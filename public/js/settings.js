import { MAX_TRIGGERS, MAX_LEN } from './triggers.js';

export const DEFAULTS = Object.freeze({
  name: '',
  medication: '',
  default_intensity: 2,
  default_triggers: [],
  triggers: ['málo spánku', 'vynechaná dávka', 'stres', 'alkohol', 'nemoc'],
  series_minutes: 60,
});

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const inRange = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

function cleanLabels(list) {
  const seen = new Set();
  const out = [];
  for (const t of list) {
    if (typeof t !== 'string') continue;
    const label = t.trim().slice(0, MAX_LEN);
    if (!label || seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    out.push(label);
    if (out.length >= MAX_TRIGGERS) break;
  }
  return out;
}

export function normalizeSettings(raw) {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const triggers = Array.isArray(r.triggers) ? cleanLabels(r.triggers) : [...DEFAULTS.triggers];
  return {
    name: str(r.name, 60),
    medication: str(r.medication, 500),
    default_intensity: inRange(r.default_intensity, 1, 3) ? r.default_intensity : DEFAULTS.default_intensity,
    default_triggers: Array.isArray(r.default_triggers) ? r.default_triggers.filter((t) => triggers.includes(t)) : [],
    triggers,
    series_minutes: inRange(r.series_minutes, 5, 240) ? r.series_minutes : DEFAULTS.series_minutes,
  };
}

export async function loadSettings(store) {
  return normalizeSettings(await store.getMeta('settings'));
}

export async function saveSettings(store, patch) {
  const next = normalizeSettings({ ...(await loadSettings(store)), ...patch });
  await store.setMeta('settings', next);
  return next;
}
