import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

describe('verify-gate-schedule', () => {
  it('passes in a checkout that contains only tracked project files', () => {
    const result = spawnSync(process.execPath, ['scripts/verify-gate-schedule.mjs'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    });

    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('4 gate(s) tracked; 0 overdue');
  });
});
