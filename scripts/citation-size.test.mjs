import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const css=readFileSync(new URL('../public/reader-controls.css',import.meta.url),'utf8');
test('enlarged reader choices scale citation labels and origin without changing default or print',()=>{
  const screen=css.slice(css.indexOf('@media screen{'),css.indexOf('@media print'));
  for(const size of ['large','larger'])for(const selector of ['.article-sources','.source-origin']) {
    assert.ok(screen.includes(`.article-reader:has(input[name="reader-size"][value="${size}"]:checked) ${selector}`));
  }
  assert.match(screen,/\.article-sources\{font-size:\.875em\}/);
  assert.match(screen,/\.source-origin\{font-size:\.93em\}/);
  assert.doesNotMatch(css.slice(css.indexOf('@media print')),/\.(?:article-sources|source-origin)\{font-size:/);
  assert.doesNotMatch(screen,/value="default".*(?:article-sources|source-origin)/);
});
