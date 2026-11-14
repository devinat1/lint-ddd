# no-unknown-dependencies

Rule id: `boundaries/no-unknown-dependencies`

Group: boundaries

Applies to: imports from a classified file to a file that is not a classified element

`bad.ts` is `src/application/place-order.ts`. It imports `src/scripts/migrate.ts`. The script file is not a classified element.

`good.ts` imports `src/domain/order.ts`, which is a classified element.
