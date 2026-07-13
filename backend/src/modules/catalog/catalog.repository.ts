import { prisma } from '../../lib/prisma';
import type { BoardSummary, CatalogRepository, ClassGradeSummary, SubjectSummary } from './catalog.types';

export class PrismaCatalogRepository implements CatalogRepository {
  async listBoards(): Promise<BoardSummary[]> {
    return await prisma.board.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    });
  }

  async listClassGrades(): Promise<ClassGradeSummary[]> {
    return await prisma.classGrade.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, slug: true, order: true },
      orderBy: { order: 'asc' },
    });
  }

  async listSubjects(): Promise<SubjectSummary[]> {
    return await prisma.subject.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    });
  }
}
