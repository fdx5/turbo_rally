import type { Profile } from '../../shared/progress';
import { HttpError } from './http';
/** Member-only / guest limits are enforced by API membership itself; this guards obviously bad states. */
export function assertOwned(p: Profile, itemId: string) {
  if (!p.inventory.includes(itemId)) throw new HttpError(400, '보유하지 않은 아이템이에요');
}
