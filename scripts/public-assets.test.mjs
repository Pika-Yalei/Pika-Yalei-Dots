import { fingerprintSearch } from './search.mjs';
import { fingerprintStylesheets } from './stylesheets.mjs';
import { renderCacheHeaders } from './cache-headers.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, readFile, readdir, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUBLIC_ASSETS, readPublicAssets } from './public-assets.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
async function snapshot(directory, prefix = '') {
  const result = {};
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = path.join(prefix, entry.name);
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) Object.assign(result, await snapshot(absolute, relative));
    else result[relative] = await readFile(absolute);
  }
  return result;
}
async function fixture(t) {
  const temp = await mkdtemp(path.join(tmpdir(), 'notebook-assets-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  for (const dir of ['scripts', 'content', 'public']) {
    await cp(path.join(root, dir), path.join(temp, dir), { recursive: true });
  }
  const build = () => execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: temp, stdio: 'pipe' });
  build();
  return { temp, build, previous: await snapshot(path.join(temp, 'dist')) };
}

test('reviewed assets retain their bytes and headers append only generated cache rules', async (t) => {
  const { temp, previous } = await fixture(t);
  assert.deepEqual(PUBLIC_ASSETS, ['_headers', 'favicon.svg', 'style.css', 'reader-controls.css', 'news-calendar.css', 'search.js']);
  for (const name of PUBLIC_ASSETS) {
    const original = await readFile(path.join(temp, 'public', name));
    const fingerprints = [...fingerprintStylesheets(await readPublicAssets(path.join(temp, 'public'))).values()];
    assert.deepEqual(previous[name], name === '_headers' ? Buffer.from(renderCacheHeaders(original.toString('utf8'), fingerprints, fingerprintSearch(await readPublicAssets(path.join(temp, 'public'))))) : original);
  }
  const hashed = Object.keys(previous).filter(name => /^style\.[0-9a-f]{16}\.css$/.test(name));
  assert.equal(hashed.length, 1);
  assert.deepEqual(previous[hashed[0]], previous['style.css']);
  assert.ok(previous['index.html'].toString().includes(`/${hashed[0]}`));
});

for (const name of ['.env', '.env.local', '.DS_Store', 'secrets.json', 'style.css.bak', 'style.css~', 'private.css', 'private.svg', 'index.html', '_redirects', 'private/.env', '.cache/token.txt']) {
  test(`unexpected public artifact ${name} fails without altering dist`, async (t) => {
    const { temp, build, previous } = await fixture(t);
    const target = path.join(temp, 'public', name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, 'synthetic test fixture');
    assert.throws(build, error => {
      assert.match(error.stderr.toString(), /Invalid public asset .*not in the reviewed public asset allowlist/);
      assert.ok(error.stderr.toString().includes(JSON.stringify(name.split('/')[0])));
      return true;
    });
    assert.deepEqual(await snapshot(path.join(temp, 'dist')), previous);
  });
}

for (const name of PUBLIC_ASSETS) {
  for (const replacement of ['missing', 'directory', 'symlink', 'dangling symlink']) {
    test(`${name} as ${replacement} fails without altering dist`, async (t) => {
      const { temp, build, previous } = await fixture(t);
      const target = path.join(temp, 'public', name);
      await rm(target);
      if (replacement === 'directory') {
        await mkdir(target);
        await writeFile(path.join(target, '.env'), 'synthetic test fixture');
      }
      if (replacement === 'symlink') await symlink(path.join(root, 'public', name), target);
      if (replacement === 'dangling symlink') await symlink(path.join(temp, 'missing'), target);
      assert.throws(build, error => {
        assert.match(error.stderr.toString(), /Invalid public asset/);
        assert.ok(error.stderr.toString().includes(JSON.stringify(name)));
        return true;
      });
      assert.deepEqual(await snapshot(path.join(temp, 'dist')), previous);
    });
  }
}

test('public directory symbolic link is rejected before replacing dist', async (t) => {
  const { temp, build, previous } = await fixture(t);
  await rename(path.join(temp, 'public'), path.join(temp, 'elsewhere'));
  await symlink(path.join(temp, 'elsewhere'), path.join(temp, 'public'), 'dir');
  assert.throws(build, error => /Invalid public asset.*real directory/.test(error.stderr.toString()));
  assert.deepEqual(await snapshot(path.join(temp, 'dist')), previous);
});

test('validated assets are snapshots, not paths subsequently copied recursively', async (t) => {
  const { temp } = await fixture(t);
  const assets = await readPublicAssets(path.join(temp, 'public'));
  const original = Buffer.from(assets.get('style.css'));
  await writeFile(path.join(temp, 'public/style.css'), 'changed later');
  await writeFile(path.join(temp, 'public/.env'), 'synthetic test fixture');
  assert.deepEqual([...assets.keys()], PUBLIC_ASSETS);
  assert.deepEqual(assets.get('style.css'), original);
});
