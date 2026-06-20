/**
 * Playtester narrative reporter (embertide-ov9).
 *
 * Opt-in markdown emitter for playtest scenarios. When
 * `PLAYTEST_NARRATE=1` is set in the environment, scenarios that
 * call `createReporter(name)` get a real reporter that accumulates
 * steps + snapshots + screenshots and writes a single markdown file
 * to `docs/playtest-reports/<YYYY-MM-DD>-<scenario>.md` at finalize.
 *
 * Without the env flag, `createReporter` returns a no-op that skips
 * all filesystem work — the default `pnpm playtest` remains a fast
 * pass/fail gate. `pnpm playtest:narrate` sets the flag.
 *
 * Designer reads the generated report before picking up the
 * controller, so the trace uses plain language (no internal jargon)
 * and the summary goes up top.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Page } from '@playwright/test';
import type { CombatSnapshot } from './harness';
import { formatSnapshot } from './harness';

export interface Reporter {
  readonly enabled: boolean;
  step(text: string): void;
  snap(s: CombatSnapshot, label?: string): void;
  screenshot(page: Page, label: string): Promise<void>;
  finalize(summary: string): Promise<void>;
}

const NOOP: Reporter = {
  enabled: false,
  step: () => undefined,
  snap: () => undefined,
  screenshot: async () => undefined,
  finalize: async () => undefined,
};

// Playwright always runs from the project root, so cwd is stable.
const REPORTS_DIR = path.resolve(process.cwd(), 'docs/playtest-reports');

function isoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

class MarkdownReporter implements Reporter {
  public readonly enabled = true;
  private readonly lines: string[] = [];
  private readonly screenshots: Array<{ label: string; relPath: string }> = [];
  private readonly scenario: string;
  private readonly slug: string;
  private readonly reportDir: string;
  private readonly reportFile: string;
  private readonly startedAt: Date;

  constructor(scenario: string) {
    this.scenario = scenario;
    this.startedAt = new Date();
    this.slug = `${isoDate()}-${scenario}`;
    this.reportDir = path.join(REPORTS_DIR, this.slug);
    this.reportFile = path.join(REPORTS_DIR, `${this.slug}.md`);
  }

  step(text: string): void {
    this.lines.push(`- ${text}`);
  }

  snap(s: CombatSnapshot, label?: string): void {
    const prefix = label ? `**${label}** — ` : '';
    this.lines.push(`- ${prefix}\`${formatSnapshot(s)}\``);
  }

  async screenshot(page: Page, label: string): Promise<void> {
    await mkdir(this.reportDir, { recursive: true });
    const filename = `${label}.png`;
    const abs = path.join(this.reportDir, filename);
    await page.screenshot({ path: abs, fullPage: false });
    const relPath = `${this.slug}/${filename}`;
    this.screenshots.push({ label, relPath });
    this.lines.push(`- _screenshot captured: \`${label}\`_`);
  }

  async finalize(summary: string): Promise<void> {
    const endedAt = new Date();
    const durationMs = endedAt.getTime() - this.startedAt.getTime();
    const shots = this.screenshots.length
      ? this.screenshots.map((s) => `### ${s.label}\n\n![${s.label}](${s.relPath})`).join('\n\n')
      : '_No screenshots captured._';
    const body = [
      `# Playtest Report — ${this.scenario}`,
      ``,
      `_Generated ${endedAt.toISOString()} · ${(durationMs / 1000).toFixed(1)}s_`,
      ``,
      `## Summary`,
      ``,
      summary,
      ``,
      `## Trace`,
      ``,
      ...this.lines,
      ``,
      `## Screenshots`,
      ``,
      shots,
      ``,
    ].join('\n');
    await mkdir(REPORTS_DIR, { recursive: true });
    await writeFile(this.reportFile, body, 'utf8');
  }
}

export function createReporter(scenario: string): Reporter {
  if (!process.env.PLAYTEST_NARRATE) return NOOP;
  return new MarkdownReporter(scenario);
}
