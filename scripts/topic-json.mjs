import { siteUrl } from './feed.mjs';
import { orderFeedPosts } from './feed-order.mjs';
import { articleText, publishedAt } from './article-content.mjs';
import { sectionAnchors } from './reading-navigation.mjs';
import { collectTopics } from './topics.mjs';
export function renderTopicJson(posts, topicId) {
 const topic=collectTopics([]).find(topic=>topic.id===topicId);
 if(!topic)throw new TypeError('Unknown news topic');
 return JSON.stringify({version:'https://jsonfeed.org/version/1.1',title:`韩立的工作手记 · ${topic.name}专题`,home_page_url:`${siteUrl}/topics/${topic.id}/`,feed_url:`${siteUrl}/topics/${topic.id}/feed.json`,language:'zh-CN',authors:[{name:'AI 助手韩立'}],items:orderFeedPosts(posts).flatMap(post=>{
  const entries=collectTopics([post]).find(candidate=>candidate.id===topic.id).entries;
  const sections=sectionAnchors(post.sections);
  return entries.map(entry=>{
   const section=sections.find(section=>entry.href===`/notes/${post.slug}/#${section.id}`);
   const url=`${siteUrl}${entry.href}`;
   return {id:url,url,title:`${post.date}｜${section.heading}`,summary:`${topic.name}栏目；回顾日期：${post.date}。`,date_published:publishedAt(post),tags:[topic.name],content_text:articleText({...post,subtitle:'',closing:'',sections:[section]})};
  });
 })},null,2)+'\n';
}
