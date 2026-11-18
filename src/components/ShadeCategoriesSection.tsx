import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { CalendarSpanEvent, EventColorItem } from '../types/calendar';
import { normalizeHex, SHADE_CATEGORY_MAX_LENGTH } from '../utils/eventPaletteStorage';

interface ShadeCategoriesSectionProps {
  eventPalette: EventColorItem[];
  spanEvents: CalendarSpanEvent[];
  showCategoryKey: boolean;
  onToggleShowCategoryKey: (show: boolean) => void;
  onUpdateCategory: (hex: string, category: string) => void;
  onAddCustomColor: (hex: string, category?: string) => void;
  onDeleteCustomColor: (hex: string) => void;
}

export function ShadeCategoriesSection({
  eventPalette,
  spanEvents,
  showCategoryKey,
  onToggleShowCategoryKey,
  onUpdateCategory,
  onAddCustomColor,
  onDeleteCustomColor,
}: ShadeCategoriesSectionProps) {
  const [showAllSwatches, setShowAllSwatches] = useState(false);
  const [customHex, setCustomHex] = useState('#E11D48');
  const [customCategory, setCustomCategory] = useState('');

  const paletteByHex = new Map<string, EventColorItem>();
  for (const item of eventPalette) {
    paletteByHex.set(normalizeHex(item.hex), item);
  }

  // Count distinct colors used across calendar events
  const usedCounts = new Map<string, number>();
  const usedOrder: string[] = [];
  for (const ev of spanEvents) {
    const hex = normalizeHex(ev.color);
    if (!usedCounts.has(hex)) {
      usedOrder.push(hex);
      usedCounts.set(hex, 1);
    } else {
      usedCounts.set(hex, (usedCounts.get(hex) ?? 0) + 1);
    }
  }

  const usedItems: { item: EventColorItem; count: number }[] = usedOrder.map((hex) => {
    const existing = paletteByHex.get(hex);
    return {
      item: existing ?? {
        id: `used-${hex}`,
        label: hex,
        hex,
        category: '',
        isCustom: true,
      },
      count: usedCounts.get(hex) ?? 0,
    };
  });

  const handleAddCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddCustomColor(customHex, customCategory.trim());
    setCustomCategory('');
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold text-stone-500 tracking-wide">
          Shade Categories & Footer Key
        </h2>
        <label className="flex items-center gap-1.5 text-[11px] text-stone-600 cursor-pointer">
          <input
            type="checkbox"
            checked={showCategoryKey}
            onChange={(e) => onToggleShowCategoryKey(e.target.checked)}
            className="accent-stone-900"
          />
          <span>Show key</span>
        </label>
      </div>

      {usedItems.length === 0 ? (
        <p className="text-[11px] text-stone-500 leading-relaxed">
          Add events with shades to assign category descriptions for the calendar footer key.
        </p>
      ) : (
        <div className="space-y-2">
          {usedItems.map(({ item, count }) => (
            <div
              key={item.hex}
              className="p-2 bg-stone-50 border border-stone-200 rounded-md space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-4 h-4 rounded-sm border border-stone-300 shrink-0"
                    style={{ backgroundColor: item.hex }}
                  />
                  <span className="text-[11px] font-medium text-stone-800 truncate">
                    {item.label}
                  </span>
                </div>
                <span className="text-[10px] text-stone-500 tabular-nums shrink-0">
                  {count} {count === 1 ? 'event' : 'events'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <input
                  type="text"
                  maxLength={SHADE_CATEGORY_MAX_LENGTH}
                  value={item.category ?? ''}
                  onChange={(e) =>
                    onUpdateCategory(item.hex, e.target.value.slice(0, SHADE_CATEGORY_MAX_LENGTH))
                  }
                  placeholder="Category label (e.g. School Break)"
                  className="flex-1 min-w-0 px-2 py-1 text-xs bg-white border border-stone-300 rounded focus:outline-none focus:border-stone-900"
                />
                <span className="text-[10px] text-stone-400 tabular-nums shrink-0">
                  {(item.category ?? '').length}/{SHADE_CATEGORY_MAX_LENGTH}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Save custom shade / manage all palette swatches */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setShowAllSwatches((v) => !v)}
          className="flex items-center gap-1 text-[11px] font-medium text-stone-600 hover:text-stone-900 cursor-pointer"
        >
          {showAllSwatches ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
          <span>Saved Shades & Custom Colors ({eventPalette.length})</span>
        </button>

        {showAllSwatches && (
          <div className="mt-2.5 space-y-2.5">
            <form
              onSubmit={handleAddCustomSubmit}
              className="p-2 bg-stone-50 border border-stone-200 rounded-md space-y-2"
            >
              <div className="text-[11px] font-medium text-stone-700">
                Save New Custom Shade
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={customHex}
                  onChange={(e) => setCustomHex(e.target.value)}
                  aria-label="Pick custom shade color"
                  className="w-7 h-7 p-0 border border-stone-300 rounded bg-white cursor-pointer shrink-0"
                />
                <input
                  type="text"
                  maxLength={SHADE_CATEGORY_MAX_LENGTH}
                  value={customCategory}
                  onChange={(e) =>
                    setCustomCategory(e.target.value.slice(0, SHADE_CATEGORY_MAX_LENGTH))
                  }
                  placeholder="Optional category (max 25 chars)"
                  className="flex-1 min-w-0 px-2 py-1 text-xs bg-white border border-stone-300 rounded focus:outline-none focus:border-stone-900"
                />
                <button
                  type="submit"
                  className="px-2 py-1 text-[11px] font-medium text-white bg-stone-900 rounded hover:bg-stone-800 flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Plus className="w-3 h-3" />
                  <span>Save</span>
                </button>
              </div>
            </form>

            <div className="divide-y divide-stone-100 border border-stone-200 rounded-md max-h-48 overflow-y-auto bg-white">
              {eventPalette.map((sw) => (
                <div key={sw.id} className="px-2.5 py-1.5 flex items-center gap-2 text-xs">
                  <span
                    className="w-3.5 h-3.5 rounded-sm border border-stone-300 shrink-0"
                    style={{ backgroundColor: sw.hex }}
                    title={sw.hex}
                  />
                  <input
                    type="text"
                    maxLength={SHADE_CATEGORY_MAX_LENGTH}
                    value={sw.category ?? ''}
                    onChange={(e) =>
                      onUpdateCategory(sw.hex, e.target.value.slice(0, SHADE_CATEGORY_MAX_LENGTH))
                    }
                    placeholder={sw.label}
                    className="flex-1 min-w-0 px-1.5 py-0.5 text-[11px] border border-transparent hover:border-stone-200 focus:border-stone-400 rounded focus:outline-none"
                  />
                  {sw.isCustom && (
                    <button
                      type="button"
                      onClick={() => onDeleteCustomColor(sw.hex)}
                      aria-label={`Delete saved color ${sw.hex}`}
                      title="Remove saved custom shade"
                      className="p-0.5 text-stone-400 hover:text-red-700 cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
