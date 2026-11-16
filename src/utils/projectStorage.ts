import { DEFAULT_CONFIG } from '../data/presets';
import { CalendarConfig } from '../types/calendar';

export const SNAPSHOTS_STORAGE_KEY = 'broadsheet_saved_snapshots_v1';

export interface SavedCalendarSnapshot {
  id: string;
  name: string;
  savedAt: string;
  eventCount: number;
  yearLabel: string;
  config: CalendarConfig;
}

export function loadSavedSnapshots(): SavedCalendarSnapshot[] {
  try {
    const raw = localStorage.getItem(SNAPSHOTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function saveCalendarSnapshot(
  name: string,
  config: CalendarConfig
): SavedCalendarSnapshot[] {
  const existing = loadSavedSnapshots();
  const cleanName = name.trim() || (config.schoolYear ? `${config.year}–${config.year + 1} School Year` : `${config.year} Wall Calendar`);
  const yearLabel = config.schoolYear ? `${config.year}–${config.year + 1}` : String(config.year);

  const snapshot: SavedCalendarSnapshot = {
    id: `snap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: cleanName,
    savedAt: new Date().toISOString(),
    eventCount: config.spanEvents.length,
    yearLabel,
    config,
  };

  const next = [snapshot, ...existing].slice(0, 20);
  try {
    localStorage.setItem(SNAPSHOTS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors
  }
  return next;
}

export function deleteCalendarSnapshot(snapshotId: string): SavedCalendarSnapshot[] {
  const next = loadSavedSnapshots().filter((s) => s.id !== snapshotId);
  try {
    localStorage.setItem(SNAPSHOTS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors
  }
  return next;
}

export function downloadProjectJson(config: CalendarConfig): void {
  const payload = {
    app: 'broadsheet',
    version: 1,
    exportedAt: new Date().toISOString(),
    config,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const label = config.schoolYear ? `${config.year}-${config.year + 1}` : `${config.year}`;
  a.href = url;
  a.download = `broadsheet-${label}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function parseProjectJson(rawText: string): CalendarConfig {
  const parsed = JSON.parse(rawText);
  const candidate = parsed?.config ? parsed.config : parsed;
  if (!candidate || typeof candidate !== 'object') {
    throw new Error('Invalid Broadsheet project file.');
  }
  return {
    ...DEFAULT_CONFIG,
    ...candidate,
    typography: {
      ...DEFAULT_CONFIG.typography,
      ...(candidate.typography ?? {}),
    },
    palette: {
      ...DEFAULT_CONFIG.palette,
      ...(candidate.palette ?? {}),
    },
    spanEvents: Array.isArray(candidate.spanEvents) ? candidate.spanEvents : [],
    events: undefined,
  };
}
