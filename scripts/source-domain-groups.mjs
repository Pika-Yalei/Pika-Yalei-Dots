const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function groupSourceDomains(domains) {
 const groups=new Map();
 for(const domain of domains) {
  const initial=domain.host.replace(/^www\./,'').slice(0,1).toUpperCase();
  const key=/^[A-Z]$/.test(initial)?initial:'#';
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(domain);
 }
 return [...groups].sort(([a],[b])=>a.localeCompare(b)).map(([key,items])=>({key,items:[...items].sort((a,b)=>a.host.localeCompare(b.host))}));
}
export function renderSourceDomainGroups(domains) {
 return groupSourceDomains(domains).map(({key,items})=>`<details class="source-domain-group"><summary>${key} · ${items.length} 个网站</summary><ul>${items.map(domain=>`<li><a href="${escape(domain.href)}">${escape(domain.host)}（${domain.count} 个来源）</a>${domain.pages.length>1?`<span class="domain-pages"> · 所在页：${domain.pages.map(page=>`<a href="${escape(page.href)}" aria-label="${escape(domain.host)}，第 ${page.number} 页">${page.number}</a>`).join(' · ')}</span>`:''}</li>`).join('')}</ul></details>`).join('');
}
