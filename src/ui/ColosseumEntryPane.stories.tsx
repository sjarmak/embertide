/**
 * Ladle stories for ColosseumEntryPane (embertide-4hr1.12, follow-up
 * to 4hr1.4). Isolates every A3 progression state plus the locked state
 * so a designer can eyeball each variant without booting the full game.
 *
 * Filed by `embertide-ui-reviewer-4hr1.4` as a MEDIUM finding —
 * post-merge follow-up to the HUD entry component. The pane renders only
 * the tiers the player has already unlocked (future tiers are omitted to
 * avoid the right-rail overflow fixed in embertide-vrqs), so each
 * story below shows exactly the rows that ship for that progression.
 */
import type { CSSProperties } from 'react';
import type { Story } from '@ladle/react';

import ColosseumEntryPane from './ColosseumEntryPane';
import type { ColosseumProgression, TierId } from '../core/colosseum';

export default {
  title: 'Components / ColosseumEntryPane',
};

const pageStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: 24,
  background: 'var(--hc-shadow-800, #0b1228)',
  color: 'var(--hc-text-primary, #f6f2e6)',
  fontFamily: 'system-ui, sans-serif',
  minWidth: 280,
  maxWidth: 360,
};

const captionStyle: CSSProperties = {
  fontSize: 12,
  color: 'var(--hc-text-muted, #b7ae95)',
};

function progressionWith(tiers: readonly TierId[]): ColosseumProgression {
  return { unlockedTiers: tiers };
}

interface DemoProps {
  readonly unlocked: boolean;
  readonly progression: ColosseumProgression;
  readonly caption: string;
}

function Demo({ unlocked, progression, caption }: DemoProps) {
  return (
    <div style={pageStyle}>
      <span style={captionStyle}>{caption}</span>
      <ColosseumEntryPane unlocked={unlocked} progression={progression} onEnter={() => undefined} />
    </div>
  );
}

export const Locked: Story = () => (
  <Demo
    unlocked={false}
    progression={progressionWith([])}
    caption="Locked — entry invisible until Craghorn + Broodmaw defeated (renders null)"
  />
);

export const EntryNotYetCleared: Story = () => (
  <Demo
    unlocked
    progression={progressionWith([])}
    caption="Unlocked, nothing cleared yet — falls back to the Tier I 'up next' preview"
  />
);

export const Tier1Only: Story = () => (
  <Demo
    unlocked
    progression={progressionWith([1])}
    caption="Tier I unlocked — only the cleared tier renders; future tiers stay hidden"
  />
);

export const Tier1And2: Story = () => (
  <Demo
    unlocked
    progression={progressionWith([1, 2])}
    caption="Tiers I + II unlocked — two rows; capstone Tier V not yet shown"
  />
);

export const Tier5Unlocked: Story = () => (
  <Demo
    unlocked
    progression={progressionWith([1, 2, 5])}
    caption="Capstone reached — Tiers I, II + V render (Trinity Aurogax visible)"
  />
);
