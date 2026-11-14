# boolean-prefix

Rule id: `policy/boolean-prefix`

Group: policy-conventions

Applies to: `{src,tests,tooling}/**/*.{ts,tsx}`

`bad.ts` names a boolean `won`. A boolean binding needs `is`, `has`, `can`, or `should`, followed by a capital letter.

`good.ts` names the same flag `hasWon`.
