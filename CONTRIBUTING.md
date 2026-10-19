# Contributing

Use a synthetic example and a dedicated test conversation. Do not include chat exports, account data, local profiles, backups, secrets or extracted DSH application resources.

Run the build and Node tests in README; run installer tests on Windows after installer changes. Keep the original-content fallback and conservative parsing. Any change to sandbox/CSP, message handling, expression parsing or export escaping needs a focused regression test. Do not enable same-origin, filesystem, external network or Node access for artifacts.

Check scope and limits against the format docs. Build from a clean source archive before a release. Update the explicit `release-files.json` inventory for intended new public files, and inspect package contents. Manual DSH acceptance must be reported separately from mocks and standalone browser checks.

The current supported compatibility constraint is exact `0.2.1-rc.2`; widen it only after relevant integration validation, and document which platform/version combinations were exercised.
