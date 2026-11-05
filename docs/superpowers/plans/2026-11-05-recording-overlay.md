# Recording release and floating status

User request: trigger on key release and show a small status above other apps for recording start/end.

Design: on Windows, the native detector waits until every key in a clean chord is released, for default Win+Alt and custom shortcuts. Electron reserves custom shortcuts without firing on keydown. Local Space also toggles on keyup. A separate unfocusable, click-through BrowserWindow stays above ordinary windows at the lower right of the monitor where recording begins. It shows a red recording indicator and timer, then stopped/recognizing, then a short ready or error message. It follows actual recorder state rather than raw shortcut events. Renderer sends copy completion only after clipboard write. Hidden main window stays hidden.

- [x] Add regression tests for full release and overlay lifecycle/timers/focus.
- [x] Implement release detector and integrate custom shortcut registration.
- [x] Build isolated overlay HTML/CSS/preload and connect recorder statuses.
- [x] Run service/native tests, build and type check; review and document.

Validation: 64 service/native tests pass; production build passes. TypeScript has zero diagnostics excluding the known unused postProcessingService module. Native hook readiness smoke passes for Win+Alt and Control+Shift+R. Review identified a local Space keyup conflict; fixed by requiring a matching unmodified keydown and cancelling on other keys/blur, with regression coverage.

Visual smoke script: `scripts/overlay-smoke.cjs` renders four states in a hidden Electron window. This environment could not start the Electron renderer/GPU process (exit -1073741515 / ERR_FAILED), so physical display/focus and microphone testing remain manual checks. Unit tests verify overlay creation, topmost/unfocusable/click-through flags, real recorder-state routing, late readiness and hide-timer cancellation.
