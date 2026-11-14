# array-emptiness

Rule id: `policy/array-emptiness`

Group: policy-conventions

Applies to: `{src,tests,tooling}/**/*.{ts,tsx}`

`bad.ts` uses `values.length` as a condition. Equivalent numeric checks such as `== 0`, `> 0`, and `< 1` are also rejected.

`good.ts` writes `values.length !== 0` for the non-empty check. `values.length === 0` is the empty check.
