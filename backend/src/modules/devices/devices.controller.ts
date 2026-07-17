import type { Request, Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { PrismaAuthRepository } from '../auth/auth.repository';
import type { ListDevicesQuery, RemoveDeviceParams, RemoveDeviceQuery } from './devices.validators';

/**
 * Deliberately no separate DevicesRepository — every piece of state this
 * module touches (DeviceSession, RefreshToken) is owned by AuthRepository
 * already, and Module 2's login/refresh/logout flows are the source of
 * truth for what "active" and "revoked" mean. Reusing AuthService here,
 * rather than duplicating that logic, is the whole point.
 */
export class DevicesController {
  private readonly service = new AuthService(new PrismaAuthRepository());

  listMyDevices = async (req: Request, res: Response): Promise<void> => {
    const { currentDeviceId } = req.query as unknown as ListDevicesQuery;
    const devices = await this.service.listMyDevices(req.user!.id, currentDeviceId);
    res.status(200).json({ data: devices });
  };

  removeDevice = async (req: Request, res: Response): Promise<void> => {
    const { deviceId } = req.params as unknown as RemoveDeviceParams;
    const { currentDeviceId } = req.query as unknown as RemoveDeviceQuery;
    await this.service.removeDevice(req.user!.id, currentDeviceId, deviceId);
    res.status(204).send();
  };
}
