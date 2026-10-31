import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {collectNewsCalendar,renderNewsCalendar,renderCalendarPrint} from './news-calendar.mjs';
test('print calendar includes all months and same-day articles independently of disclosure state',()=>{
 const posts=[{date:'2026-10-01',slug:'one',title:'One <title>',category:'新闻回顾'},{date:'2026-09-30',slug:'two',title:'Two',category:'新闻回顾'},{date:'2026-09-30',slug:'three',title:'Three',category:'新闻回顾'},{date:'2026-09-30',slug:'other',title:'Other',category:'技术复盘'}];
 const html=renderCalendarPrint(collectNewsCalendar(posts));
 for(const slug of ['one','two','three'])assert.equal(html.split(`href="/notes/${slug}/"`).length,2);
 assert.doesNotMatch(html,/other|<details|<summary|One <title>/);
 assert.match(html,/One &lt;title&gt;/);
 assert.ok(renderNewsCalendar(posts).includes(html));
 assert.equal(renderCalendarPrint([]),'');
});
test('production print list preserves every news permalink and does not depend on open details',()=>{
 const posts=JSON.parse(readFileSync(new URL('../content/posts.json',import.meta.url)));
 const html=renderCalendarPrint(collectNewsCalendar(posts));
 for(const p of posts.filter(p=>p.category==='新闻回顾'))assert.ok(html.includes(`/notes/${p.slug}/`));
 const css=readFileSync(new URL('../public/news-calendar.css',import.meta.url),'utf8');
 assert.match(css,/\.calendar-print\{display:none\}/);
 assert.match(css,/@media print\{\s*\.calendar-month\{display:none\}\s*\.calendar-print\{display:block\}/);
});
