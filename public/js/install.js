const IN_APP = /CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|GSA\/|FBAN|FBAV|Instagram|Line\/|Snapchat|MicroMessenger/;

export function detectPlatform(env = {}) {
  const ua = env.ua || '';
  const ios = /iPhone|iPad|iPod/.test(ua) || (env.platform === 'MacIntel' && (env.maxTouchPoints || 0) > 1);
  const android = /Android/.test(ua);
  const safari = ios && /Safari\//.test(ua) && !IN_APP.test(ua);
  return {
    os: ios ? 'ios' : android ? 'android' : 'other',
    safari,
    standalone: !!env.standaloneNav || !!env.standaloneMedia,
  };
}

export function installMode(p, hasPrompt) {
  if (p.standalone) return 'installed';
  if (hasPrompt) return 'prompt';
  if (p.os === 'ios') return p.safari ? 'ios-safari' : 'ios-other';
  if (p.os === 'android') return 'android-manual';
  return 'desktop';
}

export const shouldReloadOnControllerChange = ({ updateRequested, reloaded }) => updateRequested && !reloaded;
