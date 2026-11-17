# policy/single-dereference

Rule id: `policy/single-dereference`

Group: nasa

Applies to: member reads.

`bad.ts` reads `box.inner.value`.

`good.ts` stores `box.inner` in a local, then reads `value`.
