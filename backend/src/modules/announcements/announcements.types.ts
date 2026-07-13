/**
 * Teacher-facing announcement CRUD. Module 3A already built the
 * student-facing READ side (GET /users/me/announcements, in the `users`
 * module) — this is the write side, entirely new. Creating an
 * announcement fans out a Notification row per enrolled student, exactly
 * as Module 1 originally designed (docs/02-architecture.md §6.1,
 * "Announcement → Notification Fan-out") — Module 3A explicitly deferred
 * building this trigger since nothing could create an Announcement yet;
 * now something can, so the already-designed fan-out is wired up as part
 * of it, not a new feature of its own.
 */

export interface AnnouncementRecord {
  id: string;
  courseId: string;
  authorId: string;
  title: string;
  body: string;
  createdAt: Date;
}

export interface CreateAnnouncementInput {
  title: string;
  body: string;
}

export interface UpdateAnnouncementInput {
  title?: string;
  body?: string;
}

export interface TeacherAnnouncementRepository {
  createAnnouncement(
    courseId: string,
    authorId: string,
    input: CreateAnnouncementInput,
  ): Promise<AnnouncementRecord>;
  findAnnouncementById(id: string): Promise<AnnouncementRecord | null>;
  updateAnnouncement(id: string, input: UpdateAnnouncementInput): Promise<AnnouncementRecord>;
  softDeleteAnnouncement(id: string): Promise<void>;
  listEnrolledStudentIds(courseId: string): Promise<string[]>;
  createNotificationsForStudents(
    studentIds: string[],
    announcementId: string,
    title: string,
    body: string,
  ): Promise<void>;
  listAnnouncementsForTeacher(
    teacherId: string,
    page: number,
    limit: number,
  ): Promise<{ data: AnnouncementRecord[]; total: number }>;
}
