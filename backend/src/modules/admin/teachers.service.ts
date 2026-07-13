import bcrypt from 'bcrypt';
import { ApiError } from '../../utils/ApiError';
import { AuthService } from '../auth/auth.service';
import { PrismaAuthRepository } from '../auth/auth.repository';
import type {
  AdminRepository,
  AdminTeacherRecord,
  CreateTeacherInput,
  UpdateTeacherInput,
} from './admin.types';

const BCRYPT_COST_FACTOR = 12; // matches auth/password.util.ts exactly

export interface TeacherListResult {
  data: AdminTeacherRecord[];
  meta: { page: number; limit: number; total: number };
}

export class AdminTeacherService {
  // Reuses Module 2's real, tested forgot-password flow (generates a
  // hashed reset token, emails a reset link) instead of inventing a
  // parallel "set password directly" mechanism — see
  // docs/10-module-3c-notes.md for why. AuthService/PrismaAuthRepository
  // are used exactly as Module 2 exports them; nothing there is modified.
  private readonly authService = new AuthService(new PrismaAuthRepository());

  constructor(private readonly repo: AdminRepository) {}

  async listTeachers(query: string | undefined, page: number, limit: number): Promise<TeacherListResult> {
    const { data, total } = await this.repo.listTeachers(query, page, limit);
    return { data, meta: { page, limit, total } };
  }

  async createTeacher(input: CreateTeacherInput): Promise<AdminTeacherRecord> {
    if (await this.repo.isEmailTaken(input.email)) {
      throw ApiError.badRequest('EMAIL_TAKEN', 'An account with this email already exists');
    }
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST_FACTOR);
    return this.repo.createTeacher({ ...input, passwordHash });
  }

  async updateTeacher(id: string, input: UpdateTeacherInput): Promise<AdminTeacherRecord> {
    await this.assertTeacherExists(id);
    if (input.email !== undefined) {
      const taken = await this.repo.isEmailTaken(input.email);
      const current = await this.repo.findTeacherById(id);
      if (taken && current?.email !== input.email) {
        throw ApiError.badRequest('EMAIL_TAKEN', 'An account with this email already exists');
      }
    }
    return this.repo.updateTeacher(id, input);
  }

  async setActive(id: string, isActive: boolean): Promise<AdminTeacherRecord> {
    await this.assertTeacherExists(id);
    await this.repo.setUserActive(id, isActive);
    return (await this.repo.findTeacherById(id))!;
  }

  async resetPassword(id: string): Promise<void> {
    const teacher = await this.assertTeacherExists(id);
    // Deliberately the same call a self-service "forgot password" makes —
    // sends a reset-link email, doesn't return or display a password
    // anywhere (a plaintext password should never transit the Admin API
    // or its response body, even a temporary one).
    await this.authService.forgotPassword({ email: teacher.email });
  }

  private async assertTeacherExists(id: string): Promise<AdminTeacherRecord> {
    const teacher = await this.repo.findTeacherById(id);
    if (!teacher) {
      throw ApiError.notFound('TEACHER_NOT_FOUND', 'Teacher not found');
    }
    return teacher;
  }
}
