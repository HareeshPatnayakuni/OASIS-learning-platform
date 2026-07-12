import { PrismaClient } from '@prisma/client';

/**
 * Baseline data every environment needs, per docs/03-database-design.md §4:
 * the 3 initial Boards, the 7 Class Grades, the 3 initial Subjects, and a
 * single placeholder AcademySettings row. Idempotent — safe to run against
 * an environment that's already been seeded (uses upsert throughout).
 *
 * Run with: npm run seed  (from backend/), which resolves to
 * `tsx ../database/seed.ts` per backend/package.json.
 */
const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('Seeding boards...');
  const boards = [
    { name: 'CBSE', slug: 'cbse' },
    { name: 'ICSE', slug: 'icse' },
    // A generic starting point — specific state boards (e.g. "Karnataka
    // State Board") are added later as additional rows, not by editing
    // this one. See docs/03-database-design.md §2.1.
    { name: 'State Board', slug: 'state-board' },
  ];
  for (const board of boards) {
    await prisma.board.upsert({
      where: { slug: board.slug },
      update: {},
      create: board,
    });
  }

  console.log('Seeding class grades...');
  const classGrades = [4, 5, 6, 7, 8, 9, 10].map((n) => ({
    name: `Class ${n}`,
    slug: `class-${n}`,
    order: n,
  }));
  for (const classGrade of classGrades) {
    await prisma.classGrade.upsert({
      where: { slug: classGrade.slug },
      update: {},
      create: classGrade,
    });
  }

  console.log('Seeding subjects...');
  const subjects = [
    { name: 'Mathematics', slug: 'mathematics' },
    { name: 'Science', slug: 'science' },
    { name: 'English', slug: 'english' },
  ];
  for (const subject of subjects) {
    await prisma.subject.upsert({
      where: { slug: subject.slug },
      update: {},
      create: subject,
    });
  }

  console.log('Seeding academy settings (singleton)...');
  const existingSettings = await prisma.academySettings.findFirst();
  if (!existingSettings) {
    await prisma.academySettings.create({
      data: {
        academyName: 'OASIS',
        tagline: 'Learn From Home. Excel Everywhere.',
        contactEmail: 'contact@oasis.example.com',
      },
    });
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
