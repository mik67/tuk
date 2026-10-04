import { Store } from './store.js';
import { loadSettings, saveSettings, DEFAULTS, normalizeSettings } from './settings.js';
import { seriesIdFor, isDuplicateTap } from './series.js';
import { buildCsv } from './csv.js';
import { addTrigger, removeTrigger, pruneDefaults } from './triggers.js';
import { buildBackup, parseBackup, mergeBackup, backupDue, backupFilename, lostDataStatus } from './backup.js';
import { saveEvent, applyMerge } from './repo.js';
import { buildReport, fmtDate, fmtTime } from './report.js';
import { buildPdf } from './pdf.js';
import { detectPlatform, installMode, shouldReloadOnControllerChange } from './install.js';
import { shareFiles, downloadFile } from './share.js';
import { PURPOSE, PRIVACY, INSTALL, SOURCE_URL } from './cs.js';
import { VERSION } from './version.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* nic */ } };
const lsDel = (k) => { try { localStorage.removeItem(k); } catch { /* nic */ } };

const TYPE = { tuk: { n: 'Ťuk', i: '●' }, velka: { n: 'Velká událost', i: '▲' }, davka: { n: 'Dávka', i: '■' } };
const SLOT = { morning: 'ráno', evening: 'večer' };

let store;
let EV = [];
let SET = normalizeSettings({});
let lastTap = 0;
let deferredPrompt = null;
let exportFiles = null;

const live = () => EV.filter((e) => !e.deleted_at);
const uuid = () => crypto.randomUUID();
const dayKey = (t) => { const d = new Date(t); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
const fmtD = (t) => new Date(t).toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' });
const toLocalInput = (t) => new Date(t - new Date(t).getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const isoDay = () => new Date().toISOString().slice(0, 10);

/* ---------- navigace ---------- */
function go(v) {
  $$('.view').forEach((e) => e.classList.toggle('on', e.id === 'v-' + v));
  const r = { home: renderHome, history: renderHist, stats: renderStats, settings: renderSet, about: renderAbout, welcome: renderWelcome }[v];
  if (r) r();
}
$$('[data-go]').forEach((b) => { b.onclick = () => go(b.dataset.go); });
function renderAll() {
  renderHome();
  if ($('#v-history').classList.contains('on')) renderHist();
  if ($('#v-stats').classList.contains('on')) renderStats();
}

/* ---------- ukládání ---------- */
async function commit(e) {
  const saved = await saveEvent(store, EV, e);
  lsSet('tuk.hadData', '1');
  return saved;
}
const STORAGE_FAIL = 'Uložení se nepodařilo. Zkontrolujte volné místo v telefonu a zkuste to znovu.';

/* ---------- instalace ---------- */
window.addEventListener('beforeinstallprompt', (ev) => { ev.preventDefault(); deferredPrompt = ev; renderInstalls(); });
window.addEventListener('appinstalled', () => { deferredPrompt = null; renderInstalls(); });
function currentMode() {
  const p = detectPlatform({
    ua: navigator.userAgent, platform: navigator.platform, maxTouchPoints: navigator.maxTouchPoints,
    standaloneNav: navigator.standalone, standaloneMedia: window.matchMedia?.('(display-mode: standalone)').matches,
  });
  return installMode(p, !!deferredPrompt);
}
function renderInstall(el) {
  const mode = currentMode();
  const t = INSTALL[mode];
  el.innerHTML = `<b>${esc(t.title)}</b>` + (t.steps.length ? `<ol class="steps">${t.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : '') +
    (t.button ? `<div class="row"><button class="btn" id="doInstall">${esc(t.button)}</button></div>` : '');
  const b = el.querySelector('#doInstall');
  if (b) b.onclick = async () => { if (deferredPrompt) { deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; renderInstalls(); } };
}
function renderInstalls() { renderInstall($('#wInstall')); renderInstall($('#setInstall')); }

/* ---------- úvod a o aplikaci ---------- */
function renderWelcome() {
  $('#wPurpose').textContent = PURPOSE;
  $('#wPrivacy').textContent = PRIVACY;
  renderInstall($('#wInstall'));
}
$('#wStart').onclick = () => { lsSet('tuk.welcomed', '1'); go('home'); };
function renderAbout() {
  $('#aPurpose').textContent = PURPOSE;
  $('#aPrivacy').textContent = PRIVACY;
  $('#aMeta').textContent = `Verze ${VERSION} · licence MIT`;
  const a = $('#aSource');
  a.hidden = !SOURCE_URL;
  if (SOURCE_URL) a.href = SOURCE_URL;
}
$('#showWelcome').onclick = () => go('welcome');

/* ---------- domovská obrazovka ---------- */
function renderHome() {
  const h = new Date().getHours();
  $('#greet').textContent = h < 10 ? 'Dobré ráno' : h < 18 ? 'Ahoj' : 'Dobrý večer';
  const td = live().filter((e) => e.type === 'tuk' && dayKey(e.occurred_at) === dayKey(Date.now())).sort((a, b) => b.occurred_at - a.occurred_at);
  $('#today').textContent = td.length
    ? `Dnes: ${td.length} ${td.length === 1 ? 'ťuk' : td.length < 5 ? 'ťuky' : 'ťuků'} · poslední ${fmtTime(td[0].occurred_at)}`
    : 'Dnes zatím klid ☀️';
  renderBanner();
}
function renderBanner() {
  const el = $('#homeBanner');
  const lost = lostDataStatus({ hadData: lsGet('tuk.hadData') === '1', eventCount: EV.length, flag: lsGet('tuk.lostDetected') === '1' });
  if (lost) {
    el.innerHTML = `<div class="banner"><b>Data zmizela</b><p>Aplikace v tomto telefonu nenašla záznamy, které tu dříve byly. Obnovte je ze zálohy.</p><div class="row"><label class="btn" for="bkFile">Obnovit ze zálohy</label><button class="btn sec" id="lostDismiss">Začít znovu</button></div></div>`;
    $('#lostDismiss').onclick = () => { lsDel('tuk.lostDetected'); lsDel('tuk.hadData'); renderHome(); };
    return;
  }
  const last = Number(lsGet('tuk.lastBackupAt')) || null;
  if (backupDue({ events: EV, lastBackupAt: last, now: Date.now() })) {
    const days = last ? Math.floor((Date.now() - last) / 864e5) : null;
    el.innerHTML = `<div class="banner"><b>Čas na zálohu</b><p>${days === null ? 'Zatím jste nic nezálohoval(a).' : `Poslední záloha před ${days} dny.`}</p><button class="btn" id="bannerBackup">Zálohovat</button></div>`;
    $('#bannerBackup').onclick = doBackup;
    return;
  }
  el.innerHTML = '';
}

const lastTuk = () => live().filter((e) => e.type === 'tuk').sort((a, b) => b.occurred_at - a.occurred_at)[0];
async function addTuk() {
  const now = Date.now();
  if (isDuplicateTap(lastTap, now)) return;
  lastTap = now;
  const prev = lastTuk();
  const id = uuid();
  const sid = seriesIdFor(prev, now, SET.series_minutes, id);
  const e = {
    id, type: 'tuk', occurred_at: now, updated_at: now, intensity: SET.default_intensity, duration_min: null, rescue_given: null,
    dose_slot: null, note: '', triggers: [...SET.default_triggers], series_id: sid, deleted_at: null,
  };
  let saved;
  try { saved = await commit(e); } catch { toast(STORAGE_FAIL, null); return; }
  renderHome();
  if (navigator.vibrate) navigator.vibrate(25);
  toast(sid !== id ? 'Zapsáno ✔ (do série)' : 'Zapsáno ✔', saved);
}
$('#big').onclick = addTuk;

/* ---------- lišta po zápisu ---------- */
let toastTimer;
let toastEvent;
function toast(msg, e) {
  toastEvent = e;
  $('#tMsg').textContent = msg;
  $('#tEdit').hidden = !e;
  $('#tUndo').hidden = !e;
  $('#toast').classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, e ? 8000 : 5000);
}
function hideToast() { $('#toast').classList.remove('on'); }
$('#tUndo').onclick = async () => {
  hideToast();
  try { await commit({ ...toastEvent, deleted_at: Date.now() }); renderAll(); } catch { toast(STORAGE_FAIL, null); }
};
$('#tEdit').onclick = () => { hideToast(); editSheet(toastEvent, false); };

/* ---------- spodní list ---------- */
function openSheet(html) { $('#sheet').innerHTML = html; $('#sheet').classList.add('on'); $('#sheetBg').classList.add('on'); }
function closeSheet() { $('#sheet').classList.remove('on'); $('#sheetBg').classList.remove('on'); }
$('#sheetBg').onclick = closeSheet;
const chips = (list, sel) => list.map((x) => `<button class="chip${sel.includes(x) ? ' on' : ''}" data-chip="${esc(x)}">${esc(x)}</button>`).join('');
const intBtns = (v) => [1, 2, 3].map((n) => `<button class="chip${n === v ? ' on' : ''}" data-int="${n}">${'●'.repeat(n)}</button>`).join('');
const bindChips = (root) => $$(root + ' [data-chip]').forEach((b) => { b.onclick = () => b.classList.toggle('on'); });
const bindInt = (root) => $$(root + ' [data-int]').forEach((b) => {
  b.onclick = () => { $$(root + ' [data-int]').forEach((x) => x.classList.remove('on')); b.classList.add('on'); };
});

function editSheet(e, isNew) {
  const labels = [...new Set([...SET.triggers, ...e.triggers])];
  openSheet(`<h3>${TYPE[e.type].i} ${TYPE[e.type].n}</h3>
  <label for="eT">Kdy</label><input type="datetime-local" id="eT" value="${toLocalInput(e.occurred_at)}">
  ${e.type === 'tuk' ? `<label>Intenzita</label><div class="row" id="eInt">${intBtns(e.intensity)}</div>
  <label>Co tomu předcházelo</label><div class="row" id="eTr">${chips(labels, e.triggers)}</div>` : ''}
  ${e.type === 'velka' ? `<label for="eDur">Délka (odhad, minuty)</label><input type="number" id="eDur" min="0" max="600" value="${e.duration_min ?? ''}">
  <label>Záchranný lék podán</label><div class="row"><button class="chip${e.rescue_given ? ' on' : ''}" id="eRes">${e.rescue_given ? 'Ano' : 'Ne'}</button></div>` : ''}
  ${e.type === 'davka' ? `<label for="eSlot">Která dávka</label><select id="eSlot"><option value="morning">ráno</option><option value="evening">večer</option></select>` : ''}
  <label for="eNote">Poznámka</label><textarea id="eNote" rows="2" maxlength="1000">${esc(e.note)}</textarea>
  <div class="row" style="margin-top:14px"><button class="btn" id="eSave">Uložit</button><button class="btn sec" id="eClose">Zavřít</button>${isNew ? '' : '<button class="btn del" id="eDel">Smazat</button>'}</div>`);
  bindChips('#eTr');
  bindInt('#eInt');
  if (e.type === 'davka') $('#eSlot').value = e.dose_slot || 'morning';
  if (e.type === 'velka') {
    $('#eRes').onclick = (ev) => { ev.target.classList.toggle('on'); ev.target.textContent = ev.target.classList.contains('on') ? 'Ano' : 'Ne'; };
  }
  $('#eClose').onclick = closeSheet;
  if (!isNew) {
    $('#eDel').onclick = async () => {
      if (!confirm('Smazat záznam?')) return;
      try { await commit({ ...e, deleted_at: Date.now() }); } catch { toast(STORAGE_FAIL, null); return; }
      closeSheet();
      renderAll();
    };
  }
  $('#eSave').onclick = async () => {
    const d = { ...e, triggers: [...e.triggers] };   // pracovní kopie: seznam v paměti se změní až po úspěšném zápisu
    d.occurred_at = +new Date($('#eT').value) || e.occurred_at;
    d.note = $('#eNote').value.slice(0, 1000);
    if (d.type === 'tuk') {
      const a = $('#eInt .chip.on');
      d.intensity = a ? +a.dataset.int : e.intensity;
      d.triggers = $$('#eTr .chip.on').map((x) => x.dataset.chip);
    }
    if (d.type === 'velka') {
      const mins = parseInt($('#eDur').value, 10);
      d.duration_min = Number.isFinite(mins) ? Math.min(600, Math.max(0, mins)) : null;
      d.rescue_given = $('#eRes').classList.contains('on');
    }
    if (d.type === 'davka') d.dose_slot = $('#eSlot').value;
    try { await commit(d); } catch { toast(STORAGE_FAIL, null); return; }
    closeSheet();
    renderAll();
  };
}
function addSheet() {
  openSheet(`<h3>Přidat zpětně</h3><div class="row">
   <button class="btn" data-new="tuk">● Ťuk</button><button class="btn" data-new="velka" style="background:var(--velka)">▲ Velká událost</button>
   <button class="btn" data-new="davka" style="background:var(--davka)">■ Dávka</button></div>
   <p class="small">Čas a detaily upravíte v dalším kroku.</p><button class="btn sec" id="aClose">Zavřít</button>`);
  $('#aClose').onclick = closeSheet;
  $$('[data-new]').forEach((b) => {
    b.onclick = () => {
      const type = b.dataset.new;
      const id = uuid();
      editSheet({
        id, type, occurred_at: Date.now(), updated_at: Date.now(), intensity: type === 'tuk' ? SET.default_intensity : null, duration_min: null,
        rescue_given: type === 'velka' ? false : null, dose_slot: type === 'davka' ? 'morning' : null, note: '', triggers: [],
        series_id: type === 'tuk' ? id : null, deleted_at: null,
      }, true);
    };
  });
}
$('#addOther').onclick = addSheet;

/* ---------- historie ---------- */
function renderHist() {
  const ft = $('#fType').value;
  const fi = $('#fInt').value;
  const list = live().filter((e) => (!ft || e.type === ft) && (!fi || (e.type === 'tuk' && String(e.intensity) === fi))).sort((a, b) => b.occurred_at - a.occurred_at);
  let out = '';
  let last = '';
  if (!list.length) out = '<p class="small">Nic nenalezeno.</p>';
  list.forEach((e) => {
    const k = dayKey(e.occurred_at);
    if (k !== last) { out += `<div class="day">${fmtD(e.occurred_at)}</div>`; last = k; }
    const sub = e.type === 'tuk' ? 'intenzita ' + e.intensity + (e.triggers.length ? ' · ' + e.triggers.join(', ') : '')
      : e.type === 'velka' ? (e.duration_min ? e.duration_min + ' min' : '') + (e.rescue_given ? ' · záchranný lék' : '')
      : 'dávka ' + (SLOT[e.dose_slot] || '');
    out += `<button class="ev" data-id="${esc(e.id)}"><span class="ico t-${e.type}">${TYPE[e.type].i}</span>
      <span class="m"><b>${fmtTime(e.occurred_at)} · ${TYPE[e.type].n}</b><small>${esc(sub)}${e.note ? ' · ' + esc(e.note) : ''}</small></span></button>`;
  });
  $('#histList').innerHTML = out;
  $$('#histList .ev').forEach((b) => { b.onclick = () => editSheet(EV.find((x) => x.id === b.dataset.id), false); });
}
$('#fType').onchange = $('#fInt').onchange = renderHist;

/* ---------- přehled: jen prosté počty (spec §11.3) ---------- */
function renderStats() {
  const r = buildReport(EV, { days: 28, now: Date.now() });
  const mx = Math.max(1, ...r.weeks.map((w) => w.tuk));
  $('#statsBody').innerHTML = `<div class="card"><b>Ťuky po týdnech</b>
   <div class="bars">${r.weeks.map((w) => `<div class="bar" style="height:${(w.tuk / mx) * 100}%"><b>${w.tuk}</b></div>`).join('')}</div>
   <div class="bl">${r.weeks.map((w) => `<span>${esc(w.label)}</span>`).join('')}</div></div>
   <div class="card"><b>Co tomu předcházelo (posledních 28 dní)</b>${r.labels.length ? r.labels.map((l) => `<div class="row"><span style="flex:1">${esc(l.label)}</span><b>${l.count}×</b></div>`).join('') : '<p class="small">Zatím nic.</p>'}</div>
   <div class="card"><b>Zapsaná vynechaná nebo opožděná dávka</b><p>Počet dnů za posledních 28 dní: <b>${r.missedDoseDays}</b></p>
   <p class="small">Jen počty zapsaných záznamů. Souvislosti posoudí lékař z exportu.</p></div>`;
}

/* ---------- export (PDF + CSV) ---------- */
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Nepodařilo se načíst ' + src));
    document.head.appendChild(s);
  });
}
async function ensurePdfLibs() {
  if (!window.PDFLib) await loadScript('js/vendor/pdf-lib.js');
  if (!window.fontkit) await loadScript('js/vendor/fontkit.js');
}
$('#exPrepare').onclick = async () => {
  $('#exErr').textContent = '';
  $('#exResult').hidden = true;
  $('#exPrepare').disabled = true;
  try {
    const days = +$('#exPeriod').value;
    const now = Date.now();
    await ensurePdfLibs();
    const font = new Uint8Array(await (await fetch('fonts/NotoSans-Regular.ttf')).arrayBuffer());
    const report = buildReport(EV, { days, now, name: SET.name, medication: SET.medication });
    const pdf = await buildPdf({ PDFLib: window.PDFLib, fontkit: window.fontkit }, report, font, PURPOSE);
    const day = isoDay();
    exportFiles = {
      pdf: new File([pdf], `tuk-souhrn-${day}.pdf`, { type: 'application/pdf' }),
      csv: new File([buildCsv(EV, days, now)], `tuk-zaznamy-${day}.csv`, { type: 'text/csv' }),
    };
    $('#exFiles').innerHTML = [exportFiles.pdf, exportFiles.csv].map((f) => `<li>${esc(f.name)} (${Math.max(1, Math.round(f.size / 1024))} kB)</li>`).join('');
    $('#exResult').hidden = false;
  } catch (err) {
    $('#exErr').textContent = 'Export se nepodařil: ' + (err.message || 'neznámá chyba');
  } finally {
    $('#exPrepare').disabled = false;
  }
};
$('#exShare').onclick = async () => {
  const r = await shareFiles({ files: [exportFiles.pdf, exportFiles.csv], title: 'Ťuk – souhrn záznamů', text: 'Souhrn záznamů z aplikace Ťuk.' });
  if (r === 'downloaded') $('#exErr').textContent = 'Sdílení není v tomto prohlížeči dostupné, soubory se stáhly.';
};
$('#exSavePdf').onclick = () => downloadFile(exportFiles.pdf);
$('#exSaveCsv').onclick = () => downloadFile(exportFiles.csv);

/* ---------- záloha a obnova ---------- */
async function doBackup() {
  const file = new File([JSON.stringify(buildBackup(EV, SET, Date.now()))], backupFilename(Date.now()), { type: 'application/json' });
  const r = await shareFiles({ files: [file], title: 'Záloha Ťuk' });
  if (r !== 'cancelled') { lsSet('tuk.lastBackupAt', String(Date.now())); renderAll(); renderSet(); }
}
$('#bkSave').onclick = doBackup;
$('#bkFile').onchange = async (ev) => {
  const f = ev.target.files[0];
  ev.target.value = '';
  if (!f) return;
  const msg = $('#bkMsg');
  const parsed = parseBackup(await f.text());
  if (!parsed.ok) { msg.textContent = parsed.error; toast(parsed.error, null); return; }
  const m = mergeBackup(EV, parsed.backup);
  try {
    await applyMerge(store, EV, m.put);
  } catch (err) {
    const stopped = `Obnova se zastavila po ${err.written ?? 0} záznamech (úložiště telefonu zřejmě došlo místo). Zkuste to znovu.`;
    msg.textContent = stopped;
    toast(stopped, null);
    renderAll();
    return;
  }
  lsSet('tuk.hadData', '1');
  if (m.added > 0 || m.updated > 0) lsDel('tuk.lostDetected');
  if (!(await store.getMeta('settings'))) SET = await saveSettings(store, parsed.backup.settings || {});
  const text = `Obnoveno: přidáno ${m.added}, aktualizováno ${m.updated}, přeskočeno ${m.skipped}` + (m.invalid ? `, neplatných ${m.invalid}` : '') + '.';
  msg.textContent = text;
  toast(text, null);
  renderAll();
  renderSet();
};

/* ---------- nastavení ---------- */
async function patchSettings(patch) { SET = await saveSettings(store, patch); renderSet(); }
function renderSet() {
  $('#setName').value = SET.name;
  $('#setName').onchange = (ev) => patchSettings({ name: ev.target.value });
  $('#setMed').value = SET.medication;
  $('#setMed').onchange = (ev) => patchSettings({ medication: ev.target.value });
  $('#setInt').innerHTML = intBtns(SET.default_intensity);
  $$('#setInt [data-int]').forEach((b) => { b.onclick = () => patchSettings({ default_intensity: +b.dataset.int }); });
  $('#setTr').innerHTML = chips(SET.triggers, SET.default_triggers);
  $$('#setTr [data-chip]').forEach((b) => {
    b.onclick = () => {
      const cur = new Set(SET.default_triggers);
      if (cur.has(b.dataset.chip)) cur.delete(b.dataset.chip); else cur.add(b.dataset.chip);
      patchSettings({ default_triggers: [...cur] });
    };
  });
  $('#trigList').innerHTML = SET.triggers.map((t) => `<span class="chip">${esc(t)} <button data-del="${esc(t)}" aria-label="Odebrat štítek ${esc(t)}">✕</button></span>`).join('');
  $$('#trigList [data-del]').forEach((b) => {
    b.onclick = () => {
      const triggers = removeTrigger(SET.triggers, b.dataset.del);
      patchSettings({ triggers, default_triggers: pruneDefaults(SET.default_triggers, triggers) });
    };
  });
  $('#addTrig').onclick = () => {
    const triggers = addTrigger(SET.triggers, $('#newTrig').value);
    $('#newTrig').value = '';
    if (triggers !== SET.triggers) patchSettings({ triggers });
  };
  $('#setSeries').value = SET.series_minutes;
  $('#setSeries').onchange = (ev) => patchSettings({ series_minutes: Math.min(240, Math.max(5, parseInt(ev.target.value, 10) || 60)) });
  const last = Number(lsGet('tuk.lastBackupAt')) || null;
  $('#backupInfo').textContent = last ? `Poslední záloha: ${fmtDate(last)}.` : 'Zatím nezálohováno. Záloha je jediná kopie vašich dat mimo tento telefon.';
  renderInstall($('#setInstall'));
}

/* ---------- sdílení aplikace a QR ---------- */
const appUrl = () => location.origin + location.pathname.replace(/index\.html$/, '');
$('#shareApp').onclick = async () => {
  try {
    if (navigator.share) await navigator.share({ title: 'Ťuk', text: 'Osobní deník ťuků. Data zůstávají jen ve vašem telefonu.', url: appUrl() });
    else { await navigator.clipboard.writeText(appUrl()); toast('Odkaz zkopírován.', null); }
  } catch { /* zrušeno */ }
};
$('#showQr').onclick = async () => {
  if (!window.qrcode) await loadScript('js/vendor/qrcode.js');
  const qr = window.qrcode(0, 'M');
  qr.addData(appUrl());
  qr.make();
  $('#qrSvg').innerHTML = qr.createSvgTag({ scalable: true, margin: 2 });
  $('#qrLink').textContent = appUrl();
  $('#qrBox').hidden = false;
};

/* ---------- smazání všech dat ---------- */
$('#wipe').onclick = async () => {
  if (!confirm('Opravdu smazat všechna data v tomto telefonu? Nelze vrátit, pokud nemáte zálohu.')) return;
  if (!confirm('Poslední potvrzení: smazat všechny záznamy a nastavení?')) return;
  await store.clearAll();
  ['tuk.hadData', 'tuk.lastBackupAt', 'tuk.welcomed'].forEach(lsDel);
  location.reload();
};

/* ---------- aktualizace (service worker) ---------- */
function setupUpdates(reg) {
  let updateRequested = false;
  const show = (worker) => {
    $('#updateBar').classList.add('on');
    $('#updateGo').onclick = () => { updateRequested = true; worker.postMessage('SKIP_WAITING'); };
  };
  if (reg.waiting && navigator.serviceWorker.controller) show(reg.waiting);
  reg.addEventListener('updatefound', () => {
    const w = reg.installing;
    if (!w) return;
    w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) show(w); });
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!shouldReloadOnControllerChange({ updateRequested, reloaded })) return;
    reloaded = true;
    location.reload();
  });
}

/* ---------- start ---------- */
function fatal(msg) { $('#fatalMsg').textContent = msg; go('fatal'); }
async function boot() {
  try { navigator.storage?.persist?.(); } catch { /* nic */ }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').then(setupUpdates).catch(() => {});
  try {
    store = await Store.open();
    EV = await store.allEvents();
    SET = await loadSettings(store);
  } catch {
    fatal('Aplikace nemůže ukládat data v tomto prohlížeči (soukromé okno nebo zablokované úložiště). Otevřete ji v běžném okně prohlížeče.');
    return;
  }
  if (lostDataStatus({ hadData: lsGet('tuk.hadData') === '1', eventCount: EV.length, flag: false })) lsSet('tuk.lostDetected', '1');
  if (EV.length) lsSet('tuk.hadData', '1');
  go(lsGet('tuk.welcomed') ? 'home' : 'welcome');
}
boot();
