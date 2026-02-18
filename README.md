# Emergency Medicine Shift Simulator

Single-page, browser-based ED shift simulation. Manage 4 main patients (sepsis, COPD, MI, trauma) in parallel with time pressure, interruptions, and evolving patient status.

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Start the dev server:

```bash
npm run dev
```

Open the URL printed by Vite.

## Project structure

```
public/assets/          Placeholder room image(s)
src/
  components/           UI components
  data/
    patients/           Patient JSON definitions
    distractors.json    Distractor cards
    ENGINE_CONTRACT.md  Minimal engine contract + enums
  engine/               Simulation engine helpers
  App.jsx               App state + routing
  styles.css            Global styling
```

## Add a new patient

1. Create a new JSON file under `src/data/patients/` using the existing files as a template.
2. Add the filename to `src/data/patients/index.json`.
3. Provide at least:
   - `id`, `room`, `name`, `age`, `chiefComplaint`, `image`, `initialState`
   - `states` with vitals, HPI, exam, and `ordersAvailable`
   - `orders` list (labs, imaging, meds, procedures)
   - `timeline` events for decompensation
   - `actionTriggers` for stabilization
   - `criticalActions` list used in the end-of-shift summary

No code changes are needed beyond adding the JSON file and listing it in `index.json`.

### Advanced patient schema (rules + time events)

The engine also supports a richer schema (see `src/data/patients/sepsis.json`) with:

- `room` object with `label`, `image`, and `altImages`
- `initial` block with `ageSex`, `chiefComplaint`, `hpi`, `exam`, and `vitals`
- `state.current` and `state.flags`
- `rules` for `onOrderEffects`, `derivedFlags`, and `timeEvents`
- `results` map for lab/imaging outputs
- `scoring.mustDo` and `scoring.softPenalties`

This format enables rule-driven flags, absolute time events, and conditional ordering without extra code.

## Engine contract + enums

See `src/data/ENGINE_CONTRACT.md` for the minimal engine contract and the required enum strings (`orderType`, `effectType`, and `state`) to keep consistent across files.

## Add a new distractor

1. Open `src/data/distractors.json`.
2. Append a new entry to the `items` array with:
   - `id`, `type`, `prompt`, `options`, `correctIndex`, `explanation`, `scoreDelta`

## Notes on the engine

- Patient evolution uses a finite state machine driven by:
  - `timeline` events (e.g., decompensation when away too long)
  - `actionTriggers` (e.g., sepsis bundle -> stabilizing)
- Orders appear in Results only after `timeToResultMin` elapses.
- Time is accelerated: 1 real second equals 6 in-game seconds (`TIME_SCALE`).

## Swapping assets

Replace `public/assets/room-placeholder.svg` with real images and update each patient’s `image` field to point to the new asset.
