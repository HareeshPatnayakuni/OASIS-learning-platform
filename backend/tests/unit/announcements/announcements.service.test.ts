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

function createFakeAnnouncementRepository(options: { enrolledStudentIds?: string[] } = {}) {
  const announcements = new Map<string, AnnouncementRecord>();
  const notificationsCreated: Array<{ studentIds: string[]; announcementId: string }> = [];
  const enrolledStudentIds = options.enrolledStudentIds ?? [];

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
      return { data: mine.slice((page - 1) * limit, page * limit), total: mine.length };
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
});
