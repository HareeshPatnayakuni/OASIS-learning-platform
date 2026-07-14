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

/**
 * Module 3D branding note (docs/11-module-3d-notes.md): these two
 * template functions now use the official brand name/tagline/colors from
 * the OASIS Branding Package, applied as literal values here rather than
 * fetched from the AcademySettings table at send time. This is
 * deliberate, not an oversight — Module 3D's instructions explicitly say
 * "do not modify backend logic" for this module, and having
 * auth.service.ts await a Settings lookup before building an email would
 * be exactly that: a new async dependency and a new failure mode in the
 * registration/password-reset control flow. "Apply the branding to all
 * existing email templates... do not change email functionality" reads
 * as applying the now-confirmed official values as correct content, not
 * as wiring live configurability into a flow this module isn't allowed
 * to touch. No logo image is embedded, for the same reason documented in
 * docs/11-module-3d-notes.md generally: the uploaded Branding Package is
 * a set of guideline/reference boards, not the individual production
 * logo files it names, so a styled text wordmark (matching every other
 * branding surface in this app) is used instead of guessing at a cropped
 * image.
 */
const BRAND_NAME = 'OASIS';
const BRAND_TAGLINE = 'Learn from Home. Excel Everywhere.';
const BRAND_NAVY = '#0B1D3A';
const BRAND_BLUE = '#1E5BFF';

function emailHtml(fullName: string, bodyHtml: string): string {
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;">
  <tr>
    <td style="background:${BRAND_NAVY};padding:24px;text-align:center;border-radius:8px 8px 0 0;">
      <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">${BRAND_NAME}</span>
      <div style="color:${BRAND_BLUE};font-size:13px;margin-top:4px;">${BRAND_TAGLINE}</div>
    </td>
  </tr>
  <tr>
    <td style="padding:24px;color:#171717;font-size:14px;line-height:1.6;">
      <p>Hi ${fullName},</p>
      ${bodyHtml}
    </td>
  </tr>
  <tr>
    <td style="padding:16px 24px;color:#737373;font-size:12px;text-align:center;border-top:1px solid #e5e5e5;">
      ${BRAND_NAME} — Online Academy for Smart Integrated Studies
    </td>
  </tr>
</table>`.trim();
}

export function buildVerificationEmail(fullName: string, verifyUrl: string): EmailMessage {
  return {
    to: '', // set by caller
    subject: `Verify your ${BRAND_NAME} account`,
    text: `Hi ${fullName},\n\nPlease verify your email address by visiting:\n${verifyUrl}\n\nThis link expires in 24 hours. If you didn't create an ${BRAND_NAME} account, you can ignore this email.\n\n${BRAND_NAME} — ${BRAND_TAGLINE}`,
    html: emailHtml(
      fullName,
      `<p>Please verify your email address by clicking the button below:</p>
       <p style="text-align:center;margin:24px 0;">
         <a href="${verifyUrl}" style="background:${BRAND_BLUE};color:#ffffff;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">Verify email</a>
       </p>
       <p>Or copy this link: <a href="${verifyUrl}" style="color:${BRAND_BLUE};">${verifyUrl}</a></p>
       <p>This link expires in 24 hours. If you didn't create an ${BRAND_NAME} account, you can ignore this email.</p>`,
    ),
  };
}

export function buildPasswordResetEmail(fullName: string, resetUrl: string): EmailMessage {
  return {
    to: '',
    subject: `Reset your ${BRAND_NAME} password`,
    text: `Hi ${fullName},\n\nWe received a request to reset your ${BRAND_NAME} password. Visit this link to choose a new one:\n${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, you can safely ignore this email — your password will not be changed.\n\n${BRAND_NAME} — ${BRAND_TAGLINE}`,
    html: emailHtml(
      fullName,
      `<p>We received a request to reset your ${BRAND_NAME} password. Click the button below to choose a new one:</p>
       <p style="text-align:center;margin:24px 0;">
         <a href="${resetUrl}" style="background:${BRAND_BLUE};color:#ffffff;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">Reset password</a>
       </p>
       <p>Or copy this link: <a href="${resetUrl}" style="color:${BRAND_BLUE};">${resetUrl}</a></p>
       <p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email — your password will not be changed.</p>`,
    ),
  };
}

export function withRecipient(message: EmailMessage, to: string): EmailMessage {
  return { ...message, to };
}
