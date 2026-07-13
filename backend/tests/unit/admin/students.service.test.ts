import { AdminStudentService } from '../../../src/modules/admin/students.service';
import { createFakeAdminRepository } from './fakeAdminRepository';
import type { AdminStudentRecord } from '../../../src/modules/admin/admin.types';
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

function buildStudent(overrides: Partial<AdminStudentRecord> = {}): AdminStudentRecord {
  return {
    id: 'student-1',
    fullName: 'Aisha Khan',
    email: 'aisha@oasis.example.com',
    phone: null,
    isActive: true,
    enrollmentCount: 2,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

beforeEach(() => {
  MockedAuthService.mockClear();
  mockForgotPassword.mockClear();
});

describe('AdminStudentService.listStudents', () => {
  it('supports searching by name or email', async () => {
    const { repo } = createFakeAdminRepository({
      students: [buildStudent(), buildStudent({ id: 'student-2', fullName: 'Rahul Verma', email: 'rahul@x.com' })],
    });
    const service = new AdminStudentService(repo);

    const result = await service.listStudents('aisha', 1, 20);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.fullName).toBe('Aisha Khan');
  });
});

describe('AdminStudentService.setActive', () => {
  it('disables and re-enables a student account', async () => {
    const { repo } = createFakeAdminRepository({ students: [buildStudent({ isActive: true })] });
    const service = new AdminStudentService(repo);

    const disabled = await service.setActive('student-1', false);
    expect(disabled.isActive).toBe(false);

    const enabled = await service.setActive('student-1', true);
    expect(enabled.isActive).toBe(true);
  });

  it('404s for a student that does not exist', async () => {
    const { repo } = createFakeAdminRepository({});
    const service = new AdminStudentService(repo);

    await expect(service.setActive('nope', false)).rejects.toMatchObject({
      code: 'STUDENT_NOT_FOUND',
      statusCode: 404,
    });
  });
});

describe('AdminStudentService.resetPassword', () => {
  it('reuses the real Auth module forgot-password flow', async () => {
    const { repo } = createFakeAdminRepository({ students: [buildStudent()] });
    const service = new AdminStudentService(repo);

    await service.resetPassword('student-1');

    expect(mockForgotPassword).toHaveBeenCalledWith({ email: 'aisha@oasis.example.com' });
  });

  it('404s for a student that does not exist', async () => {
    const { repo } = createFakeAdminRepository({});
    const service = new AdminStudentService(repo);

    await expect(service.resetPassword('nope')).rejects.toMatchObject({ code: 'STUDENT_NOT_FOUND' });
    expect(mockForgotPassword).not.toHaveBeenCalled();
  });
});
