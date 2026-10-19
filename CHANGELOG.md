# Changelog

## 0.6.0 — public preview (2026-10-19)

First public source/release packaging. Retains the 0.6.0 feature set; final DSH acceptance remains pending.

- Honor `DSH_HOME` when checking/backing up the desktop profile.
- Validate artifact relay values, bound error text and discard unrelated fields; ignore malformed host error values.
- Escape full-width CSV formula prefixes in addition to existing ASCII/control prefixes.
- Add focused regression checks, public standalone demo, bilingual user documentation and an explicit source/runtime package manifest.
- Preserve bounded caches, block-by-block streaming conversion, lifecycle cleanup and original-content fallback from the existing 0.6.0 implementation.

## Earlier local development

- 0.5.x: isolated artifacts, local revisions/API state, inline/sidebar/fullscreen previews; per-block streaming conversion.
- 0.4.x: editable tables, calculators, decisions, schedules, boards, trees, playback, branching, diffs, sources and linked reports.
- 0.3.x: interactive curves, quizzes, forms and model format guidance.
- 0.2.x: conservative diagrams, charts, formulas and source/SVG controls.
- 0.1.x: typography, settings, reversible interface styling and presets.

Historical stage reports in docs describe earlier local work. Their test counts and acceptance statements do not expand the public preview's validated compatibility.
