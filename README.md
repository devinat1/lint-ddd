# lint-ddd

Lint rules for a TypeScript ports-and-adapters codebase.

Use Node 22.18 or newer:

```sh
npm ci
npm run check
```

- `npm run lint` checks all authored JavaScript and TypeScript, including lint tooling.
- `npm run lint:verify` proves allowed and forbidden imports using the actual root ESLint configuration.
- `npm run typecheck` checks TypeScript, including the custom lint rules.
- `npm run lint:fix` applies formatting and other safe ESLint fixes.

## Install in another repo

Install this package, then choose rules:

```sh
npm install --save-dev lint-ddd
npx lint-ddd init --full
```

`--full` enables every group. A partial install names groups, plus rules to force on or off:

```sh
npx lint-ddd init --only boundaries,policy-conventions --on policy/validated-input --off policy/boolean-prefix
```

With a terminal and no selection flags, `init` shows one group tree. If `lint-ddd.config.json` already exists, active rules start checked, and `codely` starts checked when that group is selected. A new install starts with every box empty. Up and Down move between groups and the rules of the open group. Right opens a group and Left closes it. Only one group stays open. Space on a group turns every rule in it on or off. Space on a rule turns that rule on or off. Enter confirms and replaces the granted set. A group with any rule on is saved in `groups`, and the rules left off are saved in `off`. A rule that was only listed in `on` stays active, and its unchecked siblings are saved in `off`. `codely` has no listed rules, so Space toggles that group. Without a terminal, pass `--full` or `--only`. `off` wins when a rule is also enabled by its group.

`init` writes `lint-ddd.config.json`, an `eslint.config.mjs` that calls `defineConfig()`, and the lint devDependencies in `package.json`. Running it again replaces that selection and rewrites those same files. It does not run `npm install`. It stops if `package.json` is missing, or if `eslint.config.mjs` exists and is not already the generated file. An existing `file:` or `link:` version of `lint-ddd` is left in place. Strict type rules read `tsconfig.eslint.json`.

Add or remove a group or rule later. Group changes keep rule exceptions:

```sh
npx lint-ddd enable presentation
npx lint-ddd disable policy/static-tailwind
```

The groups are `codely`, `boundaries`, `strict-types`, `code-style`, `policy-conventions`, `validation`, and `presentation`. Layer folders stay `src/domain`, `src/ports`, `src/application`, `src/adapters/primary/*`, `src/adapters/secondary/*`, `src/composition`, `src/presentation`, `tests`, and `tooling`.

## Walkthrough

1. `eslint.config.mjs` loads `tooling/eslint.config.mjs`.
2. Its `elements` list gives each source folder a role. Its `dependencies` table specifies which roles that folder can import.
3. `eslint-plugin-boundaries` reports forbidden imports. For example, application can import a port but not a concrete secondary adapter; composition can import both.
4. `tooling/tests/architecture.test.mjs` creates temporary, empty typed fixtures, lints snippets against the real configuration, checks the exact rule responsible, and removes the fixture files.

See [the lint policy](docs/lint-policy.md) for scope and limits.
