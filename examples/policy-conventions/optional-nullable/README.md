# optional-nullable

Rule id: `policy/optional-nullable`

Group: policy-conventions

Applies to: `src/{domain,ports}/**/*.ts`

`bad.ts` is `src/domain/profile.ts`. The optional field is marked `@nullable`, and its type does not include `null`. Omission and explicit null have different meanings.

`good.ts` writes `nickname?: string | null`. A field without `@nullable` is not checked by this rule.
