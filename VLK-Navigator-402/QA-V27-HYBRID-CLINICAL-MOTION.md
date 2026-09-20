# VLK Navigator 402 — QA v27 Hybrid Clinical Motion

**Source:** `VLK-Navigator-402-v25-clinical-motion`  
**Target:** `v27 Hybrid Clinical Motion / Clinical Motion Atlas`  
**Date:** 2026-09-16

## Executive summary

The v25 visual/motion layer was upgraded in-place without changing the VLK normative corpus or application business logic. The work preserves the 24×24 `currentColor` line-art icon system, the single `SpecialtyIcon` API, delegated motion state management, hover/focus/touch support, and reduced-motion behavior.

The main v27 change is a specialty-specific **Clinical Motion Atlas**: eight clinically distinct SVG illustrations now use 1.8–2.2 s one-shot sequences, plus a restrained shared **Clinical Signature**. The emblem is also converted to a one-shot interaction per mounted session.

No new runtime dependencies were added and `package-lock.json` was not changed.

## Changed files

1. `app/globals.css`
   - replaced short v25 specialty motion with the v27 Clinical Motion Atlas;
   - specialty sequences are 1800–2200 ms;
   - added specialty-specific keyframes and Clinical Signature;
   - added managed-state behavior and reduced-motion overrides;
   - adjusted emblem animation to 2200 ms and one-shot selectors;
   - avoided infinite animation and geometry-changing keyframes.

2. `app/page.tsx`
   - render-only integration: `data-specialty` and `clinical-signature` inside specialty cards;
   - selection/business logic remains unchanged.

3. `components/vlk/specialty-icon.tsx`
   - retained one `SpecialtyIcon`, existing `SpecialtyId`, `viewBox="0 0 24 24"`, `fill="none"`, `currentColor`, line-art styling, accessibility attributes;
   - refined all eight specialty symbols and exposed semantic SVG subparts for motion.

4. `components/vlk/clinical-motion.tsx`
   - retained delegated pointer/focus/touch handling and single active target;
   - added one-shot emblem state (`data-motion-played`), without timers or persistence.

5. `package.json`
   - `npm test` now launches Node test runner with `--experimental-strip-types` after build, allowing `.mjs` tests to import TypeScript modules on Node 22 without adding a loader package.

6. `tests/vlk-redesign.test.mjs`
   - updated regression contract for v27 durations, specialty semantics, Clinical Signature, reduced motion, one-shot emblem, layout stability and TypeScript test launch.

7. `QA-V27-HYBRID-CLINICAL-MOTION.md`
   - this report.

## Protected areas

Compared byte-for-byte with the supplied v25 source, no changes were made in:

- `lib/`
- `db/`
- `public/`
- `scripts/`
- normative data files outside the six implementation/test files listed above
- `package-lock.json`

No changes were made to the VLK Order 402 corpus, article/point/column data, ICD mappings, TDV data, search semantics, selection rules, routing, API/database layer, auth, local persistence or service-worker source.

## Specialty motion matrix

| Specialty | Main symbol | Animated SVG parts | Duration | Semantic effect |
|---|---|---|---:|---|
| Therapist | stethoscope + secondary ECG | tube, chest piece, ECG | 1900 ms | attentive auscultation, single rhythm trace |
| Surgeon | scalpel | tool, blade/gleam, precision line | 1800 ms | controlled instrument movement and precise line |
| Neurologist | brain + sparse neural graph | signal, core node, four peripheral nodes | 2200 ms | impulse propagation from central node to two branches |
| Psychiatrist | brain + dialog bubble | brain, dialog bubble, two dialog lines | 1900 ms | communication and visual stabilization, not neural firing |
| Ophthalmologist | eye | pupil, iris/glint detail | 1800 ms | focus shift and restrained optical glint |
| ENT | ear | inner ear, two sound waves | 1900 ms | sound perception through ear-specific geometry |
| Dentist | tooth | tooth, enamel glint, pulp line | 1800 ms | minimal examination tilt, enamel reflection, one internal response |
| Dermatologist | magnifier + skin layers | magnifier, two layers, detail point | 2100 ms | focused diagnostic inspection of simplified skin layers |

## Neurologist vs psychiatrist

The two specialties no longer share the same visual metaphor.

- **Neurologist:** a sparse brain-centered neural topology with a central signal and four peripheral response nodes. Its motion is directional propagation.
- **Psychiatrist:** a brain paired with a separate dialog bubble and two dialog lines. Its motion is staged communication and stabilization. It does not reuse the neurologist's neural-signal class.

This distinction remains readable at the existing 24×24 canvas size.

## Dermatologist update

The previous abstract skin-section concept was replaced by a hybrid symbol where the **magnifier is the primary silhouette**. Inside it are two simple skin layers and one small texture/detail point. Motion is an inspection sequence: magnifier focus/translation, sequential layer emphasis, detail response, return.

No realistic lesions or graphic clinical imagery were introduced.

## Dentist update

The tooth remains the primary symbol. The previous emoji-like sparkle metaphor was removed. It is replaced by a short `si-enamel-glint` stroke and an internal `si-pulp` detail. Motion is limited to a ~1° local tilt, enamel reflection, one internal response and return.

## Clinical Signature

Each specialty card includes a small decorative `.clinical-signature` element inside the existing icon plate. It runs once for approximately 1100 ms as a restrained mint/brass trace and is subordinate to the primary SVG motion.

Properties:

- no progress-bar semantics;
- no infinite loop;
- no card-size or text displacement;
- disabled by `prefers-reduced-motion`;
- pointer events disabled.

## Emblem motion

The emblem animation is 2200 ms and remains transform/opacity/stroke based. The motion manager marks the brand target with `data-motion-played="true"` after it settles, so repeated hover/focus does not continuously replay the decorative sequence during the same mounted session.

The emblem state is deliberately not persisted to storage.

## Reduced motion

`@media (prefers-reduced-motion: reduce)` disables decorative SVG transforms, stroke animation, pulse/sweep behavior, Clinical Signature and logo motion. Functional hover/focus surface changes and visible focus indication remain available.

No important information is encoded only in motion.

## Test-runner fix

The project already used `.mjs` tests that directly import TypeScript modules. The v27 test script now uses Node 22's built-in TypeScript stripping:

```text
node --experimental-strip-types --test tests/*.test.mjs
```

This avoids adding `tsx`, `ts-node` or another loader dependency solely for the test runner. Node 22 currently labels this feature experimental, so CI should use the repository's declared Node 22 engine and retain this as an explicitly validated runtime assumption.

## Validation actually executed

### Source syntax / parse checks

Passed:

- TypeScript transpile/parse: `app/page.tsx`
- TypeScript transpile/parse: `components/vlk/specialty-icon.tsx`
- TypeScript transpile/parse: `components/vlk/clinical-motion.tsx`
- PostCSS parse: `app/globals.css`

These checks used globally available TypeScript/PostCSS tooling because the local install could not be completed.

### v27 motion regression

Executed:

```text
node --experimental-strip-types --test tests/vlk-redesign.test.mjs
```

Result:

```text
19 tests
19 passed
0 failed
```

### Protected navigation / search / selection logic

Executed:

```text
node --experimental-strip-types --test \
  tests/vlk-navigation.test.mjs \
  tests/vlk-search.test.mjs \
  tests/vlk-selection.test.mjs
```

Result:

```text
30 tests
30 passed
0 failed
```

### Wider no-build regression suite

Executed every `.test.mjs` except the three suites that require installed React/build output (`rendered-html`, `ui-components`, `vlk-offline`).

Result:

```text
112 tests
112 passed
0 failed
```

### Full source test set without build artifacts

A broader direct Node run was also attempted. It reported 120 passing tests and 3 failures caused by absent build/dependency artifacts, not failed source assertions:

- `rendered-html.test.mjs`: `dist/server/index.js` unavailable because build could not run;
- `ui-components.test.mjs`: React package unavailable because installation was incomplete;
- `vlk-offline.test.mjs`: `dist/client/offline-manifest.json` unavailable because build could not run.

This run is **not** recorded as a project PASS.

## Commands requested by the v27 specification

The environment could not complete `npm ci`: npm registry/DNS access repeatedly failed with `EAI_AGAIN`. The partial install therefore did not provide local `eslint`, `vinext` or `next` binaries.

For transparency, the following commands were attempted after the failed install:

| Command | Exit | Actual result |
|---|---:|---|
| `npm run lint` | 127 | `eslint: not found` because install did not complete |
| `npm run build` | 69 | `vinext is unavailable` because install did not complete |
| `npm run build:next` | 127 | `next: not found` because install did not complete |
| `npm test` | 69 | stops at `npm run build`; `vinext` unavailable |

Therefore none of these four commands is claimed as PASS in this environment.

## Browser / screenshot QA

Not fabricated and not marked as complete.

Because dependencies could not be installed and neither Next nor Vinext could be started, an actual browser render was not available for the required 360/390/430/768/1024/1280/1440 px, dark/light, keyboard, touch and reduced-motion screenshot matrix.

The code-level regressions explicitly guard against layout-affecting animation properties, infinite loops and missing reduced-motion handling, but real rendered visual QA should still be run after a successful install/build.

## Remaining risks

1. **Real browser visual QA remains required.** Code-level checks cannot fully validate 24×24 optical balance, contrast, clipping, z-index or perceived motion timing.
2. **Node TypeScript stripping is experimental on Node 22.** It works in the tested runtime and solves the `.mjs → .ts` import problem without a new package, but the actual CI runner must remain compatible.
3. **Full lint/build tests remain unverified here** solely because the package installation could not complete through the unavailable npm registry.
4. **Touch UX should be visually confirmed on a real device.** Existing delegated pointer/touch behavior is preserved and regression-tested structurally, but gesture feel is a browser/device concern.

## Deployment handoff

Before production deploy on a networked workstation/CI runner:

```bash
npm ci
npm run lint
npm run build
npm run build:next
npm test
```

Then perform browser QA at the requested responsive widths in both themes, with keyboard focus, touch and `prefers-reduced-motion` enabled.

No `.env`/secret, `node_modules`, `.sites-runtime`, `.next` or `dist` output is included in the final handoff archive.
