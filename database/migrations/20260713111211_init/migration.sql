-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'TEACHER', 'STUDENT');

-- CreateEnum
CREATE TYPE "CourseStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LectureStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "MediaPurpose" AS ENUM ('COURSE_THUMBNAIL', 'TEACHER_AVATAR', 'TESTIMONIAL_PHOTO', 'ACADEMY_LOGO', 'GENERIC');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ANNOUNCEMENT', 'PAYMENT', 'LIVE_CLASS_REMINDER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "EnquiryStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'RESOLVED', 'SPAM');

-- CreateEnum
CREATE TYPE "VerificationTokenType" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "phone" TEXT,
    "avatarId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "classGradeId" TEXT,
    "boardId" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "deviceLabel" TEXT,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boards" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_grades" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "class_grades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "classGradeId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "discountPrice" DECIMAL(10,2),
    "thumbnailId" TEXT,
    "status" "CourseStatus" NOT NULL DEFAULT 'DRAFT',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapters" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "chapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_modules" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "content_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lectures" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "r2ObjectKey" TEXT NOT NULL,
    "durationSec" INTEGER,
    "order" INTEGER NOT NULL,
    "status" "LectureStatus" NOT NULL DEFAULT 'DRAFT',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lectures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "r2ObjectKey" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quizzes" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "passPercent" INTEGER NOT NULL DEFAULT 40,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "quizzes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_options" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "question_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_attempts" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "totalMarks" INTEGER NOT NULL,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quiz_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentId" TEXT,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "razorpayOrderId" TEXT NOT NULL,
    "razorpayPaymentId" TEXT,
    "razorpaySignature" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "invoiceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lecture_progress" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "lectureId" TEXT NOT NULL,
    "lastPositionSec" INTEGER NOT NULL DEFAULT 0,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lecture_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_streaks" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastActiveDate" TIMESTAMP(3),

    CONSTRAINT "learning_streaks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "courseId" TEXT,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "announcementId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_classes" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "meetingLink" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media" (
    "id" TEXT NOT NULL,
    "purpose" "MediaPurpose" NOT NULL,
    "r2ObjectKey" TEXT NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "uploadedById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "testimonials" (
    "id" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorRole" TEXT,
    "photoId" TEXT,
    "quote" TEXT NOT NULL,
    "rating" INTEGER,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enquiries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "status" "EnquiryStatus" NOT NULL DEFAULT 'NEW',
    "respondedById" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academy_settings" (
    "id" TEXT NOT NULL,
    "academyName" TEXT NOT NULL,
    "tagline" TEXT,
    "logoId" TEXT,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "address" TEXT,
    "socialLinks" JSONB,
    "seoDefaultTitle" TEXT,
    "seoDefaultDescription" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "academy_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "VerificationTokenType" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "device_sessions_userId_deviceId_key" ON "device_sessions"("userId", "deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "boards_name_key" ON "boards"("name");

-- CreateIndex
CREATE UNIQUE INDEX "boards_slug_key" ON "boards"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "class_grades_name_key" ON "class_grades"("name");

-- CreateIndex
CREATE UNIQUE INDEX "class_grades_slug_key" ON "class_grades"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "class_grades_order_key" ON "class_grades"("order");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_name_key" ON "subjects"("name");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_slug_key" ON "subjects"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "courses_slug_key" ON "courses"("slug");

-- CreateIndex
CREATE INDEX "courses_boardId_classGradeId_subjectId_idx" ON "courses"("boardId", "classGradeId", "subjectId");

-- CreateIndex
CREATE INDEX "courses_teacherId_idx" ON "courses"("teacherId");

-- CreateIndex
CREATE INDEX "chapters_courseId_idx" ON "chapters"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "chapters_courseId_slug_key" ON "chapters"("courseId", "slug");

-- CreateIndex
CREATE INDEX "content_modules_chapterId_idx" ON "content_modules"("chapterId");

-- CreateIndex
CREATE INDEX "lectures_moduleId_idx" ON "lectures"("moduleId");

-- CreateIndex
CREATE INDEX "notes_moduleId_idx" ON "notes"("moduleId");

-- CreateIndex
CREATE INDEX "quizzes_moduleId_idx" ON "quizzes"("moduleId");

-- CreateIndex
CREATE INDEX "questions_quizId_idx" ON "questions"("quizId");

-- CreateIndex
CREATE INDEX "question_options_questionId_idx" ON "question_options"("questionId");

-- CreateIndex
CREATE INDEX "quiz_attempts_quizId_studentId_idx" ON "quiz_attempts"("quizId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_paymentId_key" ON "enrollments"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_studentId_courseId_key" ON "enrollments"("studentId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_razorpayOrderId_key" ON "payments"("razorpayOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_razorpayPaymentId_key" ON "payments"("razorpayPaymentId");

-- CreateIndex
CREATE INDEX "payments_userId_status_idx" ON "payments"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "lecture_progress_studentId_lectureId_key" ON "lecture_progress"("studentId", "lectureId");

-- CreateIndex
CREATE UNIQUE INDEX "learning_streaks_studentId_key" ON "learning_streaks"("studentId");

-- CreateIndex
CREATE INDEX "announcements_courseId_idx" ON "announcements"("courseId");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- CreateIndex
CREATE INDEX "live_classes_courseId_scheduledAt_idx" ON "live_classes"("courseId", "scheduledAt");

-- CreateIndex
CREATE INDEX "testimonials_isPublished_displayOrder_idx" ON "testimonials"("isPublished", "displayOrder");

-- CreateIndex
CREATE INDEX "enquiries_status_idx" ON "enquiries"("status");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_tokenHash_key" ON "verification_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "verification_tokens_userId_type_idx" ON "verification_tokens"("userId", "type");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_avatarId_fkey" FOREIGN KEY ("avatarId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_classGradeId_fkey" FOREIGN KEY ("classGradeId") REFERENCES "class_grades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "boards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_sessions" ADD CONSTRAINT "device_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "boards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_classGradeId_fkey" FOREIGN KEY ("classGradeId") REFERENCES "class_grades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_thumbnailId_fkey" FOREIGN KEY ("thumbnailId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_modules" ADD CONSTRAINT "content_modules_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lectures" ADD CONSTRAINT "lectures_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "content_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "content_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "content_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecture_progress" ADD CONSTRAINT "lecture_progress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecture_progress" ADD CONSTRAINT "lecture_progress_lectureId_fkey" FOREIGN KEY ("lectureId") REFERENCES "lectures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_streaks" ADD CONSTRAINT "learning_streaks_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "announcements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_classes" ADD CONSTRAINT "live_classes_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_respondedById_fkey" FOREIGN KEY ("respondedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academy_settings" ADD CONSTRAINT "academy_settings_logoId_fkey" FOREIGN KEY ("logoId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academy_settings" ADD CONSTRAINT "academy_settings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
