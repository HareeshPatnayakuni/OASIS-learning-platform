import { Router } from 'express';
import { DevicesController } from './devices.controller';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { listDevicesQuerySchema, removeDeviceParamsSchema, removeDeviceQuerySchema } from './devices.validators';

const router = Router();
const controller = new DevicesController();

/**
 * @openapi
 * /devices:
 *   get:
 *     tags: [Devices]
 *     summary: List the requesting account's active devices (Student, Teacher, or Admin — the 2-device limit applies to every role)
 *     description: >
 *       A device only appears here if it has at least one unexpired,
 *       unrevoked refresh token — a session whose token has expired no
 *       longer counts as active and is cleaned up automatically. Newest
 *       active first.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: currentDeviceId
 *         required: true
 *         schema: { type: string }
 *         description: This device's own stable client-generated ID, so the response can mark which row is "this device"
 *     responses:
 *       200: { description: List of active devices }
 */
router.get(
  '/devices',
  authenticate,
  validate({ query: listDevicesQuerySchema }),
  asyncHandler(controller.listMyDevices),
);

/**
 * @openapi
 * /devices/{deviceId}:
 *   delete:
 *     tags: [Devices]
 *     summary: Remove another device — revokes its refresh tokens and frees its slot against the 2-device limit
 *     description: >
 *       Cannot be used to remove the device making the request (compare
 *       against `currentDeviceId`) — log out normally for that. Every
 *       refresh token belonging to the removed device is revoked, so it
 *       cannot silently mint a new access token after removal.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: currentDeviceId
 *         required: true
 *         schema: { type: string }
 *         description: This device's own ID, so the server can reject an attempt to remove it
 *     responses:
 *       204: { description: Device removed }
 *       400: { description: Attempted to remove the current device }
 *       404: { description: Device not found }
 */
router.delete(
  '/devices/:deviceId',
  authenticate,
  validate({ params: removeDeviceParamsSchema, query: removeDeviceQuerySchema }),
  asyncHandler(controller.removeDevice),
);

export { router as devicesRouter };
