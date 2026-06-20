/**
 * Ladle stories for HPStrip (u-2a). Covers every state the tray can land
 * in so a designer can eyeball the socket + downed + revive affordance
 * treatments without running the full game.
 *
 * Contract: `src/ui/*.stories.tsx` per PRD v2 dag.json u-2a acceptance.
 */
import type { CSSProperties } from 'react';
import type { Story } from '@ladle/react';

import HPStrip from './HPStrip';
import type { KidPlayer, Phase } from '../store/types';

export default {
  title: 'Components / HPStrip',
};

const pageStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  padding: 24,
  background: 'var(--hc-shadow-800, #0b1228)',
  color: 'var(--hc-text-primary, #f6f2e6)',
  fontFamily: 'system-ui, sans-serif',
  minWidth: 280,
  maxWidth: 420,
};

const captionStyle: CSSProperties = {
  fontSize: 12,
  color: 'var(--hc-text-muted, #b7ae95)',
};

function makePlayer(overrides: Partial<KidPlayer> = {}): KidPlayer {
  return {
    id: 'p0',
    name: 'Link',
    championId: 'champion-courage',
    championSlot: 'champion-courage',
    championPassivePulse: 0,
    hp: 5,
    hpMax: 5,
    downed: false,
    revivedThisIncident: false,
    green: 0,
    red: 0,
    keys: 0,
    deck: [],
    hand: [],
    discard: [],
    inPlay: [],
    slots: [null, null],
    items: [],
    chestsOpened: 0,
    wildWolfKillsThisTurn: 0,
    usedKeyVendorThisTurn: false,
    wisdomsLight: false,
    heartPieces: 0,
    emberShardMeter: 0,
    usedWispInBottleIds: [],
    banished: [],

    nextChestItemRevealed: false,
    ...overrides,
  };
}

interface DemoProps {
  readonly player: KidPlayer;
  readonly caption: string;
  readonly isTeammateView?: boolean;
  readonly phase?: Phase;
  readonly activePlayerRevivedThisIncident?: boolean;
}

function Demo({
  player,
  caption,
  isTeammateView = false,
  phase = 'Main',
  activePlayerRevivedThisIncident = false,
}: DemoProps) {
  return (
    <div style={pageStyle}>
      <span style={captionStyle}>{caption}</span>
      <HPStrip
        player={player}
        isActive
        isTeammateView={isTeammateView}
        onRevive={() => undefined}
        phase={phase}
        activePlayerRevivedThisIncident={activePlayerRevivedThisIncident}
      />
    </div>
  );
}

export const Full: Story = () => (
  <Demo player={makePlayer({ hp: 5, hpMax: 5 })} caption="Full HP (5/5)" />
);

export const Partial: Story = () => (
  <Demo player={makePlayer({ hp: 3, hpMax: 5 })} caption="Partial HP (3/5)" />
);

export const Empty: Story = () => (
  <Demo
    player={makePlayer({ hp: 0, hpMax: 5, downed: false })}
    caption="Empty HP (0/5, not yet downed)"
  />
);

export const Downed: Story = () => (
  <Demo
    player={makePlayer({ hp: 0, hpMax: 5, downed: true })}
    caption="Downed — self view (no revive button)"
  />
);

export const ReviveAvailable: Story = () => (
  <Demo
    player={makePlayer({ hp: 0, hpMax: 5, downed: true })}
    caption="Teammate view + Revive budget available"
    isTeammateView
    phase="Main"
    activePlayerRevivedThisIncident={false}
  />
);

export const ReviveUnavailable: Story = () => (
  <Demo
    player={makePlayer({ hp: 0, hpMax: 5, downed: true })}
    caption="Teammate view + Revive already used this incident"
    isTeammateView
    phase="Main"
    activePlayerRevivedThisIncident
  />
);

export const ReviveWrongPhase: Story = () => (
  <Demo
    player={makePlayer({ hp: 0, hpMax: 5, downed: true })}
    caption="Teammate view + outside Main phase"
    isTeammateView
    phase="Upkeep"
    activePlayerRevivedThisIncident={false}
  />
);

export const HpMaxEight: Story = () => (
  <Demo
    player={makePlayer({ hp: 6, hpMax: 8 })}
    caption="Extended hpMax (6/8) — confirms hpMax is not hardcoded"
  />
);
