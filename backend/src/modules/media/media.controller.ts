import type { Request, Response } from 'express';
import { PrismaMediaRepository } from './media.repository';
import { MediaService } from './media.service';
import type { CreateMediaBody, MediaIdParams } from './media.validators';

export class MediaController {
  private readonly service = new MediaService(new PrismaMediaRepository());

  create = async (req: Request, res: Response): Promise<void> => {
    const { purpose, contentType } = req.body as CreateMediaBody;
    const result = await this.service.createUpload(purpose, contentType, req.user!.id);
    res.status(201).json({
      data: {
        id: result.media.id,
        publicUrl: result.media.publicUrl,
        uploadUrl: result.uploadUrl,
        expiresInSeconds: result.expiresInSeconds,
      },
    });
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as unknown as MediaIdParams;
    await this.service.deleteMedia(id, req.user!.id);
    res.status(204).send();
  };
}
