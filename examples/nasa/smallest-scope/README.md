# policy/smallest-scope

Rule id: `policy/smallest-scope`

Group: nasa

Applies to: `const` and `let` whose references all sit in one nested block.

`bad.ts` declares `value` outside the block that uses it.

`good.ts` declares `value` in that block. Exports, catch bindings, and a name already declared in the block are left alone.
