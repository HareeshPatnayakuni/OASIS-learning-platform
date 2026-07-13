import type { Request, Response } from 'express';
import { PrismaContentManagementRepository } from './content-management.repository';
import { ChaptersService } from './chapters.service';
import { ContentModulesService } from './modules.service';
import { LecturesService } from './lectures.service';
import { NotesService } from './notes.service';
import type {
  CreateChapterBody,
  CreateContentModuleBody,
  CreateLectureBody,
  CreateNoteBody,
  MoveBody,
  ReuploadBody,
  UpdateChapterBody,
  UpdateContentModuleBody,
  UpdateLectureBody,
  UpdateLectureStatusBody,
  UpdateNoteBody,
} from './content-management.validators';

const repo = new PrismaContentManagementRepository();

export class ContentManagementController {
  private readonly chapters = new ChaptersService(repo);
  private readonly contentModules = new ContentModulesService(repo);
  private readonly lectures = new LecturesService(repo);
  private readonly notes = new NotesService(repo);

  // ── Course Builder read model ─────────────────────────────────
  getContentTree = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    const tree = await this.chapters.getFullContentTree(id, req.user!.id);
    res.status(200).json({ data: tree });
  };

  // ── Chapters ───────────────────────────────────────────────────
  createChapter = async (req: Request, res: Response): Promise<void> => {
    const { courseId } = req.params as { courseId: string };
    const body = req.body as CreateChapterBody;
    const chapter = await this.chapters.createChapter(courseId, req.user!.id, body);
    res.status(201).json({ data: chapter });
  };

  updateChapter = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    const body = req.body as UpdateChapterBody;
    const chapter = await this.chapters.updateChapter(id, req.user!.id, body);
    res.status(200).json({ data: chapter });
  };

  deleteChapter = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    await this.chapters.deleteChapter(id, req.user!.id);
    res.status(204).send();
  };

  moveChapter = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    const { direction } = req.body as MoveBody;
    await this.chapters.moveChapter(id, req.user!.id, direction);
    res.status(204).send();
  };

  // ── Content Modules ────────────────────────────────────────────
  createContentModule = async (req: Request, res: Response): Promise<void> => {
    const { chapterId } = req.params as { chapterId: string };
    const body = req.body as CreateContentModuleBody;
    const contentModule = await this.contentModules.createContentModule(chapterId, req.user!.id, body);
    res.status(201).json({ data: contentModule });
  };

  updateContentModule = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    const body = req.body as UpdateContentModuleBody;
    const contentModule = await this.contentModules.updateContentModule(id, req.user!.id, body);
    res.status(200).json({ data: contentModule });
  };

  deleteContentModule = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    await this.contentModules.deleteContentModule(id, req.user!.id);
    res.status(204).send();
  };

  moveContentModule = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    const { direction } = req.body as MoveBody;
    await this.contentModules.moveContentModule(id, req.user!.id, direction);
    res.status(204).send();
  };

  // ── Lectures ───────────────────────────────────────────────────
  createLecture = async (req: Request, res: Response): Promise<void> => {
    const { moduleId } = req.params as { moduleId: string };
    const body = req.body as CreateLectureBody;
    const result = await this.lectures.createLecture(
      moduleId,
      req.user!.id,
      { title: body.title, durationSec: body.durationSec },
      body.contentType,
    );
    res.status(201).json({
      data: {
        lecture: result.lecture,
        uploadUrl: result.uploadUrl,
        expiresInSeconds: result.expiresInSeconds,
      },
    });
  };

  reuploadLectureVideo = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    const { contentType } = req.body as ReuploadBody;
    const result = await this.lectures.getReuploadUrl(id, req.user!.id, contentType);
    res.status(200).json({ data: result });
  };

  updateLecture = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    const body = req.body as UpdateLectureBody;
    const lecture = await this.lectures.updateLecture(id, req.user!.id, body);
    res.status(200).json({ data: lecture });
  };

  updateLectureStatus = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    const { status } = req.body as UpdateLectureStatusBody;
    const lecture = await this.lectures.updateLectureStatus(id, req.user!.id, status);
    res.status(200).json({ data: lecture });
  };

  deleteLecture = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    await this.lectures.deleteLecture(id, req.user!.id);
    res.status(204).send();
  };

  moveLecture = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    const { direction } = req.body as MoveBody;
    await this.lectures.moveLecture(id, req.user!.id, direction);
    res.status(204).send();
  };

  // ── Notes ──────────────────────────────────────────────────────
  createNote = async (req: Request, res: Response): Promise<void> => {
    const { moduleId } = req.params as { moduleId: string };
    const body = req.body as CreateNoteBody;
    const result = await this.notes.createNote(moduleId, req.user!.id, { title: body.title }, body.contentType);
    res.status(201).json({
      data: { note: result.note, uploadUrl: result.uploadUrl, expiresInSeconds: result.expiresInSeconds },
    });
  };

  reuploadNoteFile = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    const { contentType } = req.body as ReuploadBody;
    const result = await this.notes.getReuploadUrl(id, req.user!.id, contentType);
    res.status(200).json({ data: result });
  };

  updateNote = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    const body = req.body as UpdateNoteBody;
    const note = await this.notes.updateNote(id, req.user!.id, body);
    res.status(200).json({ data: note });
  };

  deleteNote = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    await this.notes.deleteNote(id, req.user!.id);
    res.status(204).send();
  };
}
