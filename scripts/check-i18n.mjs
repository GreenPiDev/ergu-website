// tr ve en çeviri dosyalarının anahtar yapısının birebir aynı olduğunu doğrular.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const LOCALES_DIR = join(import.meta.dirname, '..', 'src', 'locales');
const [baseLocale, otherLocale] = ['tr', 'en'];

function flattenKeys(value, prefix = '') {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof child === 'object' && child !== null ? flattenKeys(child, path) : [path];
  });
}

function readKeys(locale, file) {
  return new Set(flattenKeys(JSON.parse(readFileSync(join(LOCALES_DIR, locale, file), 'utf8'))));
}

const namespaces = new Set([
  ...readdirSync(join(LOCALES_DIR, baseLocale)),
  ...readdirSync(join(LOCALES_DIR, otherLocale)),
]);

const problems = [];

for (const file of namespaces) {
  const base = readKeys(baseLocale, file);
  const other = readKeys(otherLocale, file);
  for (const key of base) if (!other.has(key)) problems.push(`${otherLocale}/${file}: eksik "${key}"`);
  for (const key of other) if (!base.has(key)) problems.push(`${baseLocale}/${file}: eksik "${key}"`);
}

if (problems.length > 0) {
  console.error(`Çeviri anahtarları uyuşmuyor:\n${problems.join('\n')}`);
  process.exit(1);
}

console.log('Çeviri anahtarları uyumlu.');
