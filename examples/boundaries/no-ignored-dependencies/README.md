# no-ignored-dependencies

Rule id: `boundaries/no-ignored-dependencies`

Group: boundaries

Applies to: imports whose target matches the boundaries ignore list

`bad.ts` is `src/application/place-order.ts`. It imports `dist/order.js`. `dist/**` and `.codegraph/**` are ignored dependencies.

`good.ts` imports `src/domain/order.ts` instead of build output.
