# Lint policy

## Source and scope

These rules check a TypeScript codebase laid out as ports and adapters. Codely 4.5 is the baseline. Architecture uses `eslint-plugin-boundaries` 7. The dependency table below is the policy an adopting codebase is checked against.

The checked layers are:

| Caller | Allowed local dependencies |
| --- | --- |
| Domain | Domain |
| Ports | Domain, ports |
| Application | Domain, ports, application |
| Primary adapters | Domain, ports, application, composition; files within the same adapter |
| Secondary adapters | Domain, ports; files within the same adapter |
| Composition | Domain, ports, application, primary/secondary adapters, composition |
| Presentation | Domain, presentation, composition |
| Tests and tooling | All layers and required external modules |

Adapter directories belong under `src/adapters/primary/<adapter>/` or `src/adapters/secondary/<adapter>/`. Different adapters cannot import one another. Files in the same adapter may import one another. Source files outside the classified layers are errors. Dependencies on unclassified or ignored source are errors. Composition may select implementations; application cannot import them directly.

Product code cannot import a test or tooling file. A colocated `*.test.ts` inside a role folder is a test file, so a domain module cannot import it. Tests and tooling may still import production code.

External dependencies default to denied, except the configured role-specific lists: pure layers permit Zod; primary adapters permit Zod and Node HTTP; secondary adapters permit Zod and Node crypto; composition permits Zod; presentation permits explicitly listed React/Next entry points. An allowed package is not necessarily installed yet. We have installed lint dependencies only, not a web framework.

## Shared conventions

- `const`, no `var`/`let`, no `for`/`for-in`/`for-of`, no non-null assertions, literal dependency specifiers, explicit caught failures, async/await instead of promise chains.
- Classify errors with an error class or code. Do not compare or search `error.message`, `err.message`, or `cause.message`.
- Product tests under `src` and `tests` are `*.test.ts` files. `*.spec.*`, `*.test.js`, and `*.test.tsx` are rejected. `tooling/tests/*.test.mjs` stays JavaScript because those tests exercise the ESLint config.
- Complexity at most 15, nesting at most 4, functions at most 100 nonblank/noncomment lines; import cycles, unused bindings and unsorted imports are errors.
- Strict type-aware safety includes unsafe assignments/calls/arguments/returns/assertions, strict boolean conditions, type-only imports/exports, and array syntax.
- TypeScript booleans use `is`/`has`/`can`/`should` prefixes. Authored multiargument functions use a named parameter object, with the reference exceptions for externally dictated signatures.
- Ambient effects stay in the layer that owns them. Domain, ports, and application cannot use `Date`, `Math.random`, `crypto`, `fetch`, timers, `process`, `console`, `Buffer`, `__dirname`, `Intl`, dynamic `import()`, `require()`, or side-effect imports. `Date` is read only in a secondary adapter and passed inward as a number. Randomness and the network stay in secondary adapters. Timers and `Buffer` stay in adapters. `process` is read in composition. `console` stays in secondary adapters and composition. Dynamic loads stay in adapters, composition, and presentation. `Intl` stays outside the core. `eval`, `Function`, and browser globals such as `document`, `window`, and `localStorage` are unavailable under `src/`.
- The domain is synchronous: no `async`, `await`, generators, or `Promise`. Ports may return `Promise`. Application may await them.
- A port file holds types, interfaces, and values such as Zod schemas. A function there is allowed only as a call argument, so a schema refinement can sit next to the contract.
- An application file exports at most one function, and that function takes one object parameter. Helpers stay unexported.
- Domain, ports, and application name their own exports. They do not use `export default`, `export *`, or `export { ... } from`.
- A class in domain or application extends `Error` or a name ending in `Error`. Ports declare no classes. The core does not construct built-in errors such as `Error` or `TypeError`. Enums and namespaces are string unions.
- Domain and port property signatures, index signatures, mapped types, class fields, parameter properties, arrays, and tuples are readonly.
- Explicit empty-array comparisons, immutable array transformations and no mutation of function parameters.
- Source messages/errors use named constants. Source numeric values use explanatory constants. JSON input must pass through a concrete Zod schema; importing Zod is allowed but it has not been installed for this step.
- Annotated `@nullable` optional domain/port fields explicitly include null.
- JSX uses div/span for layout/prose, native accessible controls, ternaries, no inline styles, no margins, even Tailwind spacing and no provably redundant breakpoints. Tailwind is not installed yet.
- TODOs use `TODO(cleanup):` with a reason; literal log messages end with periods.
- TypeScript uses two-space indentation, JavaScript uses the Codely tab convention.

## Verification

`npm run check` runs policy regression tests, lint over all authored code, then TypeScript checking (including custom rules).

The policy tests create temporary typed fixtures in the real layer paths, invoke the actual root ESLint configuration, and remove their files afterward. The tests reject parser failures and check exact rule IDs so a parse error or unresolved import cannot masquerade as a successful boundary check. Tests cover domain/application/port separation, composition wiring, both adapter roles, independent adapter isolation, presentation dependencies, type-only and dynamic dependencies, core external imports, unknown files, general conventions, JSX rules, product test filenames, error-message classification, colocated test imports, ambient effects by layer, a synchronous domain, port contracts, use-case shape, direct core exports, domain error classes, and readonly domain models.

## Limits and deliberate omissions

- Dependency checks are not a runtime sandbox. They do not prove that a function implements its port (TypeScript checks assignments) or that a module contains the right business logic.
- Ambient-effect checks do not see a clock, random source, or other effect captured in a callback that was created in an allowed layer and passed into the core.
- A webpage framework is not part of this policy. Next-specific lint rules and browser/server component boundaries are omitted. `policy/ambient-effects` rejects browser globals under `src/`.
- No Prisma, deployment, shared-contract package, blog/wiki ownership or repository-specific filesystem allowlist is copied. The ReadyMeet `insufficient_credits` selector is one of those shared-contract rules and is not copied. Unknown source files are checked by ESLint, but empty directories and symlinks are not policed by a separate folder checker.
- Next route-signature exceptions and `Response.json` / `NextResponse.json` carve-outs are not copied. Proxy Node built-in allowlists and package-captured element patterns are not copied. Tailwind checks stay enabled.
- Static Tailwind and JSON validation analysis retains the conservative proof limits of the reference implementations.

## Dependency security

At setup, `npm audit` reports six high-severity development dependency findings propagated from the braces/micromatch chain through Codely/check-file and boundaries. The braces advisory includes the currently installed latest 3.0.3. Suggested automated fixes downgrade the shared presets/plugins to incompatible older major versions; no force downgrade was applied. These are lint-tool dependencies. Passing lint does not mean the dependency graph is audit-clean.
