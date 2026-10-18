import { mkdir, mkdtemp, rename, rm } from 'node:fs/promises';
import path from 'node:path';

// Render on the same filesystem before moving the previous output aside.
// This is failure recovery, not a crash-atomic directory exchange.
export async function buildDirectory(destination, render) {
  const output = path.resolve(destination);
  const temporary = await mkdtemp(path.join(path.dirname(output), `.${path.basename(output)}-build-`));
  const staged = path.join(temporary, 'next');
  const backup = path.join(temporary, 'previous');
  let preserveBackup = false;
  try {
    await mkdir(staged);
    await render(staged);
    let hadPrevious = false;
    try {
      await rename(output, backup);
      hadPrevious = true;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    try {
      await rename(staged, output);
    } catch (error) {
      if (hadPrevious) {
        try {
          await rename(backup, output);
        } catch (restoreError) {
          preserveBackup = true;
          throw new AggregateError([error, restoreError], `Build promotion and recovery failed; previous output retained at ${backup}`);
        }
      }
      throw error;
    }
  } finally {
    // Never erase the only surviving successful output if recovery itself fails.
    if (preserveBackup) await rm(staged, { recursive: true, force: true });
    else await rm(temporary, { recursive: true, force: true });
  }
}
