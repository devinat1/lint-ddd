import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import { ESLintUtils } from '@typescript-eslint/utils';
import ts from 'typescript';

const createRule = ESLintUtils.RuleCreator(() => 'docs/lint-policy.md');

const ruleOptions: [] = [];

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
      defaultOptions: ruleOptions,
    },
    create(context) {
      const services = ESLintUtils.getParserServices(context);

      return {
        CallExpression(node) {
          reportRawJson({ context, services, node });
        },
        MemberExpression(node) {
          reportRawBody({ context, services, node });
        },
      };
    },
  }),
};

type SchemaContext = TSESLint.RuleContext<'schema', []>;
type ParserServices = ReturnType<typeof ESLintUtils.getParserServices>;

function readMethod(callee: TSESTree.MemberExpression): string | null {
  const property2 = callee.property;
  if (property2.type === 'Identifier' && !callee.computed) {
    return property2.name;
  }
  if (property2.type === 'Literal' && typeof property2.value === 'string') {
    return property2.value;
  }

  return null;
}

function hasConcreteShape({
  symbol,
  receiverNode,
  services,
}: {
  symbol: ts.Symbol;
  receiverNode: TSESTree.Node;
  services: ParserServices;
}) {
  const program3 = services.program;
  if (program3 === null) {
    return false;
  }
  const checker = program3.getTypeChecker();
  const esTreeNodeToTSNodeMap3 = services.esTreeNodeToTSNodeMap;
  const type = checker.getTypeOfSymbolAtLocation(symbol, esTreeNodeToTSNodeMap3.get(receiverNode));

  return !(type.isUnion() ? type.types : [type]).some((part) => {
    const typeFlags = ts.TypeFlags;
    const typeFlags2 = ts.TypeFlags;

    return (part.flags & (typeFlags.Unknown | typeFlags2.Any)) !== 0;
  });
}

function isZodReceiver(output: ts.Symbol) {
  const declarations2 = output.declarations;

  return (
    declarations2?.some((declaration) => {
      const fileName2 = declaration.getSourceFile().fileName;

      return fileName2.includes('/node_modules/zod/');
    }) === true
  );
}

function isValidation({ node, services }: { node: TSESTree.Node; services: ParserServices }) {
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
  const program2 = services.program;
  if (program2 === null) {
    return false;
  }
  const checker = program2.getTypeChecker();
  const esTreeNodeToTSNodeMap2 = services.esTreeNodeToTSNodeMap;
  const receiver = checker.getTypeAtLocation(esTreeNodeToTSNodeMap2.get(receiverNode));
  const output = receiver.getProperty('_output');
  if (!output || !receiver.getProperty('_def') || !isZodReceiver(output)) {
    return false;
  }
  const input = receiver.getProperty('_input');
  if (!input) {
    return false;
  }

  return (
    hasConcreteShape({ symbol: input, receiverNode, services }) &&
    hasConcreteShape({ symbol: output, receiverNode, services })
  );
}

function readsAreValidated({
  value,
  reads,
  services,
}: {
  value: TSESTree.Node;
  reads: readonly { identifier: TSESTree.Node }[];
  services: ParserServices;
}) {
  return (
    reads.length !== 0 &&
    reads.every((reference) => {
      const identifier2 = reference.identifier;
      const parent2 = identifier2.parent;
      if (parent2 === undefined || parent2.type !== 'CallExpression' || !isValidation({ node: parent2, services })) {
        return false;
      }
      const arguments3 = parent2.arguments;
      const range2 = identifier2.range;
      const range3 = value.range;

      return arguments3[0] === identifier2 && range2[0] > range3[1];
    })
  );
}

function isValidated({
  node,
  context,
  services,
}: {
  node: TSESTree.Node;
  context: SchemaContext;
  services: ParserServices;
}) {
  const value = unwrapParent(node);
  const parent = value.parent;
  if (!parent) {
    return false;
  }
  if (parent.type === 'CallExpression' && isValidation({ node: parent, services })) {
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

  return readsAreValidated({ value, reads, services });
}

function reportRawJson({
  context,
  services,
  node,
}: {
  context: SchemaContext;
  services: ParserServices;
  node: TSESTree.CallExpression;
}) {
  const callee = node.callee;
  if (callee.type !== 'MemberExpression') {
    return;
  }
  const object2 = callee.object;
  const isJsonParse = object2.type === 'Identifier' && object2.name === 'JSON' && readMethod(callee) === 'parse';
  const program5 = services.program;
  if (program5 === null) {
    return;
  }
  const checker = program5.getTypeChecker();
  const esTreeNodeToTSNodeMap4 = services.esTreeNodeToTSNodeMap;
  const receiver = checker.getTypeAtLocation(esTreeNodeToTSNodeMap4.get(callee.object));
  const isHttpJson =
    readMethod(callee) === 'json' &&
    ['Request', 'Response', 'NextRequest', 'NextResponse'].includes(receiver.getSymbol()?.name ?? '');
  if ((isJsonParse || isHttpJson) && !isValidated({ node, context, services })) {
    context.report({ node, messageId: 'schema' });
  }
}

function reportRawBody({
  context,
  services,
  node,
}: {
  context: SchemaContext;
  services: ParserServices;
  node: TSESTree.MemberExpression;
}) {
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
  const program6 = services.program;
  if (program6 === null) {
    return;
  }
  const checker = program6.getTypeChecker();
  const esTreeNodeToTSNodeMap5 = services.esTreeNodeToTSNodeMap;
  const type = checker.getTypeAtLocation(esTreeNodeToTSNodeMap5.get(node));
  const typeFlags3 = ts.TypeFlags;
  const typeFlags4 = ts.TypeFlags;
  const isUntypedBody = Boolean(type.flags & (typeFlags3.Any | typeFlags4.Unknown));
  if (isUntypedBody && !isValidated({ node, context, services })) {
    context.report({ node, messageId: 'schema' });
  }
}
