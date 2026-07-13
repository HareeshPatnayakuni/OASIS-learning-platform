/**
 * Image uploads (course thumbnails for Module 3B; avatars/logo/testimonial
 * photos are future consumers of the same pipeline, per Module 1's media
 * strategy). Always the PUBLIC bucket (lib/r2Public.ts) — never confused
 * with lecture video/note uploads, which stay in content-management and
 * use the PRIVATE bucket (lib/r2.ts).
 */

export type MediaPurposeValue =
  | 'COURSE_THUMBNAIL'
  | 'TEACHER_AVATAR'
  | 'TESTIMONIAL_PHOTO'
  | 'ACADEMY_LOGO'
  | 'GENERIC';

export interface MediaRecord {
  id: string;
  purpose: MediaPurposeValue;
  publicUrl: string;
  uploadedById: string | null;
  createdAt: Date;
}

export interface MediaForDeletion {
  id: string;
  objectKey: string;
  uploadedById: string | null;
}

export interface MediaRepository {
  createMedia(input: {
    purpose: MediaPurposeValue;
    objectKey: string;
    publicUrl: string;
    uploadedById: string;
  }): Promise<MediaRecord>;
  findMediaById(id: string): Promise<MediaForDeletion | null>;
  softDeleteMedia(id: string): Promise<void>;
}
