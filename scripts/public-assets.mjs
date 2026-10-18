import { lstat, readdir, open } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';

// Exact reviewed paths, not extensions: a stray private.css must not be published.
export const PUBLIC_ASSETS = Object.freeze(['_headers', 'favicon.svg', 'style.css']);

export async function readPublicAssets(directory) {
  const invalid = (name, reason) => new Error(`Invalid public asset ${JSON.stringify(name)}: ${reason}`);
  if (!(await lstat(directory)).isDirectory()) {
    throw invalid('public/', 'must be a real directory, not a symbolic link');
  }
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (!PUBLIC_ASSETS.includes(entry.name)) {
      throw invalid(entry.name, 'not in the reviewed public asset allowlist');
    }
    if (!entry.isFile()) {
      throw invalid(entry.name, 'must be a regular file, not a directory or symbolic link');
    }
  }
  for (const name of PUBLIC_ASSETS) {
    if (!entries.some(entry => entry.name === name)) {
      throw invalid(name, 'required asset is missing');
    }
  }
  // Read every approved asset before replacing dist; publish these bytes, never
  // recursively copy public (which could include files added after validation).
  const assets = new Map();
  for (const name of PUBLIC_ASSETS) {
    const handle = await open(path.join(directory, name), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      if (!(await handle.stat()).isFile()) throw invalid(name, 'must be a regular file');
      assets.set(name, await handle.readFile());
    } finally {
      await handle.close();
    }
  }
  return assets;
}
