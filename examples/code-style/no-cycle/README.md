# no-cycle

Rule id: `import/no-cycle`

Group: code-style

Applies to: imports between modules

`order.bad.ts` imports `price.bad.ts`, and `price.bad.ts` imports `order.bad.ts`. That is a cycle.

`order.good.ts` imports `price.good.ts`. `price.good.ts` does not import back.
