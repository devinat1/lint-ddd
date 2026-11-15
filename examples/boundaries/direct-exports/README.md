# direct-exports

Rule id: `policy/direct-exports`

Group: boundaries

Applies to: `src/{domain,ports,application}/**/*.ts`, except test files

The core names an export in the file that defines it. `export default`, `export *`, and `export { ... } from` are rejected. Composition and adapters may still re-export.

`reexport.bad.ts` re-exports from another module.

`default.bad.ts` uses a default export.

`good.ts` exports a const declared in the same file. `export { value }` is allowed when `value` is local.
