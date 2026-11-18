import { EVENT_COLORS } from '../data/presets';
import { EventColorItem } from '../types/calendar';

export const USER_EVENT_PALETTE_KEY = 'broadsheet_user_event_palette_v1';

export function normalizeHex(hex: string): string {
  const clean = hex.trim().toUpperCase();
  if (/^#[0-9A-F]{6}$/.test(clean)) return clean;
  if (/^#[0-9A-F]{3}$/.test(clean)) {
    const r = clean[1];
    const g = clean[2];
    const b = clean[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return clean;
}

export function mergeWithDefaultPalette(saved?: EventColorItem[] | null): EventColorItem[] {
  const savedList = Array.isArray(saved) ? saved : [];
  const savedByHex = new Map<string, EventColorItem>();
  for (const item of savedList) {
    if (!item?.hex) continue;
    const norm = normalizeHex(item.hex);
    savedByHex.set(norm, { ...item, hex: norm });
  }

  const merged: EventColorItem[] = EVENT_COLORS.map((def) => {
    const norm = normalizeHex(def.hex);
    const match = savedByHex.get(norm);
    if (match) {
      savedByHex.delete(norm);
      return {
        ...def,
        hex: norm,
        category: match.category ?? def.category ?? '',
      };
    }
    return { ...def, hex: norm, category: def.category ?? '' };
  });

  // Append any user-created custom colors preserved from storage
  for (const custom of savedByHex.values()) {
    merged.push({
      ...custom,
      isCustom: true,
    });
  }

  return merged;
}

export function loadUserEventPalette(): EventColorItem[] {
  try {
    const raw = localStorage.getItem(USER_EVENT_PALETTE_KEY);
    if (!raw) return mergeWithDefaultPalette([]);
    const parsed = JSON.parse(raw) as EventColorItem[];
    return mergeWithDefaultPalette(parsed);
  } catch {
    return mergeWithDefaultPalette([]);
  }
}

export function saveUserEventPalette(palette: EventColorItem[]): void {
  try {
    localStorage.setItem(USER_EVENT_PALETTE_KEY, JSON.stringify(palette));
  } catch {
    // Ignore storage quota errors
  }
}

export function ensureColorInPalette(
  palette: EventColorItem[],
  hex: string,
  optionalCategory?: string
): { nextPalette: EventColorItem[]; added: boolean } {
  const norm = normalizeHex(hex);
  const existingIdx = palette.findIndex((c) => normalizeHex(c.hex) === norm);
  if (existingIdx >= 0) {
    if (optionalCategory !== undefined && optionalCategory.trim() !== (palette[existingIdx].category ?? '')) {
      const copy = [...palette];
      copy[existingIdx] = {
        ...copy[existingIdx],
        category: optionalCategory.trim(),
      };
      return { nextPalette: copy, added: false };
    }
    return { nextPalette: palette, added: false };
  }

  const newItem: EventColorItem = {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    label: `Custom ${norm}`,
    hex: norm,
    category: optionalCategory?.trim() ?? '',
    isCustom: true,
  };
  return {
    nextPalette: [...palette, newItem],
    added: true,
  };
}
