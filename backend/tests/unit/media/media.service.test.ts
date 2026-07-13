import { MediaService } from '../../../src/modules/media/media.service';
import type { MediaForDeletion, MediaRecord, MediaRepository } from '../../../src/modules/media/media.types';
import * as r2PublicLib from '../../../src/lib/r2Public';

jest.mock('../../../src/lib/r2Public', () => ({
  getImageUploadUrl: jest.fn().mockResolvedValue({
    uploadUrl: 'https://upload.example.com/signed',
    expiresInSeconds: 600,
    publicUrl: 'https://cdn.example.com/images/course_thumbnail/abc123',
  }),
  deletePublicObject: jest.fn().mockResolvedValue(undefined),
}));

const mockedGetImageUploadUrl = r2PublicLib.getImageUploadUrl as jest.MockedFunction<
  typeof r2PublicLib.getImageUploadUrl
>;
const mockedDeletePublicObject = r2PublicLib.deletePublicObject as jest.MockedFunction<
  typeof r2PublicLib.deletePublicObject
>;

function createFakeMediaRepository(initial: MediaForDeletion[] = []) {
  const store = new Map(initial.map((m) => [m.id, m]));
  let counter = 0;

  const repo: MediaRepository = {
    async createMedia(input): Promise<MediaRecord> {
      counter += 1;
      const record: MediaRecord = {
        id: `media-${counter}`,
        purpose: input.purpose,
        publicUrl: input.publicUrl,
        uploadedById: input.uploadedById,
        createdAt: new Date(),
      };
      store.set(record.id, { id: record.id, objectKey: input.objectKey, uploadedById: input.uploadedById });
      return record;
    },
    async findMediaById(id) {
      return store.get(id) ?? null;
    },
    async softDeleteMedia(id) {
      store.delete(id);
    },
  };

  return { repo, store };
}

describe('MediaService.createUpload', () => {
  it('creates a media record and returns an upload URL for an allowed image type', async () => {
    const { repo } = createFakeMediaRepository();
    const service = new MediaService(repo);

    const result = await service.createUpload('COURSE_THUMBNAIL', 'image/jpeg', 'teacher-1');

    expect(result.uploadUrl).toBe('https://upload.example.com/signed');
    expect(result.media.uploadedById).toBe('teacher-1');
    expect(result.media.purpose).toBe('COURSE_THUMBNAIL');
    expect(mockedGetImageUploadUrl).toHaveBeenCalledTimes(1);
  });

  it.each(['image/jpeg', 'image/png', 'image/webp'])('accepts %s', async (contentType) => {
    const { repo } = createFakeMediaRepository();
    const service = new MediaService(repo);
    await expect(service.createUpload('COURSE_THUMBNAIL', contentType, 'teacher-1')).resolves.toBeDefined();
  });

  it('rejects a non-image content type', async () => {
    const { repo } = createFakeMediaRepository();
    const service = new MediaService(repo);

    await expect(service.createUpload('COURSE_THUMBNAIL', 'application/pdf', 'teacher-1')).rejects.toMatchObject({
      code: 'INVALID_CONTENT_TYPE',
      statusCode: 400,
    });
    expect(mockedGetImageUploadUrl).not.toHaveBeenCalled();
  });

  it('rejects a video content type (images pipeline only — see lib/r2.ts for video uploads)', async () => {
    const { repo } = createFakeMediaRepository();
    const service = new MediaService(repo);

    await expect(service.createUpload('COURSE_THUMBNAIL', 'video/mp4', 'teacher-1')).rejects.toMatchObject({
      code: 'INVALID_CONTENT_TYPE',
    });
  });
});

describe('MediaService.deleteMedia', () => {
  it('deletes media owned by the requester', async () => {
    const { repo, store } = createFakeMediaRepository([
      { id: 'media-1', objectKey: 'images/course_thumbnail/abc', uploadedById: 'teacher-1' },
    ]);
    const service = new MediaService(repo);

    await service.deleteMedia('media-1', 'teacher-1');

    expect(store.has('media-1')).toBe(false);
    expect(mockedDeletePublicObject).toHaveBeenCalledWith('images/course_thumbnail/abc');
  });

  it('rejects deletion by a user who did not upload the media', async () => {
    const { repo, store } = createFakeMediaRepository([
      { id: 'media-1', objectKey: 'images/course_thumbnail/abc', uploadedById: 'teacher-1' },
    ]);
    const service = new MediaService(repo);

    await expect(service.deleteMedia('media-1', 'teacher-2')).rejects.toMatchObject({
      code: 'NOT_MEDIA_OWNER',
      statusCode: 403,
    });
    expect(store.has('media-1')).toBe(true); // untouched
  });

  it('404s for unknown media', async () => {
    const { repo } = createFakeMediaRepository([]);
    const service = new MediaService(repo);

    await expect(service.deleteMedia('nope', 'teacher-1')).rejects.toMatchObject({
      code: 'MEDIA_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('still soft-deletes the DB row even if the underlying R2 object delete fails', async () => {
    mockedDeletePublicObject.mockRejectedValueOnce(new Error('R2 unreachable'));
    const { repo, store } = createFakeMediaRepository([
      { id: 'media-1', objectKey: 'images/course_thumbnail/abc', uploadedById: 'teacher-1' },
    ]);
    const service = new MediaService(repo);

    await expect(service.deleteMedia('media-1', 'teacher-1')).resolves.toBeUndefined();
    expect(store.has('media-1')).toBe(false);
  });
});
