# Automatically paste dictated text

User requests copying and immediately inserting transcription into the active input.

Implement a dedicated copy-and-paste IPC action for new recordings. Electron writes clipboard first, then a hidden Windows helper sends Ctrl+V to the current foreground app without restoring focus or pressing Enter. Manual copy and history retranscription remain copy-only. Wait briefly for held modifiers to be released, skip Voice Scribe's own foreground window, recheck foreground before injection, and report failure without losing clipboard contents. Only numeric parent PID is sent to the helper; dictated text is never passed through command arguments. No elevated execution.

- [x] Add IPC/service tests for copy-before-paste, manual-copy isolation and failure fallback.
- [x] Implement native paste helper and compile/layout checks without sending live keys.
- [x] Wire fresh transcription delivery and UI fallback notice.
- [x] Run tests, build, type checks and review. Physical insertion into other apps is a manual check.

Review found a clipboard replacement race during helper startup. The helper now checks the expected transcript hash and clipboard sequence immediately before input; it skips insertion if content changed. Only the SHA-256 hash, never the text, is passed through helper arguments. Failure notices distinguish clipboard replacement from normal copy-only fallback.

Validation: 68 tests and production build pass. Native helper is compiled and its INPUT layout, Ctrl+V sequence, key releases and normalized clipboard hashing are tested without injecting keys into the user's applications. Full TypeScript check retains the two known unused legacy postProcessingService errors. Also added a missing Info icon import in SettingsModal discovered by the check. Physical insertion into a running app has not been exercised here.
