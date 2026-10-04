const TYPE = { tuk: 'myoklonie', velka: 'GTCS', davka: 'vynechaná/opožděná dávka' };
const SLOT = { morning: 'ráno', evening: 'večer' };
const DAY = 864e5;
const WEEK = 7 * DAY;
const MAX_WEEKS = 13;
const p = (n) => String(n).padStart(2, '0');

export const fmtDate = (t) => { const d = new Date(t); return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`; };
export const fmtTime = (t) => { const d = new Date(t); return `${p(d.getHours())}:${p(d.getMinutes())}`; };
const dayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

export function buildReport(events, { days, now, name = '', medication = '' }) {
  const from = now - days * DAY;
  const inPeriod = events.filter((e) => !e.deleted_at && e.occurred_at >= from).sort((a, b) => a.occurred_at - b.occurred_at);
  const tuks = inPeriod.filter((e) => e.type === 'tuk');

  const totals = { tuk: tuks.length, velka: 0, davka: 0 };
  for (const e of inPeriod) if (e.type !== 'tuk') totals[e.type]++;

  const weekCount = Math.min(MAX_WEEKS, Math.max(1, Math.ceil(days / 7)));
  const weeks = [];
  for (let i = weekCount - 1; i >= 0; i--) {
    const end = now - i * WEEK;
    const start = end - WEEK;
    weeks.push({
      label: fmtDate(start).slice(0, 6),
      tuk: tuks.filter((e) => e.occurred_at >= start && (i === 0 ? e.occurred_at <= end : e.occurred_at < end)).length,
    });
  }

  const counts = new Map();
  for (const e of tuks) for (const t of e.triggers || []) counts.set(t, (counts.get(t) || 0) + 1);
  const labels = [...counts].map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'cs'));

  const missedDoseDays = new Set(inPeriod.filter((e) => e.type === 'davka').map((e) => dayKey(e.occurred_at))).size;

  const rows = inPeriod.map((e) => ({
    t: e.occurred_at,
    date: fmtDate(e.occurred_at),
    time: fmtTime(e.occurred_at),
    type: TYPE[e.type] ?? e.type,
    intensity: e.type === 'tuk' ? (e.intensity ?? '') : '',
    labels: (e.triggers || []).join('; '),
    duration: e.duration_min ?? '',
    rescue: e.type === 'velka' ? (e.rescue_given ? 'ano' : 'ne') : '',
    slot: e.type === 'davka' ? (SLOT[e.dose_slot] ?? '') : '',
    note: e.note || '',
  }));

  return { name, medication, generatedAt: now, from, to: now, days, totals, weeks, weeksCapped: days > MAX_WEEKS * 7, labels, missedDoseDays, rows };
}
