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

export interface ModuleWithContent {
  id: string;
  title: string;
  order: number;
  lectures: LectureSummary[];
  notes: NoteSummary[];
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
  course: { id: string; title: string; slug: string };
  author: { id: string; fullName: string };
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
