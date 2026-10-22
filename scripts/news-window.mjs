export const newsColumns = ['AI', '商业', '股票市场', '中国政治与政策', '国际政治与重大事件'];
const validTimestamp = value => typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value.replace('Z', '.000Z');
export function validateNewsWindow(post, location) {
  if (!Object.hasOwn(post, 'newsWindow')) return;
  const fail = reason => { throw new TypeError(`Invalid content at ${location}.newsWindow: ${reason}`); };
  const window = post.newsWindow;
  if (!window || typeof window !== 'object' || Array.isArray(window) || Object.keys(window).sort().join(',') !== 'end,start') fail('expected only start and end');
  if (!validTimestamp(window.start) || !validTimestamp(window.end)) fail('expected real UTC timestamps');
  if (Date.parse(window.end) - Date.parse(window.start) !== 86400000) fail('expected exactly 24 hours');
  if (post.category !== '新闻回顾' || post.title !== `${post.date}｜24 小时新闻简报`) fail('expected dated news title and category');
  const endDate = new Date(window.end).toLocaleDateString('sv-SE', {timeZone:'Asia/Shanghai'});
  if (post.date !== endDate) fail('review date must match the window end in Beijing');
  if (!validTimestamp(post.publishedAt) || Date.parse(post.publishedAt) < Date.parse(window.end)) fail('publication must not precede the cutoff');
  const sections = post.sections.length === 6 && /^回顾范围/.test(post.sections[0].heading) ? post.sections.slice(1) : post.sections;
  const columns = sections.map(section => section.heading.split('｜')[0]);
  if (JSON.stringify(columns) !== JSON.stringify(newsColumns)) fail('expected the five news columns in fixed order (with an optional legacy introduction)');
}
export function newsWindowText(post) {
  if (!post.newsWindow) return '';
  const format = value => new Date(value).toLocaleString('sv-SE', {timeZone:'Asia/Shanghai',hour12:false});
  return `新闻窗口：${format(post.newsWindow.start)} 至 ${format(post.newsWindow.end)}（北京时间，24 小时）。`;
}
