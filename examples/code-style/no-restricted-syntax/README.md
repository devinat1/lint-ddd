# no-restricted-syntax

Rule id: `no-restricted-syntax`

Group: code-style

Applies to: the linted project. Presentation adds more selectors in `presentation/jsx-syntax`.

This one rule bans several syntax patterns. Each pair below isolates one pattern.

`let.bad.ts` reassigns `total` with `let`. The message is: use const and immutable transformations instead of let.

`let.good.ts` returns `count + 1` and does not reassign a binding.

`var.bad.ts` declares `total` with `var`.

`var.good.ts` declares `total` with `const`.

`for.bad.ts` uses `for...of`. The message is: use array or stream methods instead of loop statements. `for`, `for...in`, and `for...of` are all banned.

`for.good.ts` uses `map`.

`non-null.bad.ts` writes `name!`. The message is: narrow nullable values instead of asserting non-null.

`non-null.good.ts` uses `??` when `name` is null.

`import.bad.ts` calls `import(name)`. The specifier is not a literal, so dependency boundaries cannot see it.

`import.good.ts` calls `import("./order.js")`.

`require.bad.ts` calls `require(name)`. The specifier is not a literal.

`require.good.ts` calls `require("./order.js")`.

`catch.bad.ts` uses `catch` with no binding, then returns a fallback. The message is: inspect caught failures before using a fallback response.

`catch.good.ts` names the caught failure `error` before returning the fallback.

`promise.bad.ts` chains `.then`. `.then` and `.catch` are both banned. The message is: use async/await and try/catch instead of promise chains.

`promise.good.ts` uses `await` inside an `async` function.

`message-compare.bad.ts` compares `error.message` with a string. The message is: classify errors with an error class or code, not by comparing message text.

`message-compare.good.ts` uses `instanceof OrderNotFound`.

`message-search.bad.ts` searches `error.message` with `includes`. The message is: classify errors with an error class or code, not by looking up message text.

`message-search.good.ts` compares `error.code`.
