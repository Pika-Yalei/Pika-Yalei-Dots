import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { daysInMonth, collectNewsCalendar, renderNewsCalendar } from './news-calendar.mjs';
const post = (date, slug = date, title = date) => ({date, slug, title, category: '新闻回顾'});

test('calendar handles Gregorian leap years and invalid dates', () => {
  assert.equal(daysInMonth(2024, 2), 29);
  assert.equal(daysInMonth(1900, 2), 28);
  assert.equal(daysInMonth(2000, 2), 29);
  assert.equal(daysInMonth(2026, 4), 30);
  for (const args of [[2026, 0], [2026, 13], [0, 1]]) assert.throws(() => daysInMonth(...args), RangeError);
  for (const date of ['2026-02-29', '2026-01-00', '2026-13-01', 'bad']) assert.throws(() => collectNewsCalendar([post(date)]), RangeError);
});

test('calendar weeks start Monday, pad complete weeks, and retain multiple same-day articles', () => {
  const posts = [post('2024-02-29', 'b'), post('2024-02-29', 'a'), post('2024-03-01')];
  const original = JSON.stringify(posts);
  const [march, february] = collectNewsCalendar(posts);
  assert.equal(march.month, '2024-03');
  assert.equal(february.weeks[0][0], null);
  assert.equal(february.weeks[0][2], null);
  assert.equal(february.weeks[0][3].date, '2024-02-01');
  assert.equal(february.days.length, 29);
  assert.deepEqual(february.days[28].posts.map(p => p.slug), ['a', 'b']);
  assert.equal(february.count, 2);
  assert.ok(february.weeks.every(week => week.length === 7));
  assert.equal(JSON.stringify(posts), original);
  assert.equal(collectNewsCalendar([post('2026-06-01')])[0].weeks[0][0].day, 1);
});

test('only actual months with news appear, empty days are not fabricated articles', () => {
  const months = collectNewsCalendar([post('2026-10-01'), {...post('2026-09-01'), category: '技术复盘'}]);
  assert.equal(months.length, 1);
  assert.equal(months[0].days[1].posts.length, 0);
  const html = renderNewsCalendar([post('2026-10-01')]);
  assert.match(html, /未刊发该回顾日/);
  assert.match(html, /不代表当天没有新闻/);
  assert.match(html, /2026-10-02，未刊发新闻简报/);
  assert.doesNotMatch(html, /href="#calendar-day-2026-10-02"/);
  assert.match(renderNewsCalendar([]), /暂未刊发/);
});

test('semantic calendar links reach labelled date headings and article URLs without scripts', () => {
  const html = renderNewsCalendar([post('2026-10-01', 'a', '<unsafe>'), post('2026-10-01', 'b'), post('2026-09-01')]);
  assert.equal((html.match(/class="calendar-month" open/g) || []).length, 1);
  assert.match(html, /<caption>2026-10 新闻简报（周一开始）<\/caption>/);
  assert.equal((html.match(/scope="col"/g) || []).length, 14);
  assert.match(html, /href="#calendar-day-2026-10-01" aria-label="2026-10-01，2 篇新闻简报"/);
  assert.match(html, /id="calendar-day-2026-10-01" tabindex="-1"/);
  assert.match(html, /href="\/notes\/a\/">&lt;unsafe&gt;/);
  assert.match(html, /href="\/notes\/b\/"/);
  assert.doesNotMatch(html, /<script|onclick|<unsafe>/);
});

test('calendar CSS supports small screens, focus, and readable touch-sized days', async () => {
  const css = await readFile(new URL('../public/news-calendar.css', import.meta.url), 'utf8');
  assert.match(css, /table-layout:fixed/);
  assert.match(css, /min-height:56px/);
  assert.match(css, /max-width:30em/);
  assert.match(css, /focus-visible/);
  assert.match(css, /forced-colors/);
});

test('built calendar, sitemap and archive expose the stable calendar route', async () => {
  const html = await readFile(new URL('../dist/calendar/index.html', import.meta.url), 'utf8');
  const sitemap = await readFile(new URL('../dist/sitemap.xml', import.meta.url), 'utf8');
  const archive = await readFile(new URL('../dist/archive/index.html', import.meta.url), 'utf8');
  assert.match(html, /href="\/news-calendar.css"/);
  assert.match(html, /<h1>新闻日历<\/h1>/);
  assert.match(sitemap, /\/calendar\/<\/loc>/);
  assert.match(archive, /href="\/calendar\/">用日历定位新闻简报日期/);
  assert.doesNotMatch(html, /<script/);
});
