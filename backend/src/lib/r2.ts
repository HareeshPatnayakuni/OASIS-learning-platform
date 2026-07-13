import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomBytes } from 'node:crypto';
import { env } from '../config/env';
import { logger } from './logger';

/**
 * Cloudflare R2 is S3-compatible, so the standard AWS SDK v3 S3 client +
 * presigner work against it unmodified — just point `endpoint` at R2's
 * account-scoped URL instead of AWS. This is the PRIVATE bucket only
 * (lecture videos & notes) — see docs/02-architecture.md §8 for why images
 * use a completely separate public/CDN bucket and client, never this one.
 *
 * Signed URLs are issued fresh on every stream/download request after an
 * enrollment check — see modules/content/content.service.ts. Nothing
 * caches a signed URL server-side; there'd be no point, since a cached one
 * could outlive its own usefulness relative to a fresh enrollment check
 * anyway. Expiry is enforced by R2 itself via the request signature (an
 * expired URL fails signature verification at the storage layer, not just
 * "isn't offered again") — genuinely short-lived and non-reusable past
 * expiry, not merely advisory.
 *
 * Two different TTLs, not one shared constant:
 *   - Lecture streaming needs to survive an entire viewing session,
 *     including seeking/buffering, which makes further Range requests
 *     against the SAME URL well after the initial one. An earlier version
 *     of this file used a single 10-minute TTL for both cases — fine for a
 *     one-shot note download, but it would silently break video playback
 *     partway through any lecture longer than ~10 minutes (a real risk:
 *     coaching lectures commonly run 30–60+ minutes). 4 hours comfortably
 *     covers a single sitting, including rewatching, while still expiring
 *     well within the same day.
 *   - Note downloads stay short — a PDF download completes in one request,
 *     so there's no reason to widen that window.
 */

const LECTURE_STREAM_TTL_SECONDS = 4 * 60 * 60; // 4 hours — covers a full viewing session, including seeking
const NOTE_DOWNLOAD_TTL_SECONDS = 10 * 60; // 10 minutes — a single-shot download

function buildClient(): S3Client | null {
  if (!env.R2_ACCOUNT_ID || !env.R2_PRIVATE_ACCESS_KEY_ID || !env.R2_PRIVATE_SECRET_ACCESS_KEY) {
    return null;
  }
  return new S3Client({
    region: 'auto',
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_PRIVATE_ACCESS_KEY_ID,
      secretAccessKey: env.R2_PRIVATE_SECRET_ACCESS_KEY,
    },
  });
}

const client = buildClient();

export class R2NotConfiguredError extends Error {
  constructor() {
    super(
      'Cloudflare R2 private-bucket credentials are not configured ' +
        '(R2_ACCOUNT_ID / R2_PRIVATE_ACCESS_KEY_ID / R2_PRIVATE_SECRET_ACCESS_KEY). ' +
        'Signed URLs cannot be issued until these are set.',
    );
    this.name = 'R2NotConfiguredError';
  }
}

export interface SignedUrlResult {
  url: string;
  expiresInSeconds: number;
}

async function getSignedPrivateUrl(objectKey: string, ttlSeconds: number): Promise<SignedUrlResult> {
  if (!client) {
    logger.error('Attempted to issue a signed R2 URL without R2 credentials configured');
    throw new R2NotConfiguredError();
  }

  const command = new GetObjectCommand({
    Bucket: env.R2_PRIVATE_BUCKET_NAME,
    Key: objectKey,
  });

  const url = await getSignedUrl(client, command, { expiresIn: ttlSeconds });
  return { url, expiresInSeconds: ttlSeconds };
}

export function getSignedLectureUrl(r2ObjectKey: string): Promise<SignedUrlResult> {
  return getSignedPrivateUrl(r2ObjectKey, LECTURE_STREAM_TTL_SECONDS);
}

export function getSignedNoteUrl(r2ObjectKey: string): Promise<SignedUrlResult> {
  return getSignedPrivateUrl(r2ObjectKey, NOTE_DOWNLOAD_TTL_SECONDS);
}

// ─────────────────────────────────────────────────────────────
// Module 3B addendum — Teacher upload flow (additive; nothing above this
// line changed). The Teacher never uploads a file through the Express
// server itself: the backend creates the Lecture/Note metadata row with a
// server-generated, collision-resistant object key, hands back a
// short-lived presigned PUT URL for that exact key, and the browser
// uploads the bytes directly to R2. See content-management module.
// ─────────────────────────────────────────────────────────────

const UPLOAD_URL_TTL_SECONDS = 15 * 60; // 15 minutes — generous for a large video upload on a slow connection

export interface UploadUrlResult {
  uploadUrl: string;
  expiresInSeconds: number;
}

/** Generates a unique, collision-resistant object key under a per-course
 * prefix — never derived from user-supplied input (e.g. the original
 * filename), which avoids both path-traversal concerns and awkward
 * characters ending up in an R2 key. */
export function generatePrivateObjectKey(kind: 'videos' | 'notes', courseId: string): string {
  return `${kind}/${courseId}/${randomBytes(16).toString('hex')}`;
}

async function getUploadUrlForPrivateObject(objectKey: string, contentType: string): Promise<UploadUrlResult> {
  if (!client) {
    logger.error('Attempted to issue an R2 private-bucket upload URL without credentials configured');
    throw new R2NotConfiguredError();
  }

  const command = new PutObjectCommand({
    Bucket: env.R2_PRIVATE_BUCKET_NAME,
    Key: objectKey,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: UPLOAD_URL_TTL_SECONDS });
  return { uploadUrl, expiresInSeconds: UPLOAD_URL_TTL_SECONDS };
}

export function getLectureUploadUrl(r2ObjectKey: string, contentType: string): Promise<UploadUrlResult> {
  return getUploadUrlForPrivateObject(r2ObjectKey, contentType);
}

export function getNoteUploadUrl(r2ObjectKey: string, contentType: string): Promise<UploadUrlResult> {
  return getUploadUrlForPrivateObject(r2ObjectKey, contentType);
}
