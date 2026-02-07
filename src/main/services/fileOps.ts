import fs from 'fs';
import path from 'path';

export async function walkFiles(root: string): Promise<string[]> {
  const results: string[] = [];
  const stack: string[] = [root];

  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    const entries = await fs.promises.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile()) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

export async function copyFileWithRetries(src: string, dest: string, retries = 3): Promise<void> {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      await fs.promises.mkdir(path.dirname(dest), { recursive: true });
      await fs.promises.copyFile(src, dest);
      return;
    } catch (error: any) {
      if (attempt >= retries) {
        throw error;
      }
      const code = error?.code;
      if (code !== 'EBUSY' && code !== 'EPERM' && code !== 'EACCES') {
        throw error;
      }
      await delay(200 * Math.pow(2, attempt));
    }
  }
}

export async function removeDirSafe(targetPath: string): Promise<void> {
  if (!fs.existsSync(targetPath)) return;
  await fs.promises.rm(targetPath, { recursive: true, force: true });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
