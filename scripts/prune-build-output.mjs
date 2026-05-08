import { rm, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');

await rm(path.join(dist, 'sourcemaps'), { recursive: true, force: true });

async function removeMaps(dir) {
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await removeMaps(fullPath);
      return;
    }

    if (entry.isFile() && entry.name.endsWith('.map')) {
      await rm(fullPath, { force: true });
    }
  }));
}

await removeMaps(path.join(dist, 'client'));
