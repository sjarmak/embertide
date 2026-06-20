import type { KidGameState } from '../types';
import { pickCombatBubble, type TutorialBubbleId, type TutorialTrigger } from '../../tutorial/v20';
import { bossDisplayName, renderCombatBubbleBody } from '../combatBootstrap';

/**
 * Pure transformers for the v2.1 tutorial-bubble action surface (u-8g,
 * REQ-32 u-9e). Originally lived inline in gameStore.ts; extracted as
 * part of embertide-hik1's per-domain decomposition pass.
 *
 *   fireCombatTutorialBubbleSlice — combat-screen bubbles, gated by
 *     pickCombatBubble's progressive-disclosure ladder.
 *   clearCombatTutorialBubbleSlice — dismiss the visible combat bubble.
 *   fireTutorialBubbleOnceSlice  — one-shot main-board bubbles
 *     (mountSurfaceUpsell, heirloom-drop, etc.) idempotent on
 *     state.tutorialBubblesFired.
 */

/**
 * Surface a combat-tutorial bubble (PRD §B8). Returns the input state
 * (===) when:
 *   - trigger is null
 *   - pickCombatBubble returns null (gate is closed)
 *   - the same bubble is already showing (idempotent re-fire)
 *
 * `combat-boss-turn` embeds {bossName} + {damage} from the active
 * combat's attack pattern; the other two combat triggers ship static
 * bodies (embertide-07h).
 */
export function fireCombatTutorialBubbleSlice(
  state: KidGameState,
  trigger: TutorialTrigger | null,
): KidGameState {
  if (trigger === null) return state;
  const bubbleId = pickCombatBubble(trigger, state.combatsEntered);
  if (bubbleId === null) return state;
  if (state.combatTutorialBubble === bubbleId) return state;
  let bodyOverride: string | null = null;
  if (bubbleId === 'combat-boss-turn' && state.activeCombat !== null) {
    const boss = state.activeCombat.boss;
    bodyOverride = renderCombatBubbleBody('combat-boss-turn', {
      bossName: bossDisplayName(boss.sourceCardId),
      damage: boss.attackPattern.damagePerTurn,
    });
  }
  return {
    ...state,
    combatTutorialBubble: bubbleId,
    tutorialBubbleBodyOverride: bodyOverride,
  };
}

/**
 * Dismiss the visible combat-tutorial bubble (u-8g). Returns the input
 * state (===) when both combatTutorialBubble and tutorialBubbleBodyOverride
 * are already null.
 */
export function clearCombatTutorialBubbleSlice(state: KidGameState): KidGameState {
  if (state.combatTutorialBubble === null && state.tutorialBubbleBodyOverride === null) {
    return state;
  }
  return {
    ...state,
    combatTutorialBubble: null,
    tutorialBubbleBodyOverride: null,
  };
}

/**
 * Fire a one-shot main-board tutorial bubble (REQ-32 u-9e). Idempotent —
 * returns the input state (===) when the bubble id is already in
 * `state.tutorialBubblesFired`.
 *
 * Optional `bodyOverride` templates the bubble's rendered body at fire
 * time (heirloom-drop embeds the heirloom's display name).
 */
export function fireTutorialBubbleOnceSlice(
  state: KidGameState,
  id: TutorialBubbleId,
  bodyOverride?: string,
): KidGameState {
  if (state.tutorialBubblesFired.includes(id)) return state;
  return {
    ...state,
    combatTutorialBubble: id,
    tutorialBubbleBodyOverride: typeof bodyOverride === 'string' ? bodyOverride : null,
    tutorialBubblesFired: [...state.tutorialBubblesFired, id],
  };
}
