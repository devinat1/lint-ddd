import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import { ASTUtils, ESLintUtils } from '@typescript-eslint/utils';
import ts from 'typescript';

import { readFieldIf } from './read_field.ts';

const createRule = ESLintUtils.RuleCreator(() => 'docs/lint-policy.md');

const ruleOptions: [] = [];
const externalContractAnnotation = /@external[ \t]+[^\s*]/;
type PrefixContext = TSESLint.RuleContext<'prefix', []>;
type PrefixNode = TSESTree.Identifier | TSESTree.Literal;

function eslintOptionNames() {
  return new Set([
    'props',
    'ignoreArrayIndexes',
    'ignoreEnums',
    'ignoreNumericLiteralTypes',
    'ignoreTypeIndexes',
    'ignoreReadonlyClassProperties',
    'enforceConst',
    'detectObjects',
    'skipBlankLines',
    'skipComments',
    'projectService',
    'allowString',
    'allowNumber',
    'allowAny',
    'allowBoolean',
    'allowNullish',
    'allowNumberAndString',
    'allowRegExp',
    'useTabs',
    'singleQuote',
    'boolean',
    'number',
    'string',
    'publicOnly',
    'ignoreMiddleExtensions',
    'allowConstructorOnly',
    'allowWithDecorator',
    'match',
    'ts-ignore',
    'ts-expect-error',
    'ts-nocheck',
    'ts-check',
    'ArrowFunctionExpression',
    'ClassDeclaration',
    'FunctionDeclaration',
    'FunctionExpression',
  ]);
}

function hasExternalContractAnnotation(declaration: ts.Declaration) {
  const text2 = declaration.getSourceFile().text;

  return externalContractAnnotation.test(text2.slice(declaration.getFullStart(), declaration.getStart()));
}

function isExternalDeclaration(declaration: ts.Declaration) {
  return (
    /\/node_modules\/|\/adapters\/outbound\/persistence\/generated\//.test(declaration.getSourceFile().fileName) ||
    hasExternalContractAnnotation(declaration)
  );
}

function isExternalProperty({
  type,
  name,
  checker,
}: {
  type: ts.Type | undefined;
  name: string;
  checker: ts.TypeChecker;
}) {
  if (type === undefined) {
    return false;
  }
  const narrowed = checker.getNonNullableType(type);
  const parts = narrowed.isUnionOrIntersection() ? narrowed.types : [narrowed];

  return parts.some((part) => {
    const property = part.getProperty(name);
    if (!property) {
      return false;
    }
    const declarations2 = property.declarations;

    return (
      declarations2?.some(isExternalDeclaration) === true ||
      (property.declarations === undefined &&
        readFieldIf({ value: part.aliasSymbol, key: 'declarations' })?.some(isExternalDeclaration) === true)
    );
  });
}

function readBooleanProperty({ type, name, checker }: { type: ts.Type; name: string; checker: ts.TypeChecker }) {
  const narrowed = checker.getNonNullableType(type);
  const parts = narrowed.isUnionOrIntersection() ? narrowed.types : [narrowed];

  return parts.flatMap((part) => {
    const property = part.getProperty(name);

    return property ? [property] : [];
  });
}

function collectLiteralPath({ current, path }: { current: ts.ObjectLiteralExpression; path: string[] }) {
  const steps = Array.from({ length: 32 });
  const found = steps.reduce(
    (state: { current: ts.ObjectLiteralExpression; path: string[]; isDone: boolean }) => {
      if (state.isDone) {
        return state;
      }
      const current = state.current;
      const parent = current.parent;
      const owner = parent.parent;
      const path = state.path;
      if (
        !ts.isPropertyAssignment(parent) ||
        !ts.isObjectLiteralExpression(owner) ||
        (!ts.isIdentifier(parent.name) && !ts.isStringLiteral(parent.name))
      ) {
        return { current, path, isDone: true };
      }
      const name2 = parent.name;

      return { current: owner, path: [name2.text, ...path], isDone: false };
    },
    { current, path, isDone: false },
  );

  return { root: found.current, path: found.path };
}

function isGenericExternalProperty({
  object,
  name,
  checker,
}: {
  object: ts.ObjectLiteralExpression;
  name: string;
  checker: ts.TypeChecker;
}) {
  const { root, path } = collectLiteralPath({ current: object, path: [name] });
  const call = root.parent;
  if (!ts.isCallExpression(call)) {
    return false;
  }
  const declaration = checker.getResolvedSignature(call)?.declaration;
  const typeParameters2 = declaration?.typeParameters;
  const constraints =
    typeParameters2?.flatMap((parameter) =>
      parameter.constraint ? [checker.getTypeAtLocation(parameter.constraint)] : [],
    ) ?? [];

  return constraints.some(
    (constraint) =>
      path.reduce<ts.Type[]>(
        (types, key) =>
          types.flatMap((type) =>
            readBooleanProperty({ type, name: key, checker }).map((property) =>
              checker.getTypeOfSymbolAtLocation(property, root),
            ),
          ),
        [constraint],
      ).length !== 0 &&
      readBooleanProperty({ type: constraint, name: path[0] ?? name, checker }).some((property) => {
        const declarations4 = property.declarations;

        return declarations4?.some(isExternalDeclaration) === true;
      }),
  );
}

function isConfiguredBooleanName({
  name,
  context,
  services,
  checker,
  owner,
}: {
  name: string;
  context: PrefixContext;
  services: ReturnType<typeof ESLintUtils.getParserServices>;
  checker: ts.TypeChecker;
  owner: TSESTree.Node;
}) {
  if (/\/tooling\/eslint\.(config|rules)\.ts$/.test(context.filename) && eslintOptionNames().has(name)) {
    return true;
  }
  const filename2 = context.filename;
  if (filename2.endsWith('/tooling/architecture.ts') && ['checkAllOrigins', 'checkUnknownLocals'].includes(name)) {
    return true;
  }
  const esTreeNodeToTSNodeMap2 = services.esTreeNodeToTSNodeMap;
  const object = esTreeNodeToTSNodeMap2.get(owner);
  if (!ts.isObjectLiteralExpression(object)) {
    return false;
  }
  const contextual = checker.getContextualType(object);

  return (
    isExternalProperty({ type: contextual, name, checker }) || isGenericExternalProperty({ object, name, checker })
  );
}

function isProtocolProperty({
  node,
  name,
  context,
  services,
  checker,
}: {
  node: PrefixNode;
  name: string;
  context: PrefixContext;
  services: ReturnType<typeof ESLintUtils.getParserServices>;
  checker: ts.TypeChecker;
}) {
  const parent5 = node.parent;
  const sourceCode2 = context.sourceCode;
  const hasExplicitExternalName =
    ['TSPropertySignature', 'Property'].includes(parent5.type) &&
    sourceCode2.getCommentsBefore(node.parent).some((comment) => externalContractAnnotation.test(comment.value));
  if (hasExplicitExternalName) {
    return true;
  }
  const parent6 = node.parent;
  const parent7 = parent6.parent;
  if (parent6.type === 'Property' && parent6.key === node && parent7?.type === 'ObjectPattern') {
    return true;
  }
  const parent10 = node.parent;
  const parent8 = parent10.parent;
  if (parent10.type === 'Property' && parent10.key === node && parent8?.type === 'ObjectExpression') {
    return isConfiguredBooleanName({ name, context, services, checker, owner: parent8 });
  }

  return false;
}

type NamedParameterNode =
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression
  | TSESTree.ArrowFunctionExpression
  | TSESTree.TSFunctionType
  | TSESTree.TSMethodSignature
  | TSESTree.TSDeclareFunction;

function isNativeRoute({ node, filename }: { node: TSESTree.Node; filename: string }) {
  const routeMethods = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/;
  if (!/\/src\/presentation\/app\/.*route\.ts$/.test(filename)) {
    return false;
  }
  if (node.type === 'FunctionDeclaration') {
    const parent2 = node.parent;
    const id2 = node.id;

    return parent2.type === 'ExportNamedDeclaration' && routeMethods.test(id2?.name ?? '');
  }
  const parent = node.parent;
  if (parent?.type !== 'VariableDeclarator') {
    return false;
  }
  const id3 = parent.id;
  if (id3.type !== 'Identifier') {
    return false;
  }
  const parent3 = parent.parent;
  const parent4 = parent3.parent;

  return routeMethods.test(id3.name) && parent4.type === 'ExportNamedDeclaration';
}

function isExternalCallbackRead({
  reference,
  checker,
  services,
}: {
  reference: TSESLint.Scope.Reference;
  checker: ts.TypeChecker;
  services: ReturnType<typeof ESLintUtils.getParserServices>;
}) {
  const identifier2 = reference.identifier;
  const call = identifier2.parent;
  if (call.type !== 'CallExpression') {
    return false;
  }
  const arguments2 = call.arguments;
  const position = arguments2.findIndex((argument) => argument === reference.identifier);
  const esTreeNodeToTSNodeMap4 = services.esTreeNodeToTSNodeMap;
  const signature = checker.getResolvedSignature(esTreeNodeToTSNodeMap4.get(call));
  const parameters2 = signature?.parameters;
  const parameter = parameters2 === undefined ? undefined : parameters2[position];
  const declaration2 = signature?.declaration;
  const fileName2 = declaration2 === undefined ? undefined : declaration2.getSourceFile().fileName;
  if (!parameter || fileName2?.includes('/node_modules/') !== true) {
    return false;
  }
  const esTreeNodeToTSNodeMap5 = services.esTreeNodeToTSNodeMap;

  return (
    checker
      .getNonNullableType(checker.getTypeOfSymbolAtLocation(parameter, esTreeNodeToTSNodeMap5.get(call)))
      .getCallSignatures().length !== 0
  );
}

function isReferencedExternalCallback({
  node,
  context,
  services,
  checker,
}: {
  node: TSESTree.Node;
  context: TSESLint.RuleContext<'object', []>;
  services: ReturnType<typeof ESLintUtils.getParserServices>;
  checker: ts.TypeChecker;
}) {
  const parent = node.parent;
  const id5 = node.type === 'FunctionDeclaration' ? node.id : undefined;
  const declaredName = id5?.name;
  const boundName = (() => {
    if (parent === undefined || parent.type !== 'VariableDeclarator') {
      return undefined;
    }
    const id6 = parent.id;

    return id6.type === 'Identifier' ? id6.name : undefined;
  })();
  const callbackName = declaredName ?? boundName ?? null;
  const bindingNode = parent?.type === 'VariableDeclarator' ? parent : node;
  const sourceCode3 = context.sourceCode;
  const variable = sourceCode3.getDeclaredVariables(bindingNode).find((binding) => binding.name === callbackName);
  const references2 = variable?.references;
  const reads = references2?.filter((reference) => reference.isRead()) ?? [];

  return reads.length !== 0 && reads.every((reference) => isExternalCallbackRead({ reference, checker, services }));
}

function hasNodeModuleSignature({
  node,
  checker,
  services,
}: {
  node: TSESTree.Node;
  checker: ts.TypeChecker;
  services: ReturnType<typeof ESLintUtils.getParserServices>;
}) {
  const esTreeNodeToTSNodeMap7 = services.esTreeNodeToTSNodeMap;
  const mapped = esTreeNodeToTSNodeMap7.get(node);
  if (!ts.isExpression(mapped)) {
    return false;
  }
  const contextualType = checker.getContextualType(mapped);

  return (
    contextualType?.getCallSignatures().some((signature) => {
      const declaration3 = signature.declaration;
      if (declaration3 === undefined) {
        return false;
      }
      const fileName3 = declaration3.getSourceFile().fileName;

      return fileName3.includes('/node_modules/');
    }) === true
  );
}

function reportExtraParameters({
  node,
  context,
}: {
  node: NamedParameterNode;
  context: TSESLint.RuleContext<'object', []>;
}) {
  const services = ESLintUtils.getParserServices(context);
  const program3 = services.program;
  const checker = program3.getTypeChecker();
  const params2 = node.params;
  const params = params2.filter((param) => param.type !== 'Identifier' || param.name !== 'this');
  if (params.length < 2) {
    return;
  }
  const parent = node.parent;
  if (parent.type === 'CallExpression' || parent.type === 'NewExpression') {
    const arguments3 = parent.arguments;
    if (arguments3.some((argument) => argument === node)) {
      return;
    }
  }
  if (isReferencedExternalCallback({ node, context, services, checker })) {
    return;
  }
  const esTreeNodeToTSNodeMap6 = services.esTreeNodeToTSNodeMap;
  if (
    params.length === 2 &&
    isNativeRoute({ node, filename: context.filename }) &&
    checker.getTypeAtLocation(esTreeNodeToTSNodeMap6.get(params[0] ?? node)).getSymbol()?.name === 'Request'
  ) {
    return;
  }
  if (hasNodeModuleSignature({ node, checker, services })) {
    return;
  }
  context.report({ node, messageId: 'object' });
}

function reportUnprefixedBoolean({ node, context }: { node: PrefixNode; context: PrefixContext }) {
  const booleanPrefix = /^(is|has|can|should)[A-Z0-9_]/;
  const services = ESLintUtils.getParserServices(context);
  const program2 = services.program;
  const checker = program2.getTypeChecker();
  const name = node.type === 'Identifier' ? node.name : typeof node.value === 'string' ? node.value : null;
  if (name === null || isProtocolProperty({ node, name, context, services, checker })) {
    return;
  }
  const parent9 = node.parent;
  const parent12 = parent9.parent;
  const parent13 = parent12?.parent;
  if (
    name === 'dynamicParams' &&
    /\/src\/presentation\/app\/.*\/(?:page|layout)\.tsx$/.test(context.filename) &&
    parent9.type === 'VariableDeclarator' &&
    parent13?.type === 'ExportNamedDeclaration'
  ) {
    return;
  }
  const esTreeNodeToTSNodeMap3 = services.esTreeNodeToTSNodeMap;
  const type = checker.getTypeAtLocation(esTreeNodeToTSNodeMap3.get(node));
  const parts = type.isUnion() ? type.types : [type];
  const values = parts.filter((part) => {
    const typeFlags = ts.TypeFlags;
    const typeFlags2 = ts.TypeFlags;

    return (part.flags & (typeFlags.Null | typeFlags2.Undefined)) === 0;
  });
  if (
    values.length !== 0 &&
    values.every((part) => {
      const typeFlags3 = ts.TypeFlags;

      return (part.flags & typeFlags3.BooleanLike) !== 0;
    }) &&
    !booleanPrefix.test(name)
  ) {
    context.report({ node, messageId: 'prefix' });
  }
}

export const conventionRules = {
  'boolean-prefix': createRule({
    name: 'boolean-prefix',
    meta: {
      docs: { description: 'Enforce the documented authored-code convention.' },
      type: 'suggestion',
      schema: [],
      messages: {
        prefix: 'Name boolean bindings and fields with is, has, can, or should followed by a capitalized word.',
      },
      defaultOptions: ruleOptions,
    },
    create(context) {
      const check = (node: TSESTree.Identifier | TSESTree.Literal) => {
        reportUnprefixedBoolean({ node, context });
      };

      return {
        'VariableDeclarator > Identifier.id, PropertyDefinition > Identifier.key, TSPropertySignature > Identifier.key':
          check,
        'FunctionDeclaration > Identifier.params, FunctionExpression > Identifier.params, ArrowFunctionExpression > Identifier.params':
          check,
        'Property > Identifier.key, Property > Literal.key, TSPropertySignature > Literal.key': check,
        'AssignmentPattern > Identifier.left, ArrayPattern > Identifier': check,
        'ObjectPattern > Property > Identifier.value': check,
      };
    },
  }),
  'named-parameters': createRule({
    name: 'named-parameters',
    meta: {
      docs: { description: 'Enforce the documented authored-code convention.' },
      type: 'suggestion',
      schema: [],
      messages: {
        object:
          'Use one named parameter object for authored multiargument functions; inline callbacks and externally typed callbacks retain their required signatures.',
      },
      defaultOptions: ruleOptions,
    },
    create(context) {
      const functionSelector =
        'FunctionDeclaration, FunctionExpression, ArrowFunctionExpression, TSFunctionType, TSMethodSignature, TSDeclareFunction';

      return {
        [functionSelector](node: NamedParameterNode) {
          reportExtraParameters({ node, context });
        },
      };
    },
  }),
  'array-emptiness': createRule({
    name: 'array-emptiness',
    meta: {
      docs: { description: 'Enforce the documented authored-code convention.' },
      type: 'suggestion',
      schema: [],
      messages: {
        empty: 'Compare array.length === 0 (or !== 0) instead of equivalent numeric, truthy, or negated length checks.',
      },
      defaultOptions: ruleOptions,
    },
    create(context) {
      return {
        BinaryExpression(node) {
          const length = isArrayLength({ node: node.left, context })
            ? node.left
            : isArrayLength({ node: node.right, context })
              ? node.right
              : null;
          const number = length === node.left ? node.right : node.left;
          if (!length || number.type !== 'Literal' || typeof number.value !== 'number') {
            return;
          }
          const reversedOperators: Record<string, string> = { '<': '>', '>': '<', '<=': '>=', '>=': '<=' };
          const operator = length === node.left ? node.operator : (reversedOperators[node.operator] ?? node.operator);
          if (
            (number.value === 0 && ['==', '!=', '>', '<='].includes(operator)) ||
            (number.value === 1 && ['<', '>='].includes(operator))
          ) {
            context.report({ node, messageId: 'empty' });
          }
        },
        MemberExpression(node) {
          if (!isArrayLength({ node, context })) {
            return;
          }
          const parent = node.parent;
          if (parent.type === 'UnaryExpression' && parent.operator === '!') {
            context.report({ node, messageId: 'empty' });

            return;
          }
          if (
            (parent.type === 'IfStatement' ||
              parent.type === 'ConditionalExpression' ||
              parent.type === 'WhileStatement') &&
            parent.test === node
          ) {
            context.report({ node, messageId: 'empty' });

            return;
          }
          if (parent.type === 'LogicalExpression' && parent.operator !== '??' && parent.left === node) {
            context.report({ node, messageId: 'empty' });

            return;
          }
          if (parent.type !== 'CallExpression') {
            return;
          }
          const callee2 = parent.callee;
          if (callee2.type === 'Identifier' && callee2.name === 'Boolean') {
            context.report({ node, messageId: 'empty' });
          }
        },
      };
    },
  }),
  'optional-nullable': createRule({
    name: 'optional-nullable',
    meta: {
      docs: { description: 'Check explicit nullable annotations on inward-owned optional record fields.' },
      type: 'suggestion',
      schema: [],
      messages: {
        nullable:
          'Include null in this @nullable optional record field. Omission and explicit null have different meanings.',
      },
      defaultOptions: ruleOptions,
    },
    create(context) {
      return {
        'TSPropertySignature[optional=true]'(node: TSESTree.TSPropertySignature) {
          const services = ESLintUtils.getParserServices(context);
          const program5 = services.program;
          const checker = program5.getTypeChecker();
          const sourceCode4 = context.sourceCode;
          if (!sourceCode4.getCommentsBefore(node).some((comment) => /@nullable\b/.test(comment.value))) {
            return;
          }
          const esTreeNodeToTSNodeMap9 = services.esTreeNodeToTSNodeMap;
          const type = checker.getTypeAtLocation(esTreeNodeToTSNodeMap9.get(node));
          const hasNull = (type.isUnion() ? type.types : [type]).some((part) => {
            const typeFlags4 = ts.TypeFlags;

            return (part.flags & typeFlags4.Null) !== 0;
          });
          const typeAnnotation2 = node.typeAnnotation;
          const annotation = typeAnnotation2?.typeAnnotation;
          const unionTypes = annotation?.type === 'TSUnionType' ? annotation.types : undefined;
          const hasExplicitNull = unionTypes?.some((part) => part.type === 'TSNullKeyword') === true;
          if (!hasNull && !hasExplicitNull) {
            context.report({ node, messageId: 'nullable' });
          }
        },
      };
    },
  }),
  'parameter-mutation': createRule({
    name: 'parameter-mutation',
    meta: {
      docs: { description: 'Enforce immutable parameters for known native mutator calls.' },
      type: 'problem',
      schema: [],
      messages: { mutation: 'Copy parameter data before using a known native mutator.' },
      defaultOptions: ruleOptions,
    },
    create(context) {
      return {
        "AssignmentExpression, UpdateExpression, UnaryExpression[operator='delete']"(
          node: TSESTree.AssignmentExpression | TSESTree.UpdateExpression | TSESTree.UnaryExpression,
        ) {
          reportParameterAssignment({ node, context });
        },
        CallExpression(node) {
          reportParameterCall({ node, context });
        },
      };
    },
  }),
  'immutable-arrays': createRule({
    name: 'immutable-arrays',
    meta: {
      docs: { description: 'Enforce the documented authored-code convention.' },
      type: 'problem',
      schema: [],
      messages: {
        mutation:
          'Use an immutable array transformation. Mutating a fresh array expression or an immediately copied array is permitted.',
      },
      defaultOptions: ruleOptions,
    },
    create(context) {
      return {
        CallExpression(node) {
          reportArrayMutation({ node, context });
        },
        "AssignmentExpression, UpdateExpression, UnaryExpression[operator='delete']"(
          node: TSESTree.AssignmentExpression | TSESTree.UpdateExpression | TSESTree.UnaryExpression,
        ) {
          const target = node.type === 'AssignmentExpression' ? node.left : node.argument;
          if (target.type === 'MemberExpression' && isArrayType({ node: target.object, context })) {
            context.report({ node, messageId: 'mutation' });
          }
        },
      };
    },
  }),
  'typescript-tests': createRule({
    name: 'typescript-tests',
    meta: {
      docs: { description: 'Require product tests to be *.test.ts files.' },
      type: 'problem',
      schema: [],
      messages: {
        typescript: 'Product tests are *.test.ts files.',
      },
      defaultOptions: ruleOptions,
    },
    create(context) {
      return {
        Program(node) {
          const isPackageTest = /\.(?:test|spec)\.[a-z]+$/.test(context.filename);
          const filename4 = context.filename;
          const isTypeScriptTest = filename4.endsWith('.test.ts');
          if (isPackageTest && !isTypeScriptTest) {
            context.report({ node, messageId: 'typescript' });
          }
        },
      };
    },
  }),
};

type EmptyContext = TSESLint.RuleContext<'empty', []>;
type MutationContext = TSESLint.RuleContext<'mutation', []>;

function isArrayLength({ node, context }: { node: TSESTree.Node; context: EmptyContext }): boolean {
  const services = ESLintUtils.getParserServices(context);
  const program4 = services.program;
  const checker = program4.getTypeChecker();
  if (node.type !== 'MemberExpression') {
    return false;
  }
  const property5 = node.property;
  const isLength =
    (property5.type === 'Identifier' && !node.computed && property5.name === 'length') ||
    (property5.type === 'Literal' && property5.value === 'length');
  if (!isLength) {
    return false;
  }
  const esTreeNodeToTSNodeMap8 = services.esTreeNodeToTSNodeMap;
  const type = checker.getTypeAtLocation(esTreeNodeToTSNodeMap8.get(node.object));
  const parts = type.isUnion() ? type.types : [type];

  return parts.every((part) => checker.isArrayType(part) || checker.isTupleType(part));
}

function readMemberName(node: TSESTree.MemberExpression): string | null {
  const property2 = node.property;
  if (property2.type === 'Identifier' && !node.computed) {
    const property3 = node.property;

    return property3.name;
  }
  const property4 = node.property;

  return property4.type === 'Literal' && typeof property4.value === 'string' ? property4.value : null;
}

function readRoot(node: TSESTree.Node): TSESTree.Identifier | null {
  const steps = Array.from({ length: 16 });
  const found = steps.reduce(
    (state: { node: TSESTree.Node; isDone: boolean }) => {
      if (state.isDone) {
        return state;
      }
      const current = state.node;
      if (current.type === 'Identifier') {
        return { node: current, isDone: true };
      }
      if (current.type !== 'MemberExpression') {
        return { node: current, isDone: true };
      }
      const object = current.object;

      return { node: object, isDone: false };
    },
    { node, isDone: false },
  );
  const current = found.node;

  return current.type === 'Identifier' ? current : null;
}

function isParameter({ node, context }: { node: TSESTree.Node; context: MutationContext }) {
  const root = readRoot(node);
  if (root === null) {
    return false;
  }
  const sourceCode5 = context.sourceCode;
  const variable = ASTUtils.findVariable(sourceCode5.getScope(node), root);
  const defs2 = variable?.defs;

  return defs2?.some((definition) => definition.type === 'Parameter') === true;
}

function isNodeResponse({ root, context }: { root: TSESTree.Identifier; context: MutationContext }) {
  const services = ESLintUtils.getParserServices(context);
  const program6 = services.program;
  const checker = program6.getTypeChecker();
  const esTreeNodeToTSNodeMap10 = services.esTreeNodeToTSNodeMap;
  const type = checker.getTypeAtLocation(esTreeNodeToTSNodeMap10.get(root));
  const parts = type.isIntersection() ? type.types : [type];

  return parts.some((part) => {
    const symbol = part.getSymbol();
    if (symbol?.name !== 'ServerResponse') {
      return false;
    }
    const declarations3 = symbol.declarations;

    return (
      declarations3?.some((declaration) => {
        const fileName4 = declaration.getSourceFile().fileName;

        return fileName4.includes('/node_modules/@types/node/');
      }) === true
    );
  });
}

function reportParameterAssignment({
  node,
  context,
}: {
  node: TSESTree.AssignmentExpression | TSESTree.UpdateExpression | TSESTree.UnaryExpression;
  context: MutationContext;
}) {
  const target = node.type === 'AssignmentExpression' ? node.left : node.argument;
  if (target.type !== 'MemberExpression' || !isParameter({ node: target, context })) {
    return;
  }
  const root = readRoot(target);
  if (root === null) {
    return;
  }
  if (
    isNodeResponse({ root, context }) &&
    target.object === root &&
    ['statusCode', 'statusMessage'].includes(readMemberName(target) ?? '')
  ) {
    return;
  }
  context.report({ node, messageId: 'mutation' });
}

function reportParameterCall({ node, context }: { node: TSESTree.CallExpression; context: MutationContext }) {
  const nativeMutators: Partial<Record<string, string[]>> = {
    Map: ['set', 'delete', 'clear'],
    Set: ['add', 'delete', 'clear'],
  };
  const targetMutators: Partial<Record<string, string[]>> = {
    Object: ['assign', 'defineProperty', 'defineProperties', 'setPrototypeOf'],
    Reflect: ['set', 'deleteProperty', 'defineProperty', 'setPrototypeOf'],
  };
  const callee = node.callee;
  if (callee.type !== 'MemberExpression') {
    return;
  }
  const method = readMemberName(callee);
  if (typeof method !== 'string') {
    return;
  }
  const services = ESLintUtils.getParserServices(context);
  const program6 = services.program;
  const checker = program6.getTypeChecker();
  const esTreeNodeToTSNodeMap11 = services.esTreeNodeToTSNodeMap;
  const native = checker.getTypeAtLocation(esTreeNodeToTSNodeMap11.get(callee.object)).getSymbol()?.name;
  const entry = native === undefined ? undefined : nativeMutators[native];
  const hasMutableReceiver =
    native !== undefined && (native === 'Date' ? /^set[A-Z]/.test(method) : entry?.includes(method));
  if (hasMutableReceiver === true && isParameter({ node: callee.object, context })) {
    context.report({ node, messageId: 'mutation' });
  }
  const arguments4 = node.arguments;
  const target = arguments4.at(0);
  const object2 = callee.object;
  const entry2 = object2.type === 'Identifier' ? targetMutators[object2.name] : undefined;
  const hasMutableTarget = entry2?.includes(method) === true;
  if (hasMutableTarget && target && isParameter({ node: target, context })) {
    context.report({ node, messageId: 'mutation' });
  }
}

function isArrayType({ node, context }: { node: TSESTree.Node; context: MutationContext }) {
  const services = ESLintUtils.getParserServices(context);
  const program7 = services.program;
  const checker = program7.getTypeChecker();
  const esTreeNodeToTSNodeMap12 = services.esTreeNodeToTSNodeMap;
  const type = checker.getTypeAtLocation(esTreeNodeToTSNodeMap12.get(node));

  return (type.isUnion() ? type.types : [type]).some((part) => checker.isArrayType(part) || checker.isTupleType(part));
}

function isFixtureCapture({
  object,
  name,
  context,
}: {
  object: TSESTree.Node;
  name: unknown;
  context: MutationContext;
}) {
  const sourceCode6 = context.sourceCode;
  const variable = object.type === 'Identifier' ? ASTUtils.findVariable(sourceCode6.getScope(object), object) : null;
  const filename3 = context.filename;

  return (
    filename3.includes('/tests/') &&
    name === 'push' &&
    readFieldIf({ value: variable, key: 'defs' })?.some((definition) => {
      if (definition.type !== 'Variable') {
        return false;
      }
      const node2 = definition.node;
      const init2 = node2.init;
      const sourceCode7 = context.sourceCode;

      return (
        init2?.type === 'ArrayExpression' &&
        sourceCode7.getCommentsBefore(definition.parent).some((comment) => /@fixtureCapture\s+\S/.test(comment.value))
      );
    }) === true
  );
}

function isFreshArray(object: TSESTree.Node) {
  if (object.type === 'ArrayExpression') {
    return true;
  }
  if (object.type !== 'CallExpression') {
    return false;
  }
  const callee4 = object.callee;
  if (callee4.type !== 'MemberExpression') {
    return false;
  }
  const property13 = callee4.property;

  return (
    property13.type === 'Identifier' &&
    ['slice', 'map', 'filter', 'toSorted', 'toReversed', 'toSpliced'].includes(property13.name)
  );
}

function reportArrayMutation({ node, context }: { node: TSESTree.CallExpression; context: MutationContext }) {
  const mutators = new Set(['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill', 'copyWithin']);
  const callee = node.callee;
  if (callee.type !== 'MemberExpression' || !isArrayType({ node: callee.object, context })) {
    return;
  }
  const property11 = callee.property;
  const name =
    property11.type === 'Identifier' && !callee.computed
      ? property11.name
      : property11.type === 'Literal' && typeof property11.value === 'string'
        ? property11.value
        : null;
  const object = callee.object;
  if (
    typeof name === 'string' &&
    mutators.has(name) &&
    !isFreshArray(object) &&
    !isFixtureCapture({ object, name, context })
  ) {
    context.report({ node, messageId: 'mutation' });
  }
}
