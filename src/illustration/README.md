# Modular Illustration System

A production-oriented illustration system for ornate but scalable card art.

Included:
- `schema.ts`
- `themes.ts`
- `templates/heroes.ts`
- `templates/monsters.ts`
- `segmentation.ts`
- `ornament.ts`
- `composer.ts`
- `renderContract.md`
- `examples/*.json`

## Core idea

Every illustration is built from 4 modular layers:
1. silhouette
2. segmentation
3. ornament
4. palette/application rules

This lets engineering support multiple themes without losing the system identity.
