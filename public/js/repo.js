// Zápis událostí do úložiště a do seznamu v paměti. Seznam se mění teprve po úspěšném zápisu,
// aby při chybě úložiště (kvóta, ztracené spojení) historie neukazovala neuložené změny.

export const bumpVersion = (e, now) => Math.max(now, (e.updated_at || 0) + 1);

function upsert(list, e) {
  const i = list.findIndex((x) => x.id === e.id);
  if (i >= 0) list[i] = e; else list.push(e);
}

export async function saveEvent(store, list, e) {
  const next = { ...e, updated_at: bumpVersion(e, Date.now()) };
  await store.putEvent(next);
  upsert(list, next);
  return next;
}

// Obnova ze zálohy: záznamy se zapíšou tak, jak jsou (včetně updated_at ze zálohy), jinak by pozdější
// obnova novější zálohy ztratila poslední úpravy a smazání.
export async function applyMerge(store, list, put) {
  let written = 0;
  try {
    for (const e of put) {
      await store.putEvent(e);
      upsert(list, e);
      written++;
    }
  } catch (err) {
    err.written = written;
    throw err;
  }
  return written;
}
