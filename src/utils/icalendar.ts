import { EVENT_COLORS } from '../data/presets';
import { CalendarSpanEvent } from '../types/calendar';

export function addDaysToDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const utc = Date.UTC(y, m - 1, d + deltaDays);
  const dt = new Date(utc);
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function toCompactDate(dateKey: string): string {
  return dateKey.replace(/-/g, '');
}

function escapeICSText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function unescapeICSText(value: string): string {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

function formatDTStampUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  return `${y}${m}${d}T${hh}${mm}${ss}Z`;
}

function foldICSLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let idx = 0;
  parts.push(line.slice(0, 75));
  idx = 75;
  while (idx < line.length) {
    parts.push(' ' + line.slice(idx, idx + 74));
    idx += 74;
  }
  return parts.join('\r\n');
}

export function exportEventsToICS(
  spanEvents: CalendarSpanEvent[],
  calendarName: string
): string {
  const dtStamp = formatDTStampUTC(new Date());
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Broadsheet//Wall Calendar Studio//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeICSText(calendarName || 'Broadsheet Calendar')}`,
  ];

  const sorted = [...spanEvents].sort((a, b) => a.startDate.localeCompare(b.startDate));

  for (const ev of sorted) {
    if (!ev.startDate || !ev.title) continue;
    const inclusiveEnd = ev.endDate && ev.endDate >= ev.startDate ? ev.endDate : ev.startDate;
    // RFC 5545 all-day DTEND is exclusive (+1 day)
    const exclusiveEnd = addDaysToDateKey(inclusiveEnd, 1);

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${ev.id.replace(/[^a-zA-Z0-9_.-]/g, '')}@broadsheet.local`);
    lines.push(`DTSTAMP:${dtStamp}`);
    lines.push(`DTSTART;VALUE=DATE:${toCompactDate(ev.startDate)}`);
    lines.push(`DTEND;VALUE=DATE:${toCompactDate(exclusiveEnd)}`);
    lines.push(`SUMMARY:${escapeICSText(ev.title)}`);
    if (ev.color) {
      lines.push(`X-BROADSHEET-COLOR:${ev.color}`);
    }
    if (ev.fillCell) {
      lines.push('X-BROADSHEET-FILL:1');
    }
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.map(foldICSLine).join('\r\n') + '\r\n';
}

export function downloadICSFile(icsContent: string, filename: string): void {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface ParsedICSDate {
  dateKey: string;
  isAllDay: boolean;
  isMidnight: boolean;
}

function parseICSDateValue(rawVal: string, params: string): ParsedICSDate | null {
  const val = rawVal.trim();
  const hasValueDate = params.toUpperCase().includes('VALUE=DATE') && !params.toUpperCase().includes('VALUE=DATE-TIME');

  // Basic YYYYMMDD
  const dateOnlyMatch = /^(\d{4})(\d{2})(\d{2})$/.exec(val);
  if (dateOnlyMatch) {
    const [, y, m, d] = dateOnlyMatch;
    return {
      dateKey: `${y}-${m}-${d}`,
      isAllDay: true,
      isMidnight: true,
    };
  }

  // ISO-like YYYY-MM-DD
  const hyphenDateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(val);
  if (hyphenDateMatch) {
    const [, y, m, d] = hyphenDateMatch;
    return {
      dateKey: `${y}-${m}-${d}`,
      isAllDay: true,
      isMidnight: true,
    };
  }

  // DateTime YYYYMMDDTHHMMSS(Z?)
  const dtMatch = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/i.exec(val);
  if (dtMatch) {
    const [, y, m, d, hh, mm, ss, isUtc] = dtMatch;
    if (isUtc.toUpperCase() === 'Z') {
      const dt = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss)));
      const ly = dt.getFullYear();
      const lm = String(dt.getMonth() + 1).padStart(2, '0');
      const ld = String(dt.getDate()).padStart(2, '0');
      const isMidnight = dt.getHours() === 0 && dt.getMinutes() === 0 && dt.getSeconds() === 0;
      return {
        dateKey: `${ly}-${lm}-${ld}`,
        isAllDay: hasValueDate,
        isMidnight,
      };
    }
    const isMidnight = hh === '00' && mm === '00' && ss === '00';
    return {
      dateKey: `${y}-${m}-${d}`,
      isAllDay: hasValueDate,
      isMidnight,
    };
  }

  return null;
}

function parseSimpleDurationDays(duration: string): number {
  // Matches PnD or PnW
  const weekMatch = /P(\d+)W/i.exec(duration);
  if (weekMatch) return Math.max(1, Number(weekMatch[1]) * 7);
  const dayMatch = /P(\d+)D/i.exec(duration);
  if (dayMatch) return Math.max(1, Number(dayMatch[1]));
  return 1;
}

export function parseICSToSpanEvents(icsText: string): {
  events: CalendarSpanEvent[];
  skippedCount: number;
} {
  // Unfold RFC 5545 folded lines (CRLF + SPACE/TAB or LF + SPACE/TAB)
  const unfolded = icsText.replace(/\r?\n[ \t]/g, '');
  const rawLines = unfolded.split(/\r?\n/);

  const events: CalendarSpanEvent[] = [];
  let skippedCount = 0;

  let inEvent = false;
  let props: Record<string, { params: string; value: string }> = {};
  let colorIndex = 0;

  const flushEvent = () => {
    const summaryProp = props['SUMMARY'];
    const dtStartProp = props['DTSTART'];
    if (!summaryProp || !dtStartProp) {
      skippedCount += 1;
      return;
    }

    const title = unescapeICSText(summaryProp.value).trim();
    const startParsed = parseICSDateValue(dtStartProp.value, dtStartProp.params);
    if (!title || !startParsed) {
      skippedCount += 1;
      return;
    }

    let endDateKey = startParsed.dateKey;
    const dtEndProp = props['DTEND'];
    const durationProp = props['DURATION'];

    if (dtEndProp) {
      const endParsed = parseICSDateValue(dtEndProp.value, dtEndProp.params);
      if (endParsed) {
        if (endParsed.isAllDay || endParsed.isMidnight) {
          // Exclusive DTEND for all-day / midnight-boundary events -> subtract 1 day
          const adjusted = addDaysToDateKey(endParsed.dateKey, -1);
          endDateKey = adjusted >= startParsed.dateKey ? adjusted : startParsed.dateKey;
        } else {
          endDateKey =
            endParsed.dateKey >= startParsed.dateKey ? endParsed.dateKey : startParsed.dateKey;
        }
      }
    } else if (durationProp) {
      const spanDays = parseSimpleDurationDays(durationProp.value);
      endDateKey = addDaysToDateKey(startParsed.dateKey, spanDays - 1);
    }

    const explicitColor = props['X-BROADSHEET-COLOR']?.value.trim();
    const validHex = explicitColor && /^#[0-9a-fA-F]{6}$/.test(explicitColor)
      ? explicitColor
      : EVENT_COLORS[colorIndex % EVENT_COLORS.length].hex;
    colorIndex += 1;

    const fillCell = props['X-BROADSHEET-FILL']?.value.trim() === '1';

    events.push({
      id: `ics-${Date.now()}-${colorIndex}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      startDate: startParsed.dateKey,
      endDate: endDateKey,
      color: validHex,
      fillCell,
    });
  };

  for (const rawLine of rawLines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.toUpperCase() === 'BEGIN:VEVENT') {
      inEvent = true;
      props = {};
      continue;
    }

    if (line.toUpperCase() === 'END:VEVENT') {
      if (inEvent) {
        flushEvent();
      }
      inEvent = false;
      props = {};
      continue;
    }

    if (!inEvent) continue;

    const colonIdx = line.indexOf(':');
    if (colonIdx <= 0) continue;

    const left = line.slice(0, colonIdx);
    const value = line.slice(colonIdx + 1);
    const semiIdx = left.indexOf(';');
    const name = (semiIdx >= 0 ? left.slice(0, semiIdx) : left).toUpperCase().trim();
    const params = semiIdx >= 0 ? left.slice(semiIdx + 1) : '';

    props[name] = { params, value };
  }

  return { events, skippedCount };
}
