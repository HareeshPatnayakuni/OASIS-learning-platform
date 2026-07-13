/**
 * Like config/env.test.ts, this needs env vars set (or unset) BEFORE the
 * module is imported, since src/lib/r2.ts builds its S3 client at module
 * load time based on whether R2 credentials are present. Uses the same
 * jest.resetModules() + dynamic require() pattern for that reason.
 */

const getSignedUrlMock = jest.fn().mockResolvedValue('https://signed.example.com/object');

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: unknown[]) => getSignedUrlMock(...args),
}));

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({})),
  GetObjectCommand: jest.fn().mockImplementation((input: unknown) => input),
}));

describe('lib/r2', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    getSignedUrlMock.mockClear();
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  function setEnvWithR2Credentials(): void {
    process.env = {
      ...ORIGINAL_ENV,
      R2_ACCOUNT_ID: 'test-account',
      R2_PRIVATE_ACCESS_KEY_ID: 'test-key-id',
      R2_PRIVATE_SECRET_ACCESS_KEY: 'test-secret',
    };
  }

  function setEnvWithoutR2Credentials(): void {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_PRIVATE_ACCESS_KEY_ID;
    delete process.env.R2_PRIVATE_SECRET_ACCESS_KEY;
  }

  it('issues a lecture stream URL with a 4-hour (14400s) TTL', async () => {
    setEnvWithR2Credentials();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getSignedLectureUrl } = require('../../../src/lib/r2');

    const result = await getSignedLectureUrl('videos/lecture-1.mp4');

    expect(result.expiresInSeconds).toBe(4 * 60 * 60);
    expect(getSignedUrlMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ expiresIn: 4 * 60 * 60 }),
    );
  });

  it('issues a note download URL with a 10-minute (600s) TTL — deliberately shorter than the lecture TTL', async () => {
    setEnvWithR2Credentials();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getSignedNoteUrl } = require('../../../src/lib/r2');

    const result = await getSignedNoteUrl('notes/note-1.pdf');

    expect(result.expiresInSeconds).toBe(10 * 60);
    expect(getSignedUrlMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ expiresIn: 10 * 60 }),
    );
  });

  it('the lecture TTL is long enough to cover a realistic lecture length (e.g. a 60-minute class)', async () => {
    setEnvWithR2Credentials();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getSignedLectureUrl } = require('../../../src/lib/r2');

    const result = await getSignedLectureUrl('videos/lecture-1.mp4');

    const REALISTIC_LONG_LECTURE_SECONDS = 60 * 60; // 60 minutes
    expect(result.expiresInSeconds).toBeGreaterThan(REALISTIC_LONG_LECTURE_SECONDS);
  });

  it('throws a clear R2NotConfiguredError (not a raw SDK error) when credentials are missing', async () => {
    setEnvWithoutR2Credentials();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getSignedLectureUrl, R2NotConfiguredError } = require('../../../src/lib/r2');

    await expect(getSignedLectureUrl('videos/lecture-1.mp4')).rejects.toBeInstanceOf(R2NotConfiguredError);
    expect(getSignedUrlMock).not.toHaveBeenCalled();
  });
});
