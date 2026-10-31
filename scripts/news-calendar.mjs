const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
const weekdays = ['一', '二', '三', '四', '五', '六', '日'];
export const isLeapYear = year => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
export function daysInMonth(year, month) {
  if (!Number.isInteger(year) || year < 1 || year > 9999 || !Number.isInteger(month) || month < 1 || month > 12) throw new RangeError('Invalid calendar month');
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

export function collectNewsCalendar(posts) {
  const groups = new Map();
  for (const post of posts) {
    if (post.category !== '新闻回顾') continue;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(post.date);
    if (!match || Number(match[3]) < 1 || Number(match[3]) > daysInMonth(Number(match[1]), Number(match[2]))) throw new RangeError('Invalid calendar date');
    const month = post.date.slice(0, 7);
    if (!groups.has(month)) groups.set(month, new Map());
    const dates = groups.get(month);
    if (!dates.has(post.date)) dates.set(post.date, []);
    dates.get(post.date).push(post);
  }
  return [...groups.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([month, dates]) => {
    const [year, monthNumber] = month.split('-').map(Number);
    const leading = (new Date(`${month}-01T12:00:00Z`).getUTCDay() + 6) % 7;
    const days = Array.from({length: daysInMonth(year, monthNumber)}, (_, index) => {
      const date = `${month}-${String(index + 1).padStart(2, '0')}`;
      return {day: index + 1, date, posts: [...(dates.get(date) || [])].sort((a, b) => a.slug.localeCompare(b.slug))};
    });
    const cells = [...Array(leading).fill(null), ...days];
    while (cells.length % 7) cells.push(null);
    return {month, days, weeks: Array.from({length: cells.length / 7}, (_, index) => cells.slice(index * 7, index * 7 + 7)), count: days.reduce((sum, day) => sum + day.posts.length, 0)};
  });
}

export function renderCalendarPrint(months) {
  if (!months.length) return '';
  return `<section class="calendar-print" aria-label="新闻日历打印清单"><h2>全部新闻简报</h2>${months.map(month => `<h3>${escape(month.month)}</h3><ul>${month.days.flatMap(day => day.posts.map(post => `<li><time datetime="${day.date}">${day.date}</time> · <a href="/notes/${escape(post.slug)}/">${escape(post.title)}</a></li>`)).join('')}</ul>`).join('')}</section>`;
}

export function renderNewsCalendar(posts) {
  const months = collectNewsCalendar(posts);
  return `<div class="article-shell news-calendar"><header class="article-header"><h1>新闻日历</h1><p class="article-subtitle">按简报回顾日期定位文章。点击有文章的日期，可跳到当天的标题列表。空白日期表示本站未刊发该回顾日的新闻简报，不代表当天没有新闻；实际发布时间请看文章页。</p></header>${months.length ? months.map((month, index) => `<details class="calendar-month" id="calendar-month-${escape(month.month)}"${index === 0 ? ' open' : ''}><summary>${escape(month.month)} · ${month.count} 篇简报</summary><table class="calendar-grid"><caption>${escape(month.month)} 新闻简报（周一开始）</caption><thead><tr>${weekdays.map(day => `<th scope="col"><span aria-hidden="true">${day}</span><span class="sr-only">星期${day}</span></th>`).join('')}</tr></thead><tbody>${month.weeks.map(week => `<tr>${week.map(day => !day ? '<td class="calendar-padding"></td>' : day.posts.length ? `<td><a href="#calendar-day-${day.date}" aria-label="${day.date}，${day.posts.length} 篇新闻简报"><time datetime="${day.date}">${day.day}</time><small>${day.posts.length}篇</small></a></td>` : `<td><span class="calendar-empty" aria-label="${day.date}，未刊发新闻简报">${day.day}</span></td>`).join('')}</tr>`).join('')}</tbody></table><div class="calendar-entries">${month.days.filter(day => day.posts.length).map(day => `<section aria-labelledby="calendar-day-${day.date}"><h2 id="calendar-day-${day.date}" tabindex="-1"><time datetime="${day.date}">${day.date}</time> · ${day.posts.length} 篇</h2><ul>${day.posts.map(post => `<li><a href="/notes/${escape(post.slug)}/">${escape(post.title)}</a></li>`).join('')}</ul></section>`).join('')}</div><p><a href="/archive/${month.month}/">阅读本月全部手记</a></p></details>`).join('') : '<p>暂未刊发新闻简报。</p>'}${renderCalendarPrint(months)}<p><a href="/archive/">全部日期归档</a> · <a href="/headlines/">按新闻条目浏览</a></p></div>`;
}
