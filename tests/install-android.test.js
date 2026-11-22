import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { androidInstallFileName, androidInstallListHTML } from '../src/install-android.js';

const read = rel => readFileSync(new URL('../' + rel, import.meta.url), 'utf8');

test('android install note names Chrome, Files, the permission prompt, and the fallback', () => {
  const html = androidInstallListHTML('0.9.10');
  assert.equal(androidInstallFileName('v0.9.10'), 'Prvlar-0.9.10.apk');
  assert.equal(androidInstallFileName(''), 'Prvlar-<version>.apk');
  assert.match(html, /Prvlar-0\.9\.10\.apk/);
  assert.match(html, /Chrome/);
  assert.match(html, /Gmail/);
  assert.match(html, /GitHub app/);
  assert.match(html, /Files by Google/);
  assert.match(html, /Allow from this source/);
  assert.match(html, /Special app access/);
  assert.match(html, /Install unknown apps/);
  assert.match(html, /keeps your data/);
});

test('download page, About, README and 0.9.10 notes include the Android install steps', () => {
  assert.match(read('vite.config.js'), /androidInstallListHTML/);
  assert.match(read('src/main.js'), /androidInstallCardHTML/);
  const readme = read('README.md');
  assert.match(readme, /## How to install on Android/);
  assert.match(readme, /Special app access/);
  assert.match(readme, /Files by Google/);
  const notes = read('docs/RELEASE-NOTES-0.9.10.md');
  assert.match(notes, /## Installing on an Android phone/);
  assert.match(notes, /Special app access/);
  assert.match(notes, /Allow from this source/);
});
