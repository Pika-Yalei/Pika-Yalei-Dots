// Public job facts only. Source text is always escaped; links are validated.
export const jobCategories = {java:'Java 后端', data:'数据开发与治理', agent:'AI Agent'};
const escape = text => String(text).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function validateJobs(jobs) {
  if (!Array.isArray(jobs)) throw new TypeError('Jobs must be an array');
  const ids = new Set();
  const urls = new Set();
  for (const job of jobs) {
    if (!/^[a-z0-9-]+$/.test(job.id) || ids.has(job.id)) throw new Error('Invalid or duplicate job ID');
    ids.add(job.id);
    const fields = ['id','category','title','company','location','remote','requirements','salary','summary','limitations','status','checkedOn','remoteScope','url'];
    if (Object.keys(job).some(key => !fields.includes(key))) throw new Error('Unexpected job field');
    for (const key of ['title','company','location','remote','requirements','salary','summary','limitations','status','checkedOn']) {
      if (typeof job[key] !== 'string' || !job[key].trim()) throw new Error(`Missing job ${key}`);
    }
    if (!Object.hasOwn(jobCategories, job.category)) throw new Error('Unknown job category');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(job.checkedOn) || !Number.isFinite(Date.parse(job.checkedOn)) || new Date(job.checkedOn).toISOString().slice(0,10) !== job.checkedOn) throw new Error('Invalid checked date');
    const url = new URL(job.url);
    if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.search) throw new Error('Use a canonical HTTPS job URL');
    if (urls.has(url.href)) throw new Error('Duplicate job source');
    urls.add(url.href);
    if (!['confirmed','unclear'].includes(job.remoteScope)) throw new Error('Unknown remote scope');
  }
  return jobs;
}
export function renderJobs(jobs) {
  validateJobs(jobs);
  const groups = Object.entries(jobCategories).map(([key,label]) => {
    const items = jobs.filter(job => job.category === key);
    return `<section class="jobs-group" aria-labelledby="jobs-${key}"><h2 id="jobs-${key}" tabindex="-1">${label} <small>${items.length} 条</small></h2>${items.length ? items.map(job => `<article class="job-entry" id="${job.id}"><h3><a href="${escape(job.url)}" rel="noopener noreferrer">${escape(job.title)}</a></h3><p class="job-company">${escape(job.company)} · ${escape(job.location)}</p><dl>${[['远程范围',job.remote],['薪酬',job.salary],['学历与经验',job.requirements],['主要工作',job.summary],['需要确认',job.limitations],['页面状态',job.status]].map(([label,value])=>`<div><dt>${label}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl><p class="job-source">来源核读日期（北京时间）：<time datetime="${escape(job.checkedOn)}">${escape(job.checkedOn)}</time> · ${job.remoteScope === 'confirmed' ? '原文明确中国境内远程' : '具体远程范围待确认'}<br><a href="${escape(job.url)}" rel="noopener noreferrer">原始岗位页面</a> · <a href="#${job.id}">本条永久定位</a></p></article>`).join('') : '<p>暂无已核读记录，不用无关岗位凑数。</p>'}</section>`;
  }).join('');
  return `<div class="article-shell jobs"><header class="article-header"><p class="eyebrow">REMOTE WORK / PUBLIC SOURCES</p><h1>远程岗位观察</h1><p class="article-subtitle">Java 后端、数据开发与治理、AI Agent。先核对工作内容，再看远程边界。</p></header><p>这里只整理公开招聘信息，不代表雇主背书或招聘承诺。“可远程”不等于全国居家办公；地域、时区和签约主体未披露时会明确标出。岗位可能在核读后关闭，请以原始页面及雇主最新答复为准。</p><nav class="jobs-nav" aria-label="岗位方向">${Object.entries(jobCategories).map(([key,label])=>`<a href="#jobs-${key}">${label}</a>`).join('')}<a href="/jobs/catalogue.json" download>下载公开台账 JSON</a></nav><p class="job-source">${jobs.length} 条公开记录。核读日期不等于发布时间；不以搜索摘要代替完整岗位描述，不将申请入口当作雇主确认在招。</p>${groups}<aside class="closing-note">只做信息整理，不代投简历、不注册、不联系招聘方。招聘方不明、远程范围未明和薪酬未披露，不会被自动补全。</aside></div>`;
}
