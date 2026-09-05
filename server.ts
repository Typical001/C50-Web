import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { 
  User, Batch, Subject, Chapter, Lecture, 
  Enrollment, Payment, Announcement, Progress, 
  WatchHistory, DailyStreak, DashboardStats
} from './src/types.js';
import 'dotenv/config';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

function requiredServerEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required server environment variable: ${name}`);
  return value;
}

const APP_URL = requiredServerEnv('APP_URL').replace(/\/$/, '');
const SUPABASE_URL = requiredServerEnv('SUPABASE_URL');
const SUPABASE_PUBLISHABLE_KEY = requiredServerEnv('SUPABASE_PUBLISHABLE_KEY');
const SESSION_SECRET = requiredServerEnv('SESSION_SECRET');
const SUPABASE_SECRET_KEY = requiredServerEnv('SUPABASE_SECRET_KEY');
const allowedOrigins = new Set(
  [APP_URL, ...(process.env.CORS_ALLOWED_ORIGINS || '').split(',')]
    .map(origin => origin.trim().replace(/\/$/, ''))
    .filter(Boolean)
);

// Only explicitly configured web origins may call this API cross-origin.
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin?.replace(/\/$/, '');
  if (origin) {
    if (!allowedOrigins.has(origin)) {
      return res.status(403).json({ error: 'Origin is not allowed.' });
    }
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

function getSupabaseAdmin() {
  return supabaseAdmin;
}

// -------------------------------------------------------------
// Security Logging System
// -------------------------------------------------------------
function logSecurityEvent(level: 'INFO' | 'WARN' | 'ERROR', event: string, details: any = {}) {
  const timestamp = new Date().toISOString();
  console.log(`[SECURITY][${level}][${timestamp}] ${event} | Details: ${JSON.stringify(details)}`);
}

// -------------------------------------------------------------
// Cryptographic Hashing and Token Signers
// -------------------------------------------------------------
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, hash] = storedHash.split(':');
  const checkHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return hash === checkHash;
}

function generateSessionToken(payload: { id: string; role: string; email: string }): string {
  const expiresAt = Date.now() + 2 * 60 * 60 * 1000; // 2 hours expiration
  const data = JSON.stringify({ ...payload, expiresAt });
  
  const cipher = crypto.createCipheriv('aes-256-cbc', crypto.scryptSync(SESSION_SECRET, 'salt-session', 32), Buffer.alloc(16, 0));
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const hmac = crypto.createHmac('sha256', SESSION_SECRET).update(encrypted).digest('hex');
  return `${encrypted}.${hmac}`;
}

function verifySessionToken(token: string): { id: string; role: string; email: string } | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encrypted, hmac] = parts;
  
  const expectedHmac = crypto.createHmac('sha256', SESSION_SECRET).update(encrypted).digest('hex');
  if (hmac !== expectedHmac) return null;
  
  try {
    const decipher = crypto.createDecipheriv('aes-256-cbc', crypto.scryptSync(SESSION_SECRET, 'salt-session', 32), Buffer.alloc(16, 0));
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    const payload = JSON.parse(decrypted);
    if (Date.now() > payload.expiresAt) {
      logSecurityEvent('WARN', 'Session expired', { userId: payload.id, email: payload.email });
      return null;
    }
    return payload;
  } catch (err) {
    logSecurityEvent('ERROR', 'Session token decryption failure', { error: String(err) });
    return null;
  }
}

// -------------------------------------------------------------
// Authentication Express Middlewares
// -------------------------------------------------------------
export interface AuthenticatedRequest extends Request {
  user?: { id: string; role: string; email: string };
}

const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  let token = '';
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.headers.cookie) {
    const match = req.headers.cookie.match(/session=([^;]+)/);
    if (match) {
      token = match[1];
    }
  }
  
  if (!token) {
    logSecurityEvent('WARN', 'Unauthorized route access attempted', { path: req.originalUrl, ip: req.ip });
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }
  
  const decoded = verifySessionToken(token);
  if (!decoded) {
    logSecurityEvent('WARN', 'Expired/Invalid session token presented', { path: req.originalUrl, ip: req.ip });
    return res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
  }
  
  req.user = decoded;
  next();
};

const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'admin') {
      logSecurityEvent('WARN', 'Forbidden administrator access attempted', { path: req.originalUrl, email: req.user?.email, ip: req.ip });
      return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
    }
    next();
  });
};

// -------------------------------------------------------------
// Rate Limiting System (Brute Force Protection)
// -------------------------------------------------------------
const authAttempts = new Map<string, { count: number; lockUntil: number }>();

const rateLimitAuth = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown';
  const now = Date.now();
  
  const record = authAttempts.get(ip);
  if (record && record.lockUntil > now) {
    const secsLeft = Math.ceil((record.lockUntil - now) / 1000);
    logSecurityEvent('WARN', 'Blocked rate limited connection', { ip, secsLeft });
    return res.status(429).json({ error: `Too many login attempts. Please try again after ${secsLeft} seconds.` });
  }
  
  next();
};

const recordFailedLogin = (ip: string) => {
  const now = Date.now();
  const record = authAttempts.get(ip) || { count: 0, lockUntil: 0 };
  
  record.count += 1;
  if (record.count >= 5) {
    record.lockUntil = now + 15 * 60 * 1000; // 15 mins lock
    record.count = 0;
    logSecurityEvent('WARN', 'IP address locked due to brute force login attempts', { ip, durationMinutes: 15 });
  }
  authAttempts.set(ip, record);
};

const clearFailedLogins = (ip: string) => {
  authAttempts.delete(ip);
};

// -------------------------------------------------------------
// Input Sanitization (XSS and script injection prevention)
// -------------------------------------------------------------
function sanitizeInput<T>(input: T): T {
  if (typeof input === 'string') {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;') as unknown as T;
  }
  if (Array.isArray(input)) {
    return input.map(item => sanitizeInput(item)) as unknown as T;
  }
  if (input !== null && typeof input === 'object') {
    const sanitizedObj: any = {};
    for (const key in input) {
      if (Object.prototype.hasOwnProperty.call(input, key)) {
        sanitizedObj[key] = sanitizeInput((input as any)[key]);
      }
    }
    return sanitizedObj as unknown as T;
  }
  return input;
}

// Global Sanitization Middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.body) {
    // FileReader sends `/api/upload` a Base64 data URI. Sanitizing that string
    // would alter valid Base64 characters such as `/`; it is instead validated
    // and stored without ever being rendered by the upload handler below.
    const rawFileData = req.path === '/api/upload' && typeof req.body.fileData === 'string'
      ? req.body.fileData
      : undefined;
    req.body = sanitizeInput(req.body);
    if (rawFileData !== undefined) {
      req.body.fileData = rawFileData;
    }
  }
  if (req.query) {
    req.query = sanitizeInput(req.query);
  }
  next();
});

// -------------------------------------------------------------
// Security Headers & Deployment Controls
// -------------------------------------------------------------
app.use((req: Request, res: Response, next: NextFunction) => {
  // HTTPS enforcement
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  if (process.env.NODE_ENV === 'production' && !isHttps) {
    return res.redirect(`https://${req.headers.host}${req.url}`);
  }

  // Security Headers (Compatible with iframe previews)
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  next();
});

// Base64 is used only by the legacy dashboard upload form. The raw upload
// limit is enforced again in `/api/upload` before data reaches Storage.
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Used by Render and other hosting providers to verify the service is running.
// It intentionally does not depend on Supabase or any local file storage.
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// Directories
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
// Initial Database Template
interface DatabaseSchema {
  users: User[];
  batches: Batch[];
  subjects: Subject[];
  chapters: Chapter[];
  lectures: Lecture[];
  enrollments: Enrollment[];
  payments: Payment[];
  announcements: Announcement[];
  progress: Progress[];
  watchHistory: WatchHistory[];
  dailyStreaks: DailyStreak[];
}

const initialDb: DatabaseSchema = {
  users: [
    {
      id: 'usr_admin',
      email: 'admin@carrier50.com',
      name: 'Dr. Alok Verma',
      role: 'admin',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
      createdAt: new Date().toISOString()
    },
    {
      id: 'usr_student',
      email: 'student@carrier50.com',
      name: 'Arjun Kumar',
      role: 'student',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
      createdAt: new Date().toISOString()
    }
  ],
  batches: [
    {
      id: 'batch_mppsc_foundation',
      title: 'MPPSC Foundation Batch (Prelims + Mains)',
      description: 'A comprehensive, structured roadmap for MPPSC Prelims & Mains. Taught by Madhya Pradesh\'s top civil services educators. Includes live lectures, handwritten notes, mock test series, and mentorship.',
      instructor: 'Dr. Alok Verma',
      price: 15000,
      discountPrice: 7499,
      duration: '12 Months',
      totalLectures: 24,
      notesCount: 15,
      language: 'Hindi/English',
      difficulty: 'Intermediate',
      tags: ['MPPSC', 'Foundation', 'Indore', 'Mains'],
      category: 'Foundation Courses',
      enrollmentCount: 4890,
      bannerUrl: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=1200',
      thumbnailUrl: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=400',
      lastUpdated: new Date().toISOString(),
      isFree: false,
      rating: 4.8,
      ratingCount: 2500,
      customTag: 'Bestseller'
    },
    {
      id: 'batch_mppsc_prelims',
      title: 'MPPSC Prelims Revision Crash Course',
      description: 'Targeted revision for MPPSC Prelims. Focused on high-yielding topics of MP GK, Polity, History, Economy, and CSAT with comprehensive daily test series.',
      instructor: 'Dr. Alok Verma',
      price: 6000,
      discountPrice: 2999,
      duration: '3 Months',
      totalLectures: 18,
      notesCount: 10,
      language: 'Hindi/English',
      difficulty: 'Beginner',
      tags: ['MPPSC', 'Prelims', 'Crash Course', 'Revision'],
      category: 'Crash Courses',
      enrollmentCount: 3200,
      bannerUrl: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&q=80&w=1200',
      thumbnailUrl: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&q=80&w=400',
      lastUpdated: new Date().toISOString(),
      isFree: false,
      rating: 4.8,
      ratingCount: 2100,
      customTag: 'Popular'
    },
    {
      id: 'batch_mppsc_mains',
      title: 'MPPSC Mains Answer Writing Program',
      description: 'Master the art of answer writing for MPPSC Mains. Covers daily answer evaluation, model answers, detailed paper discussions, and feedback from top mentors.',
      instructor: 'Prof. Sarah Vance',
      price: 8000,
      discountPrice: 3999,
      duration: '4 Months',
      totalLectures: 15,
      notesCount: 8,
      language: 'Hindi/English',
      difficulty: 'Advanced',
      tags: ['MPPSC', 'Mains', 'Answer Writing', 'Evaluation'],
      category: 'Writing Programs',
      enrollmentCount: 1250,
      bannerUrl: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&q=80&w=1200',
      thumbnailUrl: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&q=80&w=400',
      lastUpdated: new Date().toISOString(),
      isFree: false,
      rating: 4.7,
      ratingCount: 1800,
      customTag: 'New'
    },
    {
      id: 'batch_mppsc_interview',
      title: 'MPPSC Interview Guidance & Mock Panels',
      description: 'Prepare for the final stage with retired civil servants and expert panels. Includes personalized feedback, DAF analysis, and live mock interviews.',
      instructor: 'Dr. Alok Verma',
      price: 5000,
      discountPrice: 1999,
      duration: '2 Months',
      totalLectures: 8,
      notesCount: 4,
      language: 'Hindi/English',
      difficulty: 'Advanced',
      tags: ['MPPSC', 'Interview', 'Mock Panel', 'Guidance'],
      category: 'Interview Prep',
      enrollmentCount: 650,
      bannerUrl: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&q=80&w=1200',
      thumbnailUrl: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&q=80&w=400',
      lastUpdated: new Date().toISOString(),
      isFree: false,
      rating: 4.7,
      ratingCount: 1400,
      customTag: 'Premium'
    },
    {
      id: 'batch_mppsc_current',
      title: 'MPPSC Current Affairs Mastery Program',
      description: 'Weekly current affairs roundups covering Madhya Pradesh state news, budget, schemes, and national & international events specifically for MPPSC examinations.',
      instructor: 'Hitesh Choudhary',
      price: 2000,
      discountPrice: 999,
      duration: '6 Months',
      totalLectures: 12,
      notesCount: 12,
      language: 'Hindi/English',
      difficulty: 'Beginner',
      tags: ['Current Affairs', 'MP GK', 'Monthly Roundup'],
      category: 'Current Affairs',
      enrollmentCount: 2200,
      bannerUrl: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&q=80&w=1200',
      thumbnailUrl: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&q=80&w=400',
      lastUpdated: new Date().toISOString(),
      isFree: false,
      rating: 4.8,
      ratingCount: 1500,
      customTag: 'Popular'
    },
    {
      id: 'batch_mppsc_pyq',
      title: 'MPPSC Prelims PYQ Video Solutions (Free)',
      description: 'A complete archive of previous years\' MPPSC Prelims question papers with in-depth video explanations and micro-concept analysis.',
      instructor: 'Prof. Sarah Vance',
      price: 0,
      discountPrice: 0,
      duration: '1 Month',
      totalLectures: 6,
      notesCount: 6,
      language: 'Hindi/English',
      difficulty: 'Beginner',
      tags: ['PYQ', 'Free Course', 'Prelims'],
      category: 'Free Resources',
      enrollmentCount: 9500,
      bannerUrl: 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?auto=format&fit=crop&q=80&w=1200',
      thumbnailUrl: 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?auto=format&fit=crop&q=80&w=400',
      lastUpdated: new Date().toISOString(),
      isFree: true,
      rating: 4.6,
      ratingCount: 1600,
      customTag: 'Free'
    }
  ],
  subjects: [
    { id: 'subj_mppsc_gk', batchId: 'batch_mppsc_foundation', title: 'Madhya Pradesh GK & History', description: 'Comprehensive study of Madhya Pradesh\'s history, heritage, art, and prominent personalities.' },
    { id: 'subj_mppsc_polity', batchId: 'batch_mppsc_foundation', title: 'Indian Polity & Governance', description: 'Study of constitutional frameworks, state assemblies, panchayati raj, and administrative structures.' },
    { id: 'subj_mppsc_pre_gk', batchId: 'batch_mppsc_prelims', title: 'MP Specific Prelims Prep', description: 'Fast-track coverage of Madhya Pradesh geography, forest policies, and tribal culture.' },
    { id: 'subj_mppsc_pyq_subj', batchId: 'batch_mppsc_pyq', title: 'Prelims PYQs', description: 'Year-by-year video breakdown of Prelims GS Paper I.' }
  ],
  chapters: [
    { id: 'chap_mppsc_hist', subjectId: 'subj_mppsc_gk', title: 'Dynasties of Madhya Pradesh', description: 'Understanding the Bundela, Holkar, Scindia, and Gond dynasties.' },
    { id: 'chap_mppsc_panch', subjectId: 'subj_mppsc_polity', title: '73rd & 74th Amendments in MP', description: 'Local self-government structure, powers, and implementation in MP.' },
    { id: 'chap_mppsc_tribes', subjectId: 'subj_mppsc_pre_gk', title: 'Tribes & Folk Art of MP', description: 'Detailed analysis of Bhil, Gond, Korku, Sahariya tribes and their cultural impact.' },
    { id: 'chap_mppsc_pyq_2023', subjectId: 'subj_mppsc_pyq_subj', title: 'MPPSC 2023 Prelims Solutions', description: 'Full breakdown of questions and optional elimination techniques.' }
  ],
  lectures: [
    {
      id: 'lec_1',
      chapterId: 'chap_mppsc_hist',
      title: 'The Holkar Dynasty & Administration of Devi Ahilya Bai',
      description: 'First lecture on MP GK. Detailed analysis of Holkar history, capital shifting to Maheshwar, and Devi Ahilya Bai\'s administrative achievements.',
      videoUrl: 'https://www.youtube.com/embed/S2pSre7G6eU',
      notesUrl: '/uploads/lec1_physics_kinematics.pdf',
      notesTitle: 'Holkar Dynasty Hand-written Revision Notes',
      duration: '48:30',
      attachments: ['holkar_dynasty_notes.pdf', 'mppsc_mains_questions.pdf']
    },
    {
      id: 'lec_2',
      chapterId: 'chap_mppsc_panch',
      title: 'Panchayati Raj System in MP & State Election Commission',
      description: 'Key lecture on Polity. Exploring the local self-government acts in Madhya Pradesh and role of SEC in rural administration.',
      videoUrl: 'https://www.youtube.com/embed/Ke90Tje7VS0',
      notesUrl: '/uploads/lec2_projectile_motion.pdf',
      notesTitle: 'Panchayati Raj Constitutional Framework Notes',
      duration: '52:15',
      attachments: ['panchayati_raj_mcqs.pdf']
    },
    {
      id: 'lec_3',
      chapterId: 'chap_mppsc_tribes',
      title: 'Tribal Tribes of MP: Gonds, Bhils, and Sahariya Lifestyles',
      description: 'Understanding tribal distributions, folk songs, Bhagoria festival, and state schemes for tribal upliftment.',
      videoUrl: 'https://www.youtube.com/embed/zJSY8tbf_ys',
      notesUrl: '/uploads/lec3_friction.pdf',
      notesTitle: 'MP Tribal Culture & Traditions Cheat Sheet',
      duration: '38:40'
    },
    {
      id: 'lec_4',
      chapterId: 'chap_mppsc_pyq_2023',
      title: '2023 Prelims GS Paper I: Detailed Solution Part 1',
      description: 'Answering questions 1 to 50 of the 2023 MPPSC Prelims paper with deep conceptual explanations and tips.',
      videoUrl: 'https://www.youtube.com/embed/fDKe8_fEor4',
      notesUrl: '/uploads/lec4_calculus_limits.pdf',
      notesTitle: '2023 Prelims Answer Key & Explanation PDF',
      duration: '50:10'
    }
  ],
  enrollments: [
    {
      id: 'enr_1',
      userId: 'usr_student',
      batchId: 'batch_mppsc_foundation',
      enrolledAt: new Date().toISOString()
    }
  ],
  payments: [
    {
      id: 'pay_1',
      userId: 'usr_student',
      batchId: 'batch_mppsc_foundation',
      amount: 7499,
      status: 'success',
      razorpayOrderId: 'order_foundation_init',
      createdAt: new Date().toISOString()
    }
  ],
  announcements: [
    {
      id: 'ann_1',
      title: 'Welcome to Aura Academy MPPSC Platform!',
      content: 'We are thrilled to launch Aura Academy, a premium, distraction-free MPPSC preparation portal. Get started with our free PYQ solutions batch immediately. Happy Learning!',
      type: 'course',
      authorId: 'usr_admin',
      createdAt: new Date().toISOString(),
      batchId: null
    },
    {
      id: 'ann_2',
      title: 'MPPSC Foundation Batch: Devi Ahilya Bai Lecture Notes Uploaded',
      content: 'Hello Foundation Batch Aspirants, I have uploaded the comprehensive Holkar Dynasty notes. Please review them before the live doubt session tomorrow.',
      type: 'notice',
      authorId: 'usr_admin',
      createdAt: new Date().toISOString(),
      batchId: 'batch_mppsc_foundation'
    },
    {
      id: 'ann_3',
      title: 'Scheduled MPPSC Mains Model Answer Keys Release',
      content: 'We will be releasing model answer keys for the recent Mains writing program tonight at 9:00 PM. Stay tuned and check the attachments tab.',
      type: 'update',
      authorId: 'usr_admin',
      createdAt: new Date().toISOString(),
      batchId: null
    }
  ],
  progress: [
    {
      userId: 'usr_student',
      lectureId: 'lec_1',
      completed: true,
      watchPercentage: 100,
      lastWatchedAt: new Date().toISOString()
    }
  ],
  watchHistory: [
    {
      userId: 'usr_student',
      lectureId: 'lec_1',
      playbackTime: 2910,
      updatedAt: new Date().toISOString()
    }
  ],
  dailyStreaks: [
    {
      userId: 'usr_student',
      streakCount: 5,
      lastActiveDate: new Date().toISOString().split('T')[0]
    }
  ]
};

// Legacy JSON fallback calls this helper when no database exists. It is now a
// no-op: production assets are stored only in Supabase Storage.
const writeMockPdfs = () => undefined;

// Read / Write DB Functions
const readDb = (): DatabaseSchema => {
  let db: DatabaseSchema;
  if (!fs.existsSync(DB_PATH)) {
    db = initialDb;
    writeMockPdfs();
  } else {
    try {
      const raw = fs.readFileSync(DB_PATH, 'utf-8');
      db = JSON.parse(raw);
    } catch (err) {
      console.error('Error reading db, resetting to template:', err);
      db = initialDb;
    }
  }

  // Ensure default/existing users have passwords hashed and isVerified populated
  let dbUpdated = false;
  db.users.forEach(u => {
    if (!u.passwordHash) {
      if (u.id === 'usr_admin' || u.email.toLowerCase() === 'admin@carrier50.com') {
        u.passwordHash = hashPassword('admin123');
        u.isVerified = true;
      } else if (u.id === 'usr_student' || u.email.toLowerCase() === 'student@carrier50.com') {
        u.passwordHash = hashPassword('student123');
        u.isVerified = true;
      } else {
        u.passwordHash = hashPassword('Password123!');
        u.isVerified = false;
      }
      dbUpdated = true;
    }
    if (u.isVerified === undefined) {
      u.isVerified = (u.id === 'usr_admin' || u.id === 'usr_student');
      dbUpdated = true;
    }
  });

  if (dbUpdated || !fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  }

  return db;
};

const writeDb = (data: DatabaseSchema) => {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
};

// -------------------------------------------------------------
// Authentication Endpoints
// -------------------------------------------------------------
app.post('/api/auth/login', rateLimitAuth, async (req, res) => {
  const { email, password } = req.body;
  const ip = req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown';

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      logSecurityEvent('WARN', 'Failed login attempt via Supabase', { email, ip, error: authError.message });
      return res.status(401).json({ error: authError.message });
    }

    // Get user details from profiles
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError || !profile) {
      const fallbackUser = {
        id: authData.user.id,
        email: authData.user.email,
        name: authData.user.user_metadata?.name || 'Student',
        role: authData.user.user_metadata?.role || 'student',
        createdAt: authData.user.created_at,
        isVerified: true
      };
      logSecurityEvent('INFO', 'Login successful (fallback profile)', { userId: authData.user.id, email, ip });
      const token = generateSessionToken({
        id: fallbackUser.id,
        role: fallbackUser.role,
        email: fallbackUser.email || ''
      });
      return res.json({ user: fallbackUser, token, message: 'Login successful' });
    }

    const safeUser = {
      id: profile.id,
      email: email.trim(),
      name: profile.name || profile.full_name || 'Student',
      role: profile.role || 'student',
      avatarUrl: profile.avatar_url || '',
      createdAt: profile.created_at,
      isVerified: true
    };

    logSecurityEvent('INFO', 'Successful user login', { userId: profile.id, email: safeUser.email, role: safeUser.role, ip });
    const token = generateSessionToken({
      id: safeUser.id,
      role: safeUser.role,
      email: safeUser.email
    });
    res.json({ user: safeUser, token, message: 'Login successful' });
  } catch (err: any) {
    logSecurityEvent('ERROR', 'Exception in login endpoint', { error: err.message, ip });
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  const { email, password, name, role } = req.body;
  const ip = req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown';

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          name: name.trim(),
          role: role || 'student'
        }
      }
    });

    if (authError) {
      logSecurityEvent('WARN', 'Registration failed via Supabase', { email, ip, error: authError.message });
      return res.status(400).json({ error: authError.message });
    }

    const user = authData.user;
    if (!user) throw new Error('Failed to register user.');

    // Check if the email is already registered (identities will be empty)
    if (user.identities && user.identities.length === 0) {
      logSecurityEvent('WARN', 'Registration attempted for existing email', { email, ip });
      return res.status(400).json({ error: 'An account with this email address already exists. Please login instead.' });
    }

    // Fetch profile (created by trigger)
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    const safeUser = {
      id: user.id,
      email: user.email,
      name: profile?.name || name.trim(),
      role: profile?.role || role || 'student',
      avatarUrl: profile?.avatar_url || '',
      createdAt: user.created_at,
      isVerified: true
    };

    logSecurityEvent('INFO', 'New user registered', { userId: user.id, email: user.email, role: safeUser.role, ip });
    const token = generateSessionToken({
      id: safeUser.id,
      role: safeUser.role,
      email: safeUser.email || ''
    });
    res.json({ user: safeUser, token, message: 'Registration successful' });
  } catch (err: any) {
    logSecurityEvent('ERROR', 'Exception in register endpoint', { error: err.message, ip });
    res.status(500).json({ error: err.message });
  }
});

// Secure endpoint to verify email with a 6-digit code (auto-success on Supabase)
app.post('/api/auth/verify-email', (req, res) => {
  res.json({ success: true, message: 'Your email address has been successfully verified.' });
});

// Secure endpoint to request a password reset token
app.post('/api/auth/forgot-password', rateLimitAuth, async (req, res) => {
  const { email } = req.body;
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${APP_URL}/reset-password`
    });
    if (error) throw error;
    res.json({ message: 'If this email exists in our records, a secure password reset link has been dispatched.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Secure endpoint to perform password reset
app.post('/api/auth/reset-password', async (req, res) => {
  const { newPassword, token } = req.body;
  
  if (!token) {
    return res.status(400).json({ error: 'Session token is required to reset password.' });
  }

  try {
    const userClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    const { error: sessionError } = await userClient.auth.setSession({
      access_token: token,
      refresh_token: ''
    });

    if (sessionError) throw sessionError;

    const { error: updateError } = await userClient.auth.updateUser({ password: newPassword });
    if (updateError) throw updateError;

    res.json({ success: true, message: 'Your password has been successfully reset. Please log in with your new credentials.' });
  } catch (err: any) {
    logSecurityEvent('ERROR', 'Password reset failure', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});


app.post('/api/auth/update-profile', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { userId, name, avatarUrl } = req.body;

  if (req.user?.id !== userId && req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. You can only modify your own profile.' });
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        name: name ? name.trim() : undefined,
        avatar_url: avatarUrl || undefined
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    const safeUser = {
      id: data.id,
      email: req.user?.email || '',
      name: data.name || data.full_name || 'Student',
      role: data.role || 'student',
      avatarUrl: data.avatar_url || '',
      createdAt: data.created_at,
      isVerified: true
    };

    res.json({ user: safeUser, message: 'Profile updated successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
function mapBatch(b: any): Batch {
  if (!b) return b;
  return {
    id: b.id,
    title: b.title,
    description: b.description,
    instructor: b.instructor || 'Dr. Alok Verma',
    price: Number(b.price) || 0,
    discountPrice: Number(b.discount_price || b.price) || 0,
    duration: b.duration || '12 Months',
    totalLectures: Number(b.total_lectures || 0),
    notesCount: Number(b.notes_count || 0),
    language: b.language || 'Hindi/English',
    difficulty: b.difficulty || 'Intermediate',
    tags: Array.isArray(b.tags) ? b.tags : ['MPPSC'],
    category: b.category || 'MPPSC',
    enrollmentCount: Number(b.enrollment_count || 0),
    bannerUrl: b.banner_url || 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=1200',
    thumbnailUrl: b.thumbnail_url || 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=400',
    lastUpdated: b.last_updated || b.created_at || new Date().toISOString(),
    isFree: Boolean(b.is_free),
    customTag: b.custom_tag || ''
  };
}

function mapSubject(s: any): Subject {
  if (!s) return s;
  return {
    id: s.id,
    batchId: s.batch_id,
    title: s.title,
    description: s.description || ''
  };
}

function mapChapter(c: any): Chapter {
  if (!c) return c;
  return {
    id: c.id,
    subjectId: c.subject_id,
    title: c.title,
    description: c.description || ''
  };
}

function mapLecture(l: any): Lecture {
  if (!l) return l;
  return {
    id: l.id,
    chapterId: l.chapter_id,
    title: l.title,
    description: l.description || '',
    videoUrl: l.video_url || '',
    notesUrl: l.notes_url || '',
    notesTitle: l.notes_title || '',
    duration: l.duration || '45:00',
    attachments: Array.isArray(l.attachments) ? l.attachments : []
  };
}

function mapEnrollment(enrollment: any): Enrollment {
  return {
    id: enrollment.id,
    userId: enrollment.user_id,
    batchId: enrollment.batch_id,
    enrolledAt: enrollment.created_at
  };
}

function mapPayment(payment: any): Payment {
  return {
    id: payment.id,
    userId: payment.user_id,
    batchId: payment.batch_id,
    amount: Number(payment.amount) || 0,
    status: payment.status,
    razorpayOrderId: payment.gateway_order_id || '',
    razorpayPaymentId: payment.gateway_payment_id || '',
    createdAt: payment.created_at
  };
}

function mapProgress(progress: any): Progress {
  return {
    userId: progress.user_id,
    lectureId: progress.lecture_id,
    completed: Boolean(progress.completed),
    watchPercentage: Number(progress.watch_percentage) || 0,
    lastWatchedAt: progress.updated_at
  };
}

function mapAnnouncement(announcement: any): Announcement {
  return {
    id: announcement.id,
    title: announcement.title,
    content: announcement.message || '',
    type: announcement.type || 'notice',
    authorId: announcement.created_by || '',
    createdAt: announcement.created_at,
    batchId: announcement.batch_id || null
  };
}

// -------------------------------------------------------------
// Dynamic Homepage CMS Endpoints
// -------------------------------------------------------------
app.get('/api/homepage', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('homepage_settings')
      .select('*')
      .eq('id', 'mppsc_homepage')
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    res.json(data || {
      hero_title: 'Design your future with C50 Academy',
      hero_subtitle: 'Access premium lectures, complete syllabus tracking, and study notes.',
      faqs: [],
      testimonials: [],
      faculties: [],
      show_hero: true,
      show_faq: true,
      show_testimonials: true,
      show_faculty: true
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/homepage', requireAdmin, async (req, res) => {
  try {
    const { 
      hero_title, 
      hero_subtitle, 
      faqs, 
      testimonials, 
      faculties,
      show_hero,
      show_faq,
      show_testimonials,
      show_faculty
    } = req.body;
    const { data, error } = await supabase
      .from('homepage_settings')
      .upsert({
        id: 'mppsc_homepage',
        hero_title,
        hero_subtitle,
        faqs: Array.isArray(faqs) ? faqs : [],
        testimonials: Array.isArray(testimonials) ? testimonials : [],
        faculties: Array.isArray(faculties) ? faculties : [],
        show_hero: typeof show_hero === 'boolean' ? show_hero : true,
        show_faq: typeof show_faq === 'boolean' ? show_faq : true,
        show_testimonials: typeof show_testimonials === 'boolean' ? show_testimonials : true,
        show_faculty: typeof show_faculty === 'boolean' ? show_faculty : true,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Batches & CMS Endpoints
// -------------------------------------------------------------
app.get('/api/batches', async (req, res) => {
  try {
    // Server-only client; explicitly expose active catalog metadata through mapBatch.
    const { data, error } = await supabaseAdmin
      .from('batches')
      .select('*')
      .eq('category', 'MPPSC')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json((data || []).map(mapBatch));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/batches/:id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('batches')
      .select('*')
      .eq('id', req.params.id)
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Batch not found.' });
    res.json(mapBatch(data));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/batches', requireAdmin, async (req, res) => {
  try {
    const { title, description, instructor, price, discountPrice, duration, language, difficulty, thumbnailUrl, bannerUrl, isFree, customTag } = req.body;
    const { data, error } = await supabase
      .from('batches')
      .insert([{
        title,
        description,
        instructor,
        price: Number(price) || 0,
        discount_price: Number(discountPrice) || 0,
        duration,
        language,
        difficulty,
        thumbnail_url: thumbnailUrl,
        banner_url: bannerUrl,
        is_free: Boolean(isFree),
        is_paid: !isFree,
        is_active: true,
        category: 'MPPSC',
        custom_tag: customTag || null
      }])
      .select()
      .single();

    if (error) throw error;
    res.json(mapBatch(data));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/batches/:id', requireAdmin, async (req, res) => {
  try {
    const { title, description, instructor, price, discountPrice, duration, language, difficulty, thumbnailUrl, bannerUrl, isFree, customTag } = req.body;
    const { data, error } = await supabase
      .from('batches')
      .update({
        title,
        description,
        instructor,
        price: price !== undefined ? Number(price) : undefined,
        discount_price: discountPrice !== undefined ? Number(discountPrice) : undefined,
        duration,
        language,
        difficulty,
        thumbnail_url: thumbnailUrl,
        banner_url: bannerUrl,
        is_free: isFree !== undefined ? Boolean(isFree) : undefined,
        is_paid: isFree !== undefined ? !isFree : undefined,
        custom_tag: customTag || null,
        last_updated: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(mapBatch(data));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/batches/:id', requireAdmin, async (req, res) => {
  try {
    const { error } = await supabase
      .from('batches')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ message: 'Batch and associated metadata deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Subjects, Chapters, Lectures Endpoints
// -------------------------------------------------------------
app.get('/api/batches/:batchId/structure', async (req, res) => {
  const { batchId } = req.params;
  try {
    const { data: batchSubjects, error: subError } = await supabase
      .from('subjects')
      .select('*')
      .eq('batch_id', batchId);

    if (subError) throw subError;

    const structure = await Promise.all((batchSubjects || []).map(async (sub) => {
      const { data: subChapters, error: chapError } = await supabase
        .from('chapters')
        .select('*')
        .eq('subject_id', sub.id);

      if (chapError) throw chapError;

      const chaptersWithLectures = await Promise.all((subChapters || []).map(async (chap) => {
        const { data: chapLectures, error: lecError } = await supabase
          .from('lectures')
          .select('*')
          .eq('chapter_id', chap.id);

        if (lecError) throw lecError;

        return {
          ...mapChapter(chap),
          lectures: (chapLectures || []).map(mapLecture)
        };
      }));

      return {
        ...mapSubject(sub),
        chapters: chaptersWithLectures
      };
    }));

    res.json(structure);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create Subject
app.post('/api/subjects', requireAdmin, async (req, res) => {
  const { batchId, title, description } = req.body;
  if (!batchId || !title) return res.status(400).json({ error: 'Missing batchId or title' });

  try {
    const { data, error } = await supabase
      .from('subjects')
      .insert([{
        batch_id: batchId,
        title,
        description: description || ''
      }])
      .select()
      .single();

    if (error) throw error;
    res.json(mapSubject(data));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/subjects/:id', requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('subjects')
      .update({
        title: req.body.title,
        description: req.body.description
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(mapSubject(data));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/subjects/:id', requireAdmin, async (req, res) => {
  try {
    const { error } = await supabase
      .from('subjects')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ message: 'Subject deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create Chapter
app.post('/api/chapters', requireAdmin, async (req, res) => {
  const { subjectId, title, description } = req.body;
  if (!subjectId || !title) return res.status(400).json({ error: 'Missing subjectId or title' });

  try {
    const { data, error } = await supabase
      .from('chapters')
      .insert([{
        subject_id: subjectId,
        title,
        description: description || ''
      }])
      .select()
      .single();

    if (error) throw error;
    res.json(mapChapter(data));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/chapters/:id', requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('chapters')
      .update({
        title: req.body.title,
        description: req.body.description
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(mapChapter(data));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/chapters/:id', requireAdmin, async (req, res) => {
  try {
    const { error } = await supabase
      .from('chapters')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ message: 'Chapter deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create Lecture
app.post('/api/lectures', requireAdmin, async (req, res) => {
  const { chapterId, title, description, videoUrl, notesUrl, notesTitle, duration, attachments } = req.body;
  if (!chapterId || !title || !videoUrl) return res.status(400).json({ error: 'Missing required lecture parameters' });

  try {
    // Resolve batchId and subjectId from chapterId
    const { data: chap } = await supabase.from('chapters').select('subject_id').eq('id', chapterId).single();
    const { data: subj } = await supabase.from('subjects').select('batch_id').eq('id', chap.subject_id).single();

    const { data, error } = await getSupabaseAdmin()
      .from('lectures')
      .insert([{
        chapter_id: chapterId,
        subject_id: chap.subject_id,
        batch_id: subj.batch_id,
        title,
        description: description || '',
        video_url: videoUrl,
        notes_url: notesUrl || null,
        notes_title: notesTitle || null,
        duration: duration || '45:00'
      }])
      .select()
      .single();

    if (error) throw error;
    res.json(mapLecture(data));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/lectures/:id', requireAdmin, async (req, res) => {
  try {
    const admin = getSupabaseAdmin();
    const { data: existingLecture, error: existingError } = await admin
      .from('lectures')
      .select('id, notes_url')
      .eq('id', req.params.id)
      .single();
    if (existingError) throw existingError;

    const { data, error } = await admin
      .from('lectures')
      .update({
        title: req.body.title,
        description: req.body.description,
        video_url: req.body.videoUrl,
        notes_url: req.body.notesUrl,
        notes_title: req.body.notesTitle,
        duration: req.body.duration
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    if (existingLecture.notes_url && existingLecture.notes_url !== data.notes_url) {
      await deleteUnreferencedCourseAsset(existingLecture.notes_url, existingLecture.id);
    }
    res.json(mapLecture(data));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/lectures/:id', requireAdmin, async (req, res) => {
  try {
    const admin = getSupabaseAdmin();
    const { data: existingLecture, error: existingError } = await admin
      .from('lectures')
      .select('id, notes_url')
      .eq('id', req.params.id)
      .single();
    if (existingError) throw existingError;
    const { error } = await admin
      .from('lectures')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    if (existingLecture.notes_url) {
      await deleteUnreferencedCourseAsset(existingLecture.notes_url, existingLecture.id);
    }
    res.json({ message: 'Lecture deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Course asset uploads (Supabase Storage)
// -------------------------------------------------------------
const courseAssetTypes: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.zip': 'application/zip'
};
const MAX_COURSE_ASSET_BYTES = 20 * 1024 * 1024;

function getCourseAssetObjectPath(assetUrl: string): string | null {
  try {
    const url = new URL(assetUrl);
    const prefix = '/storage/v1/object/public/course-assets/';
    if (!url.pathname.startsWith(prefix)) return null;
    return decodeURIComponent(url.pathname.slice(prefix.length));
  } catch {
    return null;
  }
}

async function deleteUnreferencedCourseAsset(assetUrl: string, excludedLectureId: string): Promise<void> {
  const objectPath = getCourseAssetObjectPath(assetUrl);
  if (!objectPath) return;
  try {
    const admin = getSupabaseAdmin();
    const { count, error: referenceError } = await admin
      .from('lectures')
      .select('id', { count: 'exact', head: true })
      .eq('notes_url', assetUrl)
      .neq('id', excludedLectureId);
    if (referenceError) throw referenceError;
    if ((count ?? 0) > 0) return;
    const { error: removeError } = await admin.storage.from('course-assets').remove([objectPath]);
    if (removeError) throw removeError;
  } catch (error: any) {
    // The lecture change has already succeeded; retain an orphan rather than
    // failing a valid CMS action. The event is available for operator cleanup.
    logSecurityEvent('ERROR', 'Course asset cleanup failed', { assetUrl, error: error.message });
  }
}

function hasExpectedCourseAssetSignature(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === 'application/pdf') return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  if (mimeType === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === 'image/jpeg') return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === 'application/zip') return buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))
    || buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
    || buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x07, 0x08]));
  return false;
}

app.post('/api/upload', requireAdmin, async (req: AuthenticatedRequest, res) => {
  const { fileName, fileData } = req.body; // base64 encoded payload
  const ip = req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown';

  if (!fileName || !fileData) {
    return res.status(400).json({ error: 'Missing fileName or fileData base64.' });
  }

  try {
    // 1. Extract a safe extension; the Storage object name never uses user input.
    const baseName = path.basename(fileName);
    const sanitizedBase = baseName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const ext = path.extname(sanitizedBase).toLowerCase();
    const expectedMimeType = courseAssetTypes[ext];
    if (!expectedMimeType) {
      logSecurityEvent('WARN', 'Blocked upload attempt with insecure file extension', { fileName: baseName, ext, ip });
      return res.status(400).json({ error: 'File type blocked. Allowed types: PDF, PNG, JPG, JPEG, ZIP.' });
    }

    // 2. Accept only a well-formed Base64 data URI whose declared MIME type
    // agrees with the filename extension.
    const dataUriMatch = /^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(fileData);
    if (!dataUriMatch || dataUriMatch[1] !== expectedMimeType) {
      return res.status(400).json({ error: 'File content type does not match the filename extension.' });
    }
    const base64Regex = /^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{4}|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)$/;
    const cleanBase64 = dataUriMatch[2].replace(/\s/g, '');
    if (!cleanBase64 || !base64Regex.test(cleanBase64)) {
      return res.status(400).json({ error: 'Invalid base64 payload.' });
    }
    const buffer = Buffer.from(cleanBase64, 'base64');
    if (!buffer.length || buffer.length > MAX_COURSE_ASSET_BYTES) {
      return res.status(400).json({ error: 'File must be between 1 byte and 20 MiB.' });
    }
    if (!hasExpectedCourseAssetSignature(buffer, expectedMimeType)) {
      return res.status(400).json({ error: 'File contents do not match the declared file type.' });
    }

    // 3. A server-only service key performs the Storage operation. Every
    // object has an unguessable, immutable path and is read via its public URL.
    const objectPath = `course-assets/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}${ext}`;
    const storage = getSupabaseAdmin().storage.from('course-assets');
    const { error: uploadError } = await storage.upload(objectPath, buffer, {
      contentType: expectedMimeType,
      cacheControl: '31536000',
      upsert: false
    });
    if (uploadError) throw uploadError;
    const { data: publicUrlData } = storage.getPublicUrl(objectPath);
    const publicUrl = publicUrlData.publicUrl;
    
    logSecurityEvent('INFO', 'File uploaded to Supabase Storage', { objectPath, uploader: req.user?.email, ip });
    
    res.status(201).json({ url: publicUrl, path: objectPath, message: 'File uploaded successfully' });
  } catch (err: any) {
    logSecurityEvent('ERROR', 'File upload failed', { error: err.message, ip });
    res.status(500).json({ error: 'Upload failed: ' + err.message });
  }
});


// -------------------------------------------------------------
// Enrollments & Payments (Razorpay Mockup)
// -------------------------------------------------------------
app.get('/api/enrollments/:userId', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { userId } = req.params;
  
  // Authorization check: User can only read their own enrollments, unless they are admin
  if (req.user?.id !== userId && req.user?.role !== 'admin') {
    logSecurityEvent('WARN', 'Unauthorized enrollment list query (ID spoofing check)', { reqUserId: req.user?.id, targetUserId: userId });
    return res.status(403).json({ error: 'Access denied. You can only view your own enrollment record.' });
  }

  try {
    const { data, error } = await getSupabaseAdmin()
      .from('enrollments')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json((data || []).map(mapEnrollment));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Manual enrollment or free enrollment
app.post('/api/enrollments', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { userId, batchId } = req.body;
  if (!userId || !batchId) return res.status(400).json({ error: 'Missing userId or batchId' });

  // Authorization check: User can only enroll themselves, unless they are admin
  if (req.user?.id !== userId && req.user?.role !== 'admin') {
    logSecurityEvent('WARN', 'Unauthorized self-enrollment trigger (ID spoofing check)', { reqUserId: req.user?.id, targetUserId: userId });
    return res.status(403).json({ error: 'Access denied. You cannot trigger enrollment for another user.' });
  }

  try {
    const database = getSupabaseAdmin();
    const { data: batch, error: batchError } = await database
      .from('batches')
      .select('id, is_paid, is_active')
      .eq('id', batchId)
      .single();
    if (batchError || !batch) return res.status(404).json({ error: 'Batch not found.' });
    if (batch.is_paid || !batch.is_active) {
      return res.status(400).json({ error: 'Only active free batches can be enrolled through this endpoint.' });
    }

    const { data, error } = await database
      .from('enrollments')
      .insert({ user_id: userId, batch_id: batchId, access_type: 'free', status: 'active' })
      .select()
      .single();
    if (error?.code === '23505') return res.status(400).json({ error: 'Already enrolled in this batch.' });
    if (error) throw error;
    res.json(mapEnrollment(data));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Razorpay Order Mock
app.post('/api/payments/create-order', requireAuth, (req, res) => {
  const { batchId, amount } = req.body;
  if (!batchId) return res.status(400).json({ error: 'Missing batchId' });

  const orderId = 'order_' + crypto.randomBytes(6).toString('hex');
  res.json({
    id: orderId,
    amount: amount || 0,
    currency: 'INR',
    message: 'Razorpay order generated successfully'
  });
});

// Razorpay Payment Verification
app.post('/api/payments/verify', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { userId, batchId, amount, razorpayOrderId, razorpayPaymentId, signature } = req.body;
  if (!userId || !batchId || !razorpayOrderId) {
    return res.status(400).json({ error: 'Missing verification data' });
  }

  // Authorization check: User can only verify payments for themselves, unless they are admin
  if (req.user?.id !== userId && req.user?.role !== 'admin') {
    logSecurityEvent('WARN', 'Unauthorized payment verification trigger (ID spoofing check)', { reqUserId: req.user?.id, targetUserId: userId });
    return res.status(403).json({ error: 'Access denied. You cannot register payments for another user.' });
  }

  try {
    const database = getSupabaseAdmin();
    const { data: payment, error: paymentError } = await database
      .from('payments')
      .insert({
        user_id: userId,
        batch_id: batchId,
        amount: Number(amount),
        status: 'success',
        payment_gateway: 'razorpay',
        gateway_order_id: razorpayOrderId,
        gateway_payment_id: razorpayPaymentId || null
      })
      .select()
      .single();
    if (paymentError) throw paymentError;

    const { error: enrollmentError } = await database
      .from('enrollments')
      .upsert({ user_id: userId, batch_id: batchId, access_type: 'paid', status: 'active' }, { onConflict: 'user_id,batch_id' });
    if (enrollmentError) throw enrollmentError;

    logSecurityEvent('INFO', 'Mock payment recorded and batch enrollment registered', { paymentId: payment.id, userId, batchId, amount });
    res.json({ success: true, payment: mapPayment(payment), message: 'Payment recorded. Razorpay signature verification will be enabled in Step 6.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/payments/history/:userId', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { userId } = req.params;

  // Authorization check: User can only fetch their own payment ledger, unless they are admin
  if (req.user?.id !== userId && req.user?.role !== 'admin') {
    logSecurityEvent('WARN', 'Unauthorized payment ledger query (ID spoofing check)', { reqUserId: req.user?.id, targetUserId: userId });
    return res.status(403).json({ error: 'Access denied. You can only view your own payment ledger.' });
  }

  try {
    const { data, error } = await getSupabaseAdmin()
      .from('payments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json((data || []).map(mapPayment));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin payments overview
app.get('/api/admin/payments', requireAdmin, async (req, res) => {
  try {
    const { data, error } = await getSupabaseAdmin().from('payments').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json((data || []).map(mapPayment));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// -------------------------------------------------------------
// Progress & Streaks Endpoints
// -------------------------------------------------------------
app.get('/api/progress/:userId', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { userId } = req.params;

  if (req.user?.id !== userId && req.user?.role !== 'admin') {
    logSecurityEvent('WARN', 'Unauthorized progress query (ID spoofing check)', { reqUserId: req.user?.id, targetUserId: userId });
    return res.status(403).json({ error: 'Access denied. You can only query your own progress history.' });
  }

  try {
    const { data, error } = await getSupabaseAdmin()
      .from('lecture_progress')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    res.json((data || []).map(mapProgress));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/progress', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { userId, lectureId, completed, watchPercentage } = req.body;
  if (!userId || !lectureId) return res.status(400).json({ error: 'Missing userId or lectureId' });

  if (req.user?.id !== userId && req.user?.role !== 'admin') {
    logSecurityEvent('WARN', 'Unauthorized progress save (ID spoofing check)', { reqUserId: req.user?.id, targetUserId: userId });
    return res.status(403).json({ error: 'Access denied. You cannot modify progress for another user.' });
  }

  try {
    const database = getSupabaseAdmin();
    const safePercentage = Math.max(0, Math.min(100, Math.round(Number(watchPercentage) || 0)));
    const { error: progressError } = await database
      .from('lecture_progress')
      .upsert({
        user_id: userId,
        lecture_id: lectureId,
        completed: Boolean(completed),
        watch_percentage: safePercentage,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,lecture_id' });
    if (progressError) throw progressError;

    const today = new Date().toISOString().slice(0, 10);
    const { data: existingStreak, error: streakReadError } = await database
      .from('daily_streaks')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (streakReadError) throw streakReadError;

    if (!existingStreak) {
      const { error } = await database.from('daily_streaks').insert({ user_id: userId, streak_count: 1, last_active_date: today });
      if (error) throw error;
    } else if (existingStreak.last_active_date !== today) {
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const yesterdayDate = yesterday.toISOString().slice(0, 10);
      const nextCount = existingStreak.last_active_date === yesterdayDate ? existingStreak.streak_count + 1 : 1;
      const { error } = await database
        .from('daily_streaks')
        .update({ streak_count: nextCount, last_active_date: today, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
      if (error) throw error;
    }

    res.json({ success: true, message: 'Progress updated.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/progress/:userId/stats', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { userId } = req.params;

  if (req.user?.id !== userId && req.user?.role !== 'admin') {
    logSecurityEvent('WARN', 'Unauthorized dashboard stats query (ID spoofing check)', { reqUserId: req.user?.id, targetUserId: userId });
    return res.status(403).json({ error: 'Access denied. You can only query your own dashboard statistics.' });
  }

  try {
    const database = getSupabaseAdmin();
    const { data: enrollments, error: enrollmentError } = await database
      .from('enrollments').select('batch_id').eq('user_id', userId).eq('status', 'active');
    if (enrollmentError) throw enrollmentError;
    const batchIds = (enrollments || []).map(enrollment => enrollment.batch_id);

    const [progressResult, streakResult, historyResult, lectureResult] = await Promise.all([
      database.from('lecture_progress').select('*').eq('user_id', userId),
      database.from('daily_streaks').select('streak_count').eq('user_id', userId).maybeSingle(),
      database.from('watch_history').select('*').eq('user_id', userId).order('updated_at', { ascending: false }).limit(5),
      batchIds.length ? database.from('lectures').select('id, title, batch_id').in('batch_id', batchIds) : Promise.resolve({ data: [], error: null })
    ]);
    if (progressResult.error || streakResult.error || historyResult.error || lectureResult.error) {
      throw progressResult.error || streakResult.error || historyResult.error || lectureResult.error;
    }

    const lectures = lectureResult.data || [];
    const lectureById = new Map(lectures.map(lecture => [lecture.id, lecture]));
    const usedBatchIds = [...new Set(lectures.map(lecture => lecture.batch_id))];
    const { data: batches, error: batchesError } = usedBatchIds.length
      ? await database.from('batches').select('id, title').in('id', usedBatchIds)
      : { data: [], error: null };
    if (batchesError) throw batchesError;
    const batchTitleById = new Map((batches || []).map(batch => [batch.id, batch.title]));

    const progress = progressResult.data || [];
    const completedCount = progress.filter(item => item.completed).length;
    const stats: DashboardStats = {
      completedLectures: completedCount,
      totalLectures: lectures.length,
      overallProgress: lectures.length ? Math.round((completedCount / lectures.length) * 100) : 0,
      learningHours: Number((completedCount * 0.8 + progress.length * 0.1).toFixed(1)),
      dailyStreak: streakResult.data?.streak_count || 0,
      watchHistory: (historyResult.data || []).map(item => {
        const lecture = lectureById.get(item.lecture_id);
        return {
          lectureId: item.lecture_id,
          batchTitle: lecture ? batchTitleById.get(lecture.batch_id) || 'Academy Core' : 'Academy Core',
          lectureTitle: lecture?.title || 'Academy Lecture',
          playbackTime: item.playback_seconds,
          updatedAt: item.updated_at
        };
      })
    };
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Watch history updates
app.post('/api/watch-history', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { userId, lectureId, playbackTime } = req.body;
  if (!userId || !lectureId) return res.status(400).json({ error: 'Missing parameters' });

  if (req.user?.id !== userId && req.user?.role !== 'admin') {
    logSecurityEvent('WARN', 'Unauthorized watch-history update (ID spoofing check)', { reqUserId: req.user?.id, targetUserId: userId });
    return res.status(403).json({ error: 'Access denied. You cannot modify playback history for another user.' });
  }

  try {
    const { error } = await getSupabaseAdmin().from('watch_history').upsert({
      user_id: userId,
      lecture_id: lectureId,
      playback_seconds: Math.max(0, Math.round(Number(playbackTime) || 0)),
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,lecture_id' });
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// -------------------------------------------------------------
// Announcements Endpoints
// -------------------------------------------------------------
app.get('/api/announcements', async (req, res) => {
  try {
    const { data, error } = await getSupabaseAdmin().from('announcements').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json((data || []).map(mapAnnouncement));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/announcements', requireAdmin, async (req: AuthenticatedRequest, res) => {
  const { title, content, type, batchId, authorId } = req.body;
  if (!title || !content || !type) {
    return res.status(400).json({ error: 'Missing announcement parameters' });
  }

  try {
    const { data, error } = await getSupabaseAdmin().from('announcements').insert({
      title,
      message: content,
      type,
      batch_id: batchId || null,
      created_by: req.user?.id || authorId || null
    }).select().single();
    if (error) throw error;
    res.json(mapAnnouncement(data));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/announcements/:id', requireAdmin, async (req, res) => {
  try {
    const { error } = await getSupabaseAdmin().from('announcements').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Announcement deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// -------------------------------------------------------------
// Global Search
// -------------------------------------------------------------
app.get('/api/search', async (req, res) => {
  const query = (req.query.q as string || '').trim();
  if (!query) return res.json({ batches: [], subjects: [], lectures: [] });

  try {
    const pattern = `%${query.replace(/[%_]/g, '\\$&')}%`;
    const database = getSupabaseAdmin();
    const [batches, subjects, lectures] = await Promise.all([
      database.from('batches').select('*').or(`title.ilike.${pattern},description.ilike.${pattern},instructor.ilike.${pattern}`).limit(20),
      database.from('subjects').select('*').or(`title.ilike.${pattern},description.ilike.${pattern}`).limit(20),
      database.from('lectures').select('*').or(`title.ilike.${pattern},description.ilike.${pattern}`).limit(20)
    ]);
    if (batches.error || subjects.error || lectures.error) throw batches.error || subjects.error || lectures.error;
    res.json({
      batches: (batches.data || []).map(mapBatch),
      subjects: (subjects.data || []).map(mapSubject),
      lectures: (lectures.data || []).map(mapLecture)
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// -------------------------------------------------------------
// Vite Dev & Production Serving Middleware Setup
// -------------------------------------------------------------
const startServer = async () => {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Aura LMS] Server running on http://localhost:${PORT}`);
  });
};

startServer().catch(err => {
  console.error('[Aura LMS] Failed to start server:', err);
});
