import React from 'react';
import { createRoot } from 'react-dom/client';

import {
  Boss,
  Chest,
  CourageShard,
  GreenShard,
  Heart,
  Hero,
  Key,
  Magnifier,
  Monster,
  PowerShard,
  RedShard,
  Shield,
  Sword,
  WisdomShard,
} from '../../src/icons';
import { ElysianDefs } from '../../src/icons/defs';
import '../../src/styles/tokens.css';
import './sheet.css';

type Surface = 'tray' | 'parchment' | 'rules' | 'chrome' | 'card-dark' | 'card-light';

interface IconSample {
  readonly name: string;
  readonly icon: React.ReactNode;
  readonly size: string;
  readonly surface: Surface;
  readonly location: string;
  readonly reachability?: string;
}

const visible: readonly IconSample[] = [
  {
    name: 'GreenShard',
    icon: <GreenShard size={24} />,
    size: '24 px',
    surface: 'tray',
    location: 'Player tray',
  },
  { name: 'Key', icon: <Key size={24} />, size: '24 px', surface: 'tray', location: 'Player tray' },
  {
    name: 'Heart',
    icon: <Heart size={72} />,
    size: '72 px',
    surface: 'parchment',
    location: 'Chest reward',
  },
  { name: 'Sword', icon: <Sword size={24} />, size: '24 px', surface: 'tray', location: 'Player tray' },
  { name: 'Chest', icon: <Chest size={24} />, size: '24 px', surface: 'tray', location: 'Player tray' },
  {
    name: 'WisdomShard',
    icon: <WisdomShard size={12} />,
    size: '12 px',
    surface: 'rules',
    location: 'Card rules text',
  },
  {
    name: 'CourageShard',
    icon: <CourageShard size={12} />,
    size: '12 px',
    surface: 'rules',
    location: 'Card rules text',
  },
  {
    name: 'PowerShard',
    icon: <PowerShard size={12} />,
    size: '12 px',
    surface: 'rules',
    location: 'Card rules text',
  },
  {
    name: 'Magnifier',
    icon: <Magnifier size={16} title="View details" />,
    size: '16 px',
    surface: 'chrome',
    location: 'Card detail button',
  },
];

const unreachable: readonly IconSample[] = [
  {
    name: 'RedShard',
    icon: <RedShard size={24} />,
    size: '24 px default',
    surface: 'tray',
    location: 'No live caller',
    reachability: 'Export only',
  },
  {
    name: 'Hero',
    icon: <Hero size={72} />,
    size: '72 px fallback',
    surface: 'parchment',
    location: 'Reward fallback',
    reachability: 'Real card art wins',
  },
  {
    name: 'Shield',
    icon: <Shield size={72} />,
    size: '72 px fallback',
    surface: 'parchment',
    location: 'Reward / card fallback',
    reachability: 'Real card art wins',
  },
  {
    name: 'Monster',
    icon: <Monster size={72} />,
    size: '72 px fallback',
    surface: 'card-dark',
    location: 'Card-art fallback',
    reachability: 'Role art always exists',
  },
  {
    name: 'Boss',
    icon: <Boss size={72} />,
    size: '72 px fallback',
    surface: 'card-dark',
    location: 'Card / portrait fallback',
    reachability: 'Role art always exists',
  },
];

function Tile({ sample, reachable }: { readonly sample: IconSample; readonly reachable: boolean }) {
  return (
    <article className={`tile ${reachable ? 'reachable' : 'unreachable'}`}>
      <div className={`stage ${sample.surface}`}>
        <span className="scale-rule" aria-hidden="true" />
        {sample.icon}
      </div>
      <div className="tile-copy">
        <div className="name-row">
          <h3>{sample.name}</h3>
          <span className="marker">PLACEHOLDER</span>
        </div>
        <p>{sample.location}</p>
        <p className="detail">
          {sample.size}
          {sample.reachability ? ` · ${sample.reachability}` : ''}
        </p>
      </div>
    </article>
  );
}

function App() {
  return (
    <main id="contact-sheet">
      <svg className="shared-defs" aria-hidden="true">
        <ElysianDefs />
      </svg>
      <header>
        <div>
          <p className="eyebrow">ICON FINAL-ART DECISION</p>
          <h1>The current 14-icon set</h1>
          <p className="lede">Actual React SVGs, shown at live UI sizes on their Cathedral surfaces.</p>
        </div>
        <aside>
          <span className="legend reachable-key">Visible in normal play</span>
          <span className="legend unreachable-key">Not reached by current game state</span>
          <span className="legend placeholder-key">All 14 carry the placeholder marker</span>
        </aside>
      </header>

      <section>
        <div className="section-heading">
          <h2>Visible in normal play</h2>
          <span>9 icons</span>
        </div>
        <div className="grid visible-grid">
          {visible.map((sample) => (
            <Tile key={sample.name} sample={sample} reachable />
          ))}
        </div>
      </section>

      <section>
        <div className="section-heading">
          <h2>Defined, but not actually reached</h2>
          <span>5 icons</span>
        </div>
        <div className="grid unreachable-grid">
          {unreachable.map((sample) => (
            <Tile key={sample.name} sample={sample} reachable={false} />
          ))}
        </div>
      </section>

      <footer>
        The SVG artwork is shown unchanged. “Placeholder” is repository status, not a visual overlay added to the game.
      </footer>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
