# Changelog

## 0.6.3 — startup characters and greeting layout (2026-10-20)

- Add three local character illustrations on the main new-conversation screen, with a persistent brush toggle and finite reduced-motion-aware entrance.
- Reserve input space without replacing the native input or changing drafts; shrink or hide the decoration when space is insufficient.
- Center both greeting lines in dark/light themes; use ivory lace-up boots for Claude.
- Preserve public artifact, CSV and installer security fixes. Artwork is outside the MIT code grant; see docs/WELCOME_ASSETS.md.
- Merge the locally developed 0.6.2 feature and 0.6.3 refinement into one public preview.

## 0.6.1 — chart fitting and zoom preview (2026-10-19)

- Prefer supported visual components for trends, comparisons, structures and processes; distinguish justified numeric plots from labelled conceptual schematics. Model compliance is not guaranteed; missing data is never guessed.
- Fit ordinary SVG aspect ratios, retain scrolling for extreme diagrams and compact short numeric line-chart labels without dropping points.
- Add hovered wheel zoom, buttons, keyboard controls and double-click reset. Keep exports independent of temporary display zoom.
- Reattach sizing after range/slider redraws and release observers/listeners when graphics are replaced or disabled.
- Preserve public 0.6.0 installer, artifact protocol and CSV security fixes. Add focused sizing tests and a standalone browser regression harness; retain preview compatibility limits.

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
