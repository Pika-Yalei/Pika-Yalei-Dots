// Only fingerprinted bytes are immutable. Human-readable URLs must revalidate.
export function renderCacheHeaders(base, stylesheetName) {
  const names = Array.isArray(stylesheetName) ? stylesheetName : [stylesheetName];
  if (!names.length || new Set(names).size !== names.length || names.some(name => typeof name !== 'string' || !/^(?:style|reader-controls|news-calendar)\.[a-f0-9]{16}\.css$(?![\s\S])/.test(name))) throw new TypeError('Expected a fingerprinted stylesheet');
  const mutable = ['/', '/index.html', '/page/*', '/notes/*', '/archive/*', '/categories/*', '/about/*', '/subscribe/*', '/sources/*', '/topics/*', '/headlines/*', '/404.html', '/feed.xml', '/feed.json', '/sitemap.xml', '/robots.txt', '/style.css', '/reader-controls.css', '/news-calendar.css', '/calendar/*', '/favicon.svg'];
  return `${base.trimEnd()}\n\n${mutable.map(route => `${route}\n  Cache-Control: public, max-age=0, must-revalidate`).join('\n\n')}\n\n${names.map(name => `/${name}\n  Cache-Control: public, max-age=31536000, immutable`).join('\n\n')}\n`;
}
