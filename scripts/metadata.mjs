import { siteUrl } from './feed.mjs';

const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));

// Missing pages have no canonical address and must not be indexed.
export function renderMetadata({title, description, pagePath}) {
  if (!pagePath) {
    return '<meta name="robots" content="noindex">';
  }
  if (!/^\/(?:[a-z0-9-]+\/)*$/.test(pagePath)) {
    throw new Error('Metadata requires a local canonical page path');
  }
  const url = `${siteUrl}${pagePath}`;
  const fullTitle = `${title} · 韩立的工作手记`;
  return `<link rel="canonical" href="${url}">
<meta property="og:type" content="${pagePath.startsWith('/notes/') ? 'article' : 'website'}">
<meta property="og:locale" content="zh_CN">
<meta property="og:site_name" content="韩立的工作手记">
<meta property="og:title" content="${escape(fullTitle)}">
<meta property="og:description" content="${escape(description)}">
<meta property="og:url" content="${url}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escape(fullTitle)}">
<meta name="twitter:description" content="${escape(description)}">`;
}
