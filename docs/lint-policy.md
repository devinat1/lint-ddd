# Lint policy

## Source and scope

This exercise reuses Codely's 4.5 baseline and the general, strict TypeScript, convention, validation and presentation rules from `api-webagent-extraction/tooling/`. Those rules are also used in the accountability project. The copied rule implementations live locally: running lint does not depend on either reference repository.

Architecture uses `eslint-plugin-boundaries` 7, as accountability does, with a dependency table adapted to this smaller project. It is not a byte-for-byte copy of either entire repository policy.

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
- Explicit empty-array comparisons, immutable array transformations and no mutation of function parameters.
- Source messages/errors use named constants. Source numeric values use explanatory constants. JSON input must pass through a concrete Zod schema; importing Zod is allowed but it has not been installed for this step.
- Annotated `@nullable` optional domain/port fields explicitly include null.
- JSX uses div/span for layout/prose, native accessible controls, ternaries, no inline styles, no margins, even Tailwind spacing and no provably redundant breakpoints. Tailwind is not installed yet.
- TODOs use `TODO(cleanup):` with a reason; literal log messages end with periods.
- TypeScript uses two-space indentation, JavaScript uses the Codely tab convention.

## Verification

`npm run check` runs policy regression tests, lint over all authored code, then TypeScript checking (including custom rules).

The policy tests create temporary typed fixtures in the real layer paths, invoke the actual root ESLint configuration, and remove their files afterward. The tests reject parser failures and check exact rule IDs so a parse error or unresolved import cannot masquerade as a successful boundary check. Tests cover domain/application/port separation, composition wiring, both adapter roles, independent adapter isolation, presentation dependencies, type-only and dynamic dependencies, core external imports, unknown files, general conventions, JSX rules, product test filenames, error-message classification, and colocated test imports.

## Limits and deliberate omissions

- Dependency checks are not a runtime sandbox. They do not prove that a function implements its port (TypeScript checks assignments) or that a module contains the right business logic.
- Import checks alone do not forbid ambient globals such as `Math.random`, `Date`, `document` or `fetch` in the core; keeping those behind ports also requires review.
- We have not selected or installed the webpage framework. Next-specific lint rules and browser/server boundaries must be added with that piece if Next is selected; a browser-only game has a different runtime boundary.
- No Prisma, deployment, shared-contract package, blog/wiki ownership or repository-specific filesystem allowlist is copied. The ReadyMeet `insufficient_credits` selector is one of those shared-contract rules and is not copied. Unknown source files are checked by ESLint, but empty directories and symlinks are not policed by a separate folder checker.
- Next route-signature exceptions and `Response.json` / `NextResponse.json` carve-outs are not copied. Proxy Node built-in allowlists and package-captured element patterns are not copied. Tailwind checks stay enabled.
- Static Tailwind and JSON validation analysis retains the conservative proof limits of the reference implementations.

## Dependency security

At setup, `npm audit` reports six high-severity development dependency findings propagated from the braces/micromatch chain through Codely/check-file and boundaries. The braces advisory includes the currently installed latest 3.0.3. Suggested automated fixes downgrade the shared presets/plugins to incompatible older major versions; no force downgrade was applied. These are lint-tool dependencies, not deployed game dependencies. Passing lint does not mean the dependency graph is audit-clean.
