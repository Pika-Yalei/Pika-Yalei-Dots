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
