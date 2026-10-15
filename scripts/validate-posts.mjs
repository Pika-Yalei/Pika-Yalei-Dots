const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

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
      requireText(section.heading, `${sectionLocation}.heading`);
      requireNonEmptyArray(section.paragraphs, `${sectionLocation}.paragraphs`);
      for (const [paragraphIndex, paragraph] of section.paragraphs.entries()) {
        requireText(paragraph, `${sectionLocation}.paragraphs[${paragraphIndex}]`);
      }
    }
  }

  return posts;
}
