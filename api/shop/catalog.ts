import { route } from '../_lib/http';
import { COSMETICS } from '../../src/data/cosmetics';
import { WEAPONS } from '../../src/data/items';
import { VEHICLES } from '../../src/data/vehicles';
import { dailyDiscounts, today, DISCOUNT } from '../../shared/progress';
export default route(['GET'], async () => ({
  cosmetics: COSMETICS.map((c) => ({ id: c.id, category: c.category, name: c.name, price: c.price, tier: c.tier })),
  weapons: WEAPONS.map((w) => ({ id: w.id, name: w.name, price: w.price, type: w.type })),
  vehicles: VEHICLES.map((v) => ({ id: v.id, name: v.name, unlock: v.unlock })),
  discounts: dailyDiscounts(today()),
  discountRate: DISCOUNT,
}));
