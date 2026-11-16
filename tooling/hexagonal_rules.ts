import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { ASTUtils, ESLintUtils } from "@typescript-eslint/utils";

const createRule = ESLintUtils.RuleCreator(() => "docs/lint-policy.md");
const layerMarkers = [
  ["primary", "/src/adapters/primary/"],
  ["secondary", "/src/adapters/secondary/"],
  ["domain", "/src/domain/"],
  ["ports", "/src/ports/"],
  ["application", "/src/application/"],
  ["composition", "/src/composition/"],
  ["presentation", "/src/presentation/"],
] as const;
type Layer = (typeof layerMarkers)[number][0];
type Effect =
  | "clock"
  | "random"
  | "network"
  | "timer"
  | "process"
  | "console"
  | "buffer"
  | "path"
  | "loading"
  | "intl"
  | "forbidden";
type FunctionNode = TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression;

const effectLayers: Record<Effect, readonly Layer[]> = {
  clock: ["secondary"],
  random: ["secondary"],
  network: ["secondary"],
  timer: ["primary", "secondary"],
  process: ["composition"],
  console: ["secondary", "composition"],
  buffer: ["primary", "secondary"],
  path: ["secondary", "composition"],
  loading: ["primary", "secondary", "composition", "presentation"],
  intl: ["primary", "secondary", "composition", "presentation"],
  forbidden: [],
};
const identifierEffects: Record<string, Effect> = {
  Date: "clock",
  fetch: "network",
  XMLHttpRequest: "network",
  WebSocket: "network",
  setTimeout: "timer",
  setInterval: "timer",
  setImmediate: "timer",
  queueMicrotask: "timer",
  clearTimeout: "timer",
  clearInterval: "timer",
  clearImmediate: "timer",
  requestAnimationFrame: "timer",
  cancelAnimationFrame: "timer",
  process: "process",
  console: "console",
  Buffer: "buffer",
  __dirname: "path",
  __filename: "path",
  Intl: "intl",
  require: "loading",
  Function: "forbidden",
  eval: "forbidden",
  document: "forbidden",
  window: "forbidden",
  self: "forbidden",
  localStorage: "forbidden",
  sessionStorage: "forbidden",
  navigator: "forbidden",
  location: "forbidden",
  history: "forbidden",
  screen: "forbidden",
  addEventListener: "forbidden",
  removeEventListener: "forbidden",
  postMessage: "forbidden",
  crypto: "random",
};
const specificMembers: Record<string, Record<string, Effect>> = {
  Math: { random: "random" },
  performance: { now: "clock", timeOrigin: "clock" },
};
const builtinErrors = new Set([
  "Error",
  "TypeError",
  "RangeError",
  "SyntaxError",
  "ReferenceError",
  "EvalError",
  "URIError",
  "AggregateError",
]);
const coreLayers = new Set<Layer>(["domain", "ports", "application"]);

const layerOf = ({ filename }: { filename: string }): Layer | null => {
  const normalized = filename.replaceAll("\\", "/");
  if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(normalized)) {
    return null;
  }
  const match = layerMarkers.find(([, marker]) => normalized.includes(marker));

  return match === undefined ? null : match[0];
};

const unwrapExpression = (node: TSESTree.Node): TSESTree.Node =>
  node.type === "TSAsExpression" || node.type === "TSSatisfiesExpression" || node.type === "TSNonNullExpression"
    ? unwrapExpression(node.expression)
    : node;

const propertyName = (node: TSESTree.MemberExpression): string | null => {
  if (!node.computed && node.property.type === "Identifier") {
    return node.property.name;
  }
  if (node.property.type === "Literal" && typeof node.property.value === "string") {
    return node.property.value;
  }
  if (node.property.type === "TemplateLiteral" && node.property.expressions.length === 0) {
    return node.property.quasis[0]?.value.cooked ?? null;
  }

  return null;
};

const isSkippedName = (node: TSESTree.Identifier): boolean => {
  const parent = node.parent;
  if (
    parent.type === "MemberExpression" &&
    (parent.object === node || (!parent.computed && parent.property === node))
  ) {
    return true;
  }

  return (
    (parent.type === "Property" ||
      parent.type === "PropertyDefinition" ||
      parent.type === "MethodDefinition" ||
      parent.type === "TSPropertySignature" ||
      parent.type === "TSMethodSignature") &&
    parent.key === node &&
    !parent.computed
  );
};

const outermostName = (
  node: TSESTree.Identifier | TSESTree.TSQualifiedName,
): { parent: TSESTree.Node; name: TSESTree.Node } =>
  node.parent.type === "TSQualifiedName" && node.parent.left === node
    ? outermostName(node.parent)
    : { parent: node.parent, name: node };

const isTypeName = (node: TSESTree.Identifier): boolean => {
  const owned = outermostName(node);

  return owned.parent.type === "TSTypeReference" && owned.parent.typeName === owned.name;
};

const isImplicitGlobal = ({
  sourceCode,
  node,
}: {
  sourceCode: TSESLint.SourceCode;
  node: TSESTree.Identifier;
}): boolean => {
  const variable = ASTUtils.findVariable(sourceCode.getScope(node), node);
  if (variable !== null && variable.defs.length !== 0) {
    return false;
  }
  if (isTypeName(node)) {
    return true;
  }
  if (variable === null) {
    return !isSkippedName(node);
  }

  return variable.references.some((reference) => reference.identifier === node);
};

const memberChain = (
  node: TSESTree.MemberExpression,
): { root: TSESTree.Identifier; members: readonly string[] } | null => {
  const name = propertyName(node);
  if (name === null) {
    return null;
  }
  const object = unwrapExpression(node.object);
  if (object.type === "MemberExpression") {
    const inner = memberChain(object);

    return inner === null ? null : { root: inner.root, members: [...inner.members, name] };
  }

  return object.type === "Identifier" ? { root: object, members: [name] } : null;
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
  if (chain.root.name !== "globalThis") {
    return { name: chain.root.name, members: chain.members };
  }
  if (chain.members.length === 0) {
    return null;
  }
  const [name, ...members] = chain.members;

  return { name, members };
};

const ownedEffect = ({ record, name }: { record: Record<string, Effect>; name: string }): Effect | null =>
  Object.hasOwn(record, name) ? record[name] : null;

const effectForUse = ({ name, members }: { name: string; members: readonly string[] }): Effect | null => {
  if (!Object.hasOwn(specificMembers, name)) {
    return ownedEffect({ record: identifierEffects, name });
  }
  if (members.length === 0) {
    return null;
  }

  return ownedEffect({ record: specificMembers[name], name: members[0] });
};

const isInnerMember = (node: TSESTree.MemberExpression): boolean =>
  node.parent.type === "MemberExpression" && unwrapExpression(node.parent.object) === node;

const isOpaqueGlobalThis = ({
  sourceCode,
  node,
}: {
  sourceCode: TSESLint.SourceCode;
  node: TSESTree.MemberExpression;
}): boolean => {
  const object = unwrapExpression(node.object);
  if (object.type === "MemberExpression") {
    return isOpaqueGlobalThis({ sourceCode, node: object }) || propertyName(node) === null;
  }

  return (
    object.type === "Identifier" &&
    object.name === "globalThis" &&
    isImplicitGlobal({ sourceCode, node: object }) &&
    propertyName(node) === null
  );
};

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
  if (node.name === "Function" && isTypeName(node)) {
    return null;
  }

  return identifierEffects[node.name] ?? null;
};

const effectOfMember = ({
  sourceCode,
  node,
}: {
  sourceCode: TSESLint.SourceCode;
  node: TSESTree.MemberExpression;
}): Effect | null => {
  if (isInnerMember(node)) {
    return null;
  }
  const chain = memberChain(node);
  if (chain === null) {
    return isOpaqueGlobalThis({ sourceCode, node }) ? "forbidden" : null;
  }
  const use = globalUse({ sourceCode, chain });

  return use === null ? null : effectForUse(use);
};

const referenceRoot = (node: TSESTree.TSTypeReference): TSESTree.Identifier | null => {
  if (node.typeName.type === "Identifier") {
    return node.typeName;
  }
  if (node.typeName.type !== "TSQualifiedName") {
    return null;
  }
  const owned = outermostName(node.typeName);

  return owned.name.type === "Identifier" ? owned.name : null;
};

const asFunction = (node: TSESTree.Node | null): FunctionNode | null => {
  if (node === null) {
    return null;
  }
  const value = unwrapExpression(node);

  return value.type === "FunctionDeclaration" ||
    value.type === "FunctionExpression" ||
    value.type === "ArrowFunctionExpression"
    ? value
    : null;
};

const functionsNamed = ({ program, name }: { program: TSESTree.Program; name: string }): readonly FunctionNode[] =>
  program.body.flatMap((statement) => {
    const declaration = statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
    if (declaration?.type === "FunctionDeclaration" && declaration.id?.name === name) {
      return [declaration];
    }
    if (declaration?.type !== "VariableDeclaration") {
      return [];
    }

    return declaration.declarations.flatMap((declarator) => {
      const fn =
        declarator.id.type === "Identifier" && declarator.id.name === name && declarator.init !== null
          ? asFunction(declarator.init)
          : null;

      return fn === null ? [] : [fn];
    });
  });

const functionsFromExport = ({
  program,
  statement,
}: {
  program: TSESTree.Program;
  statement: TSESTree.ProgramStatement;
}): readonly FunctionNode[] => {
  if (statement.type === "ExportDefaultDeclaration") {
    const fn =
      statement.declaration.type === "FunctionDeclaration" ? statement.declaration : asFunction(statement.declaration);

    return fn === null ? [] : [fn];
  }
  if (statement.type !== "ExportNamedDeclaration" || statement.source !== null) {
    return [];
  }
  if (statement.declaration?.type === "FunctionDeclaration") {
    return [statement.declaration];
  }
  if (statement.declaration?.type === "VariableDeclaration") {
    return statement.declaration.declarations.flatMap((declarator) => {
      const fn = declarator.init === null ? null : asFunction(declarator.init);

      return fn === null ? [] : [fn];
    });
  }

  return statement.specifiers.flatMap((specifier) => functionsNamed({ program, name: specifier.local.name }));
};

const takesObject = (fn: FunctionNode): boolean => {
  if (fn.params.length !== 1) {
    return false;
  }
  const parameter = fn.params[0];
  const pattern = parameter.type === "AssignmentPattern" ? parameter.left : parameter;

  return pattern.type === "ObjectPattern";
};

const isCallArgument = (node: TSESTree.Node): boolean => {
  const parent = node.parent;
  if (parent === undefined) {
    return false;
  }
  if (
    parent.type === "TSAsExpression" ||
    parent.type === "TSSatisfiesExpression" ||
    parent.type === "TSNonNullExpression"
  ) {
    return isCallArgument(parent);
  }
  if (parent.type !== "CallExpression") {
    return false;
  }

  return parent.arguments.some((argument) => argument === node);
};

const rightmostName = (node: TSESTree.Node): string | null => {
  const value = unwrapExpression(node);
  if (value.type === "Identifier") {
    return value.name;
  }
  if (value.type !== "MemberExpression") {
    return null;
  }
  if (!value.computed && value.property.type === "Identifier") {
    return value.property.name;
  }

  return value.property.type === "Literal" && typeof value.property.value === "string" ? value.property.value : null;
};

const extendsError = (node: TSESTree.ClassDeclaration | TSESTree.ClassExpression): boolean => {
  if (node.superClass === null) {
    return false;
  }
  const name = rightmostName(node.superClass);

  return name === "Error" || (name !== null && name.endsWith("Error"));
};

const builtinName = ({ sourceCode, node }: { sourceCode: TSESLint.SourceCode; node: TSESTree.Node }): string | null => {
  const value = unwrapExpression(node);
  if (value.type === "Identifier") {
    return builtinErrors.has(value.name) && isImplicitGlobal({ sourceCode, node: value }) ? value.name : null;
  }
  if (value.type !== "MemberExpression") {
    return null;
  }
  const chain = memberChain(value);
  if (chain === null) {
    return null;
  }
  const use = globalUse({ sourceCode, chain });

  return use !== null && use.members.length === 0 && builtinErrors.has(use.name) ? use.name : null;
};

const isReadonlyCollection = (node: TSESTree.Node): boolean => {
  const parent = node.parent;

  return parent !== undefined && parent.type === "TSTypeOperator" && parent.operator === "readonly";
};

const isCore = (layer: Layer | null): boolean => layer !== null && coreLayers.has(layer);

export const hexagonalRules = {
  "ambient-effects": createRule({
    name: "ambient-effects",
    meta: {
      docs: { description: "Limit ambient effects to the layer that owns them." },
      type: "problem",
      schema: [],
      messages: {
        clock: "Read Date only in a secondary adapter. Pass time in as a number.",
        random: "Draw randomness only in a secondary adapter.",
        network: "Call the network only in a secondary adapter.",
        timer: "Schedule time only in a primary or secondary adapter.",
        process: "Read process only in composition, then pass the value in.",
        console: "Log through a port. console belongs in a secondary adapter or composition.",
        buffer: "Use Buffer only in an adapter.",
        path: "Use __dirname and __filename only in a secondary adapter or composition.",
        loading: "Load modules dynamically only from an adapter, composition, or presentation.",
        intl: "Use Intl outside the domain, ports, and application.",
        forbidden: "Keep this browser or runtime global behind a port.",
      },
    },
    defaultOptions: [],
    create(context) {
      const layer = layerOf({ filename: context.filename });
      if (layer === null) {
        return {};
      }
      const sourceCode = context.sourceCode;
      const report = ({ node, effect }: { node: TSESTree.Node; effect: Effect | null }): void => {
        if (effect === null || effectLayers[effect].includes(layer)) {
          return;
        }
        context.report({ node, messageId: effect });
      };

      return {
        Identifier(node: TSESTree.Identifier) {
          report({ node, effect: effectOfIdentifier({ sourceCode, node }) });
        },
        MemberExpression(node: TSESTree.MemberExpression) {
          report({ node, effect: effectOfMember({ sourceCode, node }) });
        },
        ImportExpression(node: TSESTree.ImportExpression) {
          report({ node, effect: "loading" });
        },
        ImportDeclaration(node: TSESTree.ImportDeclaration) {
          report({ node, effect: node.specifiers.length === 0 && node.importKind !== "type" ? "loading" : null });
        },
      };
    },
  }),
  "sync-domain": createRule({
    name: "sync-domain",
    meta: {
      docs: { description: "Keep the domain synchronous." },
      type: "problem",
      schema: [],
      messages: {
        sync: "Keep the domain synchronous. Ports may return Promise, and application may await them.",
      },
    },
    defaultOptions: [],
    create(context) {
      if (layerOf({ filename: context.filename }) !== "domain") {
        return {};
      }
      const sourceCode = context.sourceCode;
      const isPromise = (node: TSESTree.Identifier): boolean =>
        node.name === "Promise" && isImplicitGlobal({ sourceCode, node });

      return {
        "FunctionDeclaration, FunctionExpression, ArrowFunctionExpression"(node: FunctionNode) {
          if (node.async || ("generator" in node && node.generator)) {
            context.report({ node, messageId: "sync" });
          }
        },
        "AwaitExpression, YieldExpression"(node: TSESTree.AwaitExpression | TSESTree.YieldExpression) {
          context.report({ node, messageId: "sync" });
        },
        TSTypeReference(node: TSESTree.TSTypeReference) {
          const root = referenceRoot(node);
          if (root !== null && isPromise(root)) {
            context.report({ node, messageId: "sync" });
          }
        },
        "NewExpression, CallExpression"(node: TSESTree.NewExpression | TSESTree.CallExpression) {
          const callee = unwrapExpression(node.callee);
          if (callee.type === "Identifier" && isPromise(callee)) {
            context.report({ node, messageId: "sync" });
          }
        },
        MemberExpression(node: TSESTree.MemberExpression) {
          const object = unwrapExpression(node.object);
          if (object.type === "Identifier" && isPromise(object)) {
            context.report({ node, messageId: "sync" });
          }
        },
      };
    },
  }),
  "port-contracts": createRule({
    name: "port-contracts",
    meta: {
      docs: { description: "Keep port files to contracts and values." },
      type: "problem",
      schema: [],
      messages: {
        contract:
          "A port file holds types, interfaces, and values. Move functions, classes, enums, and namespaces out.",
      },
    },
    defaultOptions: [],
    create(context) {
      if (layerOf({ filename: context.filename }) !== "ports") {
        return {};
      }

      return {
        "FunctionDeclaration, TSDeclareFunction, ClassDeclaration, ClassExpression, TSEnumDeclaration, TSModuleDeclaration"(
          node: TSESTree.Node,
        ) {
          context.report({ node, messageId: "contract" });
        },
        "FunctionExpression, ArrowFunctionExpression"(
          node: TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression,
        ) {
          if (!isCallArgument(node)) {
            context.report({ node, messageId: "contract" });
          }
        },
      };
    },
  }),
  "use-case": createRule({
    name: "use-case",
    meta: {
      docs: { description: "Export one application use case with a single object parameter." },
      type: "problem",
      schema: [],
      messages: {
        one: "Export one use case function from an application file.",
        object: "A use case takes one object parameter for its ports and input.",
      },
    },
    defaultOptions: [],
    create(context) {
      if (layerOf({ filename: context.filename }) !== "application") {
        return {};
      }

      return {
        Program(node: TSESTree.Program) {
          const exported = [
            ...new Set(node.body.flatMap((statement) => functionsFromExport({ program: node, statement }))),
          ];
          exported.forEach((fn) => {
            if (exported.length > 1) {
              context.report({ node: fn, messageId: "one" });
            }
            if (!takesObject(fn)) {
              context.report({ node: fn, messageId: "object" });
            }
          });
        },
      };
    },
  }),
  "direct-exports": createRule({
    name: "direct-exports",
    meta: {
      docs: { description: "Name core exports in the file that defines them." },
      type: "problem",
      schema: [],
      messages: {
        direct: "Export the core name from the file that defines it. Do not re-export or use a default export.",
      },
    },
    defaultOptions: [],
    create(context) {
      if (!isCore(layerOf({ filename: context.filename }))) {
        return {};
      }

      return {
        "ExportDefaultDeclaration, ExportAllDeclaration"(
          node: TSESTree.ExportDefaultDeclaration | TSESTree.ExportAllDeclaration,
        ) {
          context.report({ node, messageId: "direct" });
        },
        ExportNamedDeclaration(node: TSESTree.ExportNamedDeclaration) {
          if (node.source !== null) {
            context.report({ node, messageId: "direct" });
          }
        },
      };
    },
  }),
  "core-errors": createRule({
    name: "core-errors",
    meta: {
      docs: { description: "Use string unions and domain error classes in the core." },
      type: "problem",
      schema: [],
      messages: {
        enum: "Use a string union instead of an enum or namespace.",
        portClass: "Declare error classes in the domain, not in a port.",
        class: "A core class must extend Error or a name ending in Error.",
        builtin: "Throw a domain error class, not a built-in error.",
      },
    },
    defaultOptions: [],
    create(context) {
      const layer = layerOf({ filename: context.filename });
      if (!isCore(layer)) {
        return {};
      }
      const sourceCode = context.sourceCode;

      return {
        "TSEnumDeclaration, TSModuleDeclaration"(node: TSESTree.TSEnumDeclaration | TSESTree.TSModuleDeclaration) {
          context.report({ node, messageId: "enum" });
        },
        "ClassDeclaration, ClassExpression"(node: TSESTree.ClassDeclaration | TSESTree.ClassExpression) {
          if (layer === "ports") {
            context.report({ node, messageId: "portClass" });
          } else if (!extendsError(node)) {
            context.report({ node, messageId: "class" });
          }
        },
        "NewExpression, CallExpression"(node: TSESTree.NewExpression | TSESTree.CallExpression) {
          if (builtinName({ sourceCode, node: node.callee }) !== null) {
            context.report({ node, messageId: "builtin" });
          }
        },
      };
    },
  }),
  "readonly-model": createRule({
    name: "readonly-model",
    meta: {
      docs: { description: "Keep domain and port data readonly." },
      type: "problem",
      schema: [],
      messages: {
        member: "Mark this domain or port member readonly.",
        collection: "Use a readonly array or tuple in the domain and ports.",
      },
    },
    defaultOptions: [],
    create(context) {
      const layer = layerOf({ filename: context.filename });
      if (layer !== "domain" && layer !== "ports") {
        return {};
      }
      const sourceCode = context.sourceCode;

      return {
        "TSPropertySignature, TSIndexSignature, PropertyDefinition, TSParameterProperty"(
          node:
            | TSESTree.TSPropertySignature
            | TSESTree.TSIndexSignature
            | TSESTree.PropertyDefinition
            | TSESTree.TSParameterProperty,
        ) {
          if (!node.readonly) {
            context.report({ node, messageId: "member" });
          }
        },
        TSMappedType(node: TSESTree.TSMappedType) {
          if (node.readonly !== true && node.readonly !== "+") {
            context.report({ node, messageId: "member" });
          }
        },
        "TSArrayType, TSTupleType"(node: TSESTree.TSArrayType | TSESTree.TSTupleType) {
          if (!isReadonlyCollection(node)) {
            context.report({ node, messageId: "collection" });
          }
        },
        TSTypeReference(node: TSESTree.TSTypeReference) {
          const root = referenceRoot(node);
          if (root !== null && root.name === "Array" && isImplicitGlobal({ sourceCode, node: root })) {
            context.report({ node, messageId: "collection" });
          }
        },
      };
    },
  }),
};
