# policy/bounded-loop

Rule id: `policy/bounded-loop`

Group: nasa

Applies to: `while` and `do`. `for` stays banned by `no-restricted-syntax`.

`bad.ts` loops while a flag is true.

`good.ts` compares `count` with the literal `10` and updates `count` in the body. A `const` initialized with a numeric literal is also a legal bound. Array methods stay; their bound is the receiver's length.
