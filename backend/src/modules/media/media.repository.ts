import { prisma } from '../../lib/prisma';
import type { MediaForDeletion, MediaRecord, MediaRepository } from './media.types';

export class PrismaMediaRepository implements MediaRepository {
  async createMedia(input: {
    purpose: MediaRecord['purpose'];
    objectKey: string;
    publicUrl: string;
    uploadedById: string;
  }): Promise<MediaRecord> {
    const row = await prisma.media.create({
      data: {
        purpose: input.purpose,
        r2ObjectKey: input.objectKey,
        publicUrl: input.publicUrl,
        uploadedById: input.uploadedById,
      },
      select: { id: true, purpose: true, publicUrl: true, uploadedById: true, createdAt: true },
    });
    return row;
  }

  async findMediaById(id: string): Promise<MediaForDeletion | null> {
    const row = await prisma.media.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, r2ObjectKey: true, uploadedById: true },
    });
    if (!row) return null;
    return { id: row.id, objectKey: row.r2ObjectKey, uploadedById: row.uploadedById };
  }

  async softDeleteMedia(id: string): Promise<void> {
    await prisma.media.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
