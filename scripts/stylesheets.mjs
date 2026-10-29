import { createHash } from 'node:crypto';

// Keep the reviewed CSS names explicit; never publish arbitrary assets by extension.
export const STYLESHEETS = Object.freeze(['style.css', 'reader-controls.css', 'news-calendar.css']);
export function fingerprintStylesheets(publicAssets) {
  return new Map(STYLESHEETS.map(name => {
    const bytes = publicAssets.get(name);
    if (!Buffer.isBuffer(bytes)) throw new TypeError(`Missing stylesheet bytes: ${name}`);
    const digest = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
    return [name, `${name.slice(0, -4)}.${digest}.css`];
  }));
}
