export const DUP_TAP_MS = 1000;

export function seriesIdFor(prev, now, minutes, newId) {
  if (prev && prev.series_id && now >= prev.occurred_at && now - prev.occurred_at < minutes * 60000) {
    return prev.series_id;
  }
  return newId;
}

export function isDuplicateTap(lastTapMs, nowMs) {
  return lastTapMs > 0 && nowMs - lastTapMs >= 0 && nowMs - lastTapMs < DUP_TAP_MS;
}
