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
| `pre-dispatch-throw.spec.ts`  | Path expansion / value read / optional gate throws folded into the failing mount, across all three run modes |
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

### Reaching `wrapSafeRunError`: throw from outside every per-mount `try`

`Container` folds a throw into issues at two sites, and it is easy to write a spec that thinks it is testing one while actually testing the other. A validator that throws is folded by `collectExecutionFailure`, **with the mount path attached** — it never reaches `wrapSafeRunError`.

For a **keyed** mount the tell is the resulting issue's `path`: `['foo']` means `collectExecutionFailure`, `[]` means `wrapSafeRunError`. That tell does **not** generalise — `prepareMountKey` sets `keyParts = key ? pathToArray(key) : []`, so a *keyless* container mount (the one mount form `Container` allows without a path) that fails with a non-`ValidupError` also emits `path: []` from `collectExecutionFailure`. If the spec's container has any keyless mount, drive the two sites apart some other way: throw from the strict pre-flight (below) for `wrapSafeRunError`, from inside a mounted unit for `collectExecutionFailure`.

To hit `wrapSafeRunError` the throw has to escape the run loop entirely. The **pre-dispatch region is no longer such a site**: path expansion, key preparation, the value read and the optional gate all sit inside per-mount error capture, because a throw there is attributable to a mount and letting it escape discarded every issue the earlier mounts had collected (issues #448 / #449). A getter on the input therefore lands in `collectExecutionFailure` now.

What remains outside is the **strict pre-flight** — `assertPathsStrict` walks `expandPath(data, item.path)` over every mount before the loop starts, with no issue accumulator to protect and no mount to attribute a failure to. So `pathsStrict` plus a filter list plus a throwing accessor drives every branch with no `Container` subclass:

```ts
function inputWithThrowingRead(thrown: unknown): { foo: string } {
    return { get foo(): string { throw thrown; } };
}

const container = new Container<{ foo: string }>({ pathsStrict: true, pathsToInclude: ['foo'] });
container.mount('foo', stringValidatorSync);
```

`finalizeOutput`'s defaults fill (`options.defaults` with a throwing getter) is the other reachable site, if a case ever needs one that does not involve strict mode.

**Watch for the trigger silently moving.** `safe-run-error.spec.ts` was written believing it reached the fold via `getPathValue`; it actually reached it one line earlier, via `expandPath` — which is why containing the pre-dispatch region turned 5 of its 15 cases red at once. The lesson: when a spec's premise is "this throws from site X", confirm X with a stack trace rather than by reading the source, because a nearby earlier site will satisfy the test while invalidating its comment.

This matters beyond convenience. Before `safe-run-error.spec.ts` landed, the entire suite stayed green with both non-`ValidupError` branches of `wrapSafeRunError` replaced by a bare re-throw — the tested implementation and the shipped one had diverged with nothing to catch it. When adding a case there, mutate the source and watch it fail before believing it.

### Pre-dispatch throws: assert all three run modes

`pre-dispatch-throw.spec.ts` pins that a throw from path expansion, the value read, or the optional gate is folded into the failing mount's issues instead of escaping. It is `describe.each`'d over `run` / `runSync` / `parallel: true` on purpose — the defect it covers reached all three through *different* code (one twin body, one separate scheduling loop), so a regression in one mode is invisible to the others.

Two traps that make cases in this area pass vacuously, both hit while writing that spec:

- **"All modes agree" is satisfied by all modes being equally broken.** A cross-mode `toEqual` assertion has to be preceded by an assertion on the tree's actual content, or it stays green against the very defect it exists for.
- **An escaped throw also carries no `meta`.** A case asserting only `leaf.meta?.optional === undefined` passes whether the stamp was skipped or the whole error path was bypassed. Pin `leaf.path` alongside it.

The parallel mode carries a second, non-issue-shaped failure: an escaping throw leaves already-scheduled promises unowned, which under Node's default `--unhandled-rejections=throw` kills the process. Assert it explicitly rather than trusting the runner to notice — register a `process.on('unhandledRejection', …)` listener, drain a macrotask with `setTimeout` (Node reports on a later turn), and assert nothing was captured. See `parallel.spec.ts` → "should not leak an unhandled rejection when a pre-dispatch read throws".

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
