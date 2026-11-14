# parameter-mutation

Rule id: `policy/parameter-mutation`

Group: policy-conventions

Applies to: `{src,tests,tooling}/**/*.{ts,tsx}`

`bad.ts` assigns `value.count` on a parameter. Known native mutators on parameter data, such as `array.push` or `date.setDate`, are also rejected.

`good.ts` returns a new object. Copy the data before a native mutator.
