import type { AdminRepository, AnalyticsStats, DashboardStats } from './admin.types';

const RECENT_LIST_LIMIT = 5;

export class AdminDashboardService {
  constructor(private readonly repo: AdminRepository) {}

  async getDashboard(): Promise<DashboardStats> {
    const [totalStudents, totalTeachers, totalCourses, totalEnrollments, recentRegistrations, recentAnnouncements] =
      await Promise.all([
        this.repo.countUsersByRole('STUDENT'),
        this.repo.countUsersByRole('TEACHER'),
        this.repo.countCourses(),
        this.repo.countEnrollments(),
        this.repo.listRecentRegistrations(RECENT_LIST_LIMIT),
        this.repo.listRecentAnnouncementsAcrossPlatform(RECENT_LIST_LIMIT),
      ]);

    return { totalStudents, totalTeachers, totalCourses, totalEnrollments, recentRegistrations, recentAnnouncements };
  }

  /** Deliberately a separate method (and endpoint) from getDashboard, even
   * though the two overlap heavily — the brief lists "Admin Dashboard" and
   * "Analytics" as distinct sections with slightly different fields
   * (activeUsers, publishedCourses here; recent-activity lists there).
   * Kept as two thin shapes over the same underlying counts rather than
   * inventing two different computations. */
  async getAnalytics(): Promise<AnalyticsStats> {
    const [totalStudents, totalTeachers, totalCourses, totalEnrollments, activeUsers, publishedCourses] =
      await Promise.all([
        this.repo.countUsersByRole('STUDENT'),
        this.repo.countUsersByRole('TEACHER'),
        this.repo.countCourses(),
        this.repo.countEnrollments(),
        this.repo.countActiveSessions(),
        this.repo.countPublishedCourses(),
      ]);

    return { totalStudents, totalTeachers, totalCourses, totalEnrollments, activeUsers, publishedCourses };
  }
}
