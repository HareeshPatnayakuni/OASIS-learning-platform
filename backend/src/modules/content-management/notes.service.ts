import { ApiError } from '../../utils/ApiError';
import { isCourseOwnedByTeacher, getCourseIdForContentModule, getCourseIdForNote } from '../../lib/ownership';
import { generatePrivateObjectKey, getNoteUploadUrl } from '../../lib/r2';
import type { ContentManagementRepository, CreateNoteInput, NoteRecord, UpdateNoteInput } from './content-management.types';

const ALLOWED_NOTE_CONTENT_TYPES = new Set(['application/pdf']);

export interface CreateNoteResult {
  note: NoteRecord;
  uploadUrl: string;
  expiresInSeconds: number;
}

export class NotesService {
  constructor(private readonly repo: ContentManagementRepository) {}

  async createNote(
    moduleId: string,
    teacherId: string,
    input: CreateNoteInput,
    contentType: string,
  ): Promise<CreateNoteResult> {
    this.assertValidContentType(contentType);
    const courseId = await this.assertModuleOwnershipForCreate(moduleId, teacherId);

    const existingCount = await this.repo.countNotesInModule(moduleId);
    const order = existingCount + 1;
    const objectKey = generatePrivateObjectKey('notes', courseId);

    const note = await this.repo.createNote(moduleId, { title: input.title, order, r2ObjectKey: objectKey });
    const { uploadUrl, expiresInSeconds } = await getNoteUploadUrl(objectKey, contentType);

    return { note, uploadUrl, expiresInSeconds };
  }

  async getReuploadUrl(
    noteId: string,
    teacherId: string,
    contentType: string,
  ): Promise<{ uploadUrl: string; expiresInSeconds: number }> {
    this.assertValidContentType(contentType);
    const note = await this.assertNoteOwnership(noteId, teacherId);
    return getNoteUploadUrl(note.r2ObjectKey, contentType);
  }

  async updateNote(noteId: string, teacherId: string, input: UpdateNoteInput): Promise<NoteRecord> {
    await this.assertNoteOwnership(noteId, teacherId);
    return this.repo.updateNote(noteId, input);
  }

  async deleteNote(noteId: string, teacherId: string): Promise<void> {
    await this.assertNoteOwnership(noteId, teacherId);
    await this.repo.softDeleteNote(noteId);
  }

  private assertValidContentType(contentType: string): void {
    if (!ALLOWED_NOTE_CONTENT_TYPES.has(contentType)) {
      throw ApiError.badRequest('INVALID_CONTENT_TYPE', 'Only application/pdf is supported for notes');
    }
  }

  private async assertModuleOwnershipForCreate(moduleId: string, teacherId: string): Promise<string> {
    const courseId = await getCourseIdForContentModule(moduleId);
    if (!courseId) {
      throw ApiError.notFound('MODULE_NOT_FOUND', 'Module not found');
    }
    const owned = await isCourseOwnedByTeacher(courseId, teacherId);
    if (!owned) {
      throw ApiError.forbidden('NOT_COURSE_OWNER', 'You do not own this course');
    }
    return courseId;
  }

  private async assertNoteOwnership(noteId: string, teacherId: string): Promise<NoteRecord> {
    const note = await this.repo.findNoteById(noteId);
    if (!note) {
      throw ApiError.notFound('NOTE_NOT_FOUND', 'Note not found');
    }
    const courseId = await getCourseIdForNote(noteId);
    const owned = courseId ? await isCourseOwnedByTeacher(courseId, teacherId) : false;
    if (!owned) {
      throw ApiError.forbidden('NOT_COURSE_OWNER', 'You do not own this course');
    }
    return note;
  }
}
