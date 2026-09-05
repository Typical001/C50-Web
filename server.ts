import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { 
  User, Batch, Subject, Chapter, Lecture, 
  Enrollment, Payment, Announcement, Progress, 
  WatchHistory, DailyStreak, DashboardStats
} from './src/types.js';
import { supabase } from './src/lib/supabaseClient.js';

import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Enable CORS for admin panel requests
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// Session Secret for Crypto token signing
const SESSION_SECRET = process.env.SESSION_SECRET || 'carrier50_secure_default_secret_382910_92813';

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
    req.body = sanitizeInput(req.body);
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

// Set up larger limit for base64 file uploads (PDFs, thumbnails)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Used by Render and other hosting providers to verify the service is running.
// It intentionally does not depend on Supabase or any local file storage.
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// Directories
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Helper to serve uploaded files statically
app.use('/uploads', express.static(UPLOADS_DIR));

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

// Write default PDF files to let students download something that is real
const writeMockPdfs = () => {
  const dummyPdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources << >> /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT
/F1 12 Tf
72 712 Td
(Aura Academy Study Notes PDF - High Quality File) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000215 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
310
%%EOF`;

  const files = [
    'lec1_physics_kinematics.pdf',
    'lec2_projectile_motion.pdf',
    'lec3_friction.pdf',
    'lec4_calculus_limits.pdf',
    'lec5_react19_architecture.pdf'
  ];

  files.forEach(file => {
    const filePath = path.join(UPLOADS_DIR, file);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, dummyPdfContent);
    }
  });
};

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

// Init DB
readDb();

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
      redirectTo: `${req.headers.origin || 'http://localhost:3000'}/reset-password`
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
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ypueconmqgcgcbvqqkqf.supabase.co';
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwdWVjb25tcWdjZ2NidnFxa3FmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4OTcyMjUsImV4cCI6MjA5NjQ3MzIyNX0.lP6mkG6bUBwLd5eq-nTJvwlhh04cp0h4zCVzp_2vGw4';
    
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
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
    const { data, error } = await supabase
      .from('batches')
      .select('*')
      .eq('category', 'MPPSC')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json((data || []).map(mapBatch));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/batches/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('batches')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
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

    const { data, error } = await supabase
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
    const { data, error } = await supabase
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
    res.json(mapLecture(data));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/lectures/:id', requireAdmin, async (req, res) => {
  try {
    const { error } = await supabase
      .from('lectures')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ message: 'Lecture deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// announcements placeholder bypass
// -------------------------------------------------------------
app.post('/api/upload', requireAdmin, (req: AuthenticatedRequest, res) => {
  const { fileName, fileData } = req.body; // base64 encoded payload
  const ip = req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown';

  if (!fileName || !fileData) {
    return res.status(400).json({ error: 'Missing fileName or fileData base64.' });
  }

  try {
    // 1. Path Traversal Prevention: extract basename and sanitize special chars
    const baseName = path.basename(fileName);
    const sanitizedBase = baseName.replace(/[^a-zA-Z0-9.-]/g, '_');
    
    // 2. Strict Extension Check (Whitelisting)
    const ext = path.extname(sanitizedBase).toLowerCase();
    const allowedExtensions = ['.pdf', '.png', '.jpg', '.jpeg', '.zip'];
    
    if (!allowedExtensions.includes(ext)) {
      logSecurityEvent('WARN', 'Blocked upload attempt with insecure file extension', { fileName: baseName, ext, ip });
      return res.status(400).json({ error: 'File type blocked. Allowed types: PDF, PNG, JPG, JPEG, ZIP.' });
    }

    // 3. Prevent overwriting system files
    const safeName = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
    const filePath = path.join(UPLOADS_DIR, safeName);
    
    // 4. Base64 validation and conversion
    const parts = fileData.split(',');
    const base64Data = parts[1] || parts[0];
    
    // Simple verification that base64 is format-valid
    const base64Regex = /^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{4}|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)$/;
    const cleanBase64 = base64Data.replace(/\s/g, '');
    if (cleanBase64.length > 0 && !base64Regex.test(cleanBase64)) {
      return res.status(400).json({ error: 'Invalid base64 payload.' });
    }

    const buffer = Buffer.from(cleanBase64, 'base64');
    
    // Write the safe file to directory
    fs.writeFileSync(filePath, buffer);
    const relativeUrl = `/uploads/${safeName}`;
    
    logSecurityEvent('INFO', 'File uploaded successfully', { safeName, url: relativeUrl, uploader: req.user?.email, ip });
    
    res.json({ url: relativeUrl, message: 'File uploaded successfully' });
  } catch (err: any) {
    logSecurityEvent('ERROR', 'File upload failed', { error: err.message, ip });
    res.status(500).json({ error: 'Upload failed: ' + err.message });
  }
});


// -------------------------------------------------------------
// Enrollments & Payments (Razorpay Mockup)
// -------------------------------------------------------------
app.get('/api/enrollments/:userId', requireAuth, (req: AuthenticatedRequest, res) => {
  const { userId } = req.params;
  
  // Authorization check: User can only read their own enrollments, unless they are admin
  if (req.user?.id !== userId && req.user?.role !== 'admin') {
    logSecurityEvent('WARN', 'Unauthorized enrollment list query (ID spoofing check)', { reqUserId: req.user?.id, targetUserId: userId });
    return res.status(403).json({ error: 'Access denied. You can only view your own enrollment record.' });
  }

  const db = readDb();
  const userEnrols = db.enrollments.filter(e => e.userId === userId);
  res.json(userEnrols);
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

  const db = readDb();
  // Check if already enrolled
  const exists = db.enrollments.some(e => e.userId === userId && e.batchId === batchId);
  if (exists) {
    return res.status(400).json({ error: 'Already enrolled in this batch.' });
  }

  // Verify batch existence in Supabase first, fallback to db.json
  const { data: supabaseBatch } = await supabase.from('batches').select('id').eq('id', batchId).single();
  const localBatch = db.batches.find(b => b.id === batchId);
  if (!supabaseBatch && !localBatch) {
    return res.status(404).json({ error: 'Batch not found' });
  }

  const newEnr: Enrollment = {
    id: 'enr_' + crypto.randomBytes(5).toString('hex'),
    userId,
    batchId,
    enrolledAt: new Date().toISOString()
  };

  db.enrollments.push(newEnr);
  
  // Increment batch enrol counts
  const batchIdx = db.batches.findIndex(b => b.id === batchId);
  if (batchIdx !== -1) {
    db.batches[batchIdx].enrollmentCount += 1;
  }

  writeDb(db);
  res.json(newEnr);
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
app.post('/api/payments/verify', requireAuth, (req: AuthenticatedRequest, res) => {
  const { userId, batchId, amount, razorpayOrderId, razorpayPaymentId, signature } = req.body;
  if (!userId || !batchId || !razorpayOrderId) {
    return res.status(400).json({ error: 'Missing verification data' });
  }

  // Authorization check: User can only verify payments for themselves, unless they are admin
  if (req.user?.id !== userId && req.user?.role !== 'admin') {
    logSecurityEvent('WARN', 'Unauthorized payment verification trigger (ID spoofing check)', { reqUserId: req.user?.id, targetUserId: userId });
    return res.status(403).json({ error: 'Access denied. You cannot register payments for another user.' });
  }

  const db = readDb();
  
  const payment: Payment = {
    id: 'pay_' + crypto.randomBytes(5).toString('hex'),
    userId,
    batchId,
    amount: Number(amount),
    status: 'success',
    razorpayOrderId,
    razorpayPaymentId: razorpayPaymentId || 'pay_mock_' + crypto.randomBytes(5).toString('hex'),
    createdAt: new Date().toISOString()
  };

  db.payments.push(payment);

  // Enroll student
  const enrollmentExists = db.enrollments.some(e => e.userId === userId && e.batchId === batchId);
  if (!enrollmentExists) {
    db.enrollments.push({
      id: 'enr_' + crypto.randomBytes(5).toString('hex'),
      userId,
      batchId,
      enrolledAt: new Date().toISOString()
    });

    const batchIdx = db.batches.findIndex(b => b.id === batchId);
    if (batchIdx !== -1) {
      db.batches[batchIdx].enrollmentCount += 1;
    }
  }

  writeDb(db);
  logSecurityEvent('INFO', 'Payment verified and batch enrollment registered', { paymentId: payment.id, userId, batchId, amount });
  res.json({ success: true, payment, message: 'Payment successfully verified. Batch enrolled!' });
});

app.get('/api/payments/history/:userId', requireAuth, (req: AuthenticatedRequest, res) => {
  const { userId } = req.params;

  // Authorization check: User can only fetch their own payment ledger, unless they are admin
  if (req.user?.id !== userId && req.user?.role !== 'admin') {
    logSecurityEvent('WARN', 'Unauthorized payment ledger query (ID spoofing check)', { reqUserId: req.user?.id, targetUserId: userId });
    return res.status(403).json({ error: 'Access denied. You can only view your own payment ledger.' });
  }

  const db = readDb();
  const history = db.payments.filter(p => p.userId === userId);
  res.json(history);
});

// Admin payments overview
app.get('/api/admin/payments', requireAdmin, (req, res) => {
  const db = readDb();
  res.json(db.payments);
});


// -------------------------------------------------------------
// Progress & Streaks Endpoints
// -------------------------------------------------------------
app.get('/api/progress/:userId', requireAuth, (req: AuthenticatedRequest, res) => {
  const { userId } = req.params;

  if (req.user?.id !== userId && req.user?.role !== 'admin') {
    logSecurityEvent('WARN', 'Unauthorized progress query (ID spoofing check)', { reqUserId: req.user?.id, targetUserId: userId });
    return res.status(403).json({ error: 'Access denied. You can only query your own progress history.' });
  }

  const db = readDb();
  const prog = db.progress.filter(p => p.userId === userId);
  res.json(prog);
});

app.post('/api/progress', requireAuth, (req: AuthenticatedRequest, res) => {
  const { userId, lectureId, completed, watchPercentage } = req.body;
  if (!userId || !lectureId) return res.status(400).json({ error: 'Missing userId or lectureId' });

  if (req.user?.id !== userId && req.user?.role !== 'admin') {
    logSecurityEvent('WARN', 'Unauthorized progress save (ID spoofing check)', { reqUserId: req.user?.id, targetUserId: userId });
    return res.status(403).json({ error: 'Access denied. You cannot modify progress for another user.' });
  }

  const db = readDb();
  const idx = db.progress.findIndex(p => p.userId === userId && p.lectureId === lectureId);

  if (idx !== -1) {
    db.progress[idx].completed = completed !== undefined ? Boolean(completed) : db.progress[idx].completed;
    db.progress[idx].watchPercentage = watchPercentage !== undefined ? Number(watchPercentage) : db.progress[idx].watchPercentage;
    db.progress[idx].lastWatchedAt = new Date().toISOString();
  } else {
    db.progress.push({
      userId,
      lectureId,
      completed: Boolean(completed),
      watchPercentage: Number(watchPercentage || 0),
      lastWatchedAt: new Date().toISOString()
    });
  }

  // Update Daily Streak
  const todayStr = new Date().toISOString().split('T')[0];
  const streakIdx = db.dailyStreaks.findIndex(s => s.userId === userId);
  
  if (streakIdx !== -1) {
    const lastActive = db.dailyStreaks[streakIdx].lastActiveDate;
    if (lastActive !== todayStr) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      if (lastActive === yesterdayStr) {
        db.dailyStreaks[streakIdx].streakCount += 1;
      } else {
        db.dailyStreaks[streakIdx].streakCount = 1; // reset if missed a day
      }
      db.dailyStreaks[streakIdx].lastActiveDate = todayStr;
    }
  } else {
    db.dailyStreaks.push({
      userId,
      streakCount: 1,
      lastActiveDate: todayStr
    });
  }

  writeDb(db);
  res.json({ success: true, message: 'Progress updated.' });
});

app.get('/api/progress/:userId/stats', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { userId } = req.params;

  if (req.user?.id !== userId && req.user?.role !== 'admin') {
    logSecurityEvent('WARN', 'Unauthorized dashboard stats query (ID spoofing check)', { reqUserId: req.user?.id, targetUserId: userId });
    return res.status(403).json({ error: 'Access denied. You can only query your own dashboard statistics.' });
  }

  const db = readDb();

  // Enrollments
  const userEnrols = db.enrollments.filter(e => e.userId === userId);
  const enrolledBatchIds = userEnrols.map(e => e.batchId);

  // Count total lectures from Supabase
  let sbLecturesCount = 0;
  if (enrolledBatchIds.length > 0) {
    try {
      const { data: sbLectures } = await supabase
        .from('lectures')
        .select('id')
        .in('batch_id', enrolledBatchIds);
      if (sbLectures) {
        sbLecturesCount = sbLectures.length;
      }
    } catch (err) {
      console.error('Failed to query lectures from Supabase for stats:', err);
    }
  }

  // Lectures in enrolled batches (local db.json fallback)
  const enrolledSubjects = db.subjects.filter(s => enrolledBatchIds.includes(s.batchId));
  const enrolledSubjIds = enrolledSubjects.map(s => s.id);
  const enrolledChapters = db.chapters.filter(c => enrolledSubjIds.includes(c.subjectId));
  const enrolledChapIds = enrolledChapters.map(c => c.id);
  const localLecturesCount = db.lectures.filter(l => enrolledChapIds.includes(l.chapterId)).length;

  const totalLecturesCount = sbLecturesCount + localLecturesCount;

  // Completed Lectures
  const userProgress = db.progress.filter(p => p.userId === userId);
  const completedCount = userProgress.filter(p => p.completed).length;

  // Streak
  const streak = db.dailyStreaks.find(s => s.userId === userId)?.streakCount || 0;

  // Simulated learning hours based on completed lectures (e.g., 0.75 hours per lecture)
  const learningHours = Number((completedCount * 0.8 + userProgress.length * 0.1).toFixed(1));

  // Compose Watch History with Batch/Lecture Details
  const historyWithDetails = db.watchHistory
    .filter(h => h.userId === userId)
    .map(hist => {
      const lec = db.lectures.find(l => l.id === hist.lectureId);
      let batchTitle = 'Academy Core';
      let lectureTitle = 'Academy Lecture';
      if (lec) {
        lectureTitle = lec.title;
        const chap = db.chapters.find(c => c.id === lec.chapterId);
        const subj = db.subjects.find(s => s.id === (chap?.subjectId || ''));
        const batch = db.batches.find(b => b.id === (subj?.batchId || ''));
        if (batch) {
          batchTitle = batch.title;
        }
      }
      return {
        lectureId: hist.lectureId,
        batchTitle,
        lectureTitle,
        playbackTime: hist.playbackTime,
        updatedAt: hist.updatedAt
      };
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const stats: DashboardStats = {
    completedLectures: completedCount,
    totalLectures: totalLecturesCount || 10, // Avoid 0 denominator
    overallProgress: totalLecturesCount > 0 ? Math.round((completedCount / totalLecturesCount) * 100) : 0,
    learningHours,
    dailyStreak: streak,
    watchHistory: historyWithDetails.slice(0, 5) // Last 5
  };

  res.json(stats);
});

// Watch history updates
app.post('/api/watch-history', requireAuth, (req: AuthenticatedRequest, res) => {
  const { userId, lectureId, playbackTime } = req.body;
  if (!userId || !lectureId) return res.status(400).json({ error: 'Missing parameters' });

  if (req.user?.id !== userId && req.user?.role !== 'admin') {
    logSecurityEvent('WARN', 'Unauthorized watch-history update (ID spoofing check)', { reqUserId: req.user?.id, targetUserId: userId });
    return res.status(403).json({ error: 'Access denied. You cannot modify playback history for another user.' });
  }

  const db = readDb();
  const idx = db.watchHistory.findIndex(h => h.userId === userId && h.lectureId === lectureId);

  if (idx !== -1) {
    db.watchHistory[idx].playbackTime = Number(playbackTime);
    db.watchHistory[idx].updatedAt = new Date().toISOString();
  } else {
    db.watchHistory.push({
      userId,
      lectureId,
      playbackTime: Number(playbackTime),
      updatedAt: new Date().toISOString()
    });
  }

  writeDb(db);
  res.json({ success: true });
});


// -------------------------------------------------------------
// Announcements Endpoints
// -------------------------------------------------------------
app.get('/api/announcements', (req, res) => {
  const db = readDb();
  res.json(db.announcements.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
});

app.post('/api/announcements', requireAdmin, (req, res) => {
  const { title, content, type, batchId, authorId } = req.body;
  if (!title || !content || !type) {
    return res.status(400).json({ error: 'Missing announcement parameters' });
  }

  const db = readDb();
  const newAnn: Announcement = {
    id: 'ann_' + crypto.randomBytes(5).toString('hex'),
    title,
    content,
    type,
    authorId: authorId || 'usr_admin',
    createdAt: new Date().toISOString(),
    batchId: batchId || null
  };

  db.announcements.push(newAnn);
  writeDb(db);
  res.json(newAnn);
});

app.delete('/api/announcements/:id', requireAdmin, (req, res) => {
  const db = readDb();
  db.announcements = db.announcements.filter(a => a.id !== req.params.id);
  writeDb(db);
  res.json({ message: 'Announcement deleted' });
});


// -------------------------------------------------------------
// Global Search
// -------------------------------------------------------------
app.get('/api/search', (req, res) => {
  const query = (req.query.q as string || '').toLowerCase();
  if (!query) return res.json({ batches: [], subjects: [], lectures: [] });

  const db = readDb();
  
  const matchesBatch = db.batches.filter(b => 
    b.title.toLowerCase().includes(query) || 
    b.description.toLowerCase().includes(query) ||
    b.instructor.toLowerCase().includes(query)
  );

  const matchesSubj = db.subjects.filter(s => 
    s.title.toLowerCase().includes(query) || 
    s.description.toLowerCase().includes(query)
  );

  const matchesLec = db.lectures.filter(l => 
    l.title.toLowerCase().includes(query) || 
    l.description.toLowerCase().includes(query)
  );

  res.json({
    batches: matchesBatch,
    subjects: matchesSubj,
    lectures: matchesLec
  });
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
