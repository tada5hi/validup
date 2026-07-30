# Testing

## Runner

- **Vitest 4** with the v8 coverage provider.
- Each package has its own `test/vitest.config.ts` — there is no root-level Vitest config. Run from the package directory or via `npm run test` (which delegates to `nx run-many -t test`).
- `globals: true` is enabled, so `describe`/`it`/`expect`/etc. are available without imports.

## Layout

```
packages/<pkg>/test/
├── vitest.config.ts
├── unit/
│   └── *.spec.ts        # one spec per concern
├── data/                # shared fixtures (validup core only)
└── helpers/             # assertion helpers, not collected (validup core only)
```

Spec discovery (`test.include`): `test/unit/**/*.{test,spec}.{js,ts}`. New specs should live under `test/unit/` and end in `.spec.ts`. `test/data/` and `test/helpers/` sit outside that glob on purpose, so nothing in them is collected as a suite.

Specs reach package source via relative imports — `import { Container } from '../../src';` from inside `test/unit/`.

## Coverage Thresholds

All five integration packages currently use the same thresholds (`coverage.thresholds` in `vitest.config.ts`):

| Metric     | Threshold |
|------------|-----------|
| branches   | 59        |
| functions  | 77        |
| lines      | 73        |
| statements | 74        |

Run with `npm run test:coverage` inside the package. CI does **not** fail on coverage today (only `npm run test`), but lowering thresholds without justification is a smell.

## Existing Specs (validup core)

| File                          | Covers                                                    |
|-------------------------------|-----------------------------------------------------------|
| `module.spec.ts`              | Basic mount + run, defaults, failure paths                |
| `mount-key.spec.ts`           | Mount path / glob expansion via pathtrace                 |
| `group.spec.ts`               | `MountOptions.group` + `ContainerRunOptions.group`        |
| `optional.spec.ts`            | `optional` / `optionalValue` / `optionalInclude`          |
| `one-of.spec.ts`              | `ContainerOptions.oneOf` aggregation behavior             |
| `paths-to-include.spec.ts`    | `pathsToInclude` / `pathsToExclude` filters               |
| `error.spec.ts`               | `ValidupError` shape and `isValidupError` guard           |
| `issue.spec.ts`               | `Issue` factories and guards                              |
| `initialize.spec.ts`          | Subclass `initialize()` hook                              |
| `run-sync.spec.ts`            | `runSync` / `safeRunSync` + `RunSyncViolationError`       |
| `parallel.spec.ts`            | `runParallel` scheduling and issue ordering               |
| `run-parity.spec.ts`          | `run` ↔ `runSync` twin contract, table-driven             |
| `output-shape.spec.ts`        | Nested output reconstruction — array paths under the default `flat: false` |
| `optional-value.spec.ts`      | `isOptionalValue` atom matcher, at its own edge           |
| `path-filter.spec.ts`         | `resolvePathFilter` include/exclude verdict               |
| `defaults.spec.ts`            | `resolveDefaults` child-slice helper                      |

When adding a new container option or mount option, add or extend the matching spec — don't pile new cases into `module.spec.ts`.

### Sync/async parity

`run` and `runSync` are two drivers over one shared body (`Container.runBody`), so a mount-resolution rule that holds for one must hold for the other. Assert that once via the helpers in `test/helpers/parity.ts` rather than hand-duplicating each `it()` per variant:

```ts
import { expectRunFailureParity, expectRunParity } from '../helpers/parity';

// success: both variants run, outputs must be deeply equal
const output = await expectRunParity(container, input, options);

// failure: both variants must fail with deeply-equal issue trees
const issues = await expectRunFailureParity(container, input, options);
```

Parity specs need **synchronous** validators — `runSync` rejects any thenable return. Use `stringValidatorSync` from `test/data`, not the async `stringValidator`.

## Writing Tests

Specs import directly from the package source, not the built dist:

```ts
import { Container, type Validator } from '../../src';
```

- Use `expect.assertions(n)` when asserting in `catch` blocks (see `module.spec.ts`) — the codebase is consistent about this.
- Integration-package tests instantiate the foreign library inline (zod, validator.js); `vue` uses `@vue/test-utils` + `happy-dom`.
- Coverage is collected only from `src/**/*.{ts,tsx,js,jsx}`.

### Assert the serialized shape, not just the read-back

`Container.finalizeOutput` expands its flat dotted output into a nested object with `setPathValue` whenever `flat` is false — the default. A path with numeric segments can therefore reconstruct as `{ items: { '0': [] } }`: the value lands on an array as a non-index property, which **reads back fine in memory but is dropped by `JSON.stringify` and `structuredClone`**, i.e. in any API response body.

A pathtrace bug of exactly that shape ([tada5hi/pathtrace#200](https://github.com/tada5hi/pathtrace/issues/200), fixed in 2.2.3) went unnoticed here for that reason: every glob spec in `mount-key.spec.ts` passes `{ flat: true }` — the branch that skips `setPathValue` entirely — and every fixture used object keys rather than array indices.

So when a spec covers output reconstruction, assert `JSON.parse(JSON.stringify(output))` (and `structuredClone` where it matters) rather than reading a property off the result. `output-shape.spec.ts` is the dedicated home for those cases.

Note also that flat keys keep pathtrace's bracket notation for indices (`items[0].name`, not `items.0.name`).
