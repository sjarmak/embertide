Reinvention gate: ran 'bd search illustration compar --status all' (no hits), 'bd search recompress --status all' (only embertide-1lw itself), 'bd search contact sheet --status all' (no hits). No existing bead covers producing the comparison artifact; this is the evidence-production half of embertide-1lw, not a duplicate of the decision.

WHY THIS EXISTS
embertide-1lw asks Stephanie to rule on whether 15 recompressed Cathedral illustrations (63% smaller, 22.6 MB -> 8.4 MB) are acceptable to ship. Nobody can answer that question today because no side-by-side comparison exists. The decision is not waiting on her attention, it is waiting on an artifact. 1lw in turn gates embertide-w79, which is the live silent-ship path (primary checkout parked on a stale local-only branch with 26 dirty paths).

The precedent that worked: the icon question sat 15 days until a contact sheet was synced to her devices at /home/ds/brain/Projects/Embertide/Icon Final-Art Packet.md. Do the same thing for illustrations.

INPUTS (both read-only, neither is the working tree)
main version        : git show origin/main:public/illustrations/<name> (origin/main is 0f2a639)
recompressed version: /home/ds/.gc-preserve/embertide/2026-08-04-stranded-worktree/illustrations/<name>
15 files, listed in embertide-1lw.

HARD CONSTRAINT — DO NOT TOUCH THE PRIMARY CHECKOUT
/home/ds/projects/embertide is dirty on purpose and holds unrecoverable binaries. NEVER run git clean / stash / reset / checkout / restore there. Work in a scratch dir or a worktree off origin/main. Extract the main-side files with 'git show', never by checking anything out over the working tree.

RENDER AT THE SIZE THEY ACTUALLY APPEAR
Compare at in-game render dimensions, not full resolution. A 4x file-size reduction is invisible at thumbnail scale and obvious at full bleed, so a full-resolution comparison would answer the wrong question. Read the actual CSS/component sizing for the combat background, altar, and setup-landing surfaces before choosing crop sizes, and say in the packet what size each pair was compared at.

WHERE THE OUTPUT GOES
/home/ds/brain/Projects/Embertide/ (Obsidian vault, syncs to her devices within seconds). Plain markdown plus PNG. Treat as production: create new files, do not bulk-delete or rewrite existing vault notes.
1. A comparison image exists in /home/ds/brain/Projects/Embertide/ covering all 15 illustrations, each pair shown at the size that surface actually renders at in-game, with the compared size stated.
2. Worst-case detail crops are included for the pairs most at risk (gradient banding and fine ornament linework), not only whole-image views, so the failure mode the decision hinges on is visible.
3. A companion markdown note in the same vault directory states, per file: main size, recompressed size, percent saved, and the total 14.3 MB first-load saving, plus a one-line plain-English framing of the trade for a non-engineer.
4. 'git status -sb' in /home/ds/projects/embertide is byte-for-byte unchanged from before the work (26 dirty paths, branch architecture-refresh). Prove it by capturing the output before and after and diffing them.
5. No file under /home/ds/.gc-preserve/embertide/ is modified or deleted.
6. The packet makes no recommendation and takes no side. It presents evidence; embertide-1lw records the ruling.
