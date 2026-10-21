import { validateNewsWindow } from './news-window.mjs';
import { isReviewedSource } from './article-content.mjs';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const postFields = new Set([
  'slug', 'date', 'title', 'subtitle', 'category', 'summary',
  'readingMinutes', 'sections', 'closing', 'publishedAt', 'publicationKind', 'newsWindow'
]);
const sectionFields = new Set(['heading', 'paragraphs', 'sources']);

function invalid(location, requirement) {
  throw new TypeError(`Invalid content at ${location}: ${requirement}`);
}

function requireObject(value, location) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    invalid(location, 'expected an object');
  }
}

function requireText(value, location) {
  if (typeof value !== 'string' || !value.trim()) {
    invalid(location, 'expected a non-blank string');
  }
}

// This schema boundary rejects extra JSON fields, not private text inside allowed fields.
// Keep the list explicit: new public fields require review before being accepted.
function requireKnownFields(value, allowedFields, location) {
  for (const key of Object.keys(value)) {
    if (!allowedFields.has(key)) {
      const field = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)
        ? `.${key}`
        : `[${JSON.stringify(key)}]`;
      invalid(`${location}${field}`, 'unknown field; only reviewed public content fields are allowed');
    }
  }
}

function requireNonEmptyArray(value, location) {
  if (!Array.isArray(value) || value.length === 0) {
    invalid(location, 'expected a non-empty array');
  }
}

/** Validate content without modifying it; an empty notebook is valid. */
export function validatePosts(posts) {
  if (!Array.isArray(posts)) {
    invalid('posts', 'expected an array');
  }

  const slugs = new Map();
  for (const [postIndex, post] of posts.entries()) {
    const location = `posts[${postIndex}]`;
    requireObject(post, location);
    requireKnownFields(post, postFields, location);
    if (typeof post.slug !== 'string' || !slugPattern.test(post.slug)) {
      invalid(`${location}.slug`, 'expected a lowercase URL-safe string, with single hyphens between words');
    }
    if (slugs.has(post.slug)) {
      invalid(`${location}.slug`, `must be unique (already used at posts[${slugs.get(post.slug)}].slug)`);
    }
    slugs.set(post.slug, postIndex);

    if (typeof post.date !== 'string' || !datePattern.test(post.date)) {
      invalid(`${location}.date`, 'expected a real date in YYYY-MM-DD format');
    }
    const timestamp = Date.parse(`${post.date}T00:00:00Z`);
    if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== post.date) {
      invalid(`${location}.date`, 'expected a real date in YYYY-MM-DD format');
    }

    if (Object.hasOwn(post, 'publicationKind') && (!['original', 'backfill'].includes(post.publicationKind) || !post.publishedAt)) {
      invalid(`${location}.publicationKind`, 'expected original or backfill with an explicit publishedAt');
    }

    if (Object.hasOwn(post, 'publishedAt')) {
      const value = post.publishedAt;
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value.replace('Z', '.000Z')) {
        invalid(`${location}.publishedAt`, 'expected a real UTC timestamp in YYYY-MM-DDTHH:mm:ssZ format');
      }
    }

    for (const key of ['title', 'subtitle', 'category', 'summary', 'closing']) {
      requireText(post[key], `${location}.${key}`);
    }
    if (!Number.isSafeInteger(post.readingMinutes) || post.readingMinutes < 1) {
      invalid(`${location}.readingMinutes`, 'expected a positive safe integer');
    }

    requireNonEmptyArray(post.sections, `${location}.sections`);
    for (const [sectionIndex, section] of post.sections.entries()) {
      const sectionLocation = `${location}.sections[${sectionIndex}]`;
      requireObject(section, sectionLocation);
      requireKnownFields(section, sectionFields, sectionLocation);
      if (Object.hasOwn(section, 'sources')) {
        requireNonEmptyArray(section.sources, `${sectionLocation}.sources`);
        for (const [index, source] of section.sources.entries()) {
          const sourceLocation = `${sectionLocation}.sources[${index}]`;
          requireObject(source, sourceLocation);
          requireKnownFields(source, new Set(['label', 'url']), sourceLocation);
          requireText(source.label, `${sourceLocation}.label`);
          if (!isReviewedSource(source.url)) {
            invalid(`${sourceLocation}.url`, 'expected an exact reviewed HTTPS source URL without credentials');
          }
        }
      }
      requireText(section.heading, `${sectionLocation}.heading`);
      requireNonEmptyArray(section.paragraphs, `${sectionLocation}.paragraphs`);
      for (const [paragraphIndex, paragraph] of section.paragraphs.entries()) {
        requireText(paragraph, `${sectionLocation}.paragraphs[${paragraphIndex}]`);
      }
    }
  }

  for (const [index, post] of posts.entries()) validateNewsWindow(post, `posts[${index}]`);
  return posts;
}
