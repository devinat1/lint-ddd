import type { TSESTree } from '@typescript-eslint/utils';
import { ESLintUtils } from '@typescript-eslint/utils';
import ts from 'typescript';

const createRule = ESLintUtils.RuleCreator(() => 'docs/lint-policy.md');

function unwrapParent(node: TSESTree.Node): TSESTree.Node {
  const steps = Array.from({ length: 8 });
  const found = steps.reduce(
    (state: { node: TSESTree.Node; isDone: boolean }) => {
      if (state.isDone) {
        return state;
      }
      const current = state.node;
      const parent = current.parent;
      if (
        parent &&
        ['AwaitExpression', 'TSAsExpression', 'TSSatisfiesExpression', 'TSNonNullExpression'].includes(parent.type)
      ) {
        return { node: parent, isDone: false };
      }

      return { node: current, isDone: true };
    },
    { node, isDone: false },
  );

  return found.node;
}

export const validationRules = {
  'validated-input': createRule({
    name: 'validated-input',
    meta: {
      docs: { description: 'Enforce the documented authored-code convention.' },
      type: 'problem',
      schema: [],
      messages: {
        schema:
          'Validate JSON.parse and Request/Response.json data with a concrete Zod schema, directly or through a same-variable parse/safeParse without other raw-data reads. unknown/any schemas do not validate shape.',
      },
    },
    defaultOptions: [],
    create(context) {
      const services = ESLintUtils.getParserServices(context);
      const program2 = services.program;
      const checker = program2.getTypeChecker();
      const isValidated = (node: TSESTree.Node) => {
        const isValidation = (node: TSESTree.Node) => {
          if (node.type !== 'CallExpression') {
            return false;
          }
          const callee2 = node.callee;
          if (callee2.type !== 'MemberExpression') {
            return false;
          }
          const property6 = callee2.property;
          if (
            property6.type !== 'Identifier' ||
            !['parse', 'safeParse', 'parseAsync', 'safeParseAsync'].includes(property6.name)
          ) {
            return false;
          }
          const receiverNode = callee2.object;
          const esTreeNodeToTSNodeMap2 = services.esTreeNodeToTSNodeMap;
          const receiver = checker.getTypeAtLocation(esTreeNodeToTSNodeMap2.get(receiverNode));
          const output = receiver.getProperty('_output');
          if (!output || !receiver.getProperty('_def')) {
            return false;
          }
          const declarations2 = output.declarations;
          if (
            declarations2?.some((declaration) => {
              const fileName2 = declaration.getSourceFile().fileName;

              return fileName2.includes('/node_modules/zod/');
            }) !== true
          ) {
            return false;
          }
          const input = receiver.getProperty('_input');
          if (!input) {
            return false;
          }
          const hasConcreteShape = (symbol: ts.Symbol) => {
            const esTreeNodeToTSNodeMap3 = services.esTreeNodeToTSNodeMap;
            const type = checker.getTypeOfSymbolAtLocation(symbol, esTreeNodeToTSNodeMap3.get(receiverNode));

            return !(type.isUnion() ? type.types : [type]).some((part) => {
              const typeFlags = ts.TypeFlags;
              const typeFlags2 = ts.TypeFlags;

              return (part.flags & (typeFlags.Unknown | typeFlags2.Any)) !== 0;
            });
          };

          return hasConcreteShape(input) && hasConcreteShape(output);
        };
        const value = unwrapParent(node);
        const parent = value.parent;
        if (!parent) {
          return false;
        }
        if (parent.type === 'CallExpression' && isValidation(parent)) {
          const arguments2 = parent.arguments;
          if (arguments2[0] === value) {
            return true;
          }
        }
        if (parent.type !== 'VariableDeclarator') {
          return false;
        }
        const id2 = parent.id;
        if (id2.type !== 'Identifier') {
          return false;
        }
        const declaration = parent;
        const sourceCode2 = context.sourceCode;
        const variable = sourceCode2.getDeclaredVariables(declaration).at(0);
        const references2 = variable?.references;
        const reads = references2?.filter((reference) => reference.isRead()) ?? [];

        return (
          reads.length !== 0 &&
          reads.every((reference) => {
            const identifier2 = reference.identifier;
            const parent2 = identifier2.parent;
            if (parent2.type !== 'CallExpression' || !isValidation(parent2)) {
              return false;
            }
            const arguments3 = parent2.arguments;
            const range2 = identifier2.range;
            const range3 = value.range;

            return arguments3[0] === identifier2 && range2[0] > range3[1];
          })
        );
      };

      return {
        CallExpression(node) {
          const readMethod = (callee: TSESTree.MemberExpression) => {
            const property2 = callee.property;
            if (property2.type === 'Identifier' && !callee.computed) {
              return property2.name;
            }
            if (property2.type === 'Literal' && typeof property2.value === 'string') {
              return property2.value;
            }

            return null;
          };
          const callee = node.callee;
          if (callee.type !== 'MemberExpression') {
            return;
          }
          const object2 = callee.object;
          const isJsonParse =
            object2.type === 'Identifier' && object2.name === 'JSON' && readMethod(callee) === 'parse';
          const esTreeNodeToTSNodeMap4 = services.esTreeNodeToTSNodeMap;
          const receiver = checker.getTypeAtLocation(esTreeNodeToTSNodeMap4.get(callee.object));
          const isHttpJson =
            readMethod(callee) === 'json' &&
            ['Request', 'Response', 'NextRequest', 'NextResponse'].includes(receiver.getSymbol()?.name ?? '');
          if ((isJsonParse || isHttpJson) && !isValidated(node)) {
            context.report({ node, messageId: 'schema' });
          }
        },
        MemberExpression(node) {
          const property8 = node.property;
          const property =
            property8.type === 'Identifier' && !node.computed
              ? property8.name
              : property8.type === 'Literal' && typeof property8.value === 'string'
                ? property8.value
                : null;
          if (property !== 'body') {
            return;
          }
          const esTreeNodeToTSNodeMap5 = services.esTreeNodeToTSNodeMap;
          const type = checker.getTypeAtLocation(esTreeNodeToTSNodeMap5.get(node));
          const typeFlags3 = ts.TypeFlags;
          const typeFlags4 = ts.TypeFlags;
          const isUntypedBody = Boolean(type.flags & (typeFlags3.Any | typeFlags4.Unknown));
          if (isUntypedBody && !isValidated(node)) {
            context.report({ node, messageId: 'schema' });
          }
        },
      };
    },
  }),
};
