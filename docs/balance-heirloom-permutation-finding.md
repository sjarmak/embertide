# Heirloom permutation finding

Bead `embertide-2rx` tested whether the region-boss heirloom curve was an artifact of always injecting Craghorn Tusk first. The simulation now cycles seeds through all 24 acquisition-order permutations before shuffling the combat deck. Each point pools 6,000 seeded combats: three strategies, two region bosses, and 1,000 seeds per pair.

| Heirlooms | Fixed-order rate | Permutation-sampled rate | Seeded wins |
| ---: | ---: | ---: | ---: |
| 0 | 34.8% | 34.800% | 2,088 / 6,000 |
| 1 | 69.3% | 63.317% | 3,799 / 6,000 |
| 2 | 71.2% | 79.200% | 4,752 / 6,000 |
| 4 | 93.3% | 93.200% | 5,592 / 6,000 |

The 34.8% to 69.3% jump shrinks under permutation sampling, but it survives: one heirloom raises the pooled win rate from 34.800% to 63.317%, a gain of 28.517 percentage points. Craghorn Tusk's fixed first position inflated the one-heirloom rate by 5.983 points; the remaining uplift is still large.

The sampled two-heirloom rate is 79.200%, above the earlier 55% to 75% assertion band. This bead changes no gameplay values. Any balance response belongs in a separate tuning bead that cites these seeded results.

## Target reconciliation

Bead `embertide-5iy` reran the seeded 6,000-combat sample per point and reproduced the exact 0/1/2/4 curve above. The designer ruling memory `embertide-designer-ruling-heirloom-permutation-curve-2026-08` keeps gameplay values and permutation sampling unchanged: the zero-heirloom result remains in the intended hard-but-possible range, while the monotonic uplift rewards optional wild-boss preparation.

The PRD regression targets now match the unbiased sampling contract: 30-40% at zero heirlooms, 60-70% at one, 75-85% at two, and 90-95% at four. Tests retain the exact seeded win-count assertions in addition to those target bands.
