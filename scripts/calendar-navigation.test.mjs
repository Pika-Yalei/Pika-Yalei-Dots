import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { collectNewsCalendar, renderMonthNavigation, renderNewsCalendar } from './news-calendar.mjs';
const post=(date,slug)=>({date,slug,title:date,category:'新闻回顾'});
test('month shortcuts target visible native summaries without changing dates or open state',()=>{
 const posts=[post('2026-10-30','oct'),post('2026-11-01','nov'),post('2025-11-01','old')];
 const before=structuredClone(posts),html=renderNewsCalendar(posts);
 for(const month of collectNewsCalendar(posts)){
  assert.ok(html.includes(`href="#calendar-summary-${month.month}"`));
  assert.ok(html.includes(`<summary id="calendar-summary-${month.month}">`));
 }
 assert.equal((html.match(/ open>/g)||[]).length,1);
 assert.ok(html.indexOf('href="#calendar-summary-2026-11"')<html.indexOf('href="#calendar-summary-2026-10"'));
 assert.deepEqual(posts,before);
 assert.equal(renderMonthNavigation([]),'');
 assert.equal(renderMonthNavigation(collectNewsCalendar([posts[0]])),'');
});
test('month shortcut style wraps, preserves target visibility and omits print duplication',()=>{
 const css=readFileSync(new URL('../public/news-calendar.css',import.meta.url),'utf8');
 assert.match(css,/calendar-navigation\{[^}]*flex-wrap:wrap/);
 assert.match(css,/calendar-navigation a\{[^}]*min-height:44px/);
 assert.match(css,/summary:target\{outline:2px/);
 assert.match(css,/@media print\{\.calendar-navigation\{display:none/);
});


test('each populated day returns to its own focusable grid cell with no empty-day links', () => {
  const html = renderNewsCalendar([post('2026-10-30','a'),post('2026-10-30','b'),post('2026-11-01','c')]);
  for (const date of ['2026-10-30','2026-11-01']) {
    assert.ok(html.includes(`<a id="calendar-cell-${date}" href="#calendar-day-${date}"`));
    assert.ok(html.includes(`<a class="calendar-return" href="#calendar-cell-${date}">返回 ${date} 日期格</a>`));
    assert.equal(html.split(`id="calendar-cell-${date}"`).length, 2);
    assert.equal(html.split(`href="#calendar-cell-${date}"`).length, 2);
  }
  assert.doesNotMatch(html, /calendar-cell-2026-10-31|<script|onclick/);
  assert.doesNotMatch(renderNewsCalendar([]), /calendar-return|calendar-cell-/);
});

test('built calendar return destinations are unique, visible and covered by target styles', () => {
  const html = readFileSync(new URL('../dist/calendar/index.html', import.meta.url), 'utf8');
  const returns = [...html.matchAll(/class="calendar-return" href="#([^"]+)"/g)].map(match => match[1]);
  assert.ok(returns.length > 0);
  assert.equal(new Set(returns).size, returns.length);
  for (const id of returns) assert.equal(html.split(`id="${id}"`).length, 2);
  const css = readFileSync(new URL('../public/news-calendar.css', import.meta.url), 'utf8');
  assert.match(css, /calendar-grid a:target\{outline:2px solid var\(--green\)/);
  assert.match(css, /@media\(forced-colors:active\)\{\.calendar-grid a:target\{outline-color:Highlight/);
  assert.match(css, /calendar-entries a\{[^}]*min-height:44px/);
});
