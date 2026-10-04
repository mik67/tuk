import { normalizeSettings } from './settings.js';

export const FORMAT = 'tuk-backup';
export const VERSION = 1;
export const FIRST_BACKUP_DAYS = 7;
export const BACKUP_DAYS = 30;
export const BACKUP_EVENTS = 50;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPES = ['tuk', 'velka', 'davka'];
const MAX = Number.MAX_SAFE_INTEGER;
const DAY = 864e5;

// int v rozsahu, nebo null (chybí), nebo NaN (neplatné)
const optInt = (v, min, max) => (v === null || v === undefined ? null : Number.isInteger(v) && v >= min && v <= max ? v : NaN);

export function normalizeEvent(e) {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return null;
  if (typeof e.id !== 'string' || !UUID.test(e.id)) return null;
  if (!TYPES.includes(e.type)) return null;
  const occurred = optInt(e.occurred_at, 1, MAX);
  const updated = optInt(e.updated_at, 1, MAX);
  if (occurred === null || updated === null || Number.isNaN(occurred) || Number.isNaN(updated)) return null;
  const intensity = optInt(e.intensity, 1, 3);
  const duration = optInt(e.duration_min, 0, 600);
  const deleted = optInt(e.deleted_at, 1, MAX);
  if ([intensity, duration, deleted].some(Number.isNaN)) return null;
  const note = e.note ?? '';
  if (typeof note !== 'string' || note.length > 1000) return null;
  const triggers = e.triggers ?? [];
  if (!Array.isArray(triggers) || triggers.length > 20 || triggers.some((t) => typeof t !== 'string' || !t || t.length > 40)) return null;
  const series = e.series_id ?? null;
  if (series !== null && (typeof series !== 'string' || !UUID.test(series))) return null;
  const rescue = e.rescue_given ?? null;
  if (rescue !== null && typeof rescue !== 'boolean') return null;
  const slot = e.dose_slot ?? null;
  if (slot !== null && !['morning', 'evening'].includes(slot)) return null;
  return {
    id: e.id.toLowerCase(), type: e.type, occurred_at: occurred, updated_at: updated,
    intensity, duration_min: duration, rescue_given: rescue, dose_slot: slot, note,
    triggers: [...triggers], series_id: series === null ? null : series.toLowerCase(), deleted_at: deleted,
  };
}

export function buildBackup(events, settings, now) {
  return {
    format: FORMAT,
    version: VERSION,
    exported_at: now,
    settings: normalizeSettings(settings),
    events: events.map(normalizeEvent).filter(Boolean),
  };
}

export function parseBackup(text) {
  if (typeof text !== 'string' || !text || text.length > 20_000_000) {
    return { ok: false, error: 'Soubor je prázdný nebo příliš velký.' };
  }
  let j;
  try { j = JSON.parse(text); } catch { return { ok: false, error: 'Soubor nejde přečíst. Není to platná záloha.' }; }
  if (!j || typeof j !== 'object' || j.format !== FORMAT) return { ok: false, error: 'Toto není záloha aplikace Ťuk.' };
  if (!Number.isInteger(j.version) || j.version < 1) return { ok: false, error: 'Záloha má neplatnou verzi.' };
  if (j.version > VERSION) return { ok: false, error: 'Záloha je z novější verze aplikace. Aktualizujte aplikaci.' };
  if (!Array.isArray(j.events) || j.events.length > 200_000) return { ok: false, error: 'Záloha neobsahuje záznamy.' };
  return { ok: true, backup: j };
}

export function mergeBackup(localEvents, backup) {
  const local = new Map(localEvents.map((e) => [e.id, e]));
  const out = { put: [], added: 0, updated: 0, skipped: 0, invalid: 0 };
  for (const raw of backup.events) {
    const inc = normalizeEvent(raw);
    if (!inc) { out.invalid++; continue; }
    const cur = local.get(inc.id);
    if (!cur) { out.put.push(inc); out.added++; }
    else if (inc.updated_at > cur.updated_at) { out.put.push(inc); out.updated++; }
    else out.skipped++;
  }
  return out;
}

export function backupDue({ events, lastBackupAt, now }) {
  const live = events.filter((e) => !e.deleted_at);
  if (!live.length) return false;
  if (!lastBackupAt) {
    const oldest = Math.min(...live.map((e) => e.occurred_at));
    return now - oldest >= FIRST_BACKUP_DAYS * DAY;
  }
  const since = events.filter((e) => e.updated_at > lastBackupAt).length;
  return now - lastBackupAt >= BACKUP_DAYS * DAY || since >= BACKUP_EVENTS;
}

export function backupFilename(now) {
  return `tuk-zaloha-${new Date(now).toISOString().slice(0, 10)}.json`;
}

// Panel „Data zmizela“ musí přetrvat i po prvním novém záznamu, dokud uživatel data neobnoví nebo panel nezavře.
export const lostDataStatus = ({ hadData, eventCount, flag }) => !!flag || (!!hadData && eventCount === 0);
