# comment-and-log

Rule id: `policy/comment-and-log`

Group: policy-conventions

Applies to: comments and log calls in the linted project

`bad.ts` writes `TODO` without the required shape, and `console.info` ends without a period.

`good.ts` writes `TODO(cleanup):` plus the temporary constraint, and the log message ends with a period. The same ending check covers `console`, `logger`, and `log` methods `log`, `info`, `warn`, `error`, `debug`, `trace`, and `fatal`.
