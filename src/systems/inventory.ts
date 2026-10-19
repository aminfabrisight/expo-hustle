import { item } from '../content/items';
import type { ItemDef } from './types';

export interface BagItem { uid: number; id: string }

export interface Inventory {
  baseSlots: number;
  items: BagItem[];
  nextUid: number;
}

export function createInventory(baseSlots: number): Inventory {
  return { baseSlots, items: [], nextUid: 1 };
}

/** Capacity grows with tote bags/backpacks you carry. */
export function capacity(inv: Inventory): number {
  return inv.baseSlots + inv.items.reduce((s, b) => s + (item(b.id).bagBonus ?? 0), 0);
}

export function usedSlots(inv: Inventory): number {
  return inv.items.reduce((s, b) => s + item(b.id).slots, 0);
}

export function freeSlots(inv: Inventory): number {
  return capacity(inv) - usedSlots(inv);
}

export function canFit(inv: Inventory, def: ItemDef): boolean {
  return def.slots <= freeSlots(inv);
}

export function addItem(inv: Inventory, id: string): boolean {
  const def = item(id);
  if (!canFit(inv, def)) return false;
  inv.items.push({ uid: inv.nextUid++, id });
  return true;
}

/**
 * Remove an item. Refuses to drop a bag-expander if that would leave you over capacity
 * (otherwise you'd be carrying more than your bag holds).
 */
export function removeItem(inv: Inventory, uid: number): BagItem | null {
  const i = inv.items.findIndex((b) => b.uid === uid);
  if (i < 0) return null;
  const def = item(inv.items[i].id);
  if ((def.bagBonus ?? 0) > 0) {
    const capAfter = capacity(inv) - (def.bagBonus ?? 0);
    const usedAfter = usedSlots(inv) - def.slots;
    if (usedAfter > capAfter) return null;
  }
  return inv.items.splice(i, 1)[0];
}

/** Cheapest set of items whose removal frees enough room for `def` (greedy by value per slot). */
export function cheapestToDrop(inv: Inventory, def: ItemDef): BagItem[] | null {
  const need = def.slots - freeSlots(inv);
  if (need <= 0) return [];
  const candidates = inv.items
    .filter((b) => (item(b.id).bagBonus ?? 0) === 0 && item(b.id).slots > 0)
    .sort((a, b) => item(a.id).loot / item(a.id).slots - item(b.id).loot / item(b.id).slots);
  const out: BagItem[] = [];
  let freed = 0;
  for (const c of candidates) {
    if (freed >= need) break;
    out.push(c);
    freed += item(c.id).slots;
  }
  return freed >= need ? out : null;
}

export function bagValue(inv: Inventory): number {
  return inv.items.reduce((s, b) => s + item(b.id).loot, 0);
}
