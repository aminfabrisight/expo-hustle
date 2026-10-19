import type { ItemDef } from '../systems/types';

/**
 * Asset abstraction. Everything is procedural/emoji today.
 * To swap in illustrations: return an image key here and teach the renderer to draw it,
 * or set brand logos via sponsors.json (logoUrl, official assets only).
 */
export const ASSETS = {
  itemIcon(def: ItemDef): string {
    return def.icon;
  },
};
