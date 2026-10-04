export const MAX_TRIGGERS = 12;
export const MAX_LEN = 40;

export function addTrigger(list, label) {
  const t = String(label ?? '').trim().slice(0, MAX_LEN);
  if (!t || list.length >= MAX_TRIGGERS) return list;
  if (list.some((x) => x.toLowerCase() === t.toLowerCase())) return list;
  return [...list, t];
}

export const removeTrigger = (list, label) => list.filter((x) => x !== label);

export const pruneDefaults = (defaults, triggers) => defaults.filter((x) => triggers.includes(x));
