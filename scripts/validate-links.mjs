import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { siteUrl } from './feed.mjs';

const allowedExternalUrls = new Set(['https://github.com/Pika-Yalei/Pika-Yalei-Dots']);
const entities = { amp: '&', AMP: '&', lt: '<', LT: '<', gt: '>', GT: '>', quot: '"', QUOT: '"', apos: "'" };

// Decode once, just as HTML attributes are decoded before URL resolution.
// These named references cover the generator's escapes; numeric references
// also allow synthetic fixtures and future encoded heading IDs.
function decodeAttribute(value) {
  return value.replace(/&(#(?:[xX][\da-fA-F]+|\d+)|amp|AMP|lt|LT|gt|GT|quot|QUOT|apos);/g, (reference, entity) => {
    if (!entity.startsWith('#')) return entities[entity];
    const hex = entity[1].toLowerCase() === 'x';
    const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
    return code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)
      ? '\uFFFD' : String.fromCodePoint(code);
  });
}

// This scans the well-formed static HTML emitted by our generator, rather
// than attempting browser error recovery for arbitrary malformed documents.
function inspectHtml(html) {
  const ids = new Map();
  const references = [];
  let line = 1;
  let lineOffset = 0;
  const tags = /<!--[\s\S]*?-->|<(\/?)([a-z][a-z\d:-]*)(?=[\s/>])((?:[^"'<>]|"[^"]*"|'[^']*')*)>/gi;
  for (let tag; (tag = tags.exec(html));) {
    if (!tag[2] || tag[1]) continue;
    const name = tag[2].toLowerCase();
    const attributes = new Map();
    for (const match of tag[3].matchAll(/([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
      const attribute = match[1].toLowerCase();
      // HTML keeps the first occurrence of duplicate attributes.
      if (!attributes.has(attribute)) attributes.set(attribute, decodeAttribute(match[2] ?? match[3] ?? match[4] ?? ''));
    }
    if (attributes.has('id')) {
      const id = attributes.get('id');
      // Keep every occurrence, including IDs which no link currently uses.
      // Offsets belong to opening tags, not apparent markup in raw text.
      const occurrences = ids.get(id) ?? [];
      line += html.slice(lineOffset, tag.index).split('\n').length - 1;
      lineOffset = tag.index;
      occurrences.push(line);
      ids.set(id, occurrences);
    }
    for (const attribute of ['href', 'src']) {
      if (attributes.has(attribute)) references.push({ tag: name, attribute, value: attributes.get(attribute) });
    }
    // Angle brackets inside raw text are not real elements or anchors.
    if (['script', 'style', 'textarea', 'title'].includes(name)) {
      const closing = new RegExp(`</${name}\\s*>`, 'gi');
      closing.lastIndex = tags.lastIndex;
      tags.lastIndex = closing.exec(html) ? closing.lastIndex : html.length;
    }
  }
  return { ids, references };
}

async function listFiles(directory, prefix = '') {
  const files = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) files.push(...await listFiles(path.join(directory, entry.name), relative));
    else if (entry.isFile()) files.push(relative);
  }
  return files;
}

// Validate generated output without fetching anything or adding client code.
// File lookups use only the output inventory, never paths outside directory.
export async function validateLinks(directory) {
  const files = new Set(await listFiles(directory));
  const pages = new Map();
  for (const file of files) {
    if (file.endsWith('.html')) pages.set(file, inspectHtml(await readFile(path.join(directory, file), 'utf8')));
  }
  const problems = [];
  for (const [source, { ids, references }] of pages) {
    for (const [id, lines] of ids) {
      if (lines.length > 1) {
        problems.push(`${source}: Duplicate id=${JSON.stringify(id)} on lines ${lines.join(', ')}`);
      }
    }
    const base = new URL(source, siteUrl);
    for (const { tag, attribute, value } of references) {
      const report = message => problems.push(`${source}: ${attribute}=${JSON.stringify(value)}: ${message}`);
      let url;
      try {
        url = new URL(value, base);
      } catch {
        report('Invalid URL');
        continue;
      }
      if (url.origin !== base.origin) {
        if (attribute !== 'href' || !['a', 'area'].includes(tag)) report('External resource loads are not allowed');
        else if (!allowedExternalUrls.has(url.href)) report('External URL is not approved');
        continue;
      }
      let pathname;
      let fragment;
      try {
        pathname = decodeURIComponent(url.pathname);
        fragment = decodeURIComponent(url.hash.slice(1));
      } catch {
        report('Invalid percent encoding in local path or fragment');
        continue;
      }
      // Directory URLs (with or without the final slash) serve index.html.
      const target = files.has(pathname) ? pathname : `${pathname.replace(/\/$/, '')}/index.html`;
      if (!files.has(target)) {
        report(`Missing local target ${pathname}`);
        continue;
      }
      if (!fragment) continue; // An empty fragment points to the page itself.
      const page = pages.get(target);
      // Assets may define their own fragments (e.g. SVG views); only HTML IDs
      // are in scope. HTML's special #top also works without a matching ID.
      if (page?.ids.get(fragment)?.length > 1) {
        report(`Ambiguous fragment #${fragment} in ${target} (${page.ids.get(fragment).length} matching IDs)`);
      } else if (page && !page.ids.has(fragment) && fragment.toLowerCase() !== 'top') {
        report(`Missing fragment #${fragment} in ${target}`);
      }
    }
  }
  if (problems.length) throw new Error(`Link validation failed:\n${problems.join('\n')}`);
}
