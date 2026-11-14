# validated-input

Rule id: `policy/validated-input`

Group: validation

Applies to: `src/**/*.{ts,tsx}`

`bad.ts` calls `JSON.parse` and uses the value as data. `Request.json()`, `Response.json()`, and an untyped `.body` are checked the same way.

`good.ts` passes that text through `orderSchema.parse`. The schema must be a concrete Zod schema. `unknown` and `any` schemas do not count. This package does not install Zod. The snippet shows the call the rule looks for.
