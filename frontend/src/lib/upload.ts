/**
 * Every Module 3B upload (lecture video, note PDF, course thumbnail)
 * follows the same two-step pattern: the backend issues a signed PUT URL
 * for an R2 object it already knows the key of, and the browser uploads
 * the raw file directly to that URL. This is the second step — a plain
 * PUT, no auth header (the URL itself is the credential), matching
 * exactly what `src/lib/r2.ts`/`r2Public.ts` sign on the backend.
 */
export async function uploadFileToSignedUrl(uploadUrl: string, file: File, contentType: string): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  });

  if (!response.ok) {
    throw new Error(`Upload failed (${response.status}). The link may have expired — try again.`);
  }
}
