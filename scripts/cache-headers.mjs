// Only fingerprinted bytes are immutable. Human-readable URLs must revalidate.
export function renderCacheHeaders(base, stylesheetName) {
  if (!/^style\.[a-f0-9]{16}\.css$/.test(stylesheetName)) throw new TypeError('Expected a fingerprinted stylesheet');
  const mutable = ['/', '/index.html', '/page/*', '/notes/*', '/archive/*', '/categories/*', '/about/*', '/subscribe/*', '/sources/*', '/topics/*', '/404.html', '/feed.xml', '/feed.json', '/sitemap.xml', '/robots.txt', '/style.css', '/favicon.svg'];
  return `${base.trimEnd()}\n\n${mutable.map(route => `${route}\n  Cache-Control: public, max-age=0, must-revalidate`).join('\n\n')}\n\n/${stylesheetName}\n  Cache-Control: public, max-age=31536000, immutable\n`;
}
