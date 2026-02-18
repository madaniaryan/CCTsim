# Engine Contract (Minimal)

This simulation engine expects patient case JSON to follow a consistent contract. The app supports two schemas, but the newer rules-based schema is preferred for future cases.

## Minimal patient case JSON structure

Required top-level fields:

- `initial`: what the player sees on entry
- `truth`: hidden diagnosis + flags for scoring
- `orders`: everything orderable (labs, imaging, meds, consults, procedures)
- `results`: gated outputs unlocked after order completion
- `rules`: state machine + time-based deterioration + action-triggered changes
- `scoring`: must-do by deadline + penalties

## Design choice

Treat every action (fluids, antibiotics, consult, ECG, BiPAP, chest tube) as an orderable event with:

- an effect (change vitals/state/flags)
- optional time-to-complete
- optional dependencies (e.g., insulin requires potassium known)

## Common enums

Use these strings consistently across files:

`orderType`
- `lab` | `imaging` | `med` | `procedure` | `consult` | `nursing` | `monitoring`

`effectType`
- `setFlag` | `setState` | `modifyVitals` | `enqueueResult` | `startTimer` | `score`

`state`
- `initial` | `worsening` | `crashing` | `stabilizing` | `resolved`

## Notes

- The engine currently treats `type` as an alias for `effectType` to preserve backwards compatibility.
- Orders use `type` in existing cases; values should come from `orderType`.
- `enqueueResult` and `startTimer` are reserved for future extensions.
