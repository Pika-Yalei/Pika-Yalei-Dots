import { siteUrl } from './feed.mjs';

const escape = text => String(text).replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));

// One canonical article address, without a generated date or extra resources.
export function renderPrintSource(slug) {
  const url = escape(`${siteUrl}/notes/${encodeURIComponent(slug)}/`);
  return `<p class="print-source">原文地址：<a href="${url}">${url}</a></p>`;
}
