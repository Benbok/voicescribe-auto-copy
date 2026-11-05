# Yandex provider implementation plan

**Goal:** Switch Voice Scribe to Yandex SpeechKit + YandexGPT by default, as confirmed by the user.

**Design:** Preserve Gemini as a manual alternative. A provider service dispatches transcription and health checks. SpeechKit v3 receives mono WAV directly, polls the operation, and assembles normalized final segments. Only corrector/translator invoke YandexGPT. Settings store the provider, API key, folder ID and model; a blank password preserves the current key. Electron supplies environment configuration and its existing CORS-free transport. Never silently send audio to a different provider.

**Approaches:** Use asynchronous v3 instead of synchronous v1 (30 second limit) or streaming gRPC (new transport and recording architecture). Existing React/TypeScript/Electron stack, no new dependencies.

- [x] Add failing service tests for WAV encoding, streamed results, polling, errors, mode routing and configuration.
- [x] Implement audio conversion, Yandex API service and provider dispatcher; pass service tests.
- [x] Add settings, switch application routing/status and wire Electron environment variables.
- [x] Update README and environment example; run all service tests, production build and type check. Record pre-existing failures separately.

Validation uses local API doubles; a live request requires user credentials. Health check validates configuration only, to avoid billing for background probes; actual access is checked with recorded audio.

Review: a separate reviewer verified API schemas, auth and mode routing. Its polling-budget finding was addressed by allowing 600 polls and retaining the operation ID in timeout errors, with a long-operation regression test.

Verification: 44 service tests pass; Vite production build passes; Electron syntax and diff whitespace checks pass. Full TypeScript check still reports two existing errors in the unused legacy `postProcessingService.ts`: missing `openaiService` and `TonePreset`. The Electron environment type was corrected to describe the actual preload getter.
