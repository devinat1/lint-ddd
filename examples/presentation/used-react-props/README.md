# used-react-props

Rule id: `policy/used-react-props`

Group: presentation

Applies to: `src/presentation/**/*.tsx`

`bad.tsx` is `src/presentation/order-card.tsx`. `OrderCardProps` declares `isOpen`, and the component never reads it. The field type must be declared under `src/presentation`.

`good.tsx` reads `isOpen`. A rest property, or passing the whole props object onward, makes individual reads unprovable, so the rule stays quiet in those cases.
