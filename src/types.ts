export interface Category {
  id?: string;
  name: string;
  access: "free" | "premium";
}

export interface SubCategory {
  id?: string;
  name: string;
  parentId: string; // References Category
}

export interface Question {
  id?: string;
  subId: string; // References SubCategory
  question: string;
  option1: string;
  option2: string;
  option3: string;
  option4: string;
  correctAnswer: number; // 1-4
  explanation: string;
  explanationImg: string;
  access: "free" | "premium";
  difficulty: "easy" | "medium" | "hard";
  examTag: string;
  year: string;
  status: "approved" | "draft";
  createdAt?: any;
  updatedAt?: any;
}

export interface Course {
  id?: string;
  title: string;
  desc: string;
  access: "free" | "premium";
  status: "running" | "all";
  live: boolean;
  price?: number;
  promoPrice?: number;
  pdfUrl?: string;
  pdfTitle?: string;
}

export interface RecentInfo {
  id?: string;
  title: string;
  description: string;
  message?: string;
  category?: string;
  pinned?: boolean;
}

export interface PremiumPlan {
  id?: string;
  name: string;
  validity: string;
  price: number;
  promoPrice?: number;
  features?: string[];
}

export interface Coupon {
  id?: string;
  code: string;
  discount: number;
}

export interface LiveExam {
  id?: string;
  title: string;
  courseId: string; // References Course
  startTime: string; // local ISO / datetime-local value
  endTime: string; // local ISO / datetime-local value
  duration: number; // minutes
  negativeMark: number;
  access: "free" | "premium";
  status: "running" | "upcoming" | "closed";
  questionIds: string[];
  createdAt?: any;
  updatedAt?: any;
}

export interface Payment {
  id?: string;
  email: string;
  planName: string;
  method: string;
  transactionId: string;
  status: "pending" | "approved" | "rejected";
  userId: string;
  createdAt: string;
  courseId?: string;
  approvedAt?: string;
  rejectedAt?: string;
}

export interface UserCourseLink {
  courseId: string;
  courseTitle: string;
  assignedAt: string;
  expiry: string;
}

export interface SuspensionLog {
  id: string;
  action: "banned" | "unbanned" | "suspended" | "deactivated" | "activated";
  reason: string;
  timestamp: string;
  operator: string;
}

export interface UserProfile {
  id?: string;
  uid: string;
  email: string;
  role: "free" | "premium" | "moderator" | "admin";
  banned?: boolean;
  premiumPlan?: string;
  premiumStart?: string;
  premiumExpiry?: string;
  ownedCourses?: UserCourseLink[];
  allowedCategories?: string[];
  suspensionHistory?: SuspensionLog[];
}

export interface ExamResult {
  id?: string;
  userId: string;
  userName?: string;
  email?: string;
  examId: string; // References LiveExam
  score: number;
  correct: number;
  wrong: number;
  createdAt: any;
}

export interface ExamRoutine {
  id?: string;
  courseId: string; // References Course
  subjectName: string;
  examDate: string; // "YYYY-MM-DD"
  examTime: string; // "HH:MM"
  duration: number; // in minutes
  totalMarks: number;
  syllabusTopic: string;
  examType: string; // e.g., "সাপ্তাহিক", "ডেইলি", "মাসিক", "ফাইনাল", "special"
  roomNo: string;
  instructor: string;
  status: "active" | "postponed" | "completed";
  remarks: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface AdminActivityLog {
  id?: string;
  adminEmail: string;
  action: string;
  details: string;
  timestamp: any;
}

export interface QuestionReport {
  id?: string;
  questionId: string;
  questionText?: string;
  reportType: string;
  reporterEmail: string;
  details: string;
  status: "pending" | "resolved";
  subject?: string;
  timestamp?: any;
}

export interface JobCircular {
  id?: string;
  title: string;
  vacancies: string;
  deadline: string;
  pdfUrl?: string;
  imgUrl?: string;
  createdAt?: any;
}


