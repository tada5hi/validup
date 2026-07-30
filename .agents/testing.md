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
| `issue.spec.ts`               | `Issue` factories and guards (`isIssueItem` / `isIssueGroup` / `isIssue`) |
| `flatten.spec.ts`             | `flattenIssueItems` / `flattenIssueGroups` — pre-order + reference identity |
| `mount-dispatch.spec.ts`      | `Container.mount` / `Builder.mount` argument-dispatch order, `isContainer` |
| `initialize.spec.ts`          | Subclass `initialize()` hook                              |
| `run-sync.spec.ts`            | `runSync` / `safeRunSync` + `RunSyncViolationError`       |
| `parallel.spec.ts`            | `runParallel` scheduling and issue ordering               |
| `run-parity.spec.ts`          | `run` ↔ `runSync` twin contract, table-driven             |
| `twin.spec.ts`                | The `src/utils/twin.ts` protocol itself                   |
| `optional-value.spec.ts`      | `isOptionalValue` atom matcher, at its own edge           |
| `path-filter.spec.ts`         | `resolvePathFilter` include/exclude verdict               |
| `defaults.spec.ts`            | `resolveDefaults` child-slice helper                      |

When adding a new container option or mount option, add or extend the matching spec — don't pile new cases into `module.spec.ts`.

### Guard-ordering specs

`Container.mount` and `Builder.mount` both classify their arguments by walking a chain of duck-typed predicates, and several of those predicates overlap on the same value. The order of the branches is therefore load-bearing, and `mount-dispatch.spec.ts` pins it:

- `Container.mount` — `isContainer` and `isValidatorDescriptor` must both precede the generic `isObject` MountOptions branch. The two `run`-bearing guards are **mutually exclusive** by construction (`isValidatorDescriptor` requires `typeof input.safeRun !== 'function'`), so their relative order is defence-in-depth; the spec pins that negative check directly rather than pretending an object could satisfy both.
- `Builder.mount` — `isBuilder` (`build` + `mount`) and `isContainer` (`run` + `safeRun`) genuinely overlap: an object exposing all four satisfies both. `isBuilder` must win, so the child is `target.build()` rather than the target itself.

When adding a predicate to either chain, add its row here — a spec that only asserts "the happy shape works" will not catch a reorder.

### `run-sync-violation` is imported by module path

`container/run-sync-violation.ts` is deliberately absent from `container/index.ts` (internal plumbing — the public counterpart is `isPathsStrictViolation`). `run-sync.spec.ts` reaches it via `../../src/container/run-sync-violation`. Don't "fix" that import by adding a barrel line.

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
