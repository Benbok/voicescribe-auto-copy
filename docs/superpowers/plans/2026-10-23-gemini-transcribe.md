# Gemini Transcribe Implementation Plan

**Goal:** Support the user-selected `gemini-3.5-transcribe` with the Interactions API.
**Architecture:** An isolated REST adapter sends inline audio, disables interaction storage, and extracts model output. The transcription service dispatches the dedicated model to that adapter; other models retain generateContent. Special modes process the resulting transcript through the existing default Flash model.
**Tech Stack:** TypeScript, fetch, Node test runner, existing Google GenAI SDK.
**Spec:** User-approved approach in this conversation: add a dedicated Interactions API path for gemini-3.5-transcribe.

## Constraints and review focus

- Preserve existing user changes, manual model selection, recording history and quota accounting.
- Do not send real credentials or recordings during automated checks.
- Test REST steps, SDK-style output_text, legacy outputs, blank responses, failed status, HTTP errors, timeout and routing.
- Preserve actual HTTP error status for existing retry/error classification. Do not include API response bodies or credentials in exceptions.
- Do not silently route a dedicated transcription model to Flash after a failed request.
- Live transcription is outside this request; display an actionable error for the live-only model.

## Implementation

- [x] Write and run failing adapter tests.
- [x] Implement adapter, model dispatch and special-mode text processing.
- [x] Run adapter and existing key validation tests, build and TypeScript checks; review the diff.

## Verification record

24 automated tests passed, including actual service orchestration bundled with SDK/network doubles. Production build passed. TypeScript still reports only the three pre-existing errors (electronEnv.get typing, missing openaiService, missing TonePreset).

Fresh-context read-only review found no adapter/orchestration defects. It identified the concurrent health-check regression test; the metadata-only health path was then implemented and all 24 tests passed. Real audio/API credentials were not used during verification.

Ruling: Use a metadata GET for Transcribe health checks because the existing text ping is incompatible with ASR; metadata success does not guarantee inference access. Keep special-mode text processing explicit in the provider label and README.
