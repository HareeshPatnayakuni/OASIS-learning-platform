import type { Request, Response } from 'express';
import { PrismaSearchRepository } from './search.repository';
import { SearchService } from './search.service';
import type { SearchQuery } from './search.validators';

export class SearchController {
  private readonly service = new SearchService(new PrismaSearchRepository());

  search = async (req: Request, res: Response): Promise<void> => {
    const { q } = req.query as unknown as SearchQuery;
    const results = await this.service.search(q);
    res.status(200).json({ data: results });
  };
}
