import test from 'node:test';
import assert from 'node:assert/strict';
import { detectPlatform, installMode } from '../public/js/install.js';

const UA = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0.0.0 Mobile/15E148 Safari/604.1',
  iphoneFacebook: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/450.0]',
  ipadDesktopUa: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36',
  desktopChrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
};

test('iPhone Safari', () => {
  assert.deepEqual(detectPlatform({ ua: UA.iphoneSafari, platform: 'iPhone', maxTouchPoints: 5 }), { os: 'ios', safari: true, standalone: false });
});
test('iPhone Chrome a vestavěný prohlížeč Facebooku nejsou Safari', () => {
  assert.equal(detectPlatform({ ua: UA.iphoneChrome, platform: 'iPhone', maxTouchPoints: 5 }).safari, false);
  assert.equal(detectPlatform({ ua: UA.iphoneFacebook, platform: 'iPhone', maxTouchPoints: 5 }).safari, false);
});
test('iPad s desktopovým UA se pozná podle dotyku', () => {
  const p = detectPlatform({ ua: UA.ipadDesktopUa, platform: 'MacIntel', maxTouchPoints: 5 });
  assert.equal(p.os, 'ios');
  assert.equal(p.safari, true);
});
test('Mac bez dotyku je „other“', () => {
  assert.equal(detectPlatform({ ua: UA.ipadDesktopUa, platform: 'MacIntel', maxTouchPoints: 0 }).os, 'other');
});
test('Android a desktop', () => {
  assert.equal(detectPlatform({ ua: UA.androidChrome, platform: 'Linux armv81', maxTouchPoints: 5 }).os, 'android');
  assert.equal(detectPlatform({ ua: UA.desktopChrome, platform: 'Win32', maxTouchPoints: 0 }).os, 'other');
});
test('standalone se pozná z navigator.standalone i z media query', () => {
  assert.equal(detectPlatform({ ua: UA.iphoneSafari, platform: 'iPhone', maxTouchPoints: 5, standaloneNav: true }).standalone, true);
  assert.equal(detectPlatform({ ua: UA.androidChrome, platform: 'x', maxTouchPoints: 5, standaloneMedia: true }).standalone, true);
});
test('chybějící údaje nespadnou', () => {
  assert.deepEqual(detectPlatform({}), { os: 'other', safari: false, standalone: false });
  assert.deepEqual(detectPlatform(), { os: 'other', safari: false, standalone: false });
});

test('installMode: nainstalováno má přednost, pak výzva, pak návody (Review Focus 8)', () => {
  const ios = { os: 'ios', safari: true, standalone: false };
  assert.equal(installMode({ ...ios, standalone: true }, true), 'installed');
  assert.equal(installMode({ os: 'android', safari: false, standalone: false }, true), 'prompt');
  assert.equal(installMode(ios, false), 'ios-safari');
  assert.equal(installMode({ ...ios, safari: false }, false), 'ios-other');
  assert.equal(installMode({ os: 'android', safari: false, standalone: false }, false), 'android-manual');
  assert.equal(installMode({ os: 'other', safari: false, standalone: false }, false), 'desktop');
});

import { shouldReloadOnControllerChange } from '../public/js/install.js';

test('stránka se po aktivaci service workeru znovu načte jen na výslovnou žádost uživatele (první instalace nesmí přenačíst)', () => {
  assert.equal(shouldReloadOnControllerChange({ updateRequested: false, reloaded: false }), false);
  assert.equal(shouldReloadOnControllerChange({ updateRequested: true, reloaded: false }), true);
  assert.equal(shouldReloadOnControllerChange({ updateRequested: true, reloaded: true }), false);
});
