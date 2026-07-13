import { prisma } from '../../lib/prisma';
import type { ChapterSearchHit, CourseSearchHit, ModuleSearchHit, SearchRepository } from './search.types';

export class PrismaSearchRepository implements SearchRepository {
  async searchCourses(query: string, limit: number): Promise<CourseSearchHit[]> {
    const rows = await prisma.course.findMany({
      where: {
        status: 'PUBLISHED',
        deletedAt: null,
        title: { contains: query, mode: 'insensitive' },
      },
      take: limit,
      select: { id: true, title: true, slug: true, thumbnail: { select: { publicUrl: true } } },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (rows as any[]).map((row) => ({
      type: 'course' as const,
      id: row.id,
      title: row.title,
      slug: row.slug,
      thumbnailUrl: row.thumbnail?.publicUrl ?? null,
    }));
  }

  async searchChapters(query: string, limit: number): Promise<ChapterSearchHit[]> {
    const rows = await prisma.chapter.findMany({
      where: {
        deletedAt: null,
        title: { contains: query, mode: 'insensitive' },
        course: { is: { status: 'PUBLISHED', deletedAt: null } },
      },
      take: limit,
      select: {
        id: true,
        title: true,
        course: { select: { id: true, title: true, slug: true } },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (rows as any[]).map((row) => ({
      type: 'chapter' as const,
      id: row.id,
      title: row.title,
      course: row.course,
    }));
  }

  async searchModules(query: string, limit: number): Promise<ModuleSearchHit[]> {
    const rows = await prisma.contentModule.findMany({
      where: {
        deletedAt: null,
        title: { contains: query, mode: 'insensitive' },
        chapter: { is: { deletedAt: null, course: { is: { status: 'PUBLISHED', deletedAt: null } } } },
      },
      take: limit,
      select: {
        id: true,
        title: true,
        chapter: {
          select: {
            id: true,
            title: true,
            course: { select: { id: true, title: true, slug: true } },
          },
        },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (rows as any[]).map((row) => ({
      type: 'module' as const,
      id: row.id,
      title: row.title,
      chapter: { id: row.chapter.id, title: row.chapter.title },
      course: row.chapter.course,
    }));
  }
}
