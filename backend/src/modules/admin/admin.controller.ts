import type { Request, Response } from 'express';
import { PrismaAdminRepository } from './admin.repository';
import { AdminDashboardService } from './dashboard.service';
import { AdminTeacherService } from './teachers.service';
import { AdminStudentService } from './students.service';
import { AdminCourseService } from './courses.service';
import { AdminAnnouncementService } from './announcements.service';
import { AdminSettingsService } from './settings.service';
import type {
  CourseSearchQuery,
  CreatePlatformAnnouncementBody,
  CreateTeacherBody,
  SetActiveBody,
  UpdatePlatformAnnouncementBody,
  UpdateSettingsBody,
  UpdateTeacherBody,
} from './admin.validators';

const repo = new PrismaAdminRepository();

export class AdminController {
  private readonly dashboard = new AdminDashboardService(repo);
  private readonly teachers = new AdminTeacherService(repo);
  private readonly students = new AdminStudentService(repo);
  private readonly courses = new AdminCourseService(repo);
  private readonly announcements = new AdminAnnouncementService(repo);
  private readonly settings = new AdminSettingsService(repo);

  // ── Dashboard / analytics ──────────────────────────────────────
  getDashboard = async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json({ data: await this.dashboard.getDashboard() });
  };

  getAnalytics = async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json({ data: await this.dashboard.getAnalytics() });
  };

  // ── Teachers ───────────────────────────────────────────────────
  listTeachers = async (req: Request, res: Response): Promise<void> => {
    const { q, page = 1, limit = 20 } = req.query as unknown as { q?: string; page?: number; limit?: number };
    const result = await this.teachers.listTeachers(q, page, limit);
    res.status(200).json(result);
  };

  createTeacher = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as CreateTeacherBody;
    const teacher = await this.teachers.createTeacher(body);
    res.status(201).json({ data: teacher });
  };

  updateTeacher = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    const body = req.body as UpdateTeacherBody;
    const teacher = await this.teachers.updateTeacher(id, body);
    res.status(200).json({ data: teacher });
  };

  setTeacherActive = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    const { isActive } = req.body as SetActiveBody;
    const teacher = await this.teachers.setActive(id, isActive);
    res.status(200).json({ data: teacher });
  };

  resetTeacherPassword = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    await this.teachers.resetPassword(id);
    res.status(200).json({ data: { message: 'If the account exists, a password reset email has been sent.' } });
  };

  // ── Students ───────────────────────────────────────────────────
  listStudents = async (req: Request, res: Response): Promise<void> => {
    const { q, page = 1, limit = 20 } = req.query as unknown as { q?: string; page?: number; limit?: number };
    const result = await this.students.listStudents(q, page, limit);
    res.status(200).json(result);
  };

  setStudentActive = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    const { isActive } = req.body as SetActiveBody;
    const student = await this.students.setActive(id, isActive);
    res.status(200).json({ data: student });
  };

  resetStudentPassword = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    await this.students.resetPassword(id);
    res.status(200).json({ data: { message: 'If the account exists, a password reset email has been sent.' } });
  };

  // ── Courses ────────────────────────────────────────────────────
  listCourses = async (req: Request, res: Response): Promise<void> => {
    const { q, status, page = 1, limit = 20 } = req.query as unknown as CourseSearchQuery;
    const result = await this.courses.listCourses({ q, status }, page, limit);
    res.status(200).json(result);
  };

  archiveCourse = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    const course = await this.courses.archiveCourse(id);
    res.status(200).json({ data: course });
  };

  restoreCourse = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    const course = await this.courses.restoreCourse(id);
    res.status(200).json({ data: course });
  };

  deleteCourse = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    await this.courses.deleteCourse(id);
    res.status(204).send();
  };

  // ── Platform announcements ─────────────────────────────────────
  listAnnouncements = async (req: Request, res: Response): Promise<void> => {
    const { page = 1, limit = 20 } = req.query as unknown as { page?: number; limit?: number };
    const result = await this.announcements.listAnnouncements(page, limit);
    res.status(200).json(result);
  };

  createAnnouncement = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as CreatePlatformAnnouncementBody;
    const announcement = await this.announcements.createAnnouncement(req.user!.id, body);
    res.status(201).json({ data: announcement });
  };

  updateAnnouncement = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    const body = req.body as UpdatePlatformAnnouncementBody;
    const announcement = await this.announcements.updateAnnouncement(id, body);
    res.status(200).json({ data: announcement });
  };

  deleteAnnouncement = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    await this.announcements.deleteAnnouncement(id);
    res.status(204).send();
  };

  // ── Settings ───────────────────────────────────────────────────
  getSettings = async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json({ data: await this.settings.getSettings() });
  };

  /**
   * Public counterpart to getSettings — same data, no admin auth. Added
   * to close a real gap found during Module 3C's pre-freeze verification:
   * `AcademySettings`'s own schema comment (written in Module 1) already
   * anticipated "a public GET endpoint for the frontend footer/contact
   * page", which the initial Module 3C pass built the Admin write-side
   * of but never actually exposed publicly — so the frontend had nowhere
   * to read academyName/tagline/logo/etc. from and fell back to
   * hardcoded literals. `PlatformSettings` only ever contains
   * public-facing branding/contact fields (see the schema comment) —
   * nothing sensitive to filter out before returning it here.
   */
  getPublicSettings = async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json({ data: await this.settings.getSettings() });
  };

  updateSettings = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as UpdateSettingsBody;
    const settings = await this.settings.updateSettings(req.user!.id, body);
    res.status(200).json({ data: settings });
  };
}
