# Dice game: ports and adapters

Step 1 installs and verifies lint rules. No game logic or webpage exists yet.

Use Node 22.18 or newer:

```sh
npm ci
npm run check
```

- `npm run lint` checks all authored JavaScript and TypeScript, including lint tooling.
- `npm run lint:verify` proves allowed and forbidden imports using the actual root ESLint configuration.
- `npm run typecheck` checks TypeScript, including the custom lint rules.
- `npm run lint:fix` applies formatting and other safe ESLint fixes.

## Walkthrough

1. `eslint.config.mjs` loads `tooling/eslint.config.mjs`.
2. Its `elements` list gives each source folder a role. Its `dependencies` table specifies which roles that folder can import.
3. `eslint-plugin-boundaries` reports forbidden imports. For example, application can import a port but not a concrete secondary adapter; composition can import both.
4. `tooling/tests/architecture.test.mjs` creates temporary, empty typed fixtures, lints snippets against the real configuration, checks the exact rule responsible, and removes the fixture files. These are policy tests, not game code.

See [the lint policy](docs/lint-policy.md) for scope and limits. After this walkthrough, the next piece is the domain rule: a six wins.
