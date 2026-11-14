# no-unknown-files

Rule id: `boundaries/no-unknown-files`

Group: boundaries

Applies to: source files that are not in a classified layer

`bad.ts` is `src/scripts/migrate.ts`. That folder is not a layer, so the file itself is the violation.

`good.ts` is `src/domain/order.ts`. Domain is a classified layer.

The classified layers are `src/domain`, `src/ports`, `src/application`, `src/adapters/primary/*`, `src/adapters/secondary/*`, `src/composition`, `src/presentation`, `tests`, and `tooling`.
