import { prisma } from '../../lib/prisma';
import type {
  AnnouncementItem,
  ContinueWatchingItem,
  UpdateProfileInput,
  UserProfile,
  UsersRepository,
} from './users.types';

const profileSelect = {
  id: true,
  fullName: true,
  email: true,
  role: true,
  phone: true,
  emailVerifiedAt: true,
  createdAt: true,
  avatar: { select: { publicUrl: true } },
  classGrade: { select: { id: true, name: true, slug: true } },
  board: { select: { id: true, name: true, slug: true } },
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProfile(row: any): UserProfile {
  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    role: row.role,
    phone: row.phone,
    avatarUrl: row.avatar?.publicUrl ?? null,
    classGrade: row.classGrade,
    board: row.board,
    emailVerifiedAt: row.emailVerifiedAt,
    createdAt: row.createdAt,
  };
}

export class PrismaUsersRepository implements UsersRepository {
  async findProfileById(userId: string): Promise<UserProfile | null> {
    const row = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: profileSelect,
    });
    return row ? mapProfile(row) : null;
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<UserProfile> {
    const data: Record<string, unknown> = {};
    if (input.fullName !== undefined) data.fullName = input.fullName;
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.classGradeId !== undefined) data.classGradeId = input.classGradeId;
    if (input.boardId !== undefined) data.boardId = input.boardId;

    const row = await prisma.user.update({
      where: { id: userId },
      data,
      select: profileSelect,
    });
    return mapProfile(row);
  }

  async listContinueWatching(studentId: string, limit: number): Promise<ContinueWatchingItem[]> {
    const rows = await prisma.lectureProgress.findMany({
      where: {
        studentId,
        isCompleted: false,
        lastPositionSec: { gt: 0 },
        lecture: { deletedAt: null, status: 'PUBLISHED' },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: {
        lastPositionSec: true,
        updatedAt: true,
        lecture: {
          select: {
            id: true,
            title: true,
            durationSec: true,
            module: {
              select: {
                id: true,
                title: true,
                chapter: {
                  select: {
                    id: true,
                    title: true,
                    slug: true,
                    course: {
                      select: { id: true, title: true, slug: true, thumbnail: { select: { publicUrl: true } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (rows as any[]).map((row) => ({
      lecture: { id: row.lecture.id, title: row.lecture.title, durationSec: row.lecture.durationSec },
      lastPositionSec: row.lastPositionSec,
      module: { id: row.lecture.module.id, title: row.lecture.module.title },
      chapter: {
        id: row.lecture.module.chapter.id,
        title: row.lecture.module.chapter.title,
        slug: row.lecture.module.chapter.slug,
      },
      course: {
        id: row.lecture.module.chapter.course.id,
        title: row.lecture.module.chapter.course.title,
        slug: row.lecture.module.chapter.course.slug,
        thumbnailUrl: row.lecture.module.chapter.course.thumbnail?.publicUrl ?? null,
      },
      updatedAt: row.updatedAt,
    }));
  }

  async listAnnouncementsForStudent(
    studentId: string,
    page: number,
    limit: number,
  ): Promise<{ data: AnnouncementItem[]; total: number }> {
    const where = {
      deletedAt: null,
      course: { is: { enrollments: { some: { studentId } } } },
    };

    const [rows, total] = await Promise.all([
      prisma.announcement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          title: true,
          body: true,
          createdAt: true,
          course: { select: { id: true, title: true, slug: true } },
          author: { select: { id: true, fullName: true } },
        },
      }),
      prisma.announcement.count({ where }),
    ]);

    return {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      data: (rows as any[]).map((row) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        createdAt: row.createdAt,
        course: row.course,
        author: row.author,
      })),
      total,
    };
  }
}
