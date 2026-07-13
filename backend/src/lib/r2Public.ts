import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env';
import { logger } from './logger';

/**
 * The PUBLIC/CDN-fronted R2 bucket, for images only (course thumbnails,
 * avatars, logo, testimonial photos) — see docs/02-architecture.md §8.
 * Deliberately a separate module from lib/r2.ts (the private
 * video/notes bucket): separate S3 client, separate credentials
 * (R2_PUBLIC_* vs R2_PRIVATE_*), separate upload URL TTL. Never import
 * this from anywhere that handles lecture videos or notes, and never
 * import lib/r2.ts from anywhere that handles images — keeping the two
 * pipelines from ever touching is the point (NFR-SEC-10).
 *
 * Unlike the private bucket (which only ever issues GET/download URLs —
 * uploads happen through the Teacher-authoring flow described below),
 * this module issues PUT/upload URLs: the browser uploads the image
 * bytes directly to R2 using a short-lived presigned PUT URL, never
 * proxying the file through the Express server.
 */

const UPLOAD_URL_TTL_SECONDS = 10 * 60; // 10 minutes — plenty for a single image upload

function buildPublicClient(): S3Client | null {
  if (!env.R2_ACCOUNT_ID || !env.R2_PUBLIC_ACCESS_KEY_ID || !env.R2_PUBLIC_SECRET_ACCESS_KEY) {
    return null;
  }
  return new S3Client({
    region: 'auto',
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_PUBLIC_ACCESS_KEY_ID,
      secretAccessKey: env.R2_PUBLIC_SECRET_ACCESS_KEY,
    },
  });
}

const publicClient = buildPublicClient();

export class R2PublicNotConfiguredError extends Error {
  constructor() {
    super(
      'Cloudflare R2 public-bucket credentials are not configured ' +
        '(R2_ACCOUNT_ID / R2_PUBLIC_ACCESS_KEY_ID / R2_PUBLIC_SECRET_ACCESS_KEY). ' +
        'Image uploads cannot be issued until these are set.',
    );
    this.name = 'R2PublicNotConfiguredError';
  }
}

export interface UploadUrlResult {
  uploadUrl: string;
  expiresInSeconds: number;
  publicUrl: string;
}

/** Builds the long-lived public URL an uploaded object will be reachable
 * at once it exists — this is deterministic (no signing needed), since
 * the whole point of the public bucket is that objects are readable
 * without authorization. Constructed, not fetched, so it's available
 * immediately even before the upload completes. */
export function buildPublicUrl(objectKey: string): string {
  const base = (env.R2_PUBLIC_CDN_BASE_URL ?? '').replace(/\/+$/, '');
  return `${base}/${objectKey}`;
}

export async function getImageUploadUrl(objectKey: string, contentType: string): Promise<UploadUrlResult> {
  if (!publicClient) {
    logger.error('Attempted to issue an R2 public-bucket upload URL without credentials configured');
    throw new R2PublicNotConfiguredError();
  }

  const command = new PutObjectCommand({
    Bucket: env.R2_PUBLIC_BUCKET_NAME,
    Key: objectKey,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(publicClient, command, { expiresIn: UPLOAD_URL_TTL_SECONDS });
  return { uploadUrl, expiresInSeconds: UPLOAD_URL_TTL_SECONDS, publicUrl: buildPublicUrl(objectKey) };
}

export async function deletePublicObject(objectKey: string): Promise<void> {
  if (!publicClient) {
    logger.warn('Attempted to delete an R2 public-bucket object without credentials configured — skipping');
    return;
  }
  await publicClient.send(new DeleteObjectCommand({ Bucket: env.R2_PUBLIC_BUCKET_NAME, Key: objectKey }));
}
