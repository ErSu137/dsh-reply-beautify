# DSH Reply Beautify

An unofficial MIT community plugin for DeepSeek Harness: readable assistant replies, interactive charts and tables, and isolated HTML mini apps. It preserves the application layout and provides access to original content.

[中文说明](README.md) · [Download v0.6.0 preview](https://github.com/ErSu137/dsh-reply-beautify/releases/tag/v0.6.0)

![Synthetic before/after sample rendered with actual component code](docs/demo/preview.png)

This is a standalone synthetic demo, **not a DSH screenshot**. Open `docs/demo/index.html` from the extracted package to try series toggles, calculator inputs, presets and a sandboxed counter. No account or model connection is needed.

## Install on Windows

Compatibility baseline: **DSH Desktop 0.2.1-rc.2, default application installation path**. Other platforms/versions/custom application paths have not been validated. Final DSH visual, restart, long-conversation and real uninstall/reinstall acceptance remains pending. This release is a preview.

1. Download the named `dsh-reply-beautify-0.6.0.zip` and `SHA256SUMS-0.6.0.txt` from the Release. Compare `Get-FileHash .\dsh-reply-beautify-0.6.0.zip -Algorithm SHA256` with the checksum.
2. Extract into a permanent directory; enter the inner folder containing `install.ps1` and `package.json`. Launch DSH once to initialize its desktop profile, then fully quit it.
3. In PowerShell in that folder, run:

   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -Check
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
   ```

4. Restart DSH, open the brush next to the account row, and confirm 0.6.0. Use a new test conversation.

The installer invokes the installed official CLI with `link:`, `--offline --ignore-scripts`. **Keep the extracted directory in place.** It backs up profile configuration under `backups/` before changes. The desktop profile follows `DSH_HOME` if set, otherwise `%USERPROFILE%\.dsh\profiles\desktop`. No npm or custom marketplace publication is claimed.

## Features and limits

Default, ChatGPT and Claude typography presets with font/code sizes, line height and paragraph spacing. Reliable structured diagrams and limited Mermaid flows, charts, parameter curves, quizzes and forms. Searchable/editable tables with CSV, calculators, weighted decisions, schedules, boards, trees, playback, branching wizards, diffs, source cards and linked reports. HTML/CSS/JavaScript artifacts support inline/sidebar/fullscreen previews, local revisions and explicit state API restoration.

Ask naturally; the model receives a read-only format guide and decides when to use components. It does not always produce them. Complete validated streaming blocks can render while later prose continues. Unsupported content retains the original text. Only formal assistant replies are enhanced. Ordinary code is not automatically executed. Model data, answers and citations are not independently verified.

Brush off restores original display and stops previews, while model guides remain registered. Native plugin disable removes client and Host capabilities through DSH. To uninstall, fully quit DSH and run `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -Uninstall`. Restart after changes. Update by retaining the old folder and installing from the new one; reinstall from the old folder to roll back.

Preferences, interaction inputs, artifact code and API state stay in local DSH browser storage and are not actively deleted on disable/uninstall. Retention is bounded: 80 persistent interaction records/~280000 characters; 160 temporary records/560000 characters; 12 artifacts with up to 6 revisions each/~1.8M total characters, 24000 per API state. Old records may be evicted. No cross-device or permanent storage promise.

Artifacts use nested opaque-origin `sandbox="allow-scripts"` frames and CSP restrictions; no filesystem, Node/Electron, chat-history or model-tool bridge is provided. **This is not a guarantee that arbitrary generated apps are safe, nor a CPU/memory quota.** Ordinary calculations use a limited arithmetic parser. CSV text escaping may be affected by subsequent spreadsheet save/import behavior. Complex Mermaid syntax and unsupported diagrams fall back to source.

## Development and verification

No runtime dependency installation is required. Node 22+ (tested 24.19.0), Python 3.9+, PowerShell:

```powershell
node scripts/build.mjs
node --test tests/*.test.cjs tests/*.test.mjs
.\tests\installer.test.ps1
node scripts/build-demo.mjs
python scripts/package.py
python scripts/verify-release.py
```

87 Node tests and 19 isolated installer assertions passed. Standalone Chromium checks do not substitute for real DSH/Electron acceptance. See [release evidence](docs/RELEASE_CHECKS.md), [manual testing](docs/TESTING.md), [security scope](SECURITY.md), [third-party notices](THIRD_PARTY_NOTICES.md) and [changelog](CHANGELOG.md). No bundled fonts, original DSH assets or private conversations. ChatGPT and Claude presets are style references without official affiliation.
