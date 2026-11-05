# Global recording shortcut

User request: editable global recording toggle, including hidden windows. Default explicitly requested: Win+Alt alone.

Design: Windows modifier-only hook for Super+Alt, Electron globalShortcut for ordinary modified accelerators. Trigger modifier-only chord on release, once, ignoring combinations with any third key. Persist in userData after successful registration; preserve old registration on failure. IPC exposes configuration and a toggle event. Keep the renderer alive in the tray, with background throttling disabled and native clipboard writes for hidden-window transcription. Debounce recording start while microphone permission is pending and ignore toggles during processing.

Use the existing Windows PowerShell/C# toolchain for the modifier-only hook with a hidden child, no downloaded dependencies. Monitor child readiness and exit; dispose on switch and quit. No keystrokes are stored or sent to the renderer: only toggle notifications.

- [x] Test shortcut normalization, replacement conflicts, persistence rollback and hook lifecycle.
- [x] Implement manager and Windows chord helper; test actual C# state machine without installing a hook.
- [x] Wire Electron IPC, tray, clipboard, renderer recording toggle and a separate shortcut editor.
- [x] Document behavior and run unit tests, build and TypeScript checks (existing orphan legacy errors recorded separately).

Validation: 59 combined tests pass. Real Windows hook startup/cleanup smoke passes; C# tests exercise press order, left/right modifiers, repeats, third keys and repeated toggles. Production build passes; TypeScript reports zero diagnostics when excluding the existing unused postProcessingService module (missing openaiService and TonePreset). Electron JS syntax and diff whitespace checks pass.

Review found a race between slow hook initialization and user edits. A regression test reproduced it; serializing init and edits through the same queue fixes it. Reviewer found no further important issues. Physical keyboard behavior (including Windows menu interactions) and live microphone recording remain manual checks in the running app.
