# Insulin Hero

A kid-friendly, animated picture of how blood sugar and insulin work.

- **Body:** an *example body* simulator. It starts steady at 120 mg/dL. Tap insulin (small / medium / big) or food (snack / meal / fast sugar), then watch glucose change over sped-up body time, alongside an animated bloodstream with glucose, locked cells, and insulin heroes carrying keys.
- **Play:** "Insulin Hero Academy," a story game about how the body works.

**For learning only.** The app is purely illustrative and records nobody's real readings. It never recommends insulin doses, carb amounts, or treatment decisions. Follow the care team's plan for all treatment decisions.

Live: https://aemery4.github.io/insulin-hero/

## Safety and privacy by design

- **Illustrative, not personal.** The simulator is an example body with round, made-up, textbook-shaped effects (`src/domain/simulator.ts`). It is labeled on screen as made-up numbers that differ from real bodies.
- **No ratio to copy.** Inputs are abstract sizes, with no units and no grams, so a child can't read off a correction factor or carb ratio and apply it to themselves. A test asserts the controls show no numbers or units.
- **Realistic shapes, deliberately.** Insulin works slowly, over about 3–4 hours. Food is faster, and fast sugar is fastest. Too much insulin with no food goes low. This teaches cause, effect, and timing, not amounts.
- **Explanations describe, never instruct.** Tests reject advice words ("take", "give", "should", "units"…) in explanation and story copy.
- **All data stays on the device** (IndexedDB): settings and game progress only. No backend, no analytics. A production Content Security Policy blocks third-party network access, and ESLint forbids `fetch`/`XMLHttpRequest`/`WebSocket`/`sendBeacon` in `src/`.
- **Family-configured target range.** It starts at 70–180 and is always editable.
- The child's name is a setting stored only on the device, so it never appears in this public repo.
- Readings saved by earlier versions (which had a reading log) are left untouched on the device and no longer shown.

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
buttons ─► sim/simStore.ts ─► domain/simulator.ts (pure: insulin/food → glucose over body time)
                                   │ mgdl, what's still working, last action
                                   ▼
               domain/sceneState.ts (simSceneState) ─► SceneState
                                   │
               scene/SceneModel.ts (pure animation model, seedable, unit-tested)
                                   │
               scene/PixiRenderer.ts (draws the model) ◄─ scene/SceneController.ts
```

- `src/domain`: the example-body simulator, the glucose → scene mapping, kid-friendly copy, and validation
- `src/sim`: the session's simulator store (clock, pause, fast-forward, history for the mini graph)
- `src/scene`: `SceneModel` (particles, cells, heroes, helpers), `PixiRenderer`, and `art.ts` (original SVG characters shared by Pixi and the DOM)
- `src/game`: the Insulin Hero Academy story game (mission models, Pixi renderers, story content, sound)
- `src/storage`: IndexedDB (`idb`) with a versioned schema for settings and game progress
- `src/ui`: hash-routed views and accessible components

### Verifying the scene

In dev, `window.__insulinHero.controller` exposes:

- `snapshot()`: counts of glucose, lock states, cell energy, active heroes and helpers
- `advance(seconds)`: step the simulation deterministically
- `capture()`: returns a PNG data URL rendered at a fixed size

`POST /__capture {name, dataUrl}` (dev server only) saves a frame to `.captures/`.

## Future phases (designed for, not built)

- Story chapters 2–4 (Filter Plant, Brain Fog, Balance the City).
- A ketone scene in the simulator. It would show what happens in an example body when insulin is missing for a long time.
