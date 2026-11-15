# ambient-effects

Rule id: `policy/ambient-effects`

Group: boundaries

Applies to: `src/{domain,ports,application,adapters,composition,presentation}/**/*.{ts,tsx}`, except test files

Import boundaries cannot see a global. This rule allows each ambient effect only in the layer that should own it. Domain, ports, and application may use none of them. A global counts only when the name resolves to the real global, so a parameter named `location` or a port call `clock.now()` is fine. `globalThis.fetch` is the same as `fetch`.

`clock.bad.ts` is `src/domain/order.ts`. It calls `Date.now()`. `Date` is also banned as a type. The message is: read Date only in a secondary adapter, and pass time in as a number.

`clock.good.ts` is `src/adapters/secondary/clock/now.ts`. A secondary adapter may read the clock.

`random.bad.ts` calls `Math.random()` in the domain. `crypto.randomUUID()`, `crypto.getRandomValues()`, and `crypto.subtle` are the same effect.

`random.good.ts` draws randomness in a secondary adapter. `Math.abs` and the rest of `Math` stay available everywhere.

`network.bad.ts` calls `fetch` from application. `XMLHttpRequest` and `WebSocket` are the same effect.

`network.good.ts` calls `fetch` from a secondary adapter.

`timer.bad.ts` calls `setTimeout` from presentation. `setInterval`, `setImmediate`, `queueMicrotask`, their `clear*` partners, `requestAnimationFrame`, and `cancelAnimationFrame` are the same effect.

`timer.good.ts` schedules from a primary adapter. Secondary adapters may schedule too.

`process.bad.ts` reads `process.env` from a primary adapter. Any use of `process` is the same effect.

`process.good.ts` reads `process.env` in composition, which is where configuration enters.

`console.bad.ts` logs from the domain.

`console.good.ts` logs from a secondary adapter. Composition may log too.

`buffer.bad.ts` uses `Buffer` in the domain.

`buffer.good.ts` uses `Buffer` in a primary adapter. Secondary adapters may use it too.

`path.bad.ts` uses `__dirname` in the domain. `__filename` is the same effect.

`path.good.ts` uses `__dirname` in composition. Secondary adapters may use it too.

`loading.bad.ts` dynamically imports from the domain. A side-effect import (`import "./setup"`) and `require()` are the same effect.

`loading.good.ts` dynamically imports from a primary adapter. Secondary adapters, composition, and presentation may load dynamically too. A normal named import is not this effect.

`intl.bad.ts` formats with `Intl` in the domain.

`intl.good.ts` formats with `Intl` in presentation. Adapters and composition may use `Intl` too.

`dom.bad.ts` reads `localStorage` in presentation. `document`, `window`, `self`, `sessionStorage`, `navigator`, `location`, `history`, `screen`, `addEventListener`, `removeEventListener`, and `postMessage` are unavailable anywhere under `src/`. `typeof window` is included.

`dom.good.ts` receives the value as a parameter.

`eval.bad.ts` calls `eval` in the domain. `new Function` and any other use of the global `Function` constructor are the same effect. A `Function` type annotation is not.

`eval.good.ts` returns the string it was given.
