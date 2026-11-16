import type { TSESTree } from "@typescript-eslint/utils";
import { ESLintUtils } from "@typescript-eslint/utils";

const createRule = ESLintUtils.RuleCreator(() => "docs/lint-policy.md");
const breakpoints = ["", "sm", "md", "lg", "xl", "2xl"];

const readClasses = (node: TSESTree.Node | null): string[] => {
  if (node === null) {
    return [];
  }
  if (node.type === "Literal" && ["string", "number", "boolean"].includes(typeof node.value)) {
    return [String(node.value)];
  }
  if (node.type === "JSXExpressionContainer") {
    return readClasses(node.expression);
  }
  if (node.type === "ConditionalExpression") {
    return [...readClasses(node.consequent), ...readClasses(node.alternate)];
  }
  if (node.type === "TemplateLiteral") {
    return node.expressions.reduce<string[]>(
      (parts, expression, index) =>
        parts.flatMap((part) =>
          readClasses(expression).map((value) => part + value + (node.quasis[index + 1]?.value.cooked ?? "")),
        ),
      [node.quasis[0]?.value.cooked ?? ""],
    );
  }
  if (node.type === "BinaryExpression" && node.operator === "+") {
    return readClasses(node.left).flatMap((left) => readClasses(node.right).map((right) => left + right));
  }

  return [];
};

const effectsFor = (utility: string): string[] => {
  const spacing = /^(p|m)([trblxyse]?)-/.exec(utility);
  if (spacing) {
    const directions: Partial<Record<string, string[]>> = {
      "": ["t", "r", "b", "l", "s", "e"],
      x: ["r", "l", "s", "e"],
      y: ["t", "b"],
      t: ["t"],
      r: ["r"],
      b: ["b"],
      l: ["l"],
      s: ["s", "r", "l"],
      e: ["e", "r", "l"],
    };

    return (directions[spacing.at(2) ?? ""] ?? []).map((direction) => `${spacing.at(1) ?? ""}-${direction}`);
  }
  if (/^gap-/.test(utility)) {
    return utility.startsWith("gap-x-") ? ["gap-x"] : utility.startsWith("gap-y-") ? ["gap-y"] : ["gap-x", "gap-y"];
  }
  if (
    [
      "block",
      "inline",
      "inline-block",
      "flex",
      "inline-flex",
      "grid",
      "inline-grid",
      "hidden",
      "contents",
      "flow-root",
      "table",
      "inline-table",
      "table-row",
      "table-cell",
      "table-caption",
      "table-row-group",
      "table-column",
      "table-column-group",
      "table-header-group",
      "table-footer-group",
      "list-item",
    ].includes(utility)
  ) {
    return ["display"];
  }
  if (utility.startsWith("size-")) {
    return ["w", "h"];
  }
  if (utility === "container") {
    return ["w", "max-w"];
  }
  if (/^flex-(row|col)(-reverse)?$/.test(utility)) {
    return ["flex-direction"];
  }
  if (/^flex-/.test(utility)) {
    return ["flex-grow", "flex-shrink", "flex-basis"];
  }
  // Unknown utilities may overlap supported effects; they disable redundancy proofs.
  const prefix = /^(w|min-w|max-w|h|min-h|max-h|grid-cols|items|justify)-/.exec(utility)?.[1];

  return prefix !== undefined ? [prefix] : [];
};

export const presentationRules = {
  "static-tailwind": createRule({
    name: "static-tailwind",
    meta: {
      docs: { description: "Enforce the documented authored-code convention." },
      type: "suggestion",
      schema: [],
      messages: {
        margin: "Use parent gap or padding instead of margins, including responsive and negative margins.",
        spacing: "Use even-numbered Tailwind spacing increments.",
        redundant:
          "Remove a provably redundant default-breakpoint class with the same static utility and no intervening overlapping override.",
      },
    },
    defaultOptions: [],
    create(context) {
      return {
        JSXAttribute(node) {
          if (node.name.type !== "JSXIdentifier" || node.name.name !== "className") {
            return;
          }
          readClasses(node.value).forEach((classes) => {
            const tokens = classes.trim().split(/\s+/);
            tokens.forEach((token) => {
              const utility = token.split(":").at(-1)?.replace(/^!|!$/g, "") ?? "";
              if (/^-?m[trblxyse]?-/.test(utility)) {
                context.report({ node, messageId: "margin" });
              }
              const value = /^-?(?:gap(?:-[xy])?|[mp][trblxyse]?)-(\d+(?:\.\d+)?)$/.exec(utility)?.[1];
              if (value !== undefined && Number(value) % 2 !== 0) {
                context.report({ node, messageId: "spacing" });
              }
            });
            const responsive = tokens
              .map((token) => {
                const parts = token.split(":");
                const breakpoint = parts.length === 1 ? "" : parts.length === 2 ? (parts[0] ?? "") : "unsupported";

                return { token, utility: parts.at(-1) ?? "", rank: breakpoints.indexOf(breakpoint) };
              })
              .filter((entry) => entry.rank >= 0)
              .sort((left, right) => left.rank - right.rank);
            if (
              responsive.length !== tokens.length ||
              tokens.some((token) => token.includes("[") || token.includes("!")) ||
              responsive.some((entry) => effectsFor(entry.utility).length === 0)
            ) {
              return;
            }
            responsive.forEach((entry, index) => {
              if (entry.rank === 0 || entry.utility.includes("[") || entry.utility.includes("!")) {
                return;
              }
              const effects = effectsFor(entry.utility);
              if (effects.length === 0) {
                return;
              }
              const previous = responsive
                .slice(0, index)
                .filter(
                  (candidate) =>
                    candidate.rank < entry.rank &&
                    effectsFor(candidate.utility).some((effect) => effects.includes(effect)),
                );
              const latest = previous.at(-1);
              if (
                latest?.utility === entry.utility &&
                !previous.some((candidate) => candidate.rank === latest.rank && candidate.utility !== latest.utility) &&
                !responsive.some(
                  (candidate) =>
                    candidate.rank === entry.rank &&
                    candidate !== entry &&
                    effectsFor(candidate.utility).some((effect) => effects.includes(effect)),
                )
              ) {
                context.report({ node, messageId: "redundant" });
              }
            });
          });
        },
      };
    },
  }),
  "used-react-props": createRule({
    name: "used-react-props",
    meta: {
      docs: { description: "Enforce the documented authored-code convention." },
      type: "suggestion",
      schema: [],
      messages: { unused: "Remove the unused authored React prop field {{name}} or read it in the component." },
    },
    defaultOptions: [],
    create(context) {
      const services = ESLintUtils.getParserServices(context);
      const checker = services.program.getTypeChecker();
      const readComponentName = (
        node: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression,
      ) => {
        if (node.type === "FunctionDeclaration") {
          return node.id?.name ?? null;
        }

        return node.parent.type === "VariableDeclarator" && node.parent.id.type === "Identifier"
          ? node.parent.id.name
          : null;
      };

      return {
        "FunctionDeclaration, FunctionExpression, ArrowFunctionExpression"(
          node: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression,
        ) {
          const name = readComponentName(node);
          if (name === null || !/^[A-Z]/.test(name) || node.params.length !== 1) {
            return;
          }
          const parameter = node.params.at(0);
          if (!parameter) {
            return;
          }
          const type = checker.getTypeAtLocation(services.esTreeNodeToTSNodeMap.get(parameter));
          const fields = type
            .getProperties()
            .filter(
              (field) =>
                field.declarations?.some((declaration) =>
                  /\/src\/presentation\//.test(declaration.getSourceFile().fileName),
                ) === true,
            );
          if (parameter.type === "ObjectPattern") {
            if (parameter.properties.some((property) => property.type === "RestElement")) {
              return;
            }
            const used = parameter.properties.flatMap((property) =>
              property.type === "Property" && property.key.type === "Identifier" ? [property.key.name] : [],
            );
            fields
              .filter((field) => !used.includes(field.name))
              .forEach((field) => {
                context.report({ node: parameter, messageId: "unused", data: { name: field.name } });
              });
          } else if (parameter.type === "Identifier") {
            const variable = context.sourceCode
              .getDeclaredVariables(node)
              .find((binding) => binding.name === parameter.name);
            const references = variable?.references.filter((reference) => reference.isRead()) ?? [];
            // Escaping/spreading the whole props object makes individual reads unprovable.
            if (
              references.some(
                (reference) =>
                  reference.identifier.parent.type !== "MemberExpression" || reference.identifier.parent.computed,
              )
            ) {
              return;
            }
            const used = references.flatMap((reference) =>
              reference.identifier.parent.type === "MemberExpression" &&
              reference.identifier.parent.property.type === "Identifier"
                ? [reference.identifier.parent.property.name]
                : [],
            );
            fields
              .filter((field) => !used.includes(field.name))
              .forEach((field) => {
                context.report({ node: parameter, messageId: "unused", data: { name: field.name } });
              });
          }
        },
      };
    },
  }),
};
