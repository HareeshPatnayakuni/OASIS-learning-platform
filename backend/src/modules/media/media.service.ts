import { randomBytes } from 'node:crypto';
import { ApiError } from '../../utils/ApiError';
import { getImageUploadUrl, deletePublicObject } from '../../lib/r2Public';
import { logger } from '../../lib/logger';
import type { MediaPurposeValue, MediaRecord, MediaRepository } from './media.types';

const ALLOWED_IMAGE_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function generateImageObjectKey(purpose: MediaPurposeValue): string {
  return `images/${purpose.toLowerCase()}/${randomBytes(16).toString('hex')}`;
}

export interface CreateUploadResult {
  media: MediaRecord;
  uploadUrl: string;
  expiresInSeconds: number;
}

export class MediaService {
  constructor(private readonly repo: MediaRepository) {}

  async createUpload(purpose: MediaPurposeValue, contentType: string, uploadedById: string): Promise<CreateUploadResult> {
    if (!ALLOWED_IMAGE_CONTENT_TYPES.has(contentType)) {
      throw ApiError.badRequest(
        'INVALID_CONTENT_TYPE',
        `Unsupported image type "${contentType}". Allowed: ${[...ALLOWED_IMAGE_CONTENT_TYPES].join(', ')}`,
      );
    }

    const objectKey = generateImageObjectKey(purpose);
    const { uploadUrl, expiresInSeconds, publicUrl } = await getImageUploadUrl(objectKey, contentType);
    const media = await this.repo.createMedia({ purpose, objectKey, publicUrl, uploadedById });

    return { media, uploadUrl, expiresInSeconds };
  }

  async deleteMedia(mediaId: string, requesterId: string): Promise<void> {
    const media = await this.repo.findMediaById(mediaId);
    if (!media) {
      throw ApiError.notFound('MEDIA_NOT_FOUND', 'Media not found');
    }
    if (media.uploadedById !== requesterId) {
      throw ApiError.forbidden('NOT_MEDIA_OWNER', 'You did not upload this media');
    }

    await this.repo.softDeleteMedia(mediaId);

    // Best-effort actual object removal — a failure here shouldn't fail the
    // request (the DB row is already soft-deleted, which is what every
    // other read path respects); it's logged so an orphaned R2 object is
    // at least visible for manual cleanup rather than silent.
    try {
      await deletePublicObject(media.objectKey);
    } catch (err) {
      logger.warn({ err, mediaId }, 'Failed to delete underlying R2 object after soft-deleting Media row');
    }
  }
}
