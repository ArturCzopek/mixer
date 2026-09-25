# lib/balance

Pure TypeScript team-balancing engine (no I/O). See [docs/04-team-balancing.md](../../docs/04-team-balancing.md).
Implemented in roadmap tasks M1-4 (engine) and M1-4b (explanation).

- `skill.ts`: `skillScore()` → `SkillBreakdown`: S = wE·E + wF·F + wM·M + wA·A with every number behind it
  (form window vs baseline, shrinkage, asymmetry multiplier for the player's ELO, mix form, activity
  sessions). Contributions are whole points and sum to S. This object is the `skill_snapshot`.
- `variants.ts`: `generateVariants()` → variants with imbalance, soft-rule penalties (cost = imbalance +
  penalties), rank among all candidates and the duo status (D15; not shown as a badge, D28).
- `config.ts`: defaults (`weights`, `form.asymmetry` anchors, `activity.anchors`, rules).
