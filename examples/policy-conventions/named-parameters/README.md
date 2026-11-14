# named-parameters

Rule id: `policy/named-parameters`

Group: policy-conventions

Applies to: `{src,tests,tooling}/**/*.{ts,tsx}`

`bad.ts` takes `left` and `right` as two positional parameters. An authored function with two or more parameters takes one named object.

`good.ts` takes `{ left, right }`. An inline callback, and a callback whose external type demands another signature, can keep that signature.
