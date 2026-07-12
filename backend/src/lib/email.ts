import { env, isProduction } from '../config/env';
import { logger } from './logger';

/**
 * Transactional email, behind a small interface so the transport can be
 * swapped without touching any caller (auth.service.ts just calls
 * `sendEmail(...)` and doesn't know or care how it's actually delivered).
 *
 * Module 1's deployment doc names Resend/SES as the eventual provider, but
 * no credentials exist yet at this stage of the project. Rather than either
 * (a) blocking the Forgot Password / Email Verification requirements on
 * infrastructure that isn't provisioned yet, or (b) faking success silently,
 * this ships a "console transport": in any environment without SMTP_HOST
 * configured, the email is logged (at info level, full content) instead of
 * sent. The moment SMTP_HOST etc. are set, a real SMTP transport takes over
 * with zero code changes at the call sites — see the TODO below for wiring
 * an actual provider.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailTransport {
  send(message: EmailMessage): Promise<void>;
}

class ConsoleEmailTransport implements EmailTransport {
  async send(message: EmailMessage): Promise<void> {
    logger.info(
      { to: message.to, subject: message.subject, text: message.text },
      '📧 Email dispatch (console transport — no SMTP configured, see src/lib/email.ts)',
    );
    return Promise.resolve();
  }
}

// TODO(Module 3+): once R2/production infra is being wired up, add an
// SmtpEmailTransport here (nodemailer + SMTP_HOST/PORT/USER/PASSWORD from
// env) and select it below when env.SMTP_HOST is set. Deliberately not
// built now: adding an untested SMTP path with no real credentials to send
// to would be exactly the kind of premature infrastructure the Module 1
// brief warns against ("don't over-engineer the MVP").
function resolveTransport(): EmailTransport {
  if (!env.SMTP_HOST && isProduction) {
    logger.warn(
      'No SMTP_HOST configured in production — emails will only be logged, not delivered. ' +
        'Forgot Password and Email Verification will not reach real users until this is wired up.',
    );
  }
  return new ConsoleEmailTransport();
}

const transport = resolveTransport();

export async function sendEmail(message: EmailMessage): Promise<void> {
  await transport.send(message);
}

export function buildVerificationEmail(fullName: string, verifyUrl: string): EmailMessage {
  return {
    to: '', // set by caller
    subject: 'Verify your OASIS account',
    text: `Hi ${fullName},\n\nPlease verify your email address by visiting:\n${verifyUrl}\n\nThis link expires in 24 hours. If you didn't create an OASIS account, you can ignore this email.`,
    html: `<p>Hi ${fullName},</p><p>Please verify your email address by clicking the link below:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>This link expires in 24 hours. If you didn't create an OASIS account, you can ignore this email.</p>`,
  };
}

export function buildPasswordResetEmail(fullName: string, resetUrl: string): EmailMessage {
  return {
    to: '',
    subject: 'Reset your OASIS password',
    text: `Hi ${fullName},\n\nWe received a request to reset your OASIS password. Visit this link to choose a new one:\n${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, you can safely ignore this email — your password will not be changed.`,
    html: `<p>Hi ${fullName},</p><p>We received a request to reset your OASIS password. Click the link below to choose a new one:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email — your password will not be changed.</p>`,
  };
}

export function withRecipient(message: EmailMessage, to: string): EmailMessage {
  return { ...message, to };
}
