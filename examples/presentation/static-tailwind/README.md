# static-tailwind

Rule id: `policy/static-tailwind`

Group: presentation

Applies to: `**/*.{tsx,jsx}` className attributes

`margin.bad.tsx` puts `m-2` on the child. Margins include responsive and negative margins. `margin.good.tsx` puts `gap-2` on the parent.

`spacing.bad.tsx` uses `p-1`. Spacing increments are even numbers. `spacing.good.tsx` uses `p-2`. `gap` and padding are checked the same way.

`redundant.bad.tsx` writes `p-2 sm:p-2`. The later breakpoint repeats the same utility with no override between them. `redundant.good.tsx` keeps `p-2`.

Literal class strings that match these cases can also be reported by `no-restricted-syntax` when the presentation group is on. This rule still checks class strings that are built from pieces.
