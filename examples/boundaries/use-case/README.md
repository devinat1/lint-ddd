# use-case

Rule id: `policy/use-case`

Group: boundaries

Applies to: `src/application/**/*.ts`, except test files

An application file exports at most one function. That function takes one object parameter, so its ports and input are visible at the signature. Helpers stay unexported. A file that exports only types is fine.

`many.bad.ts` exports two functions.

`parameter.bad.ts` exports one function, but the parameter is a bare `id` instead of an object pattern.

`good.ts` keeps `normalize` private and exports `place` with one object parameter.
