import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import RulesBook from './RulesBook';
import { GAME_RULES } from '../data/gameRules';
import { KEYWORD_GLOSSARY } from '../data/keywordGlossary';

describe('RulesBook (embertide-davn)', () => {
  it('renders the Rules trigger collapsed by default (no dialog)', () => {
    render(<RulesBook />);
    const trigger = screen.getByTestId('rules-book-trigger');
    expect(trigger).toHaveTextContent('Rules');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('rules-book-panel')).toBeNull();
  });

  it('opens an accessible dialog when the trigger is pressed', () => {
    render(<RulesBook />);
    fireEvent.click(screen.getByTestId('rules-book-trigger'));
    const dialog = screen.getByTestId('rules-book-backdrop');
    expect(dialog).toHaveAttribute('role', 'dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByTestId('rules-book-trigger')).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows every authored rule section with its title and lines', () => {
    render(<RulesBook />);
    fireEvent.click(screen.getByTestId('rules-book-trigger'));
    for (const section of GAME_RULES) {
      const el = screen.getByTestId(`rules-book-section-${section.id}`);
      expect(el).toHaveTextContent(section.title);
      for (const line of section.lines) {
        expect(el).toHaveTextContent(line);
      }
    }
  });

  it('folds the keyword glossary in as a section, reusing the glossary data', () => {
    render(<RulesBook />);
    fireEvent.click(screen.getByTestId('rules-book-trigger'));
    expect(screen.getByTestId('rules-book-section-glossary')).toBeInTheDocument();
    for (const entry of KEYWORD_GLOSSARY) {
      const item = screen.getByTestId(`rules-book-keyword-${entry.keyword}`);
      expect(item).toHaveTextContent(entry.keyword);
      expect(item).toHaveTextContent(entry.kid);
    }
  });

  it('dismisses on the Close button', () => {
    render(<RulesBook />);
    fireEvent.click(screen.getByTestId('rules-book-trigger'));
    fireEvent.click(screen.getByTestId('rules-book-close'));
    expect(screen.queryByTestId('rules-book-panel')).toBeNull();
  });

  it('dismisses on Escape', () => {
    render(<RulesBook />);
    fireEvent.click(screen.getByTestId('rules-book-trigger'));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('rules-book-panel')).toBeNull();
  });

  it('dismisses on a backdrop tap (but not a panel tap)', () => {
    render(<RulesBook />);
    fireEvent.click(screen.getByTestId('rules-book-trigger'));
    // Tapping the panel itself must NOT close.
    fireEvent.click(screen.getByTestId('rules-book-panel'));
    expect(screen.queryByTestId('rules-book-panel')).not.toBeNull();
    // Tapping the backdrop closes.
    fireEvent.click(screen.getByTestId('rules-book-backdrop'));
    expect(screen.queryByTestId('rules-book-panel')).toBeNull();
  });
});
