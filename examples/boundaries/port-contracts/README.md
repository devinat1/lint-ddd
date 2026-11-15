# port-contracts

Rule id: `policy/port-contracts`

Group: boundaries

Applies to: `src/ports/**/*.ts`, except test files

A port file holds types, interfaces, and values such as Zod schemas and constants. It does not hold functions, classes, enums, or namespaces.

`bad.ts` exports a function. A class, enum, or namespace in a port file is the same rule.

`good.ts` exports a repository type and a schema. The arrow passed to `refine` is a call argument, which is the one function shape a port may contain.
