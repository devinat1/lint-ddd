import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import { ASTUtils, ESLintUtils } from '@typescript-eslint/utils';

import { readPath } from './read_field.ts';

const createRule = ESLintUtils.RuleCreator(() => 'docs/lint-policy.md');
const layerMarkers = [
  ['primary', '/src/adapters/primary/'],
  ['secondary', '/src/adapters/secondary/'],
  ['domain', '/src/domain/'],
  ['ports', '/src/ports/'],
  ['application', '/src/application/'],
  ['composition', '/src/composition/'],
  ['presentation', '/src/presentation/'],
] as const;
type Layer = (typeof layerMarkers)[number][0];
type Effect =
  | 'clock'
  | 'random'
  | 'network'
  | 'timer'
  | 'process'
  | 'console'
  | 'buffer'
  | 'path'
  | 'loading'
  | 'intl'
  | 'forbidden';
type FunctionNode = TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression;

const coreLayers = new Set<Layer>(['domain', 'ports', 'application']);

const layerOf = ({ filename }: { filename: string }): Layer | null => {
  const normalized = filename.replaceAll('\\', '/');
  if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(normalized)) {
    return null;
  }
  const match = layerMarkers.find(([, marker]) => normalized.includes(marker));

  return match === undefined ? null : match[0];
};

function unwrapExpression(node: TSESTree.Node): TSESTree.Node {
  const steps = Array.from({ length: 8 });
  const found = steps.reduce(
    (state: { node: TSESTree.Node; isDone: boolean }) => {
      const current = state.node;
      if (
        state.isDone ||
        (current.type !== 'TSAsExpression' &&
          current.type !== 'TSSatisfiesExpression' &&
          current.type !== 'TSNonNullExpression')
      ) {
        return { node: current, isDone: true };
      }
      const expression = current.expression;

      return { node: expression, isDone: false };
    },
    { node, isDone: false },
  );

  return found.node;
}

const propertyName = (node: TSESTree.MemberExpression): string | null => {
  const property2 = node.property;
  if (!node.computed && property2.type === 'Identifier') {
    return property2.name;
  }
  if (property2.type === 'Literal' && typeof property2.value === 'string') {
    return property2.value;
  }
  if (property2.type !== 'TemplateLiteral') {
    return null;
  }
  const expressions2 = property2.expressions;
  if (expressions2.length !== 0) {
    return null;
  }
  const quasis2 = property2.quasis;
  const entry = quasis2[0];

  return readPath({ value: entry, first: 'value', second: 'cooked' }) ?? null;
};

const isSkippedName = (node: TSESTree.Identifier): boolean => {
  const parent = node.parent;
  if (
    parent.type === 'MemberExpression' &&
    (parent.object === node || (!parent.computed && parent.property === node))
  ) {
    return true;
  }

  return (
    (parent.type === 'Property' ||
      parent.type === 'PropertyDefinition' ||
      parent.type === 'MethodDefinition' ||
      parent.type === 'TSPropertySignature' ||
      parent.type === 'TSMethodSignature') &&
    parent.key === node &&
    !parent.computed
  );
};

const outermostName = (
  node: TSESTree.Identifier | TSESTree.TSQualifiedName,
): { parent: TSESTree.Node; name: TSESTree.Node } => {
  const steps = Array.from({ length: 16 });
  const found = steps.reduce(
    (state: { node: TSESTree.Node; isDone: boolean }) => {
      if (state.isDone) {
        return state;
      }
      const current = state.node;
      const parent2 = current.parent;
      if (parent2?.type === 'TSQualifiedName' && parent2.left === current) {
        return { node: parent2, isDone: false };
      }

      return { node: current, isDone: true };
    },
    { node, isDone: false },
  );
  const name = found.node;
  const parent = name.parent;
  if (parent === undefined) {
    return { parent: name, name };
  }

  return { parent, name };
};

const isTypeName = (node: TSESTree.Identifier): boolean => {
  const owned = outermostName(node);

  const parent4 = owned.parent;

  return parent4.type === 'TSTypeReference' && parent4.typeName === owned.name;
};

const isImplicitGlobal = ({
  sourceCode,
  node,
}: {
  sourceCode: TSESLint.SourceCode;
  node: TSESTree.Identifier;
}): boolean => {
  const variable = ASTUtils.findVariable(sourceCode.getScope(node), node);
  if (variable !== null) {
    const defs2 = variable.defs;
    if (defs2.length !== 0) {
      return false;
    }
  }
  if (isTypeName(node)) {
    return true;
  }
  if (variable === null) {
    return !isSkippedName(node);
  }

  const references2 = variable.references;

  return references2.some((reference) => reference.identifier === node);
};

const memberChain = (
  node: TSESTree.MemberExpression,
): { root: TSESTree.Identifier; members: readonly string[] } | null => {
  const steps = Array.from({ length: 16 });
  const found = steps.reduce(
    (state: { node: TSESTree.Node; names: string[]; isFailed: boolean }) => {
      if (state.isFailed) {
        return state;
      }
      const current = state.node;
      if (current.type !== 'MemberExpression') {
        return state;
      }
      const name = propertyName(current);
      const names = state.names;
      if (name === null) {
        return { node: current, names, isFailed: true };
      }
      const object = unwrapExpression(current.object);

      return { node: object, names: [name, ...names], isFailed: false };
    },
    { node, names: [], isFailed: false },
  );
  const current = found.node;
  if (found.isFailed || current.type !== 'Identifier') {
    return null;
  }

  return { root: current, members: found.names };
};

const globalUse = ({
  sourceCode,
  chain,
}: {
  sourceCode: TSESLint.SourceCode;
  chain: { root: TSESTree.Identifier; members: readonly string[] };
}): { name: string; members: readonly string[] } | null => {
  if (!isImplicitGlobal({ sourceCode, node: chain.root })) {
    return null;
  }
  const root2 = chain.root;
  if (root2.name !== 'globalThis') {
    const root3 = chain.root;

    return { name: root3.name, members: chain.members };
  }
  const members2 = chain.members;
  if (members2.length === 0) {
    return null;
  }
  const members3 = chain.members;
  const name = members3[0];
  if (name === undefined) {
    return null;
  }

  const members4 = chain.members;

  return { name, members: members4.slice(1) };
};

function isOpaqueGlobalThis({
  sourceCode,
  node,
}: {
  sourceCode: TSESLint.SourceCode;
  node: TSESTree.MemberExpression;
}): boolean {
  const steps = Array.from({ length: 16 });
  const found = steps.reduce(
    (state: { node: TSESTree.MemberExpression; root: TSESTree.Node; isOpaque: boolean; isDone: boolean }) => {
      if (state.isDone) {
        return state;
      }
      const current = state.node;
      const object = unwrapExpression(current.object);
      if (object.type === 'MemberExpression') {
        const isOpaque = state.isOpaque || propertyName(current) === null;

        return { node: object, root: object, isOpaque, isDone: false };
      }

      return { node: current, root: object, isOpaque: state.isOpaque, isDone: true };
    },
    { node, root: node, isOpaque: false, isDone: false },
  );
  if (found.isOpaque) {
    return true;
  }
  const root = found.root;
  const member = found.node;

  return (
    root.type === 'Identifier' &&
    root.name === 'globalThis' &&
    isImplicitGlobal({ sourceCode, node: root }) &&
    propertyName(member) === null
  );
}

const referenceRoot = (node: TSESTree.TSTypeReference): TSESTree.Identifier | null => {
  const typeName2 = node.typeName;
  if (typeName2.type === 'Identifier') {
    return typeName2;
  }
  const typeName3 = node.typeName;
  if (typeName3.type !== 'TSQualifiedName') {
    return null;
  }
  const owned = outermostName(typeName3);
  const name2 = owned.name;

  return name2.type === 'Identifier' ? name2 : null;
};

function isCallArgument(node: TSESTree.Node): boolean {
  const steps = Array.from({ length: 8 });
  const found = steps.reduce(
    (state: { node: TSESTree.Node; isDone: boolean }) => {
      if (state.isDone) {
        return state;
      }
      const current = state.node;
      const parent = current.parent;
      if (
        parent?.type === 'TSAsExpression' ||
        parent?.type === 'TSSatisfiesExpression' ||
        parent?.type === 'TSNonNullExpression'
      ) {
        return { node: parent, isDone: false };
      }

      return { node: current, isDone: true };
    },
    { node, isDone: false },
  );
  const current = found.node;
  const parent = current.parent;
  if (parent?.type !== 'CallExpression') {
    return false;
  }
  const arguments2 = parent.arguments;

  return arguments2.some((argument) => argument === current);
}

const isCore = (layer: Layer | null): boolean => layer !== null && coreLayers.has(layer);

export const hexagonalRules = {
  'ambient-effects': createRule({
    name: 'ambient-effects',
    meta: {
      docs: { description: 'Limit ambient effects to the layer that owns them.' },
      type: 'problem',
      schema: [],
      messages: {
        clock: 'Read Date only in a secondary adapter. Pass time in as a number.',
        random: 'Draw randomness only in a secondary adapter.',
        network: 'Call the network only in a secondary adapter.',
        timer: 'Schedule time only in a primary or secondary adapter.',
        process: 'Read process only in composition, then pass the value in.',
        console: 'Log through a port. console belongs in a secondary adapter or composition.',
        buffer: 'Use Buffer only in an adapter.',
        path: 'Use __dirname and __filename only in a secondary adapter or composition.',
        loading: 'Load modules dynamically only from an adapter, composition, or presentation.',
        intl: 'Use Intl outside the domain, ports, and application.',
        forbidden: 'Keep this browser or runtime global behind a port.',
      },
    },
    defaultOptions: [],
    create(context) {
      const identifierEffects: Record<string, Effect> = {
        Date: 'clock',
        fetch: 'network',
        XMLHttpRequest: 'network',
        WebSocket: 'network',
        setTimeout: 'timer',
        setInterval: 'timer',
        setImmediate: 'timer',
        queueMicrotask: 'timer',
        clearTimeout: 'timer',
        clearInterval: 'timer',
        clearImmediate: 'timer',
        requestAnimationFrame: 'timer',
        cancelAnimationFrame: 'timer',
        process: 'process',
        console: 'console',
        Buffer: 'buffer',
        Intl: 'intl',
        require: 'loading',
        Function: 'forbidden',
        eval: 'forbidden',
        document: 'forbidden',
        window: 'forbidden',
        self: 'forbidden',
        localStorage: 'forbidden',
        sessionStorage: 'forbidden',
        navigator: 'forbidden',
        location: 'forbidden',
        history: 'forbidden',
        screen: 'forbidden',
        addEventListener: 'forbidden',
        removeEventListener: 'forbidden',
        postMessage: 'forbidden',
        crypto: 'random',
      };
      const layer = layerOf({ filename: context.filename });
      if (layer === null) {
        return {};
      }
      const sourceCode = context.sourceCode;
      const report = ({ node, effect }: { node: TSESTree.Node; effect: Effect | null }): void => {
        const effectLayers: Record<Effect, readonly Layer[]> = {
          clock: ['secondary'],
          random: ['secondary'],
          network: ['secondary'],
          timer: ['primary', 'secondary'],
          process: ['composition'],
          console: ['secondary', 'composition'],
          buffer: ['primary', 'secondary'],
          path: ['secondary', 'composition'],
          loading: ['primary', 'secondary', 'composition', 'presentation'],
          intl: ['primary', 'secondary', 'composition', 'presentation'],
          forbidden: [],
        };
        if (effect === null) {
          return;
        }
        const entry2 = effectLayers[effect];
        if (entry2.includes(layer)) {
          return;
        }
        context.report({ node, messageId: effect });
      };

      return {
        Identifier(node: TSESTree.Identifier) {
          const effectOfIdentifier = ({
            sourceCode,
            node,
          }: {
            sourceCode: TSESLint.SourceCode;
            node: TSESTree.Identifier;
          }): Effect | null => {
            if (isSkippedName(node) || !isImplicitGlobal({ sourceCode, node })) {
              return null;
            }
            if (node.name === 'Function' && isTypeName(node)) {
              return null;
            }

            return node.name === '__dirname' || node.name === '__filename'
              ? 'path'
              : (identifierEffects[node.name] ?? null);
          };
          report({ node, effect: effectOfIdentifier({ sourceCode, node }) });
        },
        MemberExpression(node: TSESTree.MemberExpression) {
          const effectOfMember = ({
            sourceCode,
            node,
          }: {
            sourceCode: TSESLint.SourceCode;
            node: TSESTree.MemberExpression;
          }): Effect | null => {
            const effectForUse = ({ name, members }: { name: string; members: readonly string[] }): Effect | null => {
              const specificMembers: Record<string, Record<string, Effect>> = {
                Math: { random: 'random' },
                performance: { now: 'clock', timeOrigin: 'clock' },
              };
              const ownedEffect = ({
                record,
                name,
              }: {
                record: Record<string, Effect>;
                name: string;
              }): Effect | null => (Object.hasOwn(record, name) ? (record[name] ?? null) : null);
              if (name === '__dirname' || name === '__filename') {
                return 'path';
              }
              if (!Object.hasOwn(specificMembers, name)) {
                return ownedEffect({ record: identifierEffects, name });
              }
              if (members.length === 0) {
                return null;
              }

              const record = specificMembers[name];
              const member = members[0];
              if (record === undefined || member === undefined) {
                return null;
              }

              return ownedEffect({ record, name: member });
            };
            const isInnerMember = (node: TSESTree.MemberExpression): boolean => {
              const parent6 = node.parent;

              return parent6.type === 'MemberExpression' && unwrapExpression(parent6.object) === node;
            };
            if (isInnerMember(node)) {
              return null;
            }
            const chain = memberChain(node);
            if (chain === null) {
              return isOpaqueGlobalThis({ sourceCode, node }) ? 'forbidden' : null;
            }
            const use = globalUse({ sourceCode, chain });

            return use === null ? null : effectForUse(use);
          };
          report({ node, effect: effectOfMember({ sourceCode, node }) });
        },
        ImportExpression(node: TSESTree.ImportExpression) {
          report({ node, effect: 'loading' });
        },
        ImportDeclaration(node: TSESTree.ImportDeclaration) {
          const specifiers3 = node.specifiers;
          report({ node, effect: specifiers3.length === 0 && node.importKind !== 'type' ? 'loading' : null });
        },
      };
    },
  }),
  'sync-domain': createRule({
    name: 'sync-domain',
    meta: {
      docs: { description: 'Keep the domain synchronous.' },
      type: 'problem',
      schema: [],
      messages: {
        sync: 'Keep the domain synchronous. Ports may return Promise, and application may await them.',
      },
    },
    defaultOptions: [],
    create(context) {
      if (layerOf({ filename: context.filename }) !== 'domain') {
        return {};
      }
      const sourceCode = context.sourceCode;
      const isPromise = (node: TSESTree.Identifier): boolean =>
        node.name === 'Promise' && isImplicitGlobal({ sourceCode, node });

      return {
        'FunctionDeclaration, FunctionExpression, ArrowFunctionExpression'(node: FunctionNode) {
          if (node.async || ('generator' in node && node.generator)) {
            context.report({ node, messageId: 'sync' });
          }
        },
        'AwaitExpression, YieldExpression'(node: TSESTree.AwaitExpression | TSESTree.YieldExpression) {
          context.report({ node, messageId: 'sync' });
        },
        TSTypeReference(node: TSESTree.TSTypeReference) {
          const root = referenceRoot(node);
          if (root !== null && isPromise(root)) {
            context.report({ node, messageId: 'sync' });
          }
        },
        'NewExpression, CallExpression'(node: TSESTree.NewExpression | TSESTree.CallExpression) {
          const callee = unwrapExpression(node.callee);
          if (callee.type === 'Identifier' && isPromise(callee)) {
            context.report({ node, messageId: 'sync' });
          }
        },
        MemberExpression(node: TSESTree.MemberExpression) {
          const object = unwrapExpression(node.object);
          if (object.type === 'Identifier' && isPromise(object)) {
            context.report({ node, messageId: 'sync' });
          }
        },
      };
    },
  }),
  'port-contracts': createRule({
    name: 'port-contracts',
    meta: {
      docs: { description: 'Keep port files to contracts and values.' },
      type: 'problem',
      schema: [],
      messages: {
        contract:
          'A port file holds types, interfaces, and values. Move functions, classes, enums, and namespaces out.',
      },
    },
    defaultOptions: [],
    create(context) {
      if (layerOf({ filename: context.filename }) !== 'ports') {
        return {};
      }

      return {
        'FunctionDeclaration, TSDeclareFunction, ClassDeclaration, ClassExpression, TSEnumDeclaration, TSModuleDeclaration'(
          node: TSESTree.Node,
        ) {
          context.report({ node, messageId: 'contract' });
        },
        'FunctionExpression, ArrowFunctionExpression'(
          node: TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression,
        ) {
          if (!isCallArgument(node)) {
            context.report({ node, messageId: 'contract' });
          }
        },
      };
    },
  }),
  'use-case': createRule({
    name: 'use-case',
    meta: {
      docs: { description: 'Export one application use case with a single object parameter.' },
      type: 'problem',
      schema: [],
      messages: {
        one: 'Export one use case function from an application file.',
        object: 'A use case takes one object parameter for its ports and input.',
      },
    },
    defaultOptions: [],
    create(context) {
      if (layerOf({ filename: context.filename }) !== 'application') {
        return {};
      }

      return {
        Program(node: TSESTree.Program) {
          const functionsFromExport = ({
            program,
            statement,
          }: {
            program: TSESTree.Program;
            statement: TSESTree.ProgramStatement;
          }): readonly FunctionNode[] => {
            const asFunction = (node: TSESTree.Node | null): FunctionNode | null => {
              if (node === null) {
                return null;
              }
              const value = unwrapExpression(node);

              return value.type === 'FunctionDeclaration' ||
                value.type === 'FunctionExpression' ||
                value.type === 'ArrowFunctionExpression'
                ? value
                : null;
            };
            if (statement.type === 'ExportDefaultDeclaration') {
              const declaration2 = statement.declaration;
              const fn = declaration2.type === 'FunctionDeclaration' ? declaration2 : asFunction(declaration2);

              return fn === null ? [] : [fn];
            }
            if (statement.type !== 'ExportNamedDeclaration' || statement.source !== null) {
              return [];
            }
            const declaration3 = statement.declaration;
            if (declaration3?.type === 'FunctionDeclaration') {
              return [declaration3];
            }
            const declaration4 = statement.declaration;
            if (declaration4?.type === 'VariableDeclaration') {
              const declarations3 = declaration4.declarations;

              return declarations3.flatMap((declarator) => {
                const fn = declarator.init === null ? null : asFunction(declarator.init);

                return fn === null ? [] : [fn];
              });
            }

            const specifiers2 = statement.specifiers;

            return specifiers2.flatMap((specifier) => {
              const functionsNamed = ({
                program,
                name,
              }: {
                program: TSESTree.Program;
                name: string;
              }): readonly FunctionNode[] => {
                const body2 = program.body;

                return body2.flatMap((statement) => {
                  const declaration = statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
                  if (declaration !== null && declaration.type === 'FunctionDeclaration') {
                    const id2 = declaration.id;
                    if (id2?.name === name) {
                      return [declaration];
                    }
                  }
                  if (declaration?.type !== 'VariableDeclaration') {
                    return [];
                  }

                  const declarations2 = declaration.declarations;

                  return declarations2.flatMap((declarator) => {
                    const id3 = declarator.id;
                    const fn =
                      id3.type === 'Identifier' && id3.name === name && declarator.init !== null
                        ? asFunction(declarator.init)
                        : null;

                    return fn === null ? [] : [fn];
                  });
                });
              };
              const local2 = specifier.local;

              return functionsNamed({ program, name: local2.name });
            });
          };
          const body3 = node.body;
          const exported = [
            ...new Set(body3.flatMap((statement) => functionsFromExport({ program: node, statement }))),
          ];
          exported.forEach((fn) => {
            const takesObject = (fn: FunctionNode): boolean => {
              const params2 = fn.params;
              if (params2.length !== 1) {
                return false;
              }
              const params3 = fn.params;
              const parameter = params3[0];
              if (parameter === undefined) {
                return false;
              }
              const pattern = parameter.type === 'AssignmentPattern' ? parameter.left : parameter;

              return pattern.type === 'ObjectPattern';
            };
            if (exported.length > 1) {
              context.report({ node: fn, messageId: 'one' });
            }
            if (!takesObject(fn)) {
              context.report({ node: fn, messageId: 'object' });
            }
          });
        },
      };
    },
  }),
  'direct-exports': createRule({
    name: 'direct-exports',
    meta: {
      docs: { description: 'Name core exports in the file that defines them.' },
      type: 'problem',
      schema: [],
      messages: {
        direct: 'Export the core name from the file that defines it. Do not re-export or use a default export.',
      },
    },
    defaultOptions: [],
    create(context) {
      if (!isCore(layerOf({ filename: context.filename }))) {
        return {};
      }

      return {
        'ExportDefaultDeclaration, ExportAllDeclaration'(
          node: TSESTree.ExportDefaultDeclaration | TSESTree.ExportAllDeclaration,
        ) {
          context.report({ node, messageId: 'direct' });
        },
        ExportNamedDeclaration(node: TSESTree.ExportNamedDeclaration) {
          if (node.source !== null) {
            context.report({ node, messageId: 'direct' });
          }
        },
      };
    },
  }),
  'core-errors': createRule({
    name: 'core-errors',
    meta: {
      docs: { description: 'Use string unions and domain error classes in the core.' },
      type: 'problem',
      schema: [],
      messages: {
        enum: 'Use a string union instead of an enum or namespace.',
        portClass: 'Declare error classes in the domain, not in a port.',
        class: 'A core class must extend Error or a name ending in Error.',
        builtin: 'Throw a domain error class, not a built-in error.',
      },
    },
    defaultOptions: [],
    create(context) {
      const layer = layerOf({ filename: context.filename });
      if (!isCore(layer)) {
        return {};
      }

      return {
        'TSEnumDeclaration, TSModuleDeclaration'(node: TSESTree.TSEnumDeclaration | TSESTree.TSModuleDeclaration) {
          context.report({ node, messageId: 'enum' });
        },
        'ClassDeclaration, ClassExpression'(node: TSESTree.ClassDeclaration | TSESTree.ClassExpression) {
          const extendsError = (node: TSESTree.ClassDeclaration | TSESTree.ClassExpression): boolean => {
            const rightmostName = (node: TSESTree.Node): string | null => {
              const value = unwrapExpression(node);
              if (value.type === 'Identifier') {
                return value.name;
              }
              if (value.type !== 'MemberExpression') {
                return null;
              }
              const property5 = value.property;
              if (!value.computed && property5.type === 'Identifier') {
                const property11 = value.property;

                return property11.name;
              }

              const property12 = value.property;

              return property12.type === 'Literal' && typeof property12.value === 'string' ? property12.value : null;
            };
            if (node.superClass === null) {
              return false;
            }
            const name = rightmostName(node.superClass);

            return name === 'Error' || (name !== null && name.endsWith('Error'));
          };
          if (layer === 'ports') {
            context.report({ node, messageId: 'portClass' });
          } else if (!extendsError(node)) {
            context.report({ node, messageId: 'class' });
          }
        },
        'NewExpression, CallExpression'(node: TSESTree.NewExpression | TSESTree.CallExpression) {
          const builtinName = ({
            sourceCode,
            node,
          }: {
            sourceCode: TSESLint.SourceCode;
            node: TSESTree.Node;
          }): string | null => {
            const builtinErrors = new Set([
              'Error',
              'TypeError',
              'RangeError',
              'SyntaxError',
              'ReferenceError',
              'EvalError',
              'URIError',
              'AggregateError',
            ]);
            const value = unwrapExpression(node);
            if (value.type === 'Identifier') {
              return builtinErrors.has(value.name) && isImplicitGlobal({ sourceCode, node: value }) ? value.name : null;
            }
            if (value.type !== 'MemberExpression') {
              return null;
            }
            const chain = memberChain(value);
            if (chain === null) {
              return null;
            }
            const use = globalUse({ sourceCode, chain });

            if (use === null) {
              return null;
            }
            const members5 = use.members;

            return members5.length === 0 && builtinErrors.has(use.name) ? use.name : null;
          };
          const sourceCode = context.sourceCode;
          if (builtinName({ sourceCode, node: node.callee }) !== null) {
            context.report({ node, messageId: 'builtin' });
          }
        },
      };
    },
  }),
  'readonly-model': createRule({
    name: 'readonly-model',
    meta: {
      docs: { description: 'Keep domain and port data readonly.' },
      type: 'problem',
      schema: [],
      messages: {
        member: 'Mark this domain or port member readonly.',
        collection: 'Use a readonly array or tuple in the domain and ports.',
      },
    },
    defaultOptions: [],
    create(context) {
      const layer = layerOf({ filename: context.filename });
      if (layer !== 'domain' && layer !== 'ports') {
        return {};
      }

      return {
        'TSPropertySignature, TSIndexSignature, PropertyDefinition, TSParameterProperty'(
          node:
            | TSESTree.TSPropertySignature
            | TSESTree.TSIndexSignature
            | TSESTree.PropertyDefinition
            | TSESTree.TSParameterProperty,
        ) {
          if (!node.readonly) {
            context.report({ node, messageId: 'member' });
          }
        },
        TSMappedType(node: TSESTree.TSMappedType) {
          if (node.readonly !== true && node.readonly !== '+') {
            context.report({ node, messageId: 'member' });
          }
        },
        'TSArrayType, TSTupleType'(node: TSESTree.TSArrayType | TSESTree.TSTupleType) {
          const isReadonlyCollection = (node: TSESTree.Node): boolean => {
            const parent = node.parent;

            return parent !== undefined && parent.type === 'TSTypeOperator' && parent.operator === 'readonly';
          };
          if (!isReadonlyCollection(node)) {
            context.report({ node, messageId: 'collection' });
          }
        },
        TSTypeReference(node: TSESTree.TSTypeReference) {
          const sourceCode = context.sourceCode;
          const root = referenceRoot(node);
          if (root !== null && root.name === 'Array' && isImplicitGlobal({ sourceCode, node: root })) {
            context.report({ node, messageId: 'collection' });
          }
        },
      };
    },
  }),
};
