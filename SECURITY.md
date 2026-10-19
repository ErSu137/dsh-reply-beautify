# Security scope

This is a limited pre-release review, not a complete security audit or a guarantee that arbitrary model-generated artifacts are safe. Baseline: Windows DSH Desktop 0.2.1-rc.2 interfaces; final real DSH acceptance remains pending.

## Reviewed boundaries

- Data-only parsing with explicit size/count/type limits. Ordinary labels use text nodes and fixed SVG tags/attributes, not model SVG/HTML injection. Unsupported inputs keep source visible.
- Source links allow HTTP(S) without credentials and use `noopener noreferrer`. They are user-activated; the plugin does not verify source claims.
- Calculations use a bounded arithmetic parser, explicit variables and allowlisted Math functions. No `eval`, `Function`, assignment or property access.
- CSV quotes cells, doubles quotes and prefixes formula-like strings, including full-width symbols/control prefixes. Subsequent spreadsheet save/import behavior may remove escaping; there is no universal downstream safety guarantee.
- Artifacts use nested opaque-origin `sandbox="allow-scripts"` frames. No same-origin/top navigation/popups/download permissions. CSP restricts external resources, connections and frames. The trusted shell forwards only state/error/ready envelopes; Host checks the current frame `WindowProxy` and per-run channel. Origin `null` alone would not identify an opaque frame.
- State API accepts JSON objects <=24000 characters; no file/network/Node/Electron/chat/tool bridge. Tests cover bounded persistence, corruption, quota errors and lifecycle cleanup.
- Installer uses absolute paths/argument arrays, installed official CLI, pre-change config copies, running-app refusal and environment restoration. It now follows `DSH_HOME`.
- Public files/package manifests exclude work, backups, extracted app code, profiles, chats, tokens and private screenshots. No bundled third-party runtime dependencies or fonts.

## Fixed before first public release

1. The installer backed up the default profile even if CLI used `DSH_HOME`; it now uses that variable. Two path regressions were added.
2. Artifact relay forwarded raw envelopes/invalid error values. It now drops unrelated fields, requires object state, bounds string errors, and ignores malformed Host error values. Regression coverage includes malformed and oversized payloads.
3. CSV escaping missed full-width formula prefixes; header/cell regressions now cover them.

## Remaining limits

Sandbox/CSP are permission/DOM boundaries, not CPU/memory quotas. Infinite loops, large allocations and message flooding may hang a renderer. Browser/Electron bugs, application-provided Markdown/math rendering, changing DSH interfaces and compromised local software are outside this review. Broad platform/version compatibility is not claimed.

Local storage contains user inputs and artifact code, is not encrypted by this plugin, may be evicted, and persists after disable/uninstall. No telemetry or automatic interaction-result sending. DSH's own model/network behavior is independent.

Use private vulnerability reporting on the repository when available for sensitive findings. Do not publish credentials, chats or profile backups. For ordinary bugs use Issues with a synthetic reproduction and environment details. See [release evidence](docs/RELEASE_CHECKS.md).
