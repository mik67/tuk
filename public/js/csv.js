const TYPE = { tuk: 'myoklonie', velka: 'GTCS', davka: 'vynechaná/opožděná dávka' };
const SLOT = { morning: 'ráno', evening: 'večer' };
const p = (n) => String(n).padStart(2, '0');
const safe = (v) => {
  const s = String(v ?? '');
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
};

export function buildCsv(events, days, now) {
  const from = now - days * 864e5;
  const rows = [['datum', 'cas', 'typ', 'intenzita', 'co_predchazelo', 'delka_min', 'zachranny_lek', 'davka', 'poznamka']];
  events
    .filter((e) => !e.deleted_at && e.occurred_at >= from)
    .sort((a, b) => a.occurred_at - b.occurred_at)
    .forEach((e) => {
      const d = new Date(e.occurred_at);
      rows.push([
        `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`,
        `${p(d.getHours())}:${p(d.getMinutes())}`,
        TYPE[e.type] ?? e.type,
        e.type === 'tuk' ? (e.intensity ?? '') : '',
        (e.triggers || []).join('; '),
        e.duration_min ?? '',
        e.type === 'velka' ? (e.rescue_given ? 'ano' : 'ne') : '',
        e.type === 'davka' ? (SLOT[e.dose_slot] ?? '') : '',
        e.note || '',
      ]);
    });
  return '﻿' + rows.map((r) => r.map((c) => '"' + safe(c).replace(/"/g, '""') + '"').join(';')).join('\r\n');
}
