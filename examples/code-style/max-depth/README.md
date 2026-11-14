# max-depth

Rule id: `max-depth`

Group: code-style

Applies to: blocks in the linted project. The limit is 4.

`bad.ts` nests five `if` statements. The inner block is deeper than 4.

`good.ts` returns at each failed check, so the success path stays at depth 1.
