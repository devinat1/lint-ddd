export const codeRules = {
  complexity: ["error", 15],
  "max-depth": ["error", 4],
  "max-lines-per-function": ["error", { max: 100, skipBlankLines: true, skipComments: true }],
  "import/no-cycle": "error",
  "no-restricted-syntax": [
    "error",
    {
      selector: "VariableDeclaration[kind='let']",
      message: "Use const and immutable transformations instead of let.",
    },
    { selector: "VariableDeclaration[kind='var']", message: "Use const instead of var." },
    {
      selector: "ForStatement, ForInStatement, ForOfStatement",
      message: "Use array or stream methods instead of loop statements.",
    },
    { selector: "TSNonNullExpression", message: "Narrow nullable values instead of asserting non-null." },
    {
      selector: "ImportExpression[source.type!='Literal'], TSImportType[source.type!='Literal']",
      message: "Use a literal import specifier so dependency boundaries can be checked.",
    },
    {
      selector: "CallExpression[callee.name='require'][arguments.0.type!='Literal']",
      message: "Use a literal require specifier so dependency boundaries can be checked.",
    },
    { selector: "CatchClause[param=null]", message: "Inspect caught failures before using a fallback response." },
    {
      selector: "CallExpression[callee.property.name=/^(then|catch)$/]",
      message: "Use async/await and try/catch instead of promise chains.",
    },
    {
      selector:
        "BinaryExpression[operator=/^[!=]==$/][left.property.name='message']:matches([left.object.name=/^(err|cause)$|error$/i], [left.object.property.name=/^(err|cause)$|error$/i]):matches([right.type='Identifier'][right.name!='undefined'], [right.type='MemberExpression'], [right.value=/./])",
      message: "Classify errors with an error class or code, not by comparing message text.",
    },
    {
      selector:
        "CallExpression[callee.property.name='includes'][arguments.0.property.name='message']:matches([arguments.0.object.name=/^(err|cause)$|error$/i], [arguments.0.object.property.name=/^(err|cause)$|error$/i])",
      message: "Classify errors with an error class or code, not by looking up message text.",
    },
  ],
};

export const strictLintConfiguration = [
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: ["./tsconfig.eslint.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/array-type": ["error", { default: "array" }],
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/consistent-type-exports": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-base-to-string": "error",
      "@typescript-eslint/no-deprecated": "error",
      "@typescript-eslint/no-duplicate-type-constituents": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/no-misused-spread": "error",
      "@typescript-eslint/no-redundant-type-constituents": "error",
      "@typescript-eslint/no-unnecessary-type-conversion": "error",
      "@typescript-eslint/no-unnecessary-type-parameters": "error",
      "@typescript-eslint/no-unsafe-type-assertion": "error",
      "@typescript-eslint/return-await": ["error", "in-try-catch"],
      "@typescript-eslint/strict-boolean-expressions": ["error", { allowString: false, allowNumber: false }],
      "@typescript-eslint/unbound-method": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/only-throw-error": "error",
      "@typescript-eslint/restrict-plus-operands": "error",
      "@typescript-eslint/restrict-template-expressions": ["error", { allowAny: false, allowNullish: false }],
      "prettier/prettier": ["error", { printWidth: 120, useTabs: false, tabWidth: 2 }],
    },
  },
];
export const frontendRules = {
  ...codeRules,
  "no-restricted-syntax": [
    "error",
    ...codeRules["no-restricted-syntax"].slice(1),
    {
      selector: "JSXOpeningElement[name.name=/^(p|h[1-6]|section|article|header|footer|main|nav|aside)$/]",
      message: "Use div or span for layout and prose.",
    },
    { selector: "JSXAttribute[name.name='style']", message: "Use Tailwind classes instead of inline styles." },
    {
      selector: "JSXExpressionContainer > LogicalExpression[operator='&&']",
      message: "Use a ternary for JSX conditionals.",
    },
    {
      selector: "JSXAttribute[name.name='className'][value.value=/(?:^|\\s)-?m(?:[trblxyse])?-/]",
      message: "Use parent gap or padding instead of child margins.",
    },
    {
      selector:
        "JSXAttribute[name.name='className'][value.value=/(?:^|\\s)-?(?:gap(?:-[xy])?|[mp](?:[trblxyse])?)-(?:[13579]|[0-9]*[13579])(?:\\s|$)/]",
      message: "Use even-numbered spacing increments.",
    },
  ],
};
