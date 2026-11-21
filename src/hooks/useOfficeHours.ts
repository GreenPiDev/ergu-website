import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { COMPANY } from '../content/company';

const { timeZone, schedule } = COMPANY.hours;

type ScheduleEntry = (typeof schedule)[number];

// Saat ve açık/kapalı durumu bu aralıkla yenilenir. Dakika değişimini en geç bu kadar gecikmeyle yakalar.
const TICK_MS = 15_000;

const WEEKDAY_INDEX: Readonly<Record<string, number>> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
// Hafta pazartesi başlar, pazar en sondadır.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

// Firmanın saat dilimindeki gün ve dakika. Ziyaretçinin saat dilimi sonucu değiştirmez.
const zonedParts = new Intl.DateTimeFormat('en-US', {
  timeZone,
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function toMinutes(time: string): number {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function getEntry(weekday: number): ScheduleEntry | undefined {
  return schedule.find(({ days }) => (days as readonly number[]).includes(weekday));
}

/** Firmanın saat dilimine göre o anın günü ve o günün çalışma saatleri. */
function getZonedState(date: Date) {
  const parts = Object.fromEntries(zonedParts.formatToParts(date).map(({ type, value }) => [type, value]));
  const weekday = WEEKDAY_INDEX[parts.weekday ?? ''] ?? 0;
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  const today = getEntry(weekday);
  const isOpen = today !== undefined && minutes >= toMinutes(today.open) && minutes < toMinutes(today.close);
  return { today, isOpen };
}

/** Pazar 0 olmak üzere günün kısa adı, aktif dilde (Pzt, Mon). 31 Aralık 2023 bir pazardır. */
function formatWeekday(day: number, language: string): string {
  return new Intl.DateTimeFormat(language, { weekday: 'short', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2023, 11, 31 + day)),
  );
}

/** Ardışık günler "Pzt–Cum", tek gün "Cmt" olarak yazılır. */
function formatDays(days: readonly number[], language: string): string {
  const first = days[0] ?? 0;
  const last = days[days.length - 1] ?? first;
  return first === last
    ? formatWeekday(first, language)
    : `${formatWeekday(first, language)}–${formatWeekday(last, language)}`;
}

/** Kapalı günleri hafta sırasıyla ardışık gruplara ayırır (ör. yalnızca pazar). */
function getClosedGroups(): number[][] {
  const groups: number[][] = [];
  let previousClosed = false;
  for (const day of WEEK_ORDER) {
    const isClosed = getEntry(day) === undefined;
    if (isClosed && previousClosed) groups[groups.length - 1]?.push(day);
    else if (isClosed) groups.push([day]);
    previousClosed = isClosed;
  }
  return groups;
}

const CLOSED_GROUPS = getClosedGroups();

/**
 * Firmanın şu an açık olup olmadığı, bugünün saatleri, saat dilimindeki saat ve haftalık çalışma saatlerinin satırları
 * ("Pzt–Cum · 09:00–18:30", "Paz · Kapalı"). Her sayfada kullanılabilir, metinleri ortak çeviri dosyasından gelir.
 */
export function useOfficeHours() {
  const { t, i18n } = useTranslation();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  const language = i18n.language;
  const time = new Intl.DateTimeFormat(language, { timeZone, hour: '2-digit', minute: '2-digit' }).format(now);
  const { today, isOpen } = getZonedState(now);

  const hoursLines = [
    ...schedule.map(({ days, open, close }) =>
      t('company.hours.open', { days: formatDays(days, language), open, close }),
    ),
    ...CLOSED_GROUPS.map((days) => t('company.hours.closed', { days: formatDays(days, language) })),
  ];

  return { isOpen, today, time, hoursLines };
}
