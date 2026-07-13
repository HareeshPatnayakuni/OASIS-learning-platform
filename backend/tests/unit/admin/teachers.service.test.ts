import { AdminTeacherService } from '../../../src/modules/admin/teachers.service';
import { createFakeAdminRepository } from './fakeAdminRepository';
import type { AdminTeacherRecord } from '../../../src/modules/admin/admin.types';
import { AuthService } from '../../../src/modules/auth/auth.service';

const mockForgotPassword = jest.fn().mockResolvedValue(undefined);

jest.mock('../../../src/modules/auth/auth.service', () => ({
  AuthService: jest.fn().mockImplementation(() => ({
    forgotPassword: mockForgotPassword,
  })),
}));

jest.mock('../../../src/modules/auth/auth.repository', () => ({
  PrismaAuthRepository: jest.fn().mockImplementation(() => ({})),
}));

const MockedAuthService = AuthService as jest.MockedClass<typeof AuthService>;

function buildTeacher(overrides: Partial<AdminTeacherRecord> = {}): AdminTeacherRecord {
  return {
    id: 'teacher-1',
    fullName: 'Priya Sharma',
    email: 'priya@oasis.example.com',
    phone: null,
    isActive: true,
    courseCount: 0,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

beforeEach(() => {
  MockedAuthService.mockClear();
  mockForgotPassword.mockClear();
});

describe('AdminTeacherService.createTeacher', () => {
  it('creates a teacher with a hashed password', async () => {
    const { repo, teachers } = createFakeAdminRepository({});
    const service = new AdminTeacherService(repo);

    const teacher = await service.createTeacher({
      fullName: 'New Teacher',
      email: 'new@oasis.example.com',
      password: 'Password123',
    });

    expect(teacher.email).toBe('new@oasis.example.com');
    expect(teachers.has(teacher.id)).toBe(true);
  });

  it('rejects a duplicate email', async () => {
    const { repo } = createFakeAdminRepository({ teachers: [buildTeacher()] });
    const service = new AdminTeacherService(repo);

    await expect(
      service.createTeacher({ fullName: 'X', email: 'priya@oasis.example.com', password: 'Password123' }),
    ).rejects.toMatchObject({ code: 'EMAIL_TAKEN', statusCode: 400 });
  });
});

describe('AdminTeacherService.updateTeacher', () => {
  it('updates teacher details', async () => {
    const { repo } = createFakeAdminRepository({ teachers: [buildTeacher()] });
    const service = new AdminTeacherService(repo);

    const updated = await service.updateTeacher('teacher-1', { fullName: 'Priya S. Sharma' });
    expect(updated.fullName).toBe('Priya S. Sharma');
  });

  it('404s for a teacher that does not exist', async () => {
    const { repo } = createFakeAdminRepository({});
    const service = new AdminTeacherService(repo);

    await expect(service.updateTeacher('nope', { fullName: 'X' })).rejects.toMatchObject({
      code: 'TEACHER_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('rejects changing email to one already in use by someone else', async () => {
    const { repo } = createFakeAdminRepository({
      teachers: [buildTeacher(), buildTeacher({ id: 'teacher-2', email: 'other@oasis.example.com' })],
    });
    const service = new AdminTeacherService(repo);

    await expect(service.updateTeacher('teacher-2', { email: 'priya@oasis.example.com' })).rejects.toMatchObject({
      code: 'EMAIL_TAKEN',
    });
  });
});

describe('AdminTeacherService.setActive', () => {
  it('disables a teacher account', async () => {
    const { repo } = createFakeAdminRepository({ teachers: [buildTeacher({ isActive: true })] });
    const service = new AdminTeacherService(repo);

    const updated = await service.setActive('teacher-1', false);
    expect(updated.isActive).toBe(false);
  });

  it('re-enables a disabled teacher account', async () => {
    const { repo } = createFakeAdminRepository({ teachers: [buildTeacher({ isActive: false })] });
    const service = new AdminTeacherService(repo);

    const updated = await service.setActive('teacher-1', true);
    expect(updated.isActive).toBe(true);
  });

  it('404s for a teacher that does not exist', async () => {
    const { repo } = createFakeAdminRepository({});
    const service = new AdminTeacherService(repo);

    await expect(service.setActive('nope', false)).rejects.toMatchObject({
      code: 'TEACHER_NOT_FOUND',
      statusCode: 404,
    });
  });
});

describe('AdminTeacherService.resetPassword', () => {
  it('calls the real Auth module forgot-password flow with the teacher email, never a plaintext password', async () => {
    const { repo } = createFakeAdminRepository({ teachers: [buildTeacher()] });
    const service = new AdminTeacherService(repo);

    await service.resetPassword('teacher-1');

    expect(mockForgotPassword).toHaveBeenCalledWith({ email: 'priya@oasis.example.com' });
  });

  it('404s for a teacher that does not exist', async () => {
    const { repo } = createFakeAdminRepository({});
    const service = new AdminTeacherService(repo);

    await expect(service.resetPassword('nope')).rejects.toMatchObject({
      code: 'TEACHER_NOT_FOUND',
      statusCode: 404,
    });
    expect(mockForgotPassword).not.toHaveBeenCalled();
  });
});
