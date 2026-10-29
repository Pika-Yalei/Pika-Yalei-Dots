import { siteUrl } from './feed.mjs';
import { collectTopics } from './topics.mjs';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function renderOpml(mode) {
 if(!['all','topics'].includes(mode)) throw new RangeError('Unknown subscription bundle');
 const title=mode==='all'?'全部手记 RSS':'五个新闻栏目 RSS';
 const entries=mode==='all'?[{name:'全部手记',url:'/feed.xml',page:'/'}]:collectTopics([]).map(t=>({name:t.name,url:`/topics/${t.id}/feed.xml`,page:`/topics/${t.id}/`}));
 return `<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0"><head><title>${escape(title)}</title></head><body>\n${entries.map(e=>`<outline type="rss" text="${escape(e.name)}" title="${escape(e.name)}" xmlUrl="${siteUrl}${e.url}" htmlUrl="${siteUrl}${e.page}"/>`).join('\n')}\n</body></opml>\n`;
}
