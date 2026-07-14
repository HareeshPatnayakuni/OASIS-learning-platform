import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';

/**
 * Baseline data every environment needs (Boards, Class Grades, Subjects,
 * Academy Settings — per docs/03-database-design.md §4), PLUS demo content
 * for Module 3A (a teacher, two published courses with a full syllabus, a
 * demo student enrolled in one of them with some progress already
 * recorded, and a starter Learning Streak) so the student-facing frontend
 * has something real to render without needing the Payments or
 * Teacher-authoring modules, neither of which exist yet — see
 * PROJECT_MEMORY.md §8. Idempotent — safe to re-run.
 *
 * Run with: npm run seed  (from backend/), which resolves to
 * `NODE_PATH=./node_modules tsx ../database/seed.ts` per backend/package.json
 * — the NODE_PATH is required because database/ is a sibling of backend/,
 * not a descendant, so Node can't otherwise resolve backend's
 * node_modules (this bit us for real during Module 3A — see
 * docs/08-module-3a-notes.md). The same NODE_PATH is what makes `bcrypt`
 * below resolve too.
 *
 * Demo login credentials (development/staging only — NEVER seed these
 * into a real production database):
 *   Student: student@oasis.example.com / Student@123
 *   Teacher: teacher@oasis.example.com / Teacher@123
 *   Admin:   admin@oasis.example.com / Admin@123
 * Hashed with real bcrypt (cost 12, matching
 * backend/src/modules/auth/password.util.ts exactly) — these accounts can
 * actually log in through POST /api/v1/auth/login, not just exist as rows.
 */
const prisma = new PrismaClient();
const BCRYPT_COST_FACTOR = 12; // duplicated from config/constants.ts — see note above on why this file doesn't import backend/src directly

function randomR2Key(prefix: string): string {
  return `${prefix}/${randomBytes(8).toString('hex')}`;
}

async function main(): Promise<void> {
  console.log('Seeding boards...');
  const boardSeeds = [
    { name: 'CBSE', slug: 'cbse' },
    { name: 'ICSE', slug: 'icse' },
    { name: 'State Board', slug: 'state-board' },
  ];
  for (const board of boardSeeds) {
    await prisma.board.upsert({ where: { slug: board.slug }, update: {}, create: board });
  }
  const cbse = await prisma.board.findUniqueOrThrow({ where: { slug: 'cbse' } });
  const icse = await prisma.board.findUniqueOrThrow({ where: { slug: 'icse' } });

  console.log('Seeding class grades...');
  const classGradeSeeds = [4, 5, 6, 7, 8, 9, 10].map((n) => ({
    name: `Class ${n}`,
    slug: `class-${n}`,
    order: n,
  }));
  for (const classGrade of classGradeSeeds) {
    await prisma.classGrade.upsert({ where: { slug: classGrade.slug }, update: {}, create: classGrade });
  }
  const class8 = await prisma.classGrade.findUniqueOrThrow({ where: { slug: 'class-8' } });
  const class6 = await prisma.classGrade.findUniqueOrThrow({ where: { slug: 'class-6' } });

  console.log('Seeding subjects...');
  const subjectSeeds = [
    { name: 'Mathematics', slug: 'mathematics' },
    { name: 'Science', slug: 'science' },
    { name: 'English', slug: 'english' },
  ];
  for (const subject of subjectSeeds) {
    await prisma.subject.upsert({ where: { slug: subject.slug }, update: {}, create: subject });
  }
  const mathematics = await prisma.subject.findUniqueOrThrow({ where: { slug: 'mathematics' } });
  const science = await prisma.subject.findUniqueOrThrow({ where: { slug: 'science' } });

  console.log('Seeding academy settings (singleton)...');
  const existingSettings = await prisma.academySettings.findFirst();
  if (!existingSettings) {
    await prisma.academySettings.create({
      data: {
        academyName: 'OASIS',
        tagline: 'Learn from Home. Excel Everywhere.',
        contactEmail: 'contact@oasis.example.com',
      },
    });
  }

  console.log('Seeding demo teacher, student, and admin accounts...');
  const teacherPasswordHash = await bcrypt.hash('Teacher@123', BCRYPT_COST_FACTOR);
  const studentPasswordHash = await bcrypt.hash('Student@123', BCRYPT_COST_FACTOR);
  const adminPasswordHash = await bcrypt.hash('Admin@123', BCRYPT_COST_FACTOR);

  const teacher = await prisma.user.upsert({
    where: { email: 'teacher@oasis.example.com' },
    update: {},
    create: {
      email: 'teacher@oasis.example.com',
      fullName: 'Priya Sharma',
      role: 'TEACHER',
      passwordHash: teacherPasswordHash,
      emailVerifiedAt: new Date(),
    },
  });

  const student = await prisma.user.upsert({
    where: { email: 'student@oasis.example.com' },
    update: {},
    create: {
      email: 'student@oasis.example.com',
      fullName: 'Aisha Khan',
      role: 'STUDENT',
      passwordHash: studentPasswordHash,
      emailVerifiedAt: new Date(),
      classGradeId: class8.id,
      boardId: cbse.id,
    },
  });

  // Module 3C addendum — no Admin registration flow exists (by design; see
  // docs/10-module-3c-notes.md), so a demo Admin account is seeded
  // directly, the same way the demo teacher/student accounts already are.
  await prisma.user.upsert({
    where: { email: 'admin@oasis.example.com' },
    update: {},
    create: {
      email: 'admin@oasis.example.com',
      fullName: 'OASIS Admin',
      role: 'ADMIN',
      passwordHash: adminPasswordHash,
      emailVerifiedAt: new Date(),
    },
  });

  console.log('Seeding demo courses with full syllabus...');

  const mathCourse = await prisma.course.upsert({
    where: { slug: 'cbse-class-8-mathematics-foundation' },
    update: {},
    create: {
      title: 'CBSE Class 8 Mathematics — Foundation',
      slug: 'cbse-class-8-mathematics-foundation',
      description:
        'A complete foundation course covering algebra and geometry basics for CBSE Class 8, ' +
        'taught by Priya Sharma with worked examples and chapter notes.',
      boardId: cbse.id,
      classGradeId: class8.id,
      subjectId: mathematics.id,
      teacherId: teacher.id,
      price: 999,
      status: 'PUBLISHED',
    },
  });

  const scienceCourse = await prisma.course.upsert({
    where: { slug: 'icse-class-6-science-explorer' },
    update: {},
    create: {
      title: 'ICSE Class 6 Science — Explorer',
      slug: 'icse-class-6-science-explorer',
      description: 'An introductory science course for ICSE Class 6 covering the basics of the natural world.',
      boardId: icse.id,
      classGradeId: class6.id,
      subjectId: science.id,
      teacherId: teacher.id,
      price: 799,
      status: 'PUBLISHED',
    },
  });

  // Content (chapters/modules/lectures/notes) has no natural unique key to
  // upsert against cleanly, so idempotency for the syllabus tree is
  // guarded at the course level: if this course already has a chapter,
  // assume its content was already seeded and skip re-creating it.
  const mathAlreadySeeded = await prisma.chapter.findFirst({ where: { courseId: mathCourse.id } });
  if (!mathAlreadySeeded) {
    const algebraChapter = await prisma.chapter.create({
      data: { courseId: mathCourse.id, title: 'Algebra Basics', slug: 'algebra-basics', order: 1 },
    });
    const introModule = await prisma.contentModule.create({
      data: { chapterId: algebraChapter.id, title: 'Introduction to Algebra', order: 1 },
    });
    const lecture1 = await prisma.lecture.create({
      data: {
        moduleId: introModule.id,
        title: 'What is Algebra?',
        r2ObjectKey: randomR2Key('videos/math-course/algebra-basics'),
        durationSec: 600,
        order: 1,
        status: 'PUBLISHED',
      },
    });
    const lecture2 = await prisma.lecture.create({
      data: {
        moduleId: introModule.id,
        title: 'Variables and Constants',
        r2ObjectKey: randomR2Key('videos/math-course/algebra-basics'),
        durationSec: 720,
        order: 2,
        status: 'PUBLISHED',
      },
    });
    await prisma.note.create({
      data: {
        moduleId: introModule.id,
        title: 'Chapter 1 Notes — Algebra Basics',
        r2ObjectKey: randomR2Key('notes/math-course/algebra-basics'),
        order: 1,
      },
    });

    const equationsModule = await prisma.contentModule.create({
      data: { chapterId: algebraChapter.id, title: 'Simple Equations', order: 2 },
    });
    await prisma.lecture.create({
      data: {
        moduleId: equationsModule.id,
        title: 'Solving for X',
        r2ObjectKey: randomR2Key('videos/math-course/simple-equations'),
        durationSec: 900,
        order: 1,
        status: 'PUBLISHED',
      },
    });

    const geometryChapter = await prisma.chapter.create({
      data: { courseId: mathCourse.id, title: 'Geometry Foundations', slug: 'geometry-foundations', order: 2 },
    });
    const linesModule = await prisma.contentModule.create({
      data: { chapterId: geometryChapter.id, title: 'Lines and Angles', order: 1 },
    });
    await prisma.lecture.create({
      data: {
        moduleId: linesModule.id,
        title: 'Types of Angles',
        r2ObjectKey: randomR2Key('videos/math-course/lines-and-angles'),
        durationSec: 540,
        order: 1,
        status: 'PUBLISHED',
      },
    });

    await prisma.announcement.create({
      data: {
        courseId: mathCourse.id,
        authorId: teacher.id,
        title: 'Welcome to the course!',
        body: "Hi everyone, welcome to CBSE Class 8 Mathematics — Foundation. Let's get started with Algebra Basics.",
      },
    });

    console.log('Seeding demo enrollment and progress for the demo student...');
    await prisma.enrollment.upsert({
      where: { studentId_courseId: { studentId: student.id, courseId: mathCourse.id } },
      update: {},
      create: { studentId: student.id, courseId: mathCourse.id }, // paymentId left null — see docs/03-database-design.md §2.1 on Admin/scholarship-style enrollments
    });

    await prisma.lectureProgress.upsert({
      where: { studentId_lectureId: { studentId: student.id, lectureId: lecture1.id } },
      update: {},
      create: { studentId: student.id, lectureId: lecture1.id, lastPositionSec: 600, isCompleted: true },
    });
    await prisma.lectureProgress.upsert({
      where: { studentId_lectureId: { studentId: student.id, lectureId: lecture2.id } },
      update: {},
      create: { studentId: student.id, lectureId: lecture2.id, lastPositionSec: 300, isCompleted: false },
    });

    await prisma.learningStreak.upsert({
      where: { studentId: student.id },
      update: {},
      create: { studentId: student.id, currentStreak: 3, longestStreak: 5, lastActiveDate: new Date() },
    });
  }

  const scienceAlreadySeeded = await prisma.chapter.findFirst({ where: { courseId: scienceCourse.id } });
  if (!scienceAlreadySeeded) {
    const chapter = await prisma.chapter.create({
      data: { courseId: scienceCourse.id, title: 'Getting Started', slug: 'getting-started', order: 1 },
    });
    const contentModule = await prisma.contentModule.create({
      data: { chapterId: chapter.id, title: 'What is Science?', order: 1 },
    });
    await prisma.lecture.create({
      data: {
        moduleId: contentModule.id,
        title: 'The Scientific Method',
        r2ObjectKey: randomR2Key('videos/science-course/getting-started'),
        durationSec: 480,
        order: 1,
        status: 'PUBLISHED',
      },
    });
    // Deliberately NOT enrolling the demo student in this course — it's
    // the "locked" course used to demonstrate the not-enrolled state on
    // the Course Details page and in Browse Courses.
  }

  console.log('Seed complete.');
}

main()
  .catch((err: unknown) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
