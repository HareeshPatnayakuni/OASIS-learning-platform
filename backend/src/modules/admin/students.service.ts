import { ApiError } from '../../utils/ApiError';
import { AuthService } from '../auth/auth.service';
import { PrismaAuthRepository } from '../auth/auth.repository';
import type { AdminRepository, AdminStudentRecord } from './admin.types';

export interface StudentListResult {
  data: AdminStudentRecord[];
  meta: { page: number; limit: number; total: number };
}

export class AdminStudentService {
  private readonly authService = new AuthService(new PrismaAuthRepository());

  constructor(private readonly repo: AdminRepository) {}

  async listStudents(query: string | undefined, page: number, limit: number): Promise<StudentListResult> {
    const { data, total } = await this.repo.listStudents(query, page, limit);
    return { data, meta: { page, limit, total } };
  }

  async setActive(id: string, isActive: boolean): Promise<AdminStudentRecord> {
    await this.assertStudentExists(id);
    await this.repo.setUserActive(id, isActive);
    return (await this.repo.findStudentById(id))!;
  }

  async resetPassword(id: string): Promise<void> {
    const student = await this.assertStudentExists(id);
    await this.authService.forgotPassword({ email: student.email });
  }

  private async assertStudentExists(id: string): Promise<AdminStudentRecord> {
    const student = await this.repo.findStudentById(id);
    if (!student) {
      throw ApiError.notFound('STUDENT_NOT_FOUND', 'Student not found');
    }
    return student;
  }
}
