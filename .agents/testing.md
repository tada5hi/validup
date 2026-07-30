# Testing

## Runner

- **Vitest 4** with the v8 coverage provider.
- Each package has its own `test/vitest.config.ts` — there is no root-level Vitest config. Run from the package directory or via `npm run test` (which delegates to `nx run-many -t test`).
- `globals: true` is set in four of the five packages (`@validup/validator-js` omits it deliberately), but **specs must import `describe` / `it` / `expect` explicitly from `vitest` regardless**. Every spec in the repo does; don't lean on the globals.

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

All five packages use the same thresholds (`coverage.thresholds` in `vitest.config.ts`):

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
| `safe-run-error.spec.ts`      | `wrapSafeRunError` — the `safeRun` / `safeRunSync` fold for a throw that escaped the run loop |
| `issue.spec.ts`               | `Issue` factories and guards (`isIssueItem` / `isIssueGroup` / `isIssue`) |
| `flatten.spec.ts`             | `flattenIssueItems` / `flattenIssueGroups` — pre-order + reference identity |
| `mount-dispatch.spec.ts`      | `Container.mount` / `Builder.mount` argument-dispatch order, `isContainer` |
| `initialize.spec.ts`          | Subclass `initialize()` hook                              |
| `run-sync.spec.ts`            | `runSync` / `safeRunSync` + `RunSyncViolationError`       |
| `parallel.spec.ts`            | `runParallel` scheduling and issue ordering               |
| `run-parity.spec.ts`          | `run` ↔ `runSync` twin contract, table-driven             |
| `structural-throw.spec.ts`    | `isStructuralThrow` — the shared abort / `RunSyncViolationError` / `PathsStrictViolationError` carve-out predicate |
| `output-shape.spec.ts`        | Nested output reconstruction — array paths under the default `flat: false` |
| `optional-value.spec.ts`      | `isOptionalValue` atom matcher, at its own edge           |
| `path-filter.spec.ts`         | `resolvePathFilter` include/exclude verdict               |
| `defaults.spec.ts`            | `resolveDefaults` child-slice helper                      |

When adding a new container option or mount option, add or extend the matching spec — don't pile new cases into `module.spec.ts`.

### Guard-ordering specs

`Container.mount` and `Builder.mount` both classify their arguments by walking a chain of duck-typed predicates, and several of those predicates overlap on the same value. The order of the branches is therefore load-bearing, and `mount-dispatch.spec.ts` pins it:

- `Container.mount` — `isContainer` and `isValidatorDescriptor` must both precede the generic `isObject` MountOptions branch. The two `run`-bearing guards are **mutually exclusive** by construction (`isValidatorDescriptor` requires `typeof input.safeRun !== 'function'`), so their relative order is defence-in-depth; the spec pins that negative check directly rather than pretending an object could satisfy both.
- `Builder.mount` — `isBuilder` (`build` + `mount`) and `isContainer` (`run` + `safeRun`) genuinely overlap: an object exposing all four satisfies both. `isBuilder` must win, so the child is `target.build()` rather than the target itself.

When adding a predicate to either chain, add its row here — a spec that only asserts "the happy shape works" will not catch a reorder.

### Reaching `wrapSafeRunError`: throw from outside the per-mount `try`

`Container` folds a throw into issues at two sites, and it is easy to write a spec that thinks it is testing one while actually testing the other. A validator that throws is folded by `collectExecutionFailure`, **with the mount path attached** — it never reaches `wrapSafeRunError`.

For a **keyed** mount the tell is the resulting issue's `path`: `['foo']` means `collectExecutionFailure`, `[]` means `wrapSafeRunError`. That tell does **not** generalise — `prepareMountKey` sets `keyParts = key ? pathToArray(key) : []`, so a *keyless* container mount (the one mount form `Container` allows without a path) that fails with a non-`ValidupError` also emits `path: []` from `collectExecutionFailure`. If the spec's container has any keyless mount, drive the two sites apart some other way: throw from the input's value read (below) for `wrapSafeRunError`, from inside a mounted unit for `collectExecutionFailure`.

To hit `wrapSafeRunError` the throw has to escape the run loop, i.e. originate outside the per-mount `try`. The cheapest such site is the mount's value read (`getPathValue(data, key)`), which sits a few lines above the `try`, so an input object with a throwing accessor drives every branch with no `Container` subclass:

```ts
function inputWithThrowingRead(thrown: unknown): { foo: string } {
    return { get foo(): string { throw thrown; } };
}
```

This matters beyond convenience. Before `safe-run-error.spec.ts` landed, the entire suite stayed green with both non-`ValidupError` branches of `wrapSafeRunError` replaced by a bare re-throw — the tested implementation and the shipped one had diverged with nothing to catch it. When adding a case there, mutate the source and watch it fail before believing it.

### The abort × `ValidupError` cell

`isStructuralThrow`'s three legs look independently testable, but only one input class distinguishes the abort leg from the rest: a **`ValidupError` thrown while the signal is aborted**. Every other value is either structural on its own (`RunSyncViolationError`, `PathsStrictViolationError`) or foldable either way. So a spec that exercises the abort leg with an `Error`, a string, and `undefined` — as `structural-throw.spec.ts` originally did — pins nothing: the leg narrows to `signal?.aborted && !isValidupError(error)` with the whole suite green, while `safeRun` silently starts returning a `Result` where it used to reject.

Three cases cover it, one per layer, and each is load-bearing on its own:

| Spec | Case | Kills |
|---|---|---|
| `structural-throw.spec.ts` | `isStructuralThrow(validupError, abortedSignal)` is `true` | narrowing the abort leg in the predicate itself |
| `safe-run-error.spec.ts` | getter aborts then throws a `ValidupError` → `safeRun` **rejects** with that instance | swapping `isStructuralThrow` below the `isValidupError` passthrough in `wrapSafeRunError` |
| `abort-signal.spec.ts` | mount aborts then throws a `ValidupError`, a second mount follows → `safeRun` rejects with that instance, **not** a bare `AbortError` | narrowing the carve-out in `collectExecutionFailure` (which would fold the error, continue the loop, and lose the diagnostic to the next `throwIfAborted()`) |

The general lesson: when a predicate ORs a *run-state* read with *error-type* reads, the only discriminating input is one the type reads reject and the state read accepts. Enumerate that cell explicitly — "regardless of the thrown value" in a test name is a claim, not coverage.

### Two container modules are imported by module path

`container/run-sync-violation.ts` and `container/structural-throw.ts` are both deliberately absent from `container/index.ts` (internal plumbing — the public counterpart is `isPathsStrictViolation`). `run-sync.spec.ts` reaches the first via `../../src/container/run-sync-violation`; `structural-throw.spec.ts` reaches both via their direct paths. Don't "fix" those imports by adding barrel lines — `structural-throw.ts` composes `isRunSyncViolation`, so exporting it would leak a deliberately-private decision onto the semver-protected surface.

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
- **Prefer a DOM-free spec when the unit under test is DOM-free.** `@validup/vue` has two framework-free units, `helpers/projection.ts` and `helpers/severity.ts`, but only one DOM-free spec so far. `test/unit/projection.spec.ts` covers the projection layer with plain function calls against literal fixtures and adds a `// @vitest-environment node` docblock (matched anywhere in the file, so it sits below the copyright header) to opt out of the package-wide `happy-dom` env; it asserts `typeof globalThis.document === 'undefined'` so a framework dependency leaking back into the projection layer fails loudly. `test/unit/severity.spec.ts` drives `getSeverity` by direct call for its branch table but still `mount()`s a component for one end-to-end case, so it stays on `happy-dom` — converting it is an open opportunity, not a description of today. The mounted specs stay as integration nets; move a case down to a pure suite only when it exists purely to reach a pure branch.
- Coverage is collected only from `src/**/*.{ts,tsx,js,jsx}`.

### Assert the serialized shape, not just the read-back

`Container.finalizeOutput` expands its flat dotted output into a nested object with `setPathValue` whenever `flat` is false — the default. A path with numeric segments can therefore reconstruct as `{ items: { '0': [] } }`: the value lands on an array as a non-index property, which **reads back fine in memory but is dropped by `JSON.stringify` and `structuredClone`**, i.e. in any API response body.

A pathtrace bug of exactly that shape ([tada5hi/pathtrace#200](https://github.com/tada5hi/pathtrace/issues/200), fixed in 2.2.3) went unnoticed here for that reason: every glob spec in `mount-key.spec.ts` passes `{ flat: true }` — the branch that skips `setPathValue` entirely — and every fixture used object keys rather than array indices.

So when a spec covers output reconstruction, assert `JSON.parse(JSON.stringify(output))` (and `structuredClone` where it matters) rather than reading a property off the result. `output-shape.spec.ts` is the dedicated home for those cases.

Note also that flat keys keep pathtrace's bracket notation for indices (`items[0].name`, not `items.0.name`).
