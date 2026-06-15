# Agent Instructions

## Implementation Research

- Before implementing gesture, animation, accessibility, browser API, or UI behavior from scratch, check whether a standard API, established pattern, or small well-known library already fits the need.
- Prefer boring, conventional implementations over custom clever code when the behavior should feel familiar across mobile apps.
- If a library is introduced, keep the dependency small, document why it was chosen in the change summary, and keep a graceful fallback when the feature is not critical.
- For mobile gestures, validate against common touch/mouse/pointer behavior and keep vertical scrolling available unless the interaction explicitly requires blocking it.
- Do not put implementation rationale or AI-like helper copy into visible UI. Put reasoning in README, issues, code comments, or this file.
