import { useEffect, useState, type JSX } from 'react';
import { createPortal } from 'react-dom';

import { GAME_RULES } from '../data/gameRules';
import { KEYWORD_GLOSSARY, KEYWORD_GLOSSARY_CATEGORIES } from '../data/keywordGlossary';

/**
 * Player-facing Rule Book surface (embertide-davn).
 *
 * The single "Rules" affordance on the right rail: a button that opens a
 * portal modal teaching the whole game. It renders the authored rule
 * sections ({@link GAME_RULES}) first — how to win, what a turn looks
 * like, shopping, fighting, chests, zones, bosses — then folds the
 * keyword glossary ({@link KEYWORD_GLOSSARY}) in as a final "Words to
 * know" section so one entry point covers both rules and vocabulary. The
 * glossary data is reused, not duplicated.
 *
 * Replaces the former standalone "What do words mean?" glossary button.
 * Modal chrome mirrors the prior glossary surface: portal to
 * document.body, `role="dialog"` + `aria-modal`, ESC + backdrop tap to
 * dismiss, a 44px close target. State is owned here so consumers mount a
 * single element.
 */
export default function RulesBook(): JSX.Element {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open]);

  const target =
    typeof document !== 'undefined' ? (document.body ?? document.documentElement) : null;

  const modal = (
    <div
      className="rules-book-backdrop"
      data-testid="rules-book-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="How to play"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          setOpen(false);
        }
      }}
    >
      <div className="rules-book-panel" data-testid="rules-book-panel">
        <h2 className="rules-book-title">How to play</h2>
        <div className="rules-book-scroll">
          {GAME_RULES.map((section) => (
            <section
              key={section.id}
              className="rules-book-group"
              data-testid={`rules-book-section-${section.id}`}
            >
              <h3 className="rules-book-category">{section.title}</h3>
              <ul className="rules-book-rule-list">
                {section.lines.map((line) => (
                  <li key={line} className="rules-book-rule-line">
                    {line}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <section className="rules-book-group" data-testid="rules-book-section-glossary">
            <h3 className="rules-book-category">Words to know</h3>
            {KEYWORD_GLOSSARY_CATEGORIES.map((category) => (
              <div key={category} className="rules-book-glossary-group">
                <h4 className="rules-book-glossary-category">{category}</h4>
                <dl className="rules-book-list">
                  {KEYWORD_GLOSSARY.filter((entry) => entry.category === category).map((entry) => (
                    <div
                      key={entry.keyword}
                      className="rules-book-item"
                      data-testid={`rules-book-keyword-${entry.keyword}`}
                    >
                      <dt className="rules-book-term">{entry.keyword}</dt>
                      <dd className="rules-book-gloss">{entry.kid}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </section>
        </div>
        <button
          type="button"
          className="rules-book-close"
          data-testid="rules-book-close"
          onClick={() => setOpen(false)}
        >
          Close
        </button>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        className="rules-book-trigger"
        data-testid="rules-book-trigger"
        data-touch-target="true"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        Rules
      </button>
      {open ? (target ? createPortal(modal, target) : modal) : null}
    </>
  );
}
