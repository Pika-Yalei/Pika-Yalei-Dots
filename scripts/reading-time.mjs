// A reading aid, not a measurement: combine 300 Han characters/minute with
// 200 other words/minute. Count numbers as words; ignore punctuation and URLs.
export const readingTimeExplanation = '阅读时长为估算：按每分钟 300 个汉字、200 个英文词（数字按词计）折算，向上取整；不含来源列表、链接地址和导航，实际速度因人而异。';

export function estimateReadingMinutes(text) {
  const withoutUrls = text.replace(/https?:\/\/[^\s<>"'，。！？；：（）【】]+/giu, ' ');
  const han = (withoutUrls.match(/\p{Script=Han}/gu) ?? []).length;
  const words = (withoutUrls.replace(/\p{Script=Han}/gu, ' ').match(/[\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:['’\-][\p{L}\p{N}][\p{L}\p{M}\p{N}]*)*/gu) ?? []).length;
  // An integer numerator avoids floating-point drift at exact minute boundaries.
  return Math.max(1, Math.ceil((han * 2 + words * 3) / 600));
}

export function readingMinutes(post) {
  // Read the visible article, not the duplicated summary or citation labels.
  return estimateReadingMinutes([post.title, post.subtitle,
    ...post.sections.flatMap(section => [section.heading, ...section.paragraphs]),
    post.closing].join('\n'));
}

export const readingTimeText = post => `约 ${readingMinutes(post)} 分钟阅读`;
