import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ChestRow from './ChestRow';
import { KID_CARDS } from '../data/cards';

const CHEST_STD = KID_CARDS.find((c) => c.id === 'chest-std')!;
const CHEST_MID = KID_CARDS.find((c) => c.id === 'chest-mid')!;
const CHEST_BOSS = KID_CARDS.find((c) => c.id === 'chest-boss')!;

describe('ChestRow (embertide-tq5: 3-tier system std / mid / boss)', () => {
  it('renders all three chest tiles with their variant testids', () => {
    render(<ChestRow cards={[CHEST_STD, CHEST_MID, CHEST_BOSS]} keys={5} onOpenChest={() => {}} />);
    const row = screen.getByTestId('chest-row');
    expect(row).toBeInTheDocument();
    expect(screen.getByTestId('chest-slot-std')).toBeInTheDocument();
    expect(screen.getByTestId('chest-slot-mid')).toBeInTheDocument();
    expect(screen.getByTestId('chest-slot-boss')).toBeInTheDocument();
  });

  it('renders 3 buttons total when the row holds the full std/mid/boss set', () => {
    const { container } = render(
      <ChestRow cards={[CHEST_STD, CHEST_MID, CHEST_BOSS]} keys={5} onOpenChest={() => {}} />,
    );
    expect(container.querySelectorAll('button')).toHaveLength(3);
  });

  it('renders only the chests that are in the row (1 chest → 1 button)', () => {
    render(<ChestRow cards={[CHEST_STD]} keys={5} onOpenChest={() => {}} />);
    expect(screen.getByTestId('chest-slot-std')).toBeInTheDocument();
    expect(screen.queryByTestId('chest-slot-mid')).toBeNull();
    expect(screen.queryByTestId('chest-slot-boss')).toBeNull();
  });

  it('renders an empty container when the row is empty', () => {
    render(<ChestRow cards={[]} keys={0} onOpenChest={() => {}} />);
    const row = screen.getByTestId('chest-row');
    expect(row).toBeInTheDocument();
    expect(row.querySelectorAll('button')).toHaveLength(0);
  });

  it('disables each chest slot independently based on the player key cost (std=1, mid=2, boss=3)', () => {
    render(<ChestRow cards={[CHEST_STD, CHEST_MID, CHEST_BOSS]} keys={2} onOpenChest={() => {}} />);
    // 2 keys: std (1) affordable, mid (2) affordable, boss (3) not affordable.
    const std = screen.getByTestId('chest-slot-std') as HTMLButtonElement;
    const mid = screen.getByTestId('chest-slot-mid') as HTMLButtonElement;
    const boss = screen.getByTestId('chest-slot-boss') as HTMLButtonElement;
    expect(std.disabled).toBe(false);
    expect(mid.disabled).toBe(false);
    expect(boss.disabled).toBe(true);
  });

  it('disables every slot when the player has zero keys', () => {
    render(<ChestRow cards={[CHEST_STD, CHEST_MID, CHEST_BOSS]} keys={0} onOpenChest={() => {}} />);
    expect((screen.getByTestId('chest-slot-std') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('chest-slot-mid') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('chest-slot-boss') as HTMLButtonElement).disabled).toBe(true);
  });

  it('dispatches onOpenChest with the correct variant for each tier', () => {
    const onOpen = vi.fn();
    render(<ChestRow cards={[CHEST_STD, CHEST_MID, CHEST_BOSS]} keys={5} onOpenChest={onOpen} />);
    fireEvent.click(screen.getByTestId('chest-slot-std'));
    fireEvent.click(screen.getByTestId('chest-slot-mid'));
    fireEvent.click(screen.getByTestId('chest-slot-boss'));
    expect(onOpen).toHaveBeenNthCalledWith(1, 'std');
    expect(onOpen).toHaveBeenNthCalledWith(2, 'mid');
    expect(onOpen).toHaveBeenNthCalledWith(3, 'boss');
  });

  it('keeps every chest tile accessible (44px touch target)', () => {
    const { container } = render(
      <ChestRow cards={[CHEST_STD, CHEST_MID, CHEST_BOSS]} keys={5} onOpenChest={() => {}} />,
    );
    const buttons = container.querySelectorAll<HTMLButtonElement>('button');
    expect(buttons).toHaveLength(3);
    for (const btn of Array.from(buttons)) {
      expect(btn.getAttribute('data-touch-target')).toBe('true');
      const minWidth = parseInt(btn.style.minWidth, 10);
      const minHeight = parseInt(btn.style.minHeight, 10);
      expect(minWidth).toBeGreaterThanOrEqual(44);
      expect(minHeight).toBeGreaterThanOrEqual(44);
    }
  });
});
