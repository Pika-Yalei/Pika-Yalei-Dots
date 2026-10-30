import { collectSources } from './source-index.mjs';
import { siteUrl } from './feed.mjs';
// Quote every cell; neutralize spreadsheet formulas even after leading whitespace.
export function csvCell(value) {
 const text=String(value);
 const safe=/^[\s\uFEFF]*[=+\-@]/u.test(text) ? `'${text}` : text;
 return `"${safe.replaceAll('"','""')}"`;
}
export function renderSourceCsv(posts) {
 const rows=[['source_label','source_url','source_website','article_title','section','article_url','news_item_title','mapping_scope']];
 for(const source of collectSources(posts)) for(const ref of source.references){
  rows.push([source.label,source.url,new URL(source.url).hostname,ref.title,ref.heading,siteUrl+ref.href,ref.itemTitle,ref.scope]);
 }
 return '\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
}
