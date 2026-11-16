import { EVENT_COLORS } from '../data/presets';
import { CalendarSpanEvent } from '../types/calendar';
import { addDaysToDateKey } from './icalendar';

export class GoogleAuthExpiredError extends Error {
  constructor(message = 'Google session expired. Please sign in again.') {
    super(message);
    this.name = 'GoogleAuthExpiredError';
  }
}

export interface GoogleCalendarListItem {
  id: string;
  summary: string;
  primary?: boolean;
  accessRole?: string;
  backgroundColor?: string;
}

interface GoogleRawEvent {
  id: string;
  status?: string;
  summary?: string;
  colorId?: string;
  start?: {
    date?: string;
    dateTime?: string;
  };
  end?: {
    date?: string;
    dateTime?: string;
  };
  extendedProperties?: {
    private?: Record<string, string>;
  };
}

const GOOGLE_COLOR_MAP: Record<string, string> = {
  '1': '#1D4ED8',
  '2': '#15803D',
  '3': '#881337',
  '4': '#DC2626',
  '5': '#D97706',
  '6': '#D97706',
  '7': '#1D4ED8',
  '8': '#27272A',
  '9': '#1D4ED8',
  '10': '#15803D',
  '11': '#DC2626',
};

export function getVisibleDateBounds(
  year: number,
  schoolYear: boolean
): { startDate: string; endDate: string; label: string } {
  if (schoolYear) {
    return {
      startDate: `${year}-07-01`,
      endDate: `${year + 1}-06-30`,
      label: `Jul ${year} – Jun ${year + 1}`,
    };
  }
  return {
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
    label: `Jan – Dec ${year}`,
  };
}

function toLocalDateKey(isoDateTime: string): { dateKey: string; isMidnight: boolean } {
  const dt = new Date(isoDateTime);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  const isMidnight = dt.getHours() === 0 && dt.getMinutes() === 0 && dt.getSeconds() === 0;
  return { dateKey: `${y}-${m}-${d}`, isMidnight };
}

async function googleFetch<T>(url: string, accessToken: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (res.status === 401) {
    throw new GoogleAuthExpiredError();
  }

  if (!res.ok) {
    let errDetail = `Google Calendar error (${res.status})`;
    try {
      const json = await res.json();
      if (json?.error?.message) errDetail = json.error.message;
    } catch {
      // ignore json parse failure
    }
    throw new Error(errDetail);
  }

  return res.json() as Promise<T>;
}

export async function fetchGoogleCalendars(
  accessToken: string
): Promise<GoogleCalendarListItem[]> {
  const data = await googleFetch<{ items?: GoogleCalendarListItem[] }>(
    'https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader',
    accessToken
  );
  const items = data.items ?? [];
  return [...items].sort((a, b) => {
    if (a.primary && !b.primary) return -1;
    if (!a.primary && b.primary) return 1;
    return (a.summary || '').localeCompare(b.summary || '');
  });
}

async function fetchRawEventsInRange(
  accessToken: string,
  calendarId: string,
  startDate: string,
  endDate: string
): Promise<GoogleRawEvent[]> {
  const timeMin = new Date(`${startDate}T00:00:00`).toISOString();
  const timeMax = new Date(`${endDate}T23:59:59`).toISOString();

  const allItems: GoogleRawEvent[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '2500',
    });
    if (pageToken) {
      params.set('pageToken', pageToken);
    }
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calendarId
    )}/events?${params.toString()}`;
    const page = await googleFetch<{ items?: GoogleRawEvent[]; nextPageToken?: string }>(
      url,
      accessToken
    );
    if (page.items) {
      allItems.push(...page.items);
    }
    pageToken = page.nextPageToken;
  } while (pageToken);

  return allItems;
}

export async function fetchGoogleCalendarEvents(
  accessToken: string,
  calendarId: string,
  startDate: string,
  endDate: string
): Promise<CalendarSpanEvent[]> {
  const rawItems = await fetchRawEventsInRange(accessToken, calendarId, startDate, endDate);
  const mapped: CalendarSpanEvent[] = [];
  let colorIdx = 0;

  for (const item of rawItems) {
    if (item.status === 'cancelled' || !item.summary?.trim()) continue;

    let evStart: string | null = null;
    let evEnd: string | null = null;

    if (item.start?.date) {
      evStart = item.start.date;
      if (item.end?.date) {
        const inclusive = addDaysToDateKey(item.end.date, -1);
        evEnd = inclusive >= evStart ? inclusive : evStart;
      } else {
        evEnd = evStart;
      }
    } else if (item.start?.dateTime) {
      const s = toLocalDateKey(item.start.dateTime);
      evStart = s.dateKey;
      if (item.end?.dateTime) {
        const e = toLocalDateKey(item.end.dateTime);
        if (e.isMidnight && e.dateKey > s.dateKey) {
          const adj = addDaysToDateKey(e.dateKey, -1);
          evEnd = adj >= s.dateKey ? adj : s.dateKey;
        } else {
          evEnd = e.dateKey >= s.dateKey ? e.dateKey : s.dateKey;
        }
      } else {
        evEnd = evStart;
      }
    }

    if (!evStart || !evEnd) continue;

    // Clamp to requested calendar sheet range so multi-year events fit cleanly
    const clampedStart = evStart < startDate ? startDate : evStart;
    const clampedEnd = evEnd > endDate ? endDate : evEnd;
    if (clampedEnd < clampedStart) continue;

    const customColor = item.extendedProperties?.private?.broadsheetColor;
    const color =
      customColor && /^#[0-9a-fA-F]{6}$/.test(customColor)
        ? customColor
        : (item.colorId && GOOGLE_COLOR_MAP[item.colorId]) ||
          EVENT_COLORS[colorIdx % EVENT_COLORS.length].hex;
    colorIdx += 1;

    mapped.push({
      id: `gcal-${item.id}`,
      title: item.summary.trim(),
      startDate: clampedStart,
      endDate: clampedEnd,
      color,
      fillCell: false,
    });
  }

  return mapped;
}

export async function syncEventsToGoogleCalendar(
  accessToken: string,
  calendarId: string,
  events: CalendarSpanEvent[]
): Promise<{ created: number; updated: number; skipped: number }> {
  if (events.length === 0) {
    return { created: 0, updated: 0, skipped: 0 };
  }

  const minDate = events.reduce((min, ev) => (ev.startDate < min ? ev.startDate : min), events[0].startDate);
  const maxDate = events.reduce((max, ev) => (ev.endDate > max ? ev.endDate : max), events[0].endDate);

  const existingRaw = await fetchRawEventsInRange(accessToken, calendarId, minDate, maxDate);
  const byBroadsheetId = new Map<string, GoogleRawEvent>();
  const signatureSet = new Set<string>();

  for (const raw of existingRaw) {
    const bId = raw.extendedProperties?.private?.broadsheetId;
    if (bId) {
      byBroadsheetId.set(bId, raw);
    }
    if (raw.summary && raw.start?.date && raw.end?.date) {
      const inclusiveEnd = addDaysToDateKey(raw.end.date, -1);
      signatureSet.add(`${raw.summary.trim()}|${raw.start.date}|${inclusiveEnd}`);
    }
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const ev of events) {
    const inclusiveEnd = ev.endDate && ev.endDate >= ev.startDate ? ev.endDate : ev.startDate;
    const exclusiveEnd = addDaysToDateKey(inclusiveEnd, 1);
    const body = {
      summary: ev.title,
      start: { date: ev.startDate },
      end: { date: exclusiveEnd },
      extendedProperties: {
        private: {
          broadsheetId: ev.id,
          broadsheetColor: ev.color,
        },
      },
    };

    const existingMatch = byBroadsheetId.get(ev.id);
    if (existingMatch) {
      const sameTitle = existingMatch.summary?.trim() === ev.title.trim();
      const sameDates =
        existingMatch.start?.date === ev.startDate && existingMatch.end?.date === exclusiveEnd;
      if (sameTitle && sameDates) {
        skipped += 1;
        continue;
      }
      await googleFetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
          calendarId
        )}/events/${encodeURIComponent(existingMatch.id)}`,
        accessToken,
        {
          method: 'PATCH',
          body: JSON.stringify(body),
        }
      );
      updated += 1;
      continue;
    }

    const sig = `${ev.title.trim()}|${ev.startDate}|${inclusiveEnd}`;
    if (signatureSet.has(sig)) {
      skipped += 1;
      continue;
    }

    await googleFetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    );
    signatureSet.add(sig);
    created += 1;
  }

  return { created, updated, skipped };
}
