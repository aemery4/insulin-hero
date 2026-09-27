# Insulin Hero

A kid-friendly, animated picture of what blood sugar and insulin are doing inside the body. The family logs a reading, and an animated bloodstream shows glucose, cells with locks, and an insulin hero who carries the keys.

**For learning only.** This app never calculates, recommends, or suggests insulin doses, carb amounts, or treatment decisions. Follow the care team's plan for all treatment decisions.

Live: https://aemery4.github.io/insulin-hero/

## Safety and privacy by design

- **No dosing logic.** Insulin/carb amounts are stored as entered for the family's own log, but are stripped before reaching the scene (`toSceneInput`). Animations only know *whether* insulin or food was logged, never how much — tests assert the scene is identical regardless of amounts.
- **Explanations describe, never instruct.** A test rejects advice words ("take", "give", "should", "units"…) in all explanation copy.
- **All data stays on the device** (IndexedDB). No backend, no analytics. A production Content Security Policy blocks third-party network access, and ESLint forbids `fetch`/`XMLHttpRequest`/`WebSocket`/`sendBeacon` in `src/`.
- **Family-configured target range** (starts at 70–180; always editable).
- The child's name is a setting stored only on the device, so it never appears in this public repo.
- JSON backup/restore lives in Settings, because on-device data is lost with the device.

## Development

```bash
npm install
npm run dev        # http://localhost:5173/insulin-hero/
npm test           # vitest
npm run check      # lint + test + build
node tools/make-icons.ts   # regenerate PWA icons from the hero art
```

Pushing to `main` runs lint, tests, and build, then deploys to GitHub Pages (`.github/workflows/deploy.yml`).

Commit with `git -c core.autocrlf=false commit …` on Windows (`.gitattributes` enforces LF).

## Architecture

```
reading + settings ─► domain/sceneState.ts (pure) ─► SceneState
                                                     │
                     scene/SceneModel.ts (pure simulation, seedable, unit-tested)
                                                     │
                     scene/PixiRenderer.ts (draws the model) ◄─ scene/SceneController.ts
```

- `src/domain`: types, reading → scene mapping, kid-friendly copy, validation
- `src/storage`: IndexedDB (`idb`) repos with versioned schema; `personId` and `source` fields are ready for multi-person and CGM import
- `src/scene`: `SceneModel` (particles, cells, heroes, helpers), `PixiRenderer`, `art.ts` (original SVG characters shared by Pixi and the DOM)
- `src/ui`: hash-routed views, SVG history chart, accessible components

### Verifying the scene

In dev, `window.__insulinHero.controller` exposes:

- `snapshot()`: counts of glucose, lock states, cell energy, active heroes and helpers
- `advance(seconds)`: step the simulation deterministically
- `capture()`: returns a PNG data URL rendered at a fixed size

`POST /__capture {name, dataUrl}` (dev server only) saves a frame to `.captures/`.

## Future phases (designed for, not built)

- CGM CSV import: readings already carry `source: 'cgm-import'`; add a parser per export format.
- Multiple family members viewing the same data would need a sync backend. That's a separate decision, since today nothing leaves the device.
- Achievements for logging habits only, never tied to the numbers.
- Ketone scene, only when the family logs a ketone check. It will never be inferred from glucose.
