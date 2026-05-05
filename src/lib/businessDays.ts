function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function easterDate(year: number) {
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
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function getBrazilNationalHolidayKeys(year: number) {
  const fixed = [
    `${year}-01-01`,
    `${year}-04-21`,
    `${year}-05-01`,
    `${year}-09-07`,
    `${year}-10-12`,
    `${year}-11-02`,
    `${year}-11-15`,
    `${year}-11-20`,
    `${year}-12-25`,
  ];

  const easter = easterDate(year);
  const movable = [addDays(easter, -48), addDays(easter, -47), addDays(easter, -2), addDays(easter, 60)].map(dateKey);

  return new Set([...fixed, ...movable]);
}

export function isBusinessDay(date: Date, extraHolidayKeys: string[] = []) {
  const day = date.getDay();
  if (day === 0 || day === 6) return false;

  const key = dateKey(date);
  if (getBrazilNationalHolidayKeys(date.getFullYear()).has(key)) return false;
  return !extraHolidayKeys.includes(key);
}

export function getNthBusinessDay(year: number, monthIndex: number, nth: number, extraHolidayKeys: string[] = []) {
  let found = 0;
  const cursor = new Date(year, monthIndex, 1);

  while (cursor.getMonth() === monthIndex) {
    if (isBusinessDay(cursor, extraHolidayKeys)) {
      found += 1;
      if (found === nth) return new Date(cursor);
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return new Date(year, monthIndex + 1, 0);
}

export function adjustToPreviousBusinessDay(date: Date, extraHolidayKeys: string[] = []) {
  const cursor = new Date(date);
  while (!isBusinessDay(cursor, extraHolidayKeys)) {
    cursor.setDate(cursor.getDate() - 1);
  }
  return cursor;
}

export function toISODate(date: Date) {
  return dateKey(date);
}
