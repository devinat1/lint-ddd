# Rule examples

These folders show the rules in `tooling/catalog.ts`. Each group is a directory. Each named rule is a subfolder with an explainer, a snippet that breaks the rule, and a snippet that satisfies it.

`codely` has no rule ids of its own. Its folder shows the preset baseline.

This repository ignores `examples/**` in its own ESLint config. The snippets are for reading. A boundary or layer rule reports only when the file sits on the path in the first comment.

- [codely](codely/README.md) — Prettier, sorted imports, unused imports, and baseline TypeScript checks
- [boundaries](boundaries) — which layers may import which other layers
- [strict-types](strict-types) — strict TypeScript checks and Prettier formatting
- [code-style](code-style) — complexity, nesting, function length, and cycles
- [policy-conventions](policy-conventions) — names, parameters, immutability, and test files
- [validation](validation) — Zod for JSON input, named messages, and magic numbers
- [presentation](presentation) — JSX structure, Tailwind spacing, and React props
