import { randomUUID } from 'node:crypto';
import { TeacherAnnouncementService } from '../../../src/modules/announcements/announcements.service';
import type {
  AnnouncementRecord,
  CreateAnnouncementInput,
  TeacherAnnouncementRepository,
  UpdateAnnouncementInput,
} from '../../../src/modules/announcements/announcements.types';
import * as ownershipLib from '../../../src/lib/ownership';

jest.mock('../../../src/lib/ownership', () => ({
  isCourseOwnedByTeacher: jest.fn(),
}));

const mockedIsCourseOwnedByTeacher = ownershipLib.isCourseOwnedByTeacher as jest.MockedFunction<
  typeof ownershipLib.isCourseOwnedByTeacher
>;

function createFakeAnnouncementRepository(
  options: {
    enrolledStudentIds?: string[];
    courses?: Array<{ id: string; title: string; slug: string }>;
    authors?: Array<{ id: string; fullName: string }>;
  } = {},
) {
  const announcements = new Map<string, AnnouncementRecord>();
  const notificationsCreated: Array<{ studentIds: string[]; announcementId: string }> = [];
  const enrolledStudentIds = options.enrolledStudentIds ?? [];
  const courseDirectory = new Map(
    (options.courses ?? [{ id: 'course-1', title: 'CBSE Class 8 Mathematics', slug: 'cbse-class-8-mathematics' }]).map(
      (c) => [c.id, c],
    ),
  );
  const authorDirectory = new Map(
    (options.authors ?? [{ id: 'teacher-1', fullName: 'Priya Sharma' }]).map((a) => [a.id, a]),
  );

  const repo: TeacherAnnouncementRepository = {
    async createAnnouncement(courseId: string, authorId: string, input: CreateAnnouncementInput) {
      const record: AnnouncementRecord = {
        id: randomUUID(),
        courseId,
        authorId,
        title: input.title,
        body: input.body,
        createdAt: new Date(),
      };
      announcements.set(record.id, record);
      return record;
    },
    async findAnnouncementById(id: string) {
      return announcements.get(id) ?? null;
    },
    async updateAnnouncement(id: string, input: UpdateAnnouncementInput) {
      const existing = announcements.get(id)!;
      const updated = { ...existing, ...input };
      announcements.set(id, updated);
      return updated;
    },
    async softDeleteAnnouncement(id: string) {
      announcements.delete(id);
    },
    async listEnrolledStudentIds() {
      return enrolledStudentIds;
    },
    async createNotificationsForStudents(studentIds: string[], announcementId: string) {
      notificationsCreated.push({ studentIds, announcementId });
    },
    async listAnnouncementsForTeacher(teacherId: string, page: number, limit: number) {
      const mine = [...announcements.values()].filter((a) => a.authorId === teacherId);
      const data = mine.slice((page - 1) * limit, page * limit).map((a) => ({
        id: a.id,
        title: a.title,
        body: a.body,
        createdAt: a.createdAt,
        course: courseDirectory.get(a.courseId) ?? { id: a.courseId, title: 'Unknown course', slug: 'unknown' },
        author: authorDirectory.get(a.authorId) ?? { id: a.authorId, fullName: 'Unknown teacher' },
      }));
      return { data, total: mine.length };
    },
  };

  return { repo, announcements, notificationsCreated };
}

const COURSE_ID = 'course-1';
const TEACHER_ID = 'teacher-1';

describe('TeacherAnnouncementService.createAnnouncement', () => {
  it('creates an announcement and fans out a notification to every enrolled student', async () => {
    mockedIsCourseOwnedByTeacher.mockResolvedValue(true);
    const { repo, notificationsCreated } = createFakeAnnouncementRepository({
      enrolledStudentIds: ['student-1', 'student-2', 'student-3'],
    });
    const service = new TeacherAnnouncementService(repo);

    const announcement = await service.createAnnouncement(COURSE_ID, TEACHER_ID, {
      title: 'Welcome!',
      body: 'Glad to have you.',
    });

    expect(notificationsCreated).toHaveLength(1);
    expect(notificationsCreated[0]?.studentIds).toEqual(['student-1', 'student-2', 'student-3']);
    expect(notificationsCreated[0]?.announcementId).toBe(announcement.id);
  });

  it('does not attempt a fan-out when no students are enrolled', async () => {
    mockedIsCourseOwnedByTeacher.mockResolvedValue(true);
    const { repo, notificationsCreated } = createFakeAnnouncementRepository({ enrolledStudentIds: [] });
    const service = new TeacherAnnouncementService(repo);

    await service.createAnnouncement(COURSE_ID, TEACHER_ID, { title: 'X', body: 'Y' });

    expect(notificationsCreated).toHaveLength(0);
  });

  it('rejects posting to a course the teacher does not own', async () => {
    mockedIsCourseOwnedByTeacher.mockResolvedValue(false);
    const { repo } = createFakeAnnouncementRepository();
    const service = new TeacherAnnouncementService(repo);

    await expect(
      service.createAnnouncement(COURSE_ID, TEACHER_ID, { title: 'X', body: 'Y' }),
    ).rejects.toMatchObject({ code: 'NOT_COURSE_OWNER', statusCode: 403 });
  });
});

describe('TeacherAnnouncementService.updateAnnouncement / deleteAnnouncement', () => {
  it('allows the author to edit their own announcement', async () => {
    mockedIsCourseOwnedByTeacher.mockResolvedValue(true);
    const { repo } = createFakeAnnouncementRepository();
    const service = new TeacherAnnouncementService(repo);
    const announcement = await service.createAnnouncement(COURSE_ID, TEACHER_ID, { title: 'Old', body: 'Y' });

    const updated = await service.updateAnnouncement(announcement.id, TEACHER_ID, { title: 'New' });
    expect(updated.title).toBe('New');
  });

  it('rejects editing by a teacher who did not author the announcement', async () => {
    mockedIsCourseOwnedByTeacher.mockResolvedValue(true);
    const { repo } = createFakeAnnouncementRepository();
    const service = new TeacherAnnouncementService(repo);
    const announcement = await service.createAnnouncement(COURSE_ID, TEACHER_ID, { title: 'X', body: 'Y' });

    await expect(
      service.updateAnnouncement(announcement.id, 'teacher-2', { title: 'Hijacked' }),
    ).rejects.toMatchObject({ code: 'NOT_ANNOUNCEMENT_AUTHOR', statusCode: 403 });
  });

  it('404s for an announcement that does not exist', async () => {
    const { repo } = createFakeAnnouncementRepository();
    const service = new TeacherAnnouncementService(repo);

    await expect(service.updateAnnouncement('nope', TEACHER_ID, { title: 'X' })).rejects.toMatchObject({
      code: 'ANNOUNCEMENT_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('soft-deletes an announcement authored by the requester', async () => {
    mockedIsCourseOwnedByTeacher.mockResolvedValue(true);
    const { repo, announcements } = createFakeAnnouncementRepository();
    const service = new TeacherAnnouncementService(repo);
    const announcement = await service.createAnnouncement(COURSE_ID, TEACHER_ID, { title: 'X', body: 'Y' });

    await service.deleteAnnouncement(announcement.id, TEACHER_ID);
    expect(announcements.has(announcement.id)).toBe(false);
  });
});

describe('TeacherAnnouncementService.listMyAnnouncements', () => {
  it('only returns announcements authored by the requesting teacher', async () => {
    mockedIsCourseOwnedByTeacher.mockResolvedValue(true);
    const { repo } = createFakeAnnouncementRepository();
    const service = new TeacherAnnouncementService(repo);
    await service.createAnnouncement(COURSE_ID, TEACHER_ID, { title: 'Mine', body: 'Y' });
    await service.createAnnouncement(COURSE_ID, 'teacher-2', { title: 'Not mine', body: 'Y' });

    const result = await service.listMyAnnouncements(TEACHER_ID);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.title).toBe('Mine');
  });

  it('includes the nested course and author objects the frontend renders (not just their IDs)', async () => {
    // Regression test: a previous version of this endpoint returned only
    // flat courseId/authorId strings, which crashed the Teacher Dashboard
    // — the shared AnnouncementList component (also used by the Student
    // Dashboard) reads announcement.course.title and
    // announcement.author.fullName directly.
    mockedIsCourseOwnedByTeacher.mockResolvedValue(true);
    const { repo } = createFakeAnnouncementRepository({
      courses: [{ id: COURSE_ID, title: 'CBSE Class 8 Mathematics', slug: 'cbse-class-8-mathematics' }],
      authors: [{ id: TEACHER_ID, fullName: 'Priya Sharma' }],
    });
    const service = new TeacherAnnouncementService(repo);
    await service.createAnnouncement(COURSE_ID, TEACHER_ID, { title: 'Reminder', body: 'Exam next week' });

    const result = await service.listMyAnnouncements(TEACHER_ID);

    expect(result.data[0]?.course).toEqual({
      id: COURSE_ID,
      title: 'CBSE Class 8 Mathematics',
      slug: 'cbse-class-8-mathematics',
    });
    expect(result.data[0]?.author).toEqual({ id: TEACHER_ID, fullName: 'Priya Sharma' });
  });
});
