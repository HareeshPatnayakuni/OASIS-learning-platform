import type { Request, Response } from 'express';
import { PrismaAuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import type {
  ForgotPasswordInput,
  LoginInput,
  LogoutInput,
  RefreshInput,
  RegisterInput,
  ResendVerificationInput,
  ResetPasswordInput,
  VerifyEmailInput,
} from './auth.validators';

/**
 * Controllers stay thin per docs/02-architecture.md §2: parse the
 * (already-validated) request, call the service, shape the response. No
 * business logic lives here — if you're tempted to add an `if` that decides
 * whether something is *allowed*, it belongs in AuthService instead.
 */
export class AuthController {
  private readonly service = new AuthService(new PrismaAuthRepository());

  register = async (req: Request, res: Response): Promise<void> => {
    const input = req.body as RegisterInput;
    const result = await this.service.register(input);
    res.status(201).json({ data: result.user });
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const input = req.body as LoginInput;
    const result = await this.service.login(input, req.header('user-agent'));
    res.status(200).json({ data: result });
  };

  refresh = async (req: Request, res: Response): Promise<void> => {
    const input = req.body as RefreshInput;
    const tokens = await this.service.refresh(input);
    res.status(200).json({ data: tokens });
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    const input = req.body as LogoutInput;
    await this.service.logout(input.refreshToken);
    res.status(204).send();
  };

  logoutAll = async (req: Request, res: Response): Promise<void> => {
    // `authenticate` middleware guarantees req.user is set on this route.
    const userId = req.user!.id;
    await this.service.logoutAll(userId);
    res.status(204).send();
  };

  forgotPassword = async (req: Request, res: Response): Promise<void> => {
    const input = req.body as ForgotPasswordInput;
    await this.service.forgotPassword(input);
    // Same response regardless of whether the email exists — see
    // AuthService.forgotPassword for the no-enumeration rationale.
    res.status(200).json({
      data: { message: 'If an account exists for this email, a reset link has been sent.' },
    });
  };

  resetPassword = async (req: Request, res: Response): Promise<void> => {
    const input = req.body as ResetPasswordInput;
    await this.service.resetPassword(input);
    res.status(200).json({
      data: { message: 'Password updated. Please log in again on all your devices.' },
    });
  };

  verifyEmail = async (req: Request, res: Response): Promise<void> => {
    const input = req.body as VerifyEmailInput;
    await this.service.verifyEmail(input);
    res.status(200).json({ data: { message: 'Email verified successfully.' } });
  };

  resendVerification = async (req: Request, res: Response): Promise<void> => {
    const input = req.body as ResendVerificationInput;
    await this.service.resendVerification(input);
    res.status(200).json({
      data: { message: 'If an account exists for this email, a verification link has been sent.' },
    });
  };
}
