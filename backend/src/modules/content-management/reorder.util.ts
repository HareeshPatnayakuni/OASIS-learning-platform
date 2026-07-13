import { ApiError } from '../../utils/ApiError';
import type { MoveDirection } from './content-management.types';

interface Orderable {
  id: string;
  order: number;
}

/**
 * Numeric "move up / move down" reordering — swaps the target item's
 * `order` with its immediate sibling in the requested direction. No
 * drag-and-drop, no arbitrary position, per your explicit instruction to
 * keep this simple. `siblings` must already be sorted by `order` ascending
 * (every repository's `list*SiblingsOrdered` method guarantees this).
 */
export async function moveSibling<T extends Orderable>(
  siblings: T[],
  itemId: string,
  direction: MoveDirection,
  swap: (aId: string, aOrder: number, bId: string, bOrder: number) => Promise<void>,
): Promise<void> {
  const index = siblings.findIndex((s) => s.id === itemId);
  if (index === -1) {
    throw ApiError.notFound('ITEM_NOT_FOUND', 'Item not found among its siblings');
  }

  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= siblings.length) {
    throw ApiError.badRequest(
      'CANNOT_MOVE',
      direction === 'up' ? 'This item is already first' : 'This item is already last',
    );
  }

  const current = siblings[index]!;
  const target = siblings[targetIndex]!;
  await swap(current.id, current.order, target.id, target.order);
}
