# core-errors

Rule id: `policy/core-errors`

Group: boundaries

Applies to: `src/{domain,ports,application}/**/*.ts`, except test files

The core names failures with its own error classes and uses string unions instead of enums or namespaces. A class in domain or application must extend `Error` or a name ending in `Error`. Ports declare no classes. `new Error`, `TypeError`, `RangeError`, `SyntaxError`, `ReferenceError`, `EvalError`, `URIError`, and `AggregateError` are rejected, including calls without `new`.

`class.bad.ts` declares a domain class that is not an error.

`builtin.bad.ts` throws the built-in `Error`.

`enum.bad.ts` declares an enum. A namespace is the same rule.

`port.bad.ts` is `src/ports/order-error.ts`. An error class belongs in the domain, not in a port.

`good.ts` declares `OrderRejected` and constructs that class.
