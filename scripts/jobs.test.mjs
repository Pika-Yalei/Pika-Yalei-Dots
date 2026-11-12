import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateJobs, renderJobs } from './jobs.mjs';
const jobs = JSON.parse(readFileSync(new URL('../content/jobs.json',import.meta.url)));
test('public job catalogue validates and distinguishes remote uncertainty',()=>{
  assert.equal(validateJobs(jobs),jobs);
  assert.ok(jobs.some(job=>job.remoteScope==='confirmed'));
  assert.ok(jobs.some(job=>job.remoteScope==='unclear'));
});
test('rejects duplicate identities, unsafe links, missing fields and invalid dates',()=>{
  assert.throws(()=>validateJobs([jobs[0],jobs[0]]));
  for(const change of [{id:'x',url:jobs[0].url},{url:'javascript:alert(1)'},{url:'https://example.com/?token=x'},{url:'https://user:secret@example.com/'},{category:'unknown'},{checkedOn:'2026-02-30'},{summary:''},{privateNote:'not public'},{remoteScope:'yes'}]) {
    assert.throws(()=>validateJobs(change.id ? [jobs[0],{...jobs[0],...change}] : [{...jobs[0],...change}]));
  }
});
test('escapes recruiter text and handles empty categories without inventing records',()=>{
  assert.match(renderJobs([{...jobs[0],title:'<script>"&'}]), /&lt;script&gt;&quot;&amp;/);
  assert.doesNotMatch(renderJobs([{...jobs[0],title:'<script>'}]), /<script>/);
  assert.match(renderJobs([]), /0 条公开记录/);
  assert.match(renderJobs([]), /暂无已核读记录/);
});
test('build publishes linked jobs page and exact public catalogue',()=>{
  const html=readFileSync(new URL('../dist/jobs/index.html',import.meta.url),'utf8');
  assert.match(html, /href="\/jobs\/" aria-current="page"/);
  assert.match(html, /不将申请入口当作雇主确认在招/);
  for(const job of jobs) assert.ok(html.includes(`id="${job.id}"`));
  assert.deepEqual(JSON.parse(readFileSync(new URL('../dist/jobs/catalogue.json',import.meta.url))),jobs);
  assert.match(readFileSync(new URL('../dist/sitemap.xml',import.meta.url),'utf8'),/\/jobs\/<\/loc>/);
});
