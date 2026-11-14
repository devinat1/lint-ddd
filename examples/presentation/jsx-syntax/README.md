# jsx-syntax

Rule id: `no-restricted-syntax`

Group: presentation

Applies to: `**/*.{tsx,jsx}` when the presentation group is on

ESLint reports these selectors as `no-restricted-syntax`. They are added by the presentation group. The code-style folder holds the other selectors for this same rule id.

`semantic.bad.tsx` renders `<h1>`. Layout and prose use `div` or `span`, not `p`, headings, `section`, `article`, `header`, `footer`, `main`, `nav`, or `aside`.

`semantic.good.tsx` renders `<div>`.

`style.bad.tsx` sets the `style` attribute. Use Tailwind classes instead of inline styles.

`style.good.tsx` sets `className`.

`conditional.bad.tsx` uses `&&` inside JSX. Use a ternary for JSX conditionals.

`conditional.good.tsx` uses a ternary.

`margin.bad.tsx` puts a margin utility in a literal `className`. Use parent gap or padding instead of child margins.

`margin.good.tsx` puts `gap-2` on the parent.

`spacing.bad.tsx` uses the odd increment `gap-3` in a literal `className`. Use even-numbered spacing increments.

`spacing.good.tsx` uses `gap-4`.
