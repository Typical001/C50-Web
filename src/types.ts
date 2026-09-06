export type UserRole = 'student' | 'admin' | 'teacher';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  createdAt: string;
  isVerified?: boolean;
  passwordHash?: string;
  verificationToken?: string;
  verificationTokenExpires?: string;
  resetPasswordToken?: string;
  resetPasswordExpires?: string;
}

export interface Batch {
  id: string;
  title: string;
  description: string;
  instructor: string;
  price: number;
  discountPrice: number;
  duration: string; // e.g., "6 Months"
  totalLectures: number;
  notesCount: number;
  language: string; // e.g., "English", "Hindi"
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  tags: string[];
  category: string;
  enrollmentCount: number;
  bannerUrl: string;
  thumbnailUrl: string;
  lastUpdated: string;
  isFree: boolean;
  isPaid?: boolean;
  paymentEnabled?: boolean;
  razorpayPaymentButtonId?: string;
  rating?: number;
  ratingCount?: number;
  customTag?: string;
}

export interface Subject {
  id: string;
  batchId: string;
  title: string;
  description: string;
}

export interface Chapter {
  id: string;
  subjectId: string;
  title: string;
  description: string;
}

export interface Lecture {
  id: string;
  chapterId: string;
  title: string;
  description: string;
  videoUrl: string; // YouTube embed or full URL
  notesUrl?: string; // PDF link
  notesTitle?: string;
  duration: string; // e.g. "45:30"
  attachments?: string[]; // extra file names or URLs
}

export interface Enrollment {
  id: string;
  userId: string;
  batchId: string;
  enrolledAt: string;
}

export interface Payment {
  id: string;
  userId: string;
  batchId: string;
  amount: number;
  status: 'pending' | 'success' | 'failed';
  razorpayPaymentId?: string;
  razorpayOrderId: string;
  createdAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'notice' | 'update' | 'maintenance' | 'course';
  authorId: string;
  createdAt: string;
  batchId?: string | null; // Null means global announcement
}

export interface Progress {
  userId: string;
  lectureId: string;
  completed: boolean;
  watchPercentage: number; // 0 to 100
  lastWatchedAt: string;
}

export interface WatchHistory {
  userId: string;
  lectureId: string;
  playbackTime: number; // in seconds
  updatedAt: string;
}

export interface DailyStreak {
  userId: string;
  streakCount: number;
  lastActiveDate: string; // YYYY-MM-DD
}

export interface DashboardStats {
  completedLectures: number;
  totalLectures: number;
  overallProgress: number; // percentage
  learningHours: number;
  dailyStreak: number;
  watchHistory: {
    lectureId: string;
    batchTitle: string;
    lectureTitle: string;
    playbackTime: number;
    updatedAt: string;
  }[];
}
