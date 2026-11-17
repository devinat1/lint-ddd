# policy/checked-return

Rule id: `policy/checked-return`

Group: nasa

Applies to: calls whose return type is not `void`, `undefined`, or `never`, including the value produced by `await`.

`bad.ts` ignores the number returned by `length`.

`good.ts` returns that number. `void length()` does not count as using it.
