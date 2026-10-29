import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fingerprintStylesheets, STYLESHEETS } from './stylesheets.mjs';
import { renderCacheHeaders } from './cache-headers.mjs';
const read = path => readFileSync(new URL(path, import.meta.url));
const assets = new Map(STYLESHEETS.map(name => [name, read(`../public/${name}`)]));
const names = fingerprintStylesheets(assets);

test('each reviewed stylesheet uses its own exact bytes and changes name when bytes change', () => {
  assert.deepEqual(STYLESHEETS, ['style.css', 'reader-controls.css', 'news-calendar.css']);
  for (const original of STYLESHEETS) {
    const expected = `${original.slice(0,-4)}.${createHash('sha256').update(assets.get(original)).digest('hex').slice(0,16)}.css`;
    assert.equal(names.get(original), expected);
    assert.deepEqual(read(`../dist/${expected}`), assets.get(original));
    assert.deepEqual(read(`../dist/${original}`), assets.get(original), 'legacy path keeps the same public bytes');
    const changed = new Map(assets);
    changed.set(original, Buffer.concat([assets.get(original), Buffer.from('\n/* synthetic byte change */')]));
    const updated = fingerprintStylesheets(changed);
    assert.notEqual(updated.get(original), expected);
    for (const other of STYLESHEETS.filter(name => name !== original)) assert.equal(updated.get(other), names.get(other));
  }
  assert.throws(() => fingerprintStylesheets(new Map()), /Missing stylesheet bytes/);
});

test('all emitted HTML links use exact current fingerprints with page-specific helper CSS', () => {
  const visit = dir => readdirSync(new URL(dir, import.meta.url), {withFileTypes:true}).flatMap(entry => {
    const path = `${dir}/${entry.name}`;
    return entry.isDirectory() ? visit(path) : entry.name.endsWith('.html') ? [path] : [];
  });
  for (const path of visit('../dist')) {
    const html = read(path).toString();
    const hrefs = [...html.matchAll(/<link rel="stylesheet" href="\/([^"]+)">/g)].map(match => match[1]);
    const expected = [names.get('style.css')];
    if (path.includes('/notes/')) expected.push(names.get('reader-controls.css'));
    if (path === '../dist/calendar/index.html') expected.push(names.get('news-calendar.css'));
    assert.deepEqual(hrefs, expected, path);
  }
});

test('fingerprints alone are immutable while legacy helper URLs always revalidate', () => {
  const headers = read('../dist/_headers').toString();
  assert.equal((headers.match(/immutable/g)||[]).length, 3);
  for (const original of STYLESHEETS) {
    assert.ok(headers.includes(`\n/${original}\n  Cache-Control: public, max-age=0, must-revalidate`));
    assert.ok(headers.includes(`\n/${names.get(original)}\n  Cache-Control: public, max-age=31536000, immutable`));
  }
  for (const invalid of [[], ['private.0123456789abcdef.css'], ['reader-controls.css'], ['reader-controls.0123456789abcdef.css\n'], ['news-calendar.0123456789abcdef.css\n/*'], [names.get('style.css'), names.get('style.css')]]) {
    assert.throws(() => renderCacheHeaders('', invalid), /fingerprinted/);
  }
});
