import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderJobs, jobCategories} from './jobs.mjs';
const jobs = JSON.parse(readFileSync(new URL('../content/jobs.json', import.meta.url)));
const css = readFileSync(new URL('../public/style.css', import.meta.url), 'utf8');
test('job permalinks preserve IDs and provide named, non-tabstop focus targets', () => {
  const html = renderJobs(jobs);
  for (const job of jobs) {
    assert.ok(html.includes(`id="${job.id}" tabindex="-1" aria-label=`));
    assert.ok(html.includes(`href="#${job.id}">本条永久定位</a>`));
    assert.ok(html.includes(`href="#jobs-${job.category}">返回${jobCategories[job.category]}分组</a>`));
  }
  assert.doesNotMatch(html, /tabindex="0"/);
  const unsafe = renderJobs([{...jobs[0],company:'A & B',title:'<unsafe>'}]);
  assert.match(unsafe, /aria-label="A &amp; B · &lt;unsafe&gt;"/);
});
test('all categories, including empty ones, can return to the named direction navigation', () => {
  for (const html of [renderJobs(jobs),renderJobs([])]) {
    assert.match(html, /id="jobs-directions" tabindex="-1" aria-label="岗位方向"/);
    assert.equal((html.match(/href="#jobs-directions"/g) || []).length, 3);
  }
});
test('focus remains visible in normal and forced colors without printing control outlines', () => {
  assert.match(css, /\.job-entry:focus,#jobs-directions:focus\{outline:2px solid var\(--green\)/);
  assert.match(css, /#jobs-directions,\.jobs-group h2\{scroll-margin-top:24px/);
  assert.match(css, /@media screen and \(forced-colors:active\)\{[\s\S]*?\.job-entry:focus,#jobs-directions:focus,\.jobs-group h2:focus\{outline:2px solid Highlight/);
  assert.match(css, /@media print\{[\s\S]*?\.job-entry:focus,#jobs-directions:focus,\.jobs-group h2:focus\{outline:none/);
});
