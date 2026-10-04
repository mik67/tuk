const A4 = { w: 595.28, h: 841.89 };
const M = 42;
const FOOT = 34;

export async function buildPdf({ PDFLib, fontkit }, report, fontBytes, purpose) {
  const { PDFDocument, rgb } = PDFLib;
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle('Ťuk – souhrn záznamů');
  doc.setCreator('Ťuk');
  doc.setProducer('Ťuk');
  const font = await doc.embedFont(fontBytes, { subset: true });
  const supported = new Set(font.getCharacterSet?.() ?? []);

  const BLACK = rgb(0.1, 0.1, 0.12);
  const GRAY = rgb(0.42, 0.42, 0.46);
  const LINE = rgb(0.8, 0.8, 0.83);
  const BAR = rgb(0.23, 0.44, 0.83);

  const prepare = (s) => String(s ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  const clean = (s) => Array.from(prepare(s))
    .map((ch) => (supported.size && !supported.has(ch.codePointAt(0)) ? '?' : ch))
    .join('');

  const width = (s, size) => font.widthOfTextAtSize(s, size);

  function wrap(str, size, maxW) {
    const words = clean(str).split(' ').filter(Boolean);
    const lines = [];
    let cur = '';
    const push = () => { if (cur) { lines.push(cur); cur = ''; } };
    for (let w of words) {
      while (width(w, size) > maxW) {                 // velmi dlouhé slovo rozdělit po znacích
        let i = 1;
        while (i < w.length && width(w.slice(0, i + 1), size) <= maxW) i++;
        push();
        lines.push(w.slice(0, i));
        w = w.slice(i);
      }
      const test = cur ? `${cur} ${w}` : w;
      if (width(test, size) <= maxW) cur = test; else { push(); cur = w; }
    }
    push();
    return lines.length ? lines : [''];
  }

  let page;
  let y;
  const newPage = () => { page = doc.addPage([A4.w, A4.h]); y = A4.h - M; };
  const ensure = (h) => { if (y - h < M + FOOT) newPage(); };
  const line = (str, { size = 10, color = BLACK, x = M, maxW = A4.w - 2 * M, gap = 3 } = {}) => {
    for (const l of wrap(str, size, maxW)) {
      ensure(size + gap);
      page.drawText(l, { x, y: y - size, size, font, color });
      y -= size + gap;
    }
  };

  newPage();
  line('Ťuk – souhrn záznamů', { size: 20, gap: 6 });
  if (report.name) line(`Jméno: ${report.name}`, { size: 11 });
  line(`Období: ${fmtD(report.from)} – ${fmtD(report.to)} (${report.days} dní)`, { size: 11 });
  line(`Vytvořeno: ${fmtD(report.generatedAt)}`, { size: 11, gap: 6 });
  line(purpose, { size: 8.5, color: GRAY, gap: 2 });
  y -= 8;

  line('Počty ve vybraném období', { size: 13, gap: 5 });
  line(`Myoklonie (ťuky): ${report.totals.tuk}   ·   GTCS (velké události): ${report.totals.velka}   ·   Vynechané/opožděné dávky: ${report.totals.davka}`, { size: 10 });
  line(`Dny se zapsanou vynechanou dávkou: ${report.missedDoseDays}`, { size: 10, gap: 6 });

  line(report.weeksCapped ? 'Myoklonie po týdnech (posledních 13 týdnů)' : 'Myoklonie po týdnech', { size: 13, gap: 5 });
  const max = Math.max(1, ...report.weeks.map((w) => w.tuk));
  for (const w of report.weeks) {
    ensure(14);
    page.drawText(w.label, { x: M, y: y - 9, size: 9, font, color: GRAY });
    const bw = Math.max(w.tuk ? 2 : 0, (w.tuk / max) * 300);
    if (bw) page.drawRectangle({ x: M + 48, y: y - 10, width: bw, height: 9, color: BAR });
    page.drawText(String(w.tuk), { x: M + 54 + bw, y: y - 9, size: 9, font, color: BLACK });
    y -= 14;
  }
  y -= 6;

  line('Co tomu předcházelo (četnost u myoklonií)', { size: 13, gap: 5 });
  if (!report.labels.length) line('Žádné štítky.', { size: 10, color: GRAY });
  for (const l of report.labels) line(`${l.label}: ${l.count}×`, { size: 10 });
  y -= 6;

  if (report.medication) {
    line('Medikace (informace zapsaná uživatelem)', { size: 13, gap: 5 });
    line(report.medication, { size: 10 });
    y -= 6;
  }

  line('Záznamy', { size: 13, gap: 5 });
  if (!report.rows.length) {
    line('Žádné záznamy ve vybraném období.', { size: 10, color: GRAY });
  } else {
    const cols = [
      { h: 'Datum', w: 56 }, { h: 'Čas', w: 32 }, { h: 'Typ', w: 92 }, { h: 'Int.', w: 30 },
      { h: 'Co předcházelo', w: 108 }, { h: 'Podrobnosti', w: 92 }, { h: 'Poznámka', w: 101 },
    ];
    const size = 8.5;
    const lh = 11;
    const header = () => {
      ensure(lh + 6);
      let x = M;
      for (const c of cols) { page.drawText(c.h, { x, y: y - size, size, font, color: GRAY }); x += c.w; }
      y -= lh + 2;
      page.drawLine({ start: { x: M, y }, end: { x: A4.w - M, y }, thickness: 0.6, color: LINE });
      y -= 3;
    };
    header();
    for (const r of report.rows) {
      const details = r.type === 'GTCS'
        ? [r.duration !== '' ? `${r.duration} min` : '', r.rescue ? `záchr. lék: ${r.rescue}` : ''].filter(Boolean).join(', ')
        : r.slot;
      const cells = [r.date, r.time, r.type, String(r.intensity), r.labels, details, r.note];
      const wrapped = cells.map((c, i) => wrap(c, size, cols[i].w - 4));
      const rowH = Math.max(...wrapped.map((w) => w.length)) * lh + 4;
      if (y - rowH < M + FOOT) { newPage(); header(); }
      let x = M;
      wrapped.forEach((ls, i) => {
        ls.forEach((l, k) => page.drawText(l, { x, y: y - size - k * lh, size, font, color: BLACK }));
        x += cols[i].w;
      });
      y -= rowH;
      page.drawLine({ start: { x: M, y: y + 2 }, end: { x: A4.w - M, y: y + 2 }, thickness: 0.3, color: LINE });
    }
  }

  const pages = doc.getPages();
  pages.forEach((pg, i) => {
    pg.drawText(`Ťuk · sestaveno z údajů zapsaných uživatelem · strana ${i + 1}/${pages.length}`, { x: M, y: M - 6, size: 8, font, color: GRAY });
  });
  return doc.save();
}

function fmtD(t) {
  const d = new Date(t);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}
