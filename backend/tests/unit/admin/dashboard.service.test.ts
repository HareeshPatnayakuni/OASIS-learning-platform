import { AdminDashboardService } from '../../../src/modules/admin/dashboard.service';
import { createFakeAdminRepository } from './fakeAdminRepository';
import type { AdminCourseRecord, AdminStudentRecord, AdminTeacherRecord } from '../../../src/modules/admin/admin.types';

function buildTeacher(overrides: Partial<AdminTeacherRecord> = {}): AdminTeacherRecord {
  return {
    id: 'teacher-1',
    fullName: 'Priya Sharma',
    email: 'priya@oasis.example.com',
    phone: null,
    isActive: true,
    courseCount: 1,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function buildStudent(overrides: Partial<AdminStudentRecord> = {}): AdminStudentRecord {
  return {
    id: 'student-1',
    fullName: 'Aisha Khan',
    email: 'aisha@oasis.example.com',
    phone: null,
    isActive: true,
    enrollmentCount: 1,
    createdAt: new Date('2026-01-02'),
    ...overrides,
  };
}

function buildCourse(overrides: Partial<AdminCourseRecord> = {}): AdminCourseRecord {
  return {
    id: 'course-1',
    title: 'CBSE Class 8 Mathematics',
    slug: 'cbse-class-8-mathematics',
    status: 'PUBLISHED',
    teacher: { id: 'teacher-1', fullName: 'Priya Sharma', email: 'priya@oasis.example.com' },
    enrollmentCount: 3,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('AdminDashboardService.getDashboard', () => {
  it('aggregates counts and recent lists', async () => {
    const { repo } = createFakeAdminRepository({
      teachers: [buildTeacher()],
      students: [buildStudent(), buildStudent({ id: 'student-2', email: 'x@y.com' })],
      courses: [buildCourse()],
    });
    const service = new AdminDashboardService(repo);

    const dashboard = await service.getDashboard();

    expect(dashboard.totalTeachers).toBe(1);
    expect(dashboard.totalStudents).toBe(2);
    expect(dashboard.totalCourses).toBe(1);
    expect(dashboard.totalEnrollments).toBe(3);
    expect(dashboard.recentRegistrations.length).toBeGreaterThan(0);
  });

  it('returns zero counts for a brand-new platform with no data', async () => {
    const { repo } = createFakeAdminRepository({});
    const service = new AdminDashboardService(repo);

    const dashboard = await service.getDashboard();

    expect(dashboard.totalStudents).toBe(0);
    expect(dashboard.totalTeachers).toBe(0);
    expect(dashboard.totalCourses).toBe(0);
    expect(dashboard.totalEnrollments).toBe(0);
    expect(dashboard.recentRegistrations).toEqual([]);
    expect(dashboard.recentAnnouncements).toEqual([]);
  });
});

describe('AdminDashboardService.getAnalytics', () => {
  it('includes activeUsers and publishedCourses on top of the shared counts', async () => {
    const { repo } = createFakeAdminRepository({
      teachers: [buildTeacher()],
      students: [buildStudent()],
      courses: [buildCourse({ status: 'PUBLISHED' }), buildCourse({ id: 'course-2', status: 'DRAFT' })],
      activeSessionCount: 4,
    });
    const service = new AdminDashboardService(repo);

    const analytics = await service.getAnalytics();

    expect(analytics.activeUsers).toBe(4);
    expect(analytics.publishedCourses).toBe(1);
    expect(analytics.totalCourses).toBe(2);
  });
});
