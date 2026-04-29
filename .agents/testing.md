# Testing

## Runner

- **Jest 30** with **`@swc/jest`** transformer (no Babel, no `ts-jest`).
- Each package has its own `test/jest.config.js` — there is no root-level Jest config. Run from the package directory or via `npm run test` (which delegates to `nx run-many -t test`).
- Tests run under `cross-env NODE_ENV=test`.

## Layout

```
packages/<pkg>/test/
├── jest.config.js
├── unit/
│   └── *.spec.ts        # one spec per concern
└── data/                # shared fixtures (validup core only)
```

Discovery pattern (`testRegex`): `(/unit/.*|(\.|/)(test|spec))\.(ts|js)x?$`. New specs should live under `test/unit/` and end in `.spec.ts`. `dist/` is ignored.

`rootDir` is `../` so source under `src/` is reachable as `../../src` from inside `test/unit/`.

## Coverage Thresholds (validup core)

`packages/validup/test/jest.config.js`:

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

When adding a new container option or mount option, add or extend the matching spec — don't pile new cases into `module.spec.ts`.

## Writing Tests

Specs import directly from the package source, not the built dist:

```ts
import { Container, type Validator } from '../../src';
```

- Use `expect.assertions(n)` when asserting in `catch` blocks (see `module.spec.ts:79`) — the codebase is consistent about this.
- Adapter tests use `supertest` (routup) or instantiate the foreign library inline (zod, express-validator).
- Coverage is collected only from `src/**/*.{ts,tsx,js,jsx}`.
