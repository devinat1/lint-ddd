# dependencies

Rule id: `boundaries/dependencies`

Group: boundaries

Applies to: classified source files under `src/`, `tests/`, and `tooling/`

`bad.ts` is `src/domain/order.ts`. Domain may import domain. This file imports `src/application/place-order.ts`.

`good.ts` is the same domain file. It imports `src/domain/money.ts`.

The same rule checks the rest of the table. Application may import a port, not a concrete adapter. A domain file may not import a colocated `*.test.ts`. Tests and tooling may import production code. External packages are denied unless the layer allowlist names them. Domain, ports, application, and composition may import `zod`. Primary adapters may also import `node:http`. Secondary adapters may also import `node:crypto`. Presentation may import the listed React and Next entry points.
