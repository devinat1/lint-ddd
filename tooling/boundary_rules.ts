import type { TSESTree } from '@typescript-eslint/utils';
import { ESLintUtils } from '@typescript-eslint/utils';

import { readPath } from './read_field.ts';

const createRule = ESLintUtils.RuleCreator(() => 'docs/lint-policy.md');
function isConstantObject(node: TSESTree.Node | null): boolean {
  const steps = Array.from({ length: 8 });
  const found = steps.reduce(
    (state: { node: TSESTree.Node | null; isMatched: boolean }) => {
      if (state.isMatched) {
        return state;
      }
      const current = state.node;
      if (current === null) {
        return state;
      }
      if (current.type === 'ObjectExpression') {
        return { node: current, isMatched: true };
      }
      if (current.type === 'TSAsExpression' || current.type === 'TSSatisfiesExpression') {
        const expression = current.expression;

        return { node: expression, isMatched: false };
      }

      return { node: null, isMatched: false };
    },
    { node, isMatched: false },
  );

  return found.isMatched;
}
const readStaticText = (node: TSESTree.Node | null | undefined): string | null => {
  if (node?.type === 'Literal' && typeof node.value === 'string') {
    return node.value;
  }
  if (node?.type !== 'TemplateLiteral') {
    return null;
  }
  const expressions2 = node.expressions;
  if (expressions2.length !== 0) {
    return null;
  }
  const quasis2 = node.quasis;
  const entry = quasis2[0];

  return readPath({ value: entry, first: 'value', second: 'cooked' }) ?? null;
};

export const boundaryRules = {
  'comment-and-log': createRule({
    name: 'comment-and-log',
    meta: {
      docs: { description: 'Enforce the documented authored-code convention.' },
      type: 'suggestion',
      schema: [],
      messages: {
        todo: 'Write TODO(cleanup): followed by the specific temporary constraint.',
        period: 'End literal or template log messages with a period.',
      },
    },
    defaultOptions: [],
    create(context) {
      return {
        Program() {
          const sourceCode2 = context.sourceCode;
          sourceCode2.getAllComments().forEach((comment) => {
            if (/\bTODO\b/.test(comment.value) && /\bTODO\b(?!\(cleanup\):\s+\S)/.test(comment.value)) {
              context.report({ loc: comment.loc, messageId: 'todo' });
            }
          });
        },
        CallExpression(node) {
          const callee = node.callee;
          if (callee.type !== 'MemberExpression') {
            return;
          }
          const object2 = callee.object;
          const property2 = callee.property;
          if (
            object2.type !== 'Identifier' ||
            !['console', 'logger', 'log'].includes(object2.name) ||
            property2.type !== 'Identifier' ||
            !['log', 'info', 'warn', 'error', 'debug', 'trace', 'fatal'].includes(property2.name)
          ) {
            return;
          }
          const arguments2 = node.arguments;
          const argument = arguments2.at(0);
          if (!argument) {
            return;
          }
          const quasis3 = argument.type === 'TemplateLiteral' ? argument.quasis : [];
          const quasi = quasis3.at(-1);
          const ending =
            argument.type === 'TemplateLiteral'
              ? readPath({ value: quasi, first: 'value', second: 'cooked' })
              : readStaticText(argument);
          if (ending !== null && ending !== undefined && !ending.trimEnd().endsWith('.')) {
            context.report({ node: argument, messageId: 'period' });
          }
        },
      };
    },
  }),
  'named-messages': createRule({
    name: 'named-messages',
    meta: {
      docs: { description: 'Enforce the documented authored-code convention.' },
      type: 'suggestion',
      schema: [],
      messages: {
        constant:
          'Move API codes, error messages, prompts, and user-facing message text into named domain constants or copy modules.',
      },
    },
    defaultOptions: [],
    create(context) {
      const check = (node: TSESTree.Node | null | undefined) => {
        if (node && (readStaticText(node) !== null || node.type === 'TemplateLiteral')) {
          context.report({ node, messageId: 'constant' });
        }
      };

      return {
        Property(node) {
          const literalMessageFields = new Set([
            'code',
            'error',
            'message',
            'prompt',
            'system',
            'instructions',
            'text',
          ]);
          const key2 = node.key;
          const name = key2.type === 'Identifier' && !node.computed ? key2.name : readStaticText(node.key);
          // Constant declarations are the intended home for grouped copy and protocol strings.
          const sourceCode3 = context.sourceCode;
          const ancestors = sourceCode3.getAncestors(node);
          if (
            !ancestors.some((ancestor) =>
              ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(ancestor.type),
            ) &&
            ancestors.some((ancestor) => {
              if (ancestor.type !== 'VariableDeclarator') {
                return false;
              }
              const parent2 = ancestor.parent;

              return parent2.kind === 'const' && isConstantObject(ancestor.init);
            })
          ) {
            return;
          }
          if (name !== null && literalMessageFields.has(name)) {
            check(node.value);
          }
        },
        NewExpression(node) {
          const callee2 = node.callee;
          if (callee2.type === 'Identifier' && /Error$/.test(callee2.name)) {
            const arguments3 = node.arguments;
            check(arguments3[0]);
          }
        },
        JSXExpressionContainer(node) {
          const parent3 = node.parent;
          if (parent3.type !== 'JSXElement') {
            return;
          }
          const openingElement2 = parent3.openingElement;
          const name = openingElement2.name;
          if (name.type === 'JSXIdentifier' && ['button', 'a', 'label', 'option', 'summary'].includes(name.name)) {
            return;
          }
          check(node.expression);
        },
        JSXText(node) {
          const value4 = node.value;
          if (value4.trim().length === 0) {
            return;
          }
          const parent = node.parent;
          if (parent.type !== 'JSXElement') {
            context.report({ node, messageId: 'constant' });

            return;
          }
          const openingElement3 = parent.openingElement;
          const name2 = openingElement3.name;
          if (name2.type === 'JSXIdentifier' && ['button', 'a', 'label', 'option', 'summary'].includes(name2.name)) {
            return;
          }
          context.report({ node, messageId: 'constant' });
        },
      };
    },
  }),
};
