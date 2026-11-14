# immutable-arrays

Rule id: `policy/immutable-arrays`

Group: policy-conventions

Applies to: `{src,tests,tooling}/**/*.{ts,tsx}`

`bad.ts` calls `push` on an existing array. `pop`, `shift`, `unshift`, `splice`, `sort`, `reverse`, `fill`, and `copyWithin` are the other mutators. Assigning to an index is also rejected.

`good.ts` copies the items into a new array. Calling a mutator on a fresh array expression, or on an array just returned by `slice`, `map`, `filter`, `toSorted`, `toReversed`, or `toSpliced`, is allowed.
