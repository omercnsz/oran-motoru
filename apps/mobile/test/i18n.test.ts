// Çeviri dosyaları: her dilde her metin İngilizcedeki yer tutucuların (%{...}) aynısını içermeli.
// (Eksik ya da fazla anahtarı zaten tip kontrolü yakalar.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

import en from '../src/i18n/locales/en.ts';

type Tree = { [k: string]: string | Tree };
const leaves = (tree: Tree, prefix = ''): [string, string][] =>
  Object.entries(tree).flatMap(([k, v]) => (typeof v === 'string' ? [[prefix + k, v]] : leaves(v, `${prefix}${k}.`)));
const placeholders = (s: string) => [...s.matchAll(/%\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

const reference = new Map(leaves(en as unknown as Tree).map(([k, v]) => [k, placeholders(v)]));
const locales = readdirSync(new URL('../src/i18n/locales', import.meta.url)).filter((f: string) => f.endsWith('.ts') && f !== 'en.ts');

test('27 dil var', () => assert.equal(locales.length + 1, 27));

for (const file of locales) {
  test(`yer tutucular: ${file}`, async () => {
    const messages = (await import(`../src/i18n/locales/${file}`)).default as Tree;
    for (const [key, value] of leaves(messages)) {
      assert.equal(placeholders(value), reference.get(key), `${file} → ${key}: "${value}"`);
      assert.ok(value.trim().length > 0, `${file} → ${key} boş`);
    }
  });
}

// iOS ve Android'e uygulamanın dillerini bildiren liste (sağdan sola düzen ve sistemdeki uygulama dili ayarı için)
test('app.json dil listesi çeviri dosyalarıyla aynı', () => {
  const app = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8'));
  const plugin = app.expo.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-localization');
  const supported = [...plugin[1].supportedLocales].sort();
  assert.deepEqual(supported, ['en.ts', ...locales].map((f) => f.replace(/\.ts$/, '')).sort());
});
