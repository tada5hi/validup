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

### `issue-shape.spec.ts` holds the validator-js `code → message → data` table

`@validup/validator-js`'s per-factory failure triple lives in one table in `test/unit/issue-shape.spec.ts` — a row per single-triple factory asserting `(code, message, data, sideEffect)` plus the value-passes-through case. Every factory writes its own triple by hand, so the table is the only thing that puts a drifting default next to its siblings. When adding a factory, add its row there rather than hand-writing another block of assertions; `factories.spec.ts` stays the home for behaviour that is *not* a single triple (the `isInt` / `isFloat` / `isLength` branch ladders, option forwarding).

The same file carries four `@ts-expect-error` cases pinning the core's per-code `data` gatekeep (`createValidupError`) **as the adapter sees it**. The positive direction is build-enforced from `src/` — `matches`, `equals` and `isStrongPassword` all pass typed `data` — but nothing in `src/` ever passes a WRONG payload, so the negative direction needs the spec. See below.

### Specs are not typechecked, in any package

Each package has **two** TypeScript configs: `tsconfig.build.json` (`src/**/*` only — what `npm run build:types` and therefore the published declarations read) and `tsconfig.json` (what `npx tsc --noEmit` and your editor read). Both used to include only `src`, so **nothing typechecked `test/` in any package**.

`@validup/validator-js` now closes that: its `tsconfig.json` includes `test/**/*.ts` and `npm run test:types` (`tsc --noEmit`) covers the specs. `tsconfig.build.json` is deliberately untouched, so specs still never influence the emitted `.d.mts`.

- **`issue-shape.spec.ts`'s four `@ts-expect-error` gatekeep cases are enforced by that command.** Verified non-vacuous: collapsing the core's `CreateValidupErrorTail` (`packages/validup/src/helpers/create-error.ts`) to a single permissive `[data?: any]` tuple makes `npx tsc --noEmit` in `packages/validator-js` report all four as `TS2578: Unused '@ts-expect-error' directive` (baseline is clean). Before this, the directives were inert in every automated context, and the re-check command printed in the spec's own docblock was itself broken — it omitted `--ignoreConfig` and died with `TS5112` having typechecked nothing.
- **The other four packages are still unchecked.** `validup`, `vue` and `standard-schema` would likely pass as-is; `packages/zod/test/unit/` has pre-existing type errors that must be fixed first — `error.spec.ts:60` (`TS2322`, `number` vs `string`) and `module.spec.ts:170` (`TS2353`) on this branch, and a third on `master` (`error.spec.ts:154`, `TS2353`) that this branch's `error.spec.ts` rewrite happened to remove. None are regressions; they simply have never been checked.

Rolling the same `include` out to the remaining four packages is the open follow-up. Until then, if a spec's type-level assertion is load-bearing in one of those, **say so in the spec and give a command that actually runs** — the standalone form needs `--ignoreConfig`:

```
npx tsc --noEmit --ignoreConfig --strict --target ES2022 --module ESNext \
    --moduleResolution bundler --skipLibCheck --esModuleInterop test/unit/<spec>.ts
```

### The six validator-js specs, and what each one owns

| File | Owns |
|---|---|
| `issue-shape.spec.ts` | The `code → message → data → sideEffect` table for the 16 single-triple factories; the value-identity table over all 19 factory `return ctx.value` sites; descriptor own-property shape; `data`-payload identity per failure; when `message` is resolved; the `@ts-expect-error` gatekeep cases |
| `factories.spec.ts` | Behaviour that is *not* a single triple — the `isInt` / `isFloat` / `isLength` branch ladders, their per-throw-site `message` overrides, the degenerate `isLength` fallbacks, and `isFloat`'s locale downgrade |
| `option-passthrough.spec.ts` | That each factory's closure reaches the right `validator.*` **argument position**; that type-failure stays distinct from range-failure; and the `assertNumericRange` bound-precedence ladder |
| `cache.spec.ts` | `sideEffect` × `ResultCache` end-to-end — the flag's *effect*, driven through a real `Container` |
| `to-validator-string.spec.ts` | The `toValidatorString` coercion table and its one load-bearing consequence for `equals` |
| `createValidator.spec.ts` | The generic escape hatch's own surface (code / message / data defaults, the `sideEffect` opt-in, and its own value-identity case) |

Three of those exist because a table of defaults cannot see certain classes of defect:

- **`option-passthrough.spec.ts` — every row is a PAIR.** `issue-shape.spec.ts` calls each factory with DEFAULT options, so an option silently dropped on the floor still produces the documented triple. Each row therefore judges the same input with and without the option and asserts they *disagree*; a dropped option collapses the pair and fails. Where validator.js takes a positional argument (`isUUID(s, version)`), a separate test pins the accept direction too — a mis-wire that passes the whole options bag rejects everything, which a fail-expecting row cannot distinguish. Two rows are knowingly non-discriminating and say so in place: `isIP` (validator 13 accepts both `isIP(s, 6)` and `isIP(s, { version: 6 })`) and the `matches` RegExp overload (validator only rebuilds the pattern when it is *not* a RegExp, so a stray third `modifiers` argument is ignored outright).

- **An ordering test needs inputs that violate BOTH branches.** This is the single easiest way to write a spec that looks protective and is not, and it bit twice here. `isInt`'s and `isFloat`'s "type failure beats range failure" tests originally used `'abc'` / `'not-a-number'` — but `Number('abc')` is `NaN`, and *every* comparison in `assertNumericRange` against `NaN` is false, so the range branch was never live and the ordering was unprotected: hoisting `assertNumericRange` above the type gate left the whole suite green. The fix is inputs where both gates genuinely fire — `isInt({ min: 100 })` on `'5.5'` / `'1e3'` / `' 12 '`, `isFloat({ min: 100 })` on `' 12 '` (`validator.isFloat(' 12 ')` is false while `Number(' 12 ')` is 12). Same trap inside `assertNumericRange` itself: `min`/`gt` share `MIN_VALUE` and `max`/`lt` share `MAX_VALUE`, so a swap within a pair is invisible in `code` and only changes which bound lands in `data` — i.e. the number an i18n template renders. All four competing pairs are now pinned on `data`, not just on `code`.
- **`cache.spec.ts` asserts the flag's effect, not its value.** `equals(key)` without `expectedValue` is the only place in the package where `sideEffect` is load-bearing, and a boolean assertion proves nothing about the runtime. The suite runs two `safeRun`s sharing one `ResultCache` where only the SIBLING changes — the snapshot `(value, context, group)` stays byte-identical — and includes a **counterfactual**: the same closure re-wrapped without the flag, which goes stale. If the cache ever stopped engaging, the counterfactual fails and exposes the main test as vacuous. Keep it.
- **Spies must preserve `sideEffect`.** `Container.mount` reads the flag off the descriptor at mount time, so an invocation-counting wrapper has to copy it or it changes the behaviour under test.
- **`.toBeUndefined()` cannot see an own-property regression.** A refactor that writes `sideEffect: options.sideEffect` unconditionally gives every non-declaring factory a `sideEffect` key valued `undefined` where it had none. `descriptor.sideEffect` still reads `undefined`, so every value assertion passes — but `Object.keys(isEmail())` goes from `['run']` to `['sideEffect','run']`, breaking `toStrictEqual` and any consumer using `hasOwnProperty` to detect an *explicit* declaration. This happened once during the `008` pass and no existing test saw it. `issue-shape.spec.ts` now pins `Object.hasOwn` / `Object.keys` across all 18 non-declaring factories, plus `equals` in both polarities. **When a value's absence is meaningful, assert `Object.hasOwn` / `Object.keys`, not the read-back.** (`createValidator` is the deliberate exception — it always writes the key, and its spec says so.)

- **A string fixture cannot prove a factory returned `ctx.value` rather than the coerced probe.** Every factory opens its `run` with `const s = toValidatorString(ctx.value)` and closes it with `return ctx.value` — 19 hand-written sites across the four factory modules, plus a twentieth in `createValidator`. For a **string** input the two are the same value, so all 17 `returns ctx.value untouched on success` rows in the contract table are blind to `return s`: mutating all 19 sites left 199 of 200 tests green, the lone survivor being `isInt`'s numeric fixture in `factories.spec.ts`. The defect is a silent retype of validated output (`output.age` becomes `'42'` instead of `42`) that flows straight into an API response body. `issue-shape.spec.ts` now carries a second table feeding each site a passing value that is **not** its own stringification — a natural non-string where the vocabulary admits one (`123` for `isNumeric` / `isAlphanumeric` / `matches`, `1.5` for `isDecimal` / `isFloat`, `true` for `isAlpha`, `12345` for `isLength`, `42` for `isInt` / `equals`), and an object whose `toString()` returns a well-formed one for the ten string-format factories, which accept nothing else. A companion `it()` pins `typeof row.passing !== 'string'` so a future "simplification" back to a string fails loudly instead of silently going vacuous. **When a function's contract is "returns the input, not a derived value", the fixture must be a value that differs from its own derivation.**

- **`message` resolution is NOT uniform across the factories, and a doc claim that it is was shipped and retracted.** Fourteen factories hoist `const message = options.message ?? …` into the factory body, so the override is frozen when the descriptor is built: the ten in `string-format.ts` plus `isAlpha` / `isAlphanumeric` / `isNumeric` / `isDecimal`. Five read `options.message` **inside `run`**, so mutating the options bag after construction IS observed: `matches`, `equals`, `isLength`, `isInt`, `isFloat`. (`createValidator` hoists, like the fourteen.) `issue-shape.spec.ts` pins both halves per factory so unifying them is a deliberate change; nothing user-facing promises either, because promising the wrong one is exactly what happened. Note the trap in writing such a test: a row that spreads the bag (`isLength({ ...bag, min: 5 })`) severs the reference and passes in **both** directions — every row must hand the factory the same object it later mutates.

### One inert branch in validator-js — and one that was wrongly called dead

- `type-assertions.ts` — `isFloat`'s **`Number.isNaN(numeric)` guard** before the range ladder is behaviourally inert (every ladder comparison against `NaN` is already false). Mutation-verified: deleting it leaves the whole suite green. It is documentation-in-code for the locale contract; do not "fix" its coverage.

- `type-assertions.ts` — `isInt`'s **defensive final `validator.isInt(s, options)` re-check** was previously documented here as "KNOWN DEAD against validator 13.15.x, verified by an exhaustive 294,912-combination probe … reaching it needs a type-violating `as any`". **That was wrong, and is corrected.** `isInt({ min: Number.NaN })` is fully type-legal — `NaN` has type `number`, so it compiles clean under `--strict` with no cast — and it reaches the throw: the ladder cannot classify a NaN bound (every comparison against `NaN` is false) while validator.js's own `str >= options.min` is false too. Same for `max` / `lt` / `gt`, and `Infinity` behaves comparably. The branch is now covered by `factories.spec.ts` → "the defensive re-check catches bounds the ladder cannot express", so it is no longer the package's one uncovered line.

  The retracted probe was also internally inconsistent: its stated parameters (`8^4` bound combinations × 3 `allow_leading_zeroes` × 23 values) multiply to 282,624, not the 294,912 it claimed — that figure needs 24 values. **The lesson generalises: a comment asserting an exhaustive-search result is a load-bearing claim.** If the search space omits the interesting inputs (here: non-finite bounds), "zero reached" measures the probe, not the code. State the enumerated domain precisely enough that a reader can spot what it excluded, and prefer a spec that exercises the branch over a comment asserting nothing can.

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
