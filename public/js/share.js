export function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export async function shareFiles({ files, title, text }, nav = globalThis.navigator, download = downloadFile) {
  try {
    if (nav && typeof nav.share === 'function' && typeof nav.canShare === 'function' && nav.canShare({ files })) {
      await nav.share({ files, title, text });
      return 'shared';
    }
  } catch (err) {
    if (err && err.name === 'AbortError') return 'cancelled';
  }
  files.forEach((f) => download(f));
  return 'downloaded';
}
