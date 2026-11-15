# readonly-model

Rule id: `policy/readonly-model`

Group: policy-conventions

Applies to: `src/{domain,ports}/**/*.ts`, except test files

Domain and port data does not change in place. Property signatures, index signatures, mapped types, class fields, and constructor parameter properties are `readonly`. Arrays and tuples are `readonly`, including `readonly string[]` and `readonly [string, number]`. A mutable `Array<string>` is the same rule.

`property.bad.ts` leaves `id` writable.

`property.good.ts` marks `id` readonly.

`array.bad.ts` types `ids` as `string[]`. The property itself is already readonly.

`array.good.ts` types `ids` as `readonly string[]`.

`tuple.bad.ts` annotates a mutable pair.

`tuple.good.ts` annotates a readonly pair.

`mapped.bad.ts` maps keys to writable properties.

`mapped.good.ts` maps keys to readonly properties.
