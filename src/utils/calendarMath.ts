export const MONTH_NAMES_FULL = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export const MONTH_NAMES_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export const WEEKDAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const WEEKDAY_NAMES_SINGLE = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function getDaysInMonth(year: number, monthIndex: number): number {
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return days[monthIndex];
}

export function formatDateKey(year: number, monthIndex: number, day: number): string {
  const m = String(monthIndex + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

export function getDayOfWeek(year: number, monthIndex: number, day: number): number {
  return new Date(Date.UTC(year, monthIndex, day)).getUTCDay();
}

export function getDayOfYear(year: number, monthIndex: number, day: number): number {
  let total = day;
  for (let m = 0; m < monthIndex; m++) {
    total += getDaysInMonth(year, m);
  }
  return total;
}

export function getISOWeekNumber(year: number, monthIndex: number, day: number): number {
  const date = new Date(Date.UTC(year, monthIndex, day));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Returns 'new' | 'full' | null for major lunar phase markers using synodic period.
 */
export function getMajorMoonPhase(
  year: number,
  monthIndex: number,
  day: number
): 'new' | 'full' | null {
  const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14, 0);
  const synodicMonth = 29.53058867;
  const targetNoon = Date.UTC(year, monthIndex, day, 12, 0, 0);
  const prevNoon = Date.UTC(year, monthIndex, day - 1, 12, 0, 0);

  const cycleAt = (t: number) => {
    const days = (t - knownNewMoon) / 86400000;
    return ((days / synodicMonth) % 1 + 1) % 1;
  };

  const pPrev = cycleAt(prevNoon);
  const pCurr = cycleAt(targetNoon);

  if (pPrev > 0.85 && pCurr < 0.15) return 'new';
  if (pPrev < 0.5 && pCurr >= 0.5) return 'full';
  return null;
}

function nthWeekdayOfMonth(year: number, monthIndex: number, weekday: number, nth: number): number {
  const firstDay = getDayOfWeek(year, monthIndex, 1);
  const offset = (weekday - firstDay + 7) % 7;
  return 1 + offset + (nth - 1) * 7;
}

function lastWeekdayOfMonth(year: number, monthIndex: number, weekday: number): number {
  const dim = getDaysInMonth(year, monthIndex);
  const lastDay = getDayOfWeek(year, monthIndex, dim);
  const offset = (lastDay - weekday + 7) % 7;
  return dim - offset;
}

function getEasterSunday(year: number): { monthIndex: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { monthIndex: month - 1, day };
}

export function getUSHolidaysForYear(year: number): Record<string, string> {
  const map: Record<string, string> = {};
  const add = (m: number, d: number, name: string) => {
    map[formatDateKey(year, m, d)] = name;
  };

  add(0, 1, "New Year's Day");
  add(0, nthWeekdayOfMonth(year, 0, 1, 3), 'MLK Jr. Day');
  add(1, nthWeekdayOfMonth(year, 1, 1, 3), "Presidents' Day");

  const easter = getEasterSunday(year);
  add(easter.monthIndex, easter.day, 'Easter');

  add(4, lastWeekdayOfMonth(year, 4, 1), 'Memorial Day');
  add(5, 19, 'Juneteenth');
  add(6, 4, 'Independence Day');
  add(8, nthWeekdayOfMonth(year, 8, 1, 1), 'Labor Day');
  add(9, nthWeekdayOfMonth(year, 9, 1, 2), 'Indigenous Peoples');
  add(10, 11, 'Veterans Day');
  add(10, nthWeekdayOfMonth(year, 10, 4, 4), 'Thanksgiving');
  add(11, 25, 'Christmas Day');
  add(11, 31, "New Year's Eve");

  return map;
}

export function getOrderedWeekdays(weekStart: 0 | 1, singleChar = false): string[] {
  const source = singleChar ? WEEKDAY_NAMES_SINGLE : WEEKDAY_NAMES_SHORT;
  const result: string[] = [];
  for (let i = 0; i < 7; i++) {
    result.push(source[(weekStart + i) % 7]);
  }
  return result;
}
