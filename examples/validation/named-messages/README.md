# named-messages

Rule id: `policy/named-messages`

Group: validation

Applies to: `src/**/*.{ts,tsx}`

`bad.ts` throws `new Error` with a string literal. The same check covers template text, and object fields named `code`, `error`, `message`, `prompt`, `system`, `instructions`, or `text`, when that object is not a module-level const.

`good.ts` stores the text in `orderNotFound` and throws that constant. A const object at module scope is the home for grouped copy.
