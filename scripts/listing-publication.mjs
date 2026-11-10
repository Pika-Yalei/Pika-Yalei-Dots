const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
// Review-day ordering is unchanged. Only recorded publication instants are shown.
export function renderListingPublication(post) {
  if (!post.publishedAt) return '';
  const instant = new Date(post.publishedAt);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(post.publishedAt) || !Number.isFinite(instant.getTime()) || instant.toISOString() !== post.publishedAt.replace('Z', '.000Z')) throw new RangeError('Invalid listing publication timestamp');
  const label = post.publicationKind === 'backfill' ? '补发时间' : '发布时间';
  const text = instant.toLocaleString('sv-SE', {timeZone:'Asia/Shanghai',hour12:false});
  return `<p class="entry-publication">${label}：<time datetime="${escape(post.publishedAt)}">${escape(text)}</time>（北京时间）</p>`;
}
