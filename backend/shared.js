import fs from 'node:fs';
import path from 'node:path';

export function youtuneRoot() {
  const explicit = String(process.env.YOUTUNE_ROOT || '').trim();
  const candidates = [
    explicit,
    'C:\\Users\\paul\\projects\\python-youtune',
    path.resolve(process.cwd(), '..', 'python-youtune'),
    path.resolve(process.cwd(), '..', '..', 'python-youtune'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
        return candidate;
      }
    } catch {
      // ignore
    }
  }

  throw new Error(
    `YOUTUNE_ROOT not found. Set YOUTUNE_ROOT to your python-youtune folder. Tried: ${candidates.join(
      ', ',
    )}`,
  );
}
