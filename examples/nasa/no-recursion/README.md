# policy/no-recursion

Rule id: `policy/no-recursion`

Group: nasa

Applies to: the linted project.

`bad.ts` calls `walk` from `walk`. A cycle between two named functions in the same file is the same error. A call in another file is not visible to this rule.

`good.ts` calls a different function.
