import type { Store } from './types';
const zones: Record<string, string> = { VIC: 'Australia/Melbourne', NSW: 'Australia/Sydney', ACT: 'Australia/Sydney', QLD: 'Australia/Brisbane', SA: 'Australia/Adelaide', WA: 'Australia/Perth', TAS: 'Australia/Hobart', NT: 'Australia/Darwin' };
export function hoursToday(store: Store, now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-AU', { timeZone: zones[store.state] ?? 'Australia/Sydney', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  const raw = store.hours[part('weekday').toLowerCase()];
  if (!raw) return 'Hours not supplied';
  if (/closed/i.test(raw)) return 'Closed today';
  const match = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)\s*[-–]\s*(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return `Today: ${raw}`;
  const mins = (h: string, m: string, ap: string) => (Number(h) % 12 + (ap.toUpperCase() === 'PM' ? 12 : 0)) * 60 + Number(m);
  const open = mins(match[1], match[2], match[3]), close = mins(match[4], match[5], match[6]);
  const current = Number(part('hour')) * 60 + Number(part('minute')); 
  if (current < open) return `Opens ${Number(match[1])}:${match[2]} ${match[3]}`;
  if (current < close) return `Open · closes ${Number(match[4])}:${match[5]} ${match[6]}`;
  return 'Closed for today';
}
