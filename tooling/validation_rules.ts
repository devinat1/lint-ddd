import type { TSESTree } from "@typescript-eslint/utils";
import { ESLintUtils } from "@typescript-eslint/utils";
import ts from "typescript";

const createRule = ESLintUtils.RuleCreator(() => "docs/lint-policy.md");

const unwrapParent = (node: TSESTree.Node): TSESTree.Node => {
  const parent = node.parent;

  return parent &&
    ["AwaitExpression", "TSAsExpression", "TSSatisfiesExpression", "TSNonNullExpression"].includes(parent.type)
    ? unwrapParent(parent)
    : node;
};

const readMethod = (callee: TSESTree.MemberExpression) =>
  callee.property.type === "Identifier" && !callee.computed
    ? callee.property.name
    : callee.property.type === "Literal"
      ? callee.property.value
      : null;

export const validationRules = {
  "validated-input": createRule({
    name: "validated-input",
    meta: {
      docs: { description: "Enforce the documented authored-code convention." },
      type: "problem",
      schema: [],
      messages: {
        schema:
          "Validate JSON.parse and Request/Response.json data with a concrete Zod schema, directly or through a same-variable parse/safeParse without other raw-data reads. unknown/any schemas do not validate shape.",
      },
    },
    defaultOptions: [],
    create(context) {
      const services = ESLintUtils.getParserServices(context);
      const checker = services.program.getTypeChecker();
      const isValidation = (node: TSESTree.Node) => {
        if (
          node.type !== "CallExpression" ||
          node.callee.type !== "MemberExpression" ||
          node.callee.property.type !== "Identifier" ||
          !["parse", "safeParse", "parseAsync", "safeParseAsync"].includes(node.callee.property.name)
        ) {
          return false;
        }
        const receiverNode = node.callee.object;
        const receiver = checker.getTypeAtLocation(services.esTreeNodeToTSNodeMap.get(receiverNode));
        const output = receiver.getProperty("_output");
        if (
          !output ||
          !receiver.getProperty("_def") ||
          output.declarations?.some((declaration) =>
            declaration.getSourceFile().fileName.includes("/node_modules/zod/"),
          ) !== true
        ) {
          return false;
        }
        const input = receiver.getProperty("_input");
        if (!input) {
          return false;
        }
        const hasConcreteShape = (symbol: ts.Symbol) => {
          const type = checker.getTypeOfSymbolAtLocation(symbol, services.esTreeNodeToTSNodeMap.get(receiverNode));

          return !(type.isUnion() ? type.types : [type]).some(
            (part) => (part.flags & (ts.TypeFlags.Unknown | ts.TypeFlags.Any)) !== 0,
          );
        };

        return hasConcreteShape(input) && hasConcreteShape(output);
      };
      const isValidated = (node: TSESTree.Node) => {
        const value = unwrapParent(node);
        const parent = value.parent;
        if (!parent) {
          return false;
        }
        if (isValidation(parent) && parent.type === "CallExpression" && parent.arguments[0] === value) {
          return true;
        }
        if (parent.type !== "VariableDeclarator" || parent.id.type !== "Identifier") {
          return false;
        }
        const declaration = parent;
        const variable = context.sourceCode.getDeclaredVariables(declaration).at(0);
        const reads = variable?.references.filter((reference) => reference.isRead()) ?? [];

        return (
          reads.length !== 0 &&
          reads.every(
            (reference) =>
              isValidation(reference.identifier.parent) &&
              reference.identifier.parent.type === "CallExpression" &&
              reference.identifier.parent.arguments[0] === reference.identifier &&
              reference.identifier.range[0] > value.range[1],
          )
        );
      };

      return {
        CallExpression(node) {
          const callee = node.callee;
          if (callee.type !== "MemberExpression") {
            return;
          }
          const isJsonParse =
            callee.object.type === "Identifier" && callee.object.name === "JSON" && readMethod(callee) === "parse";
          const receiver = checker.getTypeAtLocation(services.esTreeNodeToTSNodeMap.get(callee.object));
          const isHttpJson =
            readMethod(callee) === "json" &&
            ["Request", "Response", "NextRequest", "NextResponse"].includes(receiver.getSymbol()?.name ?? "");
          if ((isJsonParse || isHttpJson) && !isValidated(node)) {
            context.report({ node, messageId: "schema" });
          }
        },
        MemberExpression(node) {
          const property =
            node.property.type === "Identifier" && !node.computed
              ? node.property.name
              : node.property.type === "Literal"
                ? node.property.value
                : null;
          if (property !== "body") {
            return;
          }
          const type = checker.getTypeAtLocation(services.esTreeNodeToTSNodeMap.get(node));
          const isUntypedBody = Boolean(type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown));
          if (isUntypedBody && !isValidated(node)) {
            context.report({ node, messageId: "schema" });
          }
        },
      };
    },
  }),
};
