/**
 * Types that mirror the backend's public API contracts
 * (backend/src/modules/auth/auth.types.ts, docs/04-api-design.md). Kept in
 * sync by hand for now — if this ever drifts enough to hurt, generating
 * these from the OpenAPI spec at /api/v1/docs.json is the natural next
 * step, not a rewrite.
 */

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'TEACHER' | 'STUDENT';

export interface PublicUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  emailVerifiedAt: string | null;
  classGradeId: string | null;
  boardId: string | null;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResult {
  user: PublicUser;
  tokens: AuthTokens;
}

// ── Catalog ──────────────────────────────────────────────────────────

export interface CatalogRef {
  id: string;
  name: string;
  slug: string;
}

export interface ClassGrade extends CatalogRef {
  order: number;
}

// ── Courses ──────────────────────────────────────────────────────────

export type CourseStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type LectureStatus = 'DRAFT' | 'PUBLISHED' | 'HIDDEN';

export interface TeacherRef {
  id: string;
  fullName: string;
}

export interface CourseListItem {
  id: string;
  title: string;
  slug: string;
  description: string;
  board: CatalogRef;
  classGrade: ClassGrade;
  subject: CatalogRef;
  teacher: TeacherRef;
  price: number;
  discountPrice: number | null;
  thumbnailUrl: string | null;
  status: CourseStatus;
}

export interface LectureProgressInfo {
  lastPositionSec: number;
  isCompleted: boolean;
}

export interface LectureSummary {
  id: string;
  title: string;
  order: number;
  durationSec: number | null;
  status: LectureStatus;
  progress: LectureProgressInfo | null;
}

export interface NoteSummary {
  id: string;
  title: string;
  order: number;
}

export interface QuizSummary {
  id: string;
  title: string;
}

export interface ModuleWithContent {
  id: string;
  title: string;
  order: number;
  lectures: LectureSummary[];
  notes: NoteSummary[];
  quizzes: QuizSummary[];
}

export interface ChapterWithModules {
  id: string;
  title: string;
  slug: string;
  order: number;
  modules: ModuleWithContent[];
}

export interface CourseDetail extends CourseListItem {
  chapters: ChapterWithModules[];
  isEnrolled: boolean;
}

// ── Payments (Module 4A) ─────────────────────────────────────────────

export type PurchaseResult =
  | { type: 'ALREADY_ENROLLED' }
  | { type: 'ENROLLED'; enrollmentId: string }
  | {
      type: 'CHECKOUT_REQUIRED';
      paymentId: string;
      razorpayOrderId: string;
      amount: number;
      currency: string;
      keyId: string;
    };

export type VerifyPaymentResult =
  | { type: 'SUCCESS'; enrollmentId: string }
  | { type: 'ALREADY_PROCESSED'; enrollmentId: string };

// ── Payment Management (Module 4B) ───────────────────────────────────

export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';

export interface PaymentListItem {
  id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  createdAt: string;
  razorpayPaymentId: string | null;
  course: { id: string; title: string; slug: string };
}

/** Superset of `PaymentListItem` — also includes the Razorpay Order ID,
 * which the list view doesn't show (matching the brief's own field
 * lists for each page). */
export interface PaymentDetail extends PaymentListItem {
  razorpayOrderId: string;
}

export interface AdminPaymentListItem {
  id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  createdAt: string;
  student: { id: string; fullName: string; email: string };
  course: { id: string; title: string; slug: string };
}

// ── Devices (Module 5) ────────────────────────────────────────────────

export interface DeviceSummary {
  deviceId: string;
  deviceLabel: string | null;
  browser: string | null;
  operatingSystem: string | null;
  lastActiveAt: string;
  isCurrentDevice: boolean;
}


// ── Content (signed URLs / progress) ────────────────────────────────

export interface SignedUrlResult {
  url: string;
  expiresInSeconds: number;
}

// ── Enrollments ──────────────────────────────────────────────────────

export interface EnrolledCourseSummary {
  enrollmentId: string;
  enrolledAt: string;
  course: CourseListItem;
  totalLectures: number;
  completedLectures: number;
  progressPercent: number;
}

// ── Users: profile, streak, continue-watching, announcements ────────

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  phone: string | null;
  avatarUrl: string | null;
  classGrade: CatalogRef | null;
  board: CatalogRef | null;
  emailVerifiedAt: string | null;
  createdAt: string;
}

export interface StreakSnapshot {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
}

export interface ContinueWatchingItem {
  lecture: { id: string; title: string; durationSec: number | null };
  lastPositionSec: number;
  module: { id: string; title: string };
  chapter: { id: string; title: string; slug: string };
  course: { id: string; title: string; slug: string; thumbnailUrl: string | null };
  updatedAt: string;
}

export interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  course?: { id: string; title: string; slug: string };
  author?: { id: string; fullName: string };
}

// ── Search ───────────────────────────────────────────────────────────

export interface CourseSearchHit {
  type: 'course';
  id: string;
  title: string;
  slug: string;
  thumbnailUrl: string | null;
}

export interface ChapterSearchHit {
  type: 'chapter';
  id: string;
  title: string;
  course: { id: string; title: string; slug: string };
}

export interface ModuleSearchHit {
  type: 'module';
  id: string;
  title: string;
  chapter: { id: string; title: string };
  course: { id: string; title: string; slug: string };
}

export interface SearchResults {
  courses: CourseSearchHit[];
  chapters: ChapterSearchHit[];
  modules: ModuleSearchHit[];
}

// ── Teacher: Course management (Module 3B) ──────────────────────────

export interface TeacherCourseSummary {
  id: string;
  title: string;
  slug: string;
  description: string;
  board: CatalogRef;
  classGrade: ClassGrade;
  subject: CatalogRef;
  teacher: TeacherRef;
  price: number;
  discountPrice: number | null;
  thumbnailUrl: string | null;
  status: CourseStatus;
  createdAt: string;
  updatedAt: string;
  enrollmentCount: number;
  totalLectures: number;
  publishedLectures: number;
}

// ── Teacher: Content management (Module 3B) ─────────────────────────

export interface TeacherChapter {
  id: string;
  courseId: string;
  title: string;
  slug: string;
  order: number;
}

export interface TeacherContentModule {
  id: string;
  chapterId: string;
  title: string;
  order: number;
}

export interface TeacherLecture {
  id: string;
  moduleId: string;
  title: string;
  order: number;
  durationSec: number | null;
  status: LectureStatus;
  r2ObjectKey: string;
}

export interface TeacherNote {
  id: string;
  moduleId: string;
  title: string;
  order: number;
  r2ObjectKey: string;
}

export interface TeacherQuizSummary {
  id: string;
  title: string;
  questionCount: number;
}

export interface TeacherModuleWithContent extends TeacherContentModule {
  lectures: TeacherLecture[];
  notes: TeacherNote[];
  quizzes: TeacherQuizSummary[];
}

export interface TeacherChapterWithContent extends TeacherChapter {
  modules: TeacherModuleWithContent[];
}

export interface UploadIssuedResult {
  uploadUrl: string;
  expiresInSeconds: number;
}

export interface CreateLectureResult {
  lecture: TeacherLecture;
  uploadUrl: string;
  expiresInSeconds: number;
}

export interface CreateNoteResult {
  note: TeacherNote;
  uploadUrl: string;
  expiresInSeconds: number;
}

// ── Teacher: Quizzes (Module 3B) ─────────────────────────────────────

export interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface QuizQuestion {
  id: string;
  text: string;
  order: number;
  options: QuestionOption[];
}

export interface QuizDetail {
  id: string;
  moduleId: string;
  title: string;
  passPercent: number;
  questions: QuizQuestion[];
}

export interface QuestionOptionDraft {
  text: string;
  isCorrect: boolean;
}

export interface QuestionDraft {
  text: string;
  options: QuestionOptionDraft[];
}

// ── Teacher: Announcements (Module 3B) ──────────────────────────────

export interface TeacherAnnouncement {
  id: string;
  courseId: string;
  authorId: string;
  title: string;
  body: string;
  createdAt: string;
}

// ── Media (Module 3B) ────────────────────────────────────────────────

export type MediaPurposeValue =
  | 'COURSE_THUMBNAIL'
  | 'TEACHER_AVATAR'
  | 'TESTIMONIAL_PHOTO'
  | 'ACADEMY_LOGO'
  | 'GENERIC';

export interface CreateMediaResult {
  id: string;
  publicUrl: string;
  uploadUrl: string;
  expiresInSeconds: number;
}

// ── Admin (Module 3C) ────────────────────────────────────────────────

export interface AdminUserSummary {
  id: string;
  fullName: string;
  email: string;
  role: 'TEACHER' | 'STUDENT';
  createdAt: string;
}

export interface AdminAnnouncementSummary {
  id: string;
  title: string;
  body: string;
  courseId: string | null;
  authorName: string;
  createdAt: string;
}

export interface DashboardStats {
  totalStudents: number;
  totalTeachers: number;
  totalCourses: number;
  totalEnrollments: number;
  recentRegistrations: AdminUserSummary[];
  recentAnnouncements: AdminAnnouncementSummary[];
}

export interface AnalyticsStats {
  totalStudents: number;
  totalTeachers: number;
  totalCourses: number;
  totalEnrollments: number;
  activeUsers: number;
  publishedCourses: number;
}

export interface AdminTeacherRecord {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  courseCount: number;
  createdAt: string;
}

export interface AdminStudentRecord {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  enrollmentCount: number;
  createdAt: string;
}

export interface AdminCourseRecord {
  id: string;
  title: string;
  slug: string;
  status: CourseStatus;
  teacher: { id: string; fullName: string; email: string };
  enrollmentCount: number;
  createdAt: string;
}

export interface PlatformSettings {
  academyName: string;
  academyFullName: string | null;
  tagline: string | null;
  contactEmail: string;
  contactPhone: string | null;
  address: string | null;
  socialLinks: Record<string, string> | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  updatedAt: string;
}

// ── Admin (Module 3C) ────────────────────────────────────────────────

export interface AdminUserSummary {
  id: string;
  fullName: string;
  email: string;
  role: 'TEACHER' | 'STUDENT';
  createdAt: string;
}

export interface AdminAnnouncementSummary {
  id: string;
  title: string;
  body: string;
  courseId: string | null;
  authorName: string;
  createdAt: string;
}

export interface DashboardStats {
  totalStudents: number;
  totalTeachers: number;
  totalCourses: number;
  totalEnrollments: number;
  recentRegistrations: AdminUserSummary[];
  recentAnnouncements: AdminAnnouncementSummary[];
}

export interface AnalyticsStats {
  totalStudents: number;
  totalTeachers: number;
  totalCourses: number;
  totalEnrollments: number;
  activeUsers: number;
  publishedCourses: number;
}

export interface AdminTeacherRecord {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  courseCount: number;
  createdAt: string;
}

export interface AdminStudentRecord {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  enrollmentCount: number;
  createdAt: string;
}

export interface AdminCourseRecord {
  id: string;
  title: string;
  slug: string;
  status: CourseStatus;
  teacher: { id: string; fullName: string; email: string };
  enrollmentCount: number;
  createdAt: string;
}

export interface PlatformSettings {
  academyName: string;
  academyFullName: string | null;
  tagline: string | null;
  contactEmail: string;
  contactPhone: string | null;
  address: string | null;
  socialLinks: Record<string, string> | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  updatedAt: string;
}

// ── Quiz Attempts (Module 6) ─────────────────────────────────────────

export interface OptionForAttempt {
  id: string;
  text: string;
}

export interface QuestionForAttempt {
  id: string;
  text: string;
  order: number;
  options: OptionForAttempt[];
}

export interface QuizForAttempt {
  id: string;
  title: string;
  passPercent: number;
  questions: QuestionForAttempt[];
}

export interface SubmittedAnswer {
  questionId: string;
  optionId: string;
}

export interface QuestionResult {
  questionId: string;
  selectedOptionId: string | null;
  correctOptionId: string;
  isCorrect: boolean;
}

export interface QuizAttemptResult {
  id: string;
  score: number;
  totalMarks: number;
  passPercent: number;
  passed: boolean;
  attemptedAt: string;
  questionResults: QuestionResult[];
}

/** What a *previous* attempt looks like when fetched later — no
 * per-question breakdown, since that's never persisted. */
export interface QuizAttemptSummary {
  id: string;
  score: number;
  totalMarks: number;
  attemptedAt: string;
}
