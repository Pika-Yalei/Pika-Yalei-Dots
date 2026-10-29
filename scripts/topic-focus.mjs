import { collectTopics } from './topics.mjs';

// Reuse exact topic/legacy-heading matching; never rewrite historical anchors.
export function topicFocusSections(post, sections) {
  const topics = collectTopics([post]);
  return sections.map(section => ({...section, focusTopic: topics.find(topic => topic.entries.some(entry => entry.href.endsWith(`#${section.id}`)))?.id ?? 'other'}));
}
export function renderTopicFocus(post) {
  if (post.category !== '新闻回顾') return '';
  const topics = collectTopics([post]);
  if (!topics.some(topic => topic.entries.length)) return '';
  return `<fieldset class="topic-focus"><legend>聚焦新闻栏目</legend><div class="topic-focus-options"><label><input type="radio" name="news-focus" value="all" checked>全篇</label>${topics.map(topic => `<label><input type="radio" name="news-focus" value="${topic.id}"${topic.entries.length ? '' : ' disabled'}>${topic.name}</label>`).join('')}</div><p>仅筛选本页屏幕正文，不保存偏好；选择“全篇”恢复。链接定位的栏目会额外显示，以免隐藏目标；打印、订阅与文本下载始终保留全文。</p></fieldset>`;
}
