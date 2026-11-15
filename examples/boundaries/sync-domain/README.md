# sync-domain

Rule id: `policy/sync-domain`

Group: boundaries

Applies to: `src/domain/**/*.ts`, except test files

The domain returns values. It does not wait. Ports may still declare `Promise`, and application may `await` those ports.

`async.bad.ts` is an `async` domain function. `await`, `yield`, and generators are the same rule.

`promise.bad.ts` names `Promise` in a domain type. `new Promise` and `Promise.all` are included.

`good.ts` returns a number. The clock value arrives as an argument.
