import { z } from 'zod';

/**
 * `currentDeviceId` is the same stable, client-generated UUID already
 * sent on every login/refresh (frontend/src/lib/auth-storage.ts) — the
 * only way the backend can know which row in the response is "this
 * device," since access tokens deliberately don't carry deviceId (see
 * middleware/authenticate.ts). Reused as a query param here rather than
 * introducing a new transport (a header, a body on a GET) for a single
 * small value.
 */
const currentDeviceIdQuerySchema = z.object({
  currentDeviceId: z.string().trim().min(8, 'currentDeviceId must be a stable client-generated identifier'),
});

export const listDevicesQuerySchema = currentDeviceIdQuerySchema;
export type ListDevicesQuery = z.infer<typeof listDevicesQuerySchema>;

export const removeDeviceParamsSchema = z.object({
  deviceId: z.string().trim().min(8),
});
export type RemoveDeviceParams = z.infer<typeof removeDeviceParamsSchema>;

export const removeDeviceQuerySchema = currentDeviceIdQuerySchema;
export type RemoveDeviceQuery = z.infer<typeof removeDeviceQuerySchema>;
