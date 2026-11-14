# no-param-reassign

Rule id: `no-param-reassign`

Group: policy-conventions

Applies to: `{src,tests,tooling}/**/*.{ts,tsx}`

The option is `{ props: false }`. `bad.ts` assigns a new value to the parameter `count`.

`good.ts` returns `count + 1` and leaves the parameter binding alone. Assigning to a property of a parameter is `policy/parameter-mutation`, not this rule.
