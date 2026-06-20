import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Tutorial from './Tutorial';
import { createDwellTracker } from '../tutorial/v20';

/**
 * Tutorial.tsx is the v2.0 co-op tutorial overlay (u-4, REQ-24
 * abbreviated, amendment A9/A11). Content is driven by
 * `src/tutorial/v20.ts`; this suite exercises the turn-based fallback
 * schedule for each of the three progressive-disclosure games.
 */

describe('Tutorial v2.0 co-op — game 1 (co-op survival)', () => {
  it('renders the hp-downed bubble on turn 1 of game 1', () => {
    const { container } = render(
      <Tutorial turn={1} seen={false} onSeen={() => {}} gameNumber={1} />,
    );
    const text = container.textContent ?? '';
    expect(text).toMatch(/hp|heart|downed/i);
    expect(screen.getByTestId('tutorial-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('tutorial-overlay').getAttribute('data-bubble-id')).toBe('hp-downed');
  });

  it('renders the revive-prompt bubble on turn 3 of game 1', () => {
    const { container } = render(
      <Tutorial turn={3} seen={false} onSeen={() => {}} gameNumber={1} />,
    );
    expect(container.textContent ?? '').toMatch(/revive|teammate/i);
    expect(screen.getByTestId('tutorial-overlay').getAttribute('data-bubble-id')).toBe(
      'revive-prompt',
    );
  });

  it('renders the wisp-on-downed bubble on turn 5 of game 1', () => {
    const { container } = render(
      <Tutorial turn={5} seen={false} onSeen={() => {}} gameNumber={1} />,
    );
    expect(container.textContent ?? '').toMatch(/wisp|fairies/i);
    expect(screen.getByTestId('tutorial-overlay').getAttribute('data-bubble-id')).toBe(
      'wisp-on-downed',
    );
  });

  it('renders nothing on turn 2 (between scheduled bubbles)', () => {
    const { container } = render(
      <Tutorial turn={2} seen={false} onSeen={() => {}} gameNumber={1} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing on turn 6 (past the last game-1 scheduled bubble)', () => {
    const { container } = render(
      <Tutorial turn={6} seen={false} onSeen={() => {}} gameNumber={1} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('gameNumber defaults to 1 when the prop is omitted (back-compat)', () => {
    const { container } = render(<Tutorial turn={1} seen={false} onSeen={() => {}} />);
    expect(container.textContent ?? '').toMatch(/hp|heart|downed/i);
  });
});

describe('Tutorial v2.0 co-op — game 2 (shards + zones)', () => {
  it('renders the shared-shards bubble on turn 1 of game 2', () => {
    const { container } = render(
      <Tutorial turn={1} seen={false} onSeen={() => {}} gameNumber={2} />,
    );
    expect(container.textContent ?? '').toMatch(/embertide|shard/i);
    expect(screen.getByTestId('tutorial-overlay').getAttribute('data-bubble-id')).toBe(
      'shared-shards',
    );
  });

  it('renders the zone-advance bubble on turn 4 of game 2', () => {
    const { container } = render(
      <Tutorial turn={4} seen={false} onSeen={() => {}} gameNumber={2} />,
    );
    expect(container.textContent ?? '').toMatch(/zone|map/i);
    expect(screen.getByTestId('tutorial-overlay').getAttribute('data-bubble-id')).toBe(
      'zone-advance',
    );
  });
});

describe('Tutorial v2.0 co-op — game 3 (Vurmox / Climax)', () => {
  it('renders the vurmox-climax bubble on turn 9 of game 3', () => {
    const { container } = render(
      <Tutorial turn={9} seen={false} onSeen={() => {}} gameNumber={3} />,
    );
    expect(container.textContent ?? '').toMatch(/climax|demon king|vurmox/i);
    expect(screen.getByTestId('tutorial-overlay').getAttribute('data-bubble-id')).toBe(
      'vurmox-climax',
    );
  });
});

describe('Tutorial v2.0 co-op — suppression', () => {
  it('renders nothing when seen=true even on a scheduled turn', () => {
    const { container } = render(
      <Tutorial turn={1} seen={true} onSeen={() => {}} gameNumber={1} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('calls onSeen when the dismiss button is clicked', () => {
    const onSeen = vi.fn();
    render(<Tutorial turn={1} seen={false} onSeen={onSeen} gameNumber={1} />);
    fireEvent.click(screen.getByTestId('tutorial-dismiss'));
    expect(onSeen).toHaveBeenCalledTimes(1);
  });
});

describe('Tutorial v2.0 co-op — dwell instrumentation', () => {
  it('calls markShown on the injected tracker when a scheduled bubble mounts', () => {
    const tracker = createDwellTracker();
    render(
      <Tutorial turn={1} seen={false} onSeen={() => {}} gameNumber={1} dwellTracker={tracker} />,
    );
    const entries = tracker.entries();
    expect(entries).toHaveLength(1);
    expect(entries[0].bubbleId).toBe('hp-downed');
    expect(entries[0].dismissedAt).toBeNull();
  });

  it('closes the dwell entry on dismiss (dismissedAt + dwellMs set)', () => {
    const tracker = createDwellTracker();
    render(
      <Tutorial turn={1} seen={false} onSeen={() => {}} gameNumber={1} dwellTracker={tracker} />,
    );
    fireEvent.click(screen.getByTestId('tutorial-dismiss'));
    const closed = tracker.entries().filter((e) => e.dismissedAt !== null);
    expect(closed).toHaveLength(1);
    expect(closed[0].bubbleId).toBe('hp-downed');
    expect(closed[0].dwellMs).not.toBeNull();
  });
});
