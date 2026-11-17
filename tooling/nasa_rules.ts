import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import { ASTUtils, ESLintUtils } from '@typescript-eslint/utils';
import ts from 'typescript';

const createRule = ESLintUtils.RuleCreator(() => 'docs/lint-policy.md');
type Variable = TSESLint.Scope.Variable;
type Scope = TSESLint.Scope.Scope;
type FunctionNode = TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression;
interface RecursionState {
  sourceCode: TSESLint.SourceCode;
  functionNodes: TSESTree.Node[];
  ids: Map<TSESTree.Node, number>;
  variableIds: Map<Variable, number>;
  methodIds: Map<TSESTree.Node, Map<string, number>>;
  edges: number[][];
  stack: TSESTree.Node[];
}
interface CycleState {
  color: number[];
  trail: number[];
  work: { id: number; index: number }[];
  cyclic: number[];
}

function paint({ color, index, value }: { color: readonly number[]; index: number; value: number }): number[] {
  return color.map((current, position) => (position === index ? value : current));
}

function ensureFunction({ state, node }: { state: RecursionState; node: TSESTree.Node }): {
  state: RecursionState;
  id: number;
} {
  const ids = state.ids;
  const existing = ids.get(node);
  if (existing !== undefined) {
    return { state, id: existing };
  }
  const functionNodes = state.functionNodes;
  const edges = state.edges;
  const id = functionNodes.length;
  const recorded = new Map(ids).set(node, id);

  return {
    state: {
      ...state,
      functionNodes: functionNodes.concat([node]),
      edges: edges.concat([[]]),
      ids: recorded,
    },
    id,
  };
}

function bindName({
  state,
  scope,
  name,
  id,
}: {
  state: RecursionState;
  scope: Scope | null | undefined;
  name: string;
  id: number;
}): RecursionState {
  if (scope === null || scope === undefined) {
    return state;
  }
  const variables = scope.set;
  const variable = variables.get(name);
  if (variable === undefined) {
    return state;
  }
  const variableIds = new Map(state.variableIds);

  return { ...state, variableIds: variableIds.set(variable, id) };
}

function withStack({ state, node }: { state: RecursionState; node: TSESTree.Node }): RecursionState {
  const stack = state.stack;

  return { ...state, stack: stack.concat([node]) };
}

function methodKey(parent: TSESTree.Node): string | null {
  if (parent.type !== 'MethodDefinition' && parent.type !== 'Property') {
    return null;
  }
  const key = parent.key;
  if (parent.computed || key.type !== 'Identifier') {
    return null;
  }

  return key.name;
}

function methodOwner(node: TSESTree.FunctionExpression): { key: string; owner: TSESTree.Node } | null {
  const parent = node.parent;
  const key = methodKey(parent);
  if (key === null) {
    return null;
  }
  if (parent.type === 'MethodDefinition' && parent.value === node) {
    const body = parent.parent;
    const owner = body.parent;

    return { key, owner };
  }
  if (parent.type === 'Property' && parent.method && parent.value === node) {
    const owner = parent.parent;

    return { key, owner };
  }

  return null;
}

function rememberMethod({
  state,
  node,
  id,
}: {
  state: RecursionState;
  node: TSESTree.FunctionExpression;
  id: number;
}): RecursionState {
  const located = methodOwner(node);
  if (located === null) {
    return state;
  }
  const methodIds = state.methodIds;
  const current = methodIds.get(located.owner) ?? new Map<string, number>();
  const recorded = new Map(current).set(located.key, id);
  const stored = new Map(methodIds).set(located.owner, recorded);

  return { ...state, methodIds: stored };
}

function trackDeclaration({
  state,
  node,
}: {
  state: RecursionState;
  node: TSESTree.FunctionDeclaration;
}): RecursionState {
  const idNode = node.id;
  if (idNode === null) {
    return withStack({ state, node });
  }
  const named = ensureFunction({ state, node });
  const current = named.state;
  const sourceCode = current.sourceCode;
  const scope = sourceCode.getScope(node);
  const bound = bindName({ state: current, scope, name: idNode.name, id: named.id });
  const upper = scope.upper;

  return withStack({ state: bindName({ state: bound, scope: upper, name: idNode.name, id: named.id }), node });
}

function trackExpression({
  state,
  node,
}: {
  state: RecursionState;
  node: TSESTree.FunctionExpression;
}): RecursionState {
  const named = ensureFunction({ state, node });
  const idNode = node.id;
  const current = named.state;
  const sourceCode = current.sourceCode;
  const bound =
    idNode === null
      ? current
      : bindName({ state: current, scope: sourceCode.getScope(node), name: idNode.name, id: named.id });
  const remembered = rememberMethod({ state: bound, node, id: named.id });

  return withStack({ state: remembered, node });
}

function trackFunction({ state, node }: { state: RecursionState; node: FunctionNode }): RecursionState {
  if (node.type === 'FunctionDeclaration') {
    return trackDeclaration({ state, node });
  }
  if (node.type === 'FunctionExpression') {
    return trackExpression({ state, node });
  }

  return withStack({ state, node });
}

function popStack(state: RecursionState): RecursionState {
  const stack = state.stack;

  return { ...state, stack: stack.slice(0, -1) };
}

function trackAssigned({ state, node }: { state: RecursionState; node: TSESTree.VariableDeclarator }): RecursionState {
  const id = node.id;
  const init = node.init;
  if (
    id.type !== 'Identifier' ||
    init === null ||
    (init.type !== 'ArrowFunctionExpression' && init.type !== 'FunctionExpression')
  ) {
    return state;
  }
  const sourceCode = state.sourceCode;
  const variable = ASTUtils.findVariable(sourceCode.getScope(node), id.name);
  if (variable === null) {
    return state;
  }
  const named = ensureFunction({ state, node: init });
  const current = named.state;
  const variableIds = new Map(current.variableIds);

  return { ...current, variableIds: variableIds.set(variable, named.id) };
}

function nearestTracked({
  stack,
  ids,
}: {
  stack: readonly TSESTree.Node[];
  ids: ReadonlyMap<TSESTree.Node, number>;
}): number | undefined {
  const steps = Array.from({ length: 64 });
  const found = steps.reduce(
    (current: { index: number; id: number | undefined }) => {
      if (current.id !== undefined || current.index < 0) {
        return current;
      }
      const node = stack[current.index];
      const id = node === undefined ? undefined : ids.get(node);

      return { index: current.index - 1, id };
    },
    { index: stack.length - 1, id: undefined },
  );

  return found.id;
}

function ownerOf(fn: TSESTree.Node): TSESTree.Node | undefined {
  const parent = fn.parent;
  if (parent === undefined) {
    return undefined;
  }
  if (parent.type === 'MethodDefinition' && parent.value === fn) {
    const body = parent.parent;

    return body.parent;
  }
  if (parent.type === 'Property' && parent.method && parent.value === fn) {
    return parent.parent;
  }

  return undefined;
}

function thisOwner(stack: readonly TSESTree.Node[]): TSESTree.Node | undefined {
  const steps = Array.from({ length: 64 });
  const found = steps.reduce(
    (current: { index: number; owner: TSESTree.Node | undefined }) => {
      if (current.owner !== undefined || current.index < 0) {
        return current;
      }
      const fn = stack[current.index];

      return { index: current.index - 1, owner: fn === undefined ? undefined : ownerOf(fn) };
    },
    { index: stack.length - 1, owner: undefined },
  );

  return found.owner;
}

function callTarget({
  callee,
  sourceCode,
  variableIds,
  methodIds,
  stack,
}: {
  callee: TSESTree.Node;
  sourceCode: TSESLint.SourceCode;
  variableIds: ReadonlyMap<Variable, number>;
  methodIds: ReadonlyMap<TSESTree.Node, ReadonlyMap<string, number>>;
  stack: readonly TSESTree.Node[];
}): number | undefined {
  if (callee.type === 'Identifier') {
    const variable = ASTUtils.findVariable(sourceCode.getScope(callee), callee.name);

    return variable === null ? undefined : variableIds.get(variable);
  }
  if (callee.type !== 'MemberExpression' || callee.computed) {
    return undefined;
  }
  const object = callee.object;
  if (object.type !== 'ThisExpression') {
    return undefined;
  }
  const property = callee.property;
  if (property.type !== 'Identifier') {
    return undefined;
  }
  const owner = thisOwner(stack);
  if (owner === undefined) {
    return undefined;
  }
  const methods = methodIds.get(owner);

  return methods?.get(property.name);
}

function trackCall({ state, node }: { state: RecursionState; node: TSESTree.CallExpression }): RecursionState {
  const stack = state.stack;
  const ids = state.ids;
  const caller = nearestTracked({ stack, ids });
  const sourceCode = state.sourceCode;
  const variableIds = state.variableIds;
  const methodIds = state.methodIds;
  const target = callTarget({ callee: node.callee, sourceCode, variableIds, methodIds, stack });
  if (caller === undefined || target === undefined) {
    return state;
  }
  const edges = state.edges;
  const inner = edges[caller] ?? [];
  const nextInner = inner.concat([target]);

  return { ...state, edges: edges.map((edge, index) => (index === caller ? nextInner : edge)) };
}

function cycleStep({ edges, state }: { edges: readonly (readonly number[])[]; state: CycleState }): CycleState {
  const workList = state.work;
  const frame = workList.at(-1);
  if (frame === undefined) {
    return state;
  }
  const nexts = edges[frame.id] ?? [];
  if (frame.index === nexts.length) {
    const color = state.color;
    const trail = state.trail;
    const work = state.work;

    return {
      color: paint({ color, index: frame.id, value: 2 }),
      trail: trail.slice(0, -1),
      work: work.slice(0, -1),
      cyclic: state.cyclic,
    };
  }
  const next = nexts[frame.index] ?? frame.id;
  const previousWork = state.work;
  const work = previousWork.slice(0, -1).concat([{ id: frame.id, index: frame.index + 1 }]);
  const color = state.color;
  if (color[next] === 1) {
    const trail = state.trail;
    const from = trail.indexOf(next);
    const cyclic = state.cyclic;

    return { ...state, work, cyclic: cyclic.concat(trail.slice(from)) };
  }
  if (color[next] === 0) {
    const trail = state.trail;
    const cyclic = state.cyclic;

    return {
      color: paint({ color, index: next, value: 1 }),
      trail: trail.concat([next]),
      work: work.concat([{ id: next, index: 0 }]),
      cyclic,
    };
  }

  return { ...state, work };
}

function functionsInCycles(edges: readonly (readonly number[])[]): Set<number> {
  const cyclic = edges.reduce<number[]>((found, _, start) => {
    const budget = edges.length * edges.length + edges.length + 1;
    const steps = Array.from({ length: budget });
    const blank = edges.map(() => 0);
    const explored = steps.reduce((step: CycleState) => cycleStep({ edges, state: step }), {
      color: paint({ color: blank, index: start, value: 1 }),
      trail: [start],
      work: [{ id: start, index: 0 }],
      cyclic: found,
    });

    return explored.cyclic;
  }, []);

  return new Set(cyclic);
}

function childNodes(node: TSESTree.Node): TSESTree.Node[] {
  return Object.entries(node).flatMap(([key, value]) => {
    if (key === 'parent' || value === null || typeof value !== 'object') {
      return [];
    }
    const items = Array.isArray(value) ? value : [value];

    return items.filter((item): item is TSESTree.Node => item !== null && typeof item === 'object' && 'type' in item);
  });
}

function updatesCounter({ body, name }: { body: TSESTree.Node; name: string }): boolean {
  const steps = Array.from({ length: 4096 });
  const found = steps.reduce(
    (state: { pending: TSESTree.Node[]; isMatched: boolean }) => {
      const functionTypes = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
      if (state.isMatched) {
        return state;
      }
      const pending = state.pending;
      const node = pending.at(-1);
      if (node === undefined) {
        return state;
      }
      const rest = pending.slice(0, -1);
      if (node !== body && functionTypes.has(node.type)) {
        return { pending: rest, isMatched: false };
      }
      const left = node.type === 'AssignmentExpression' ? node.left : null;
      const argument = node.type === 'UpdateExpression' ? node.argument : null;
      const target = left ?? argument;
      if (target !== null && target.type === 'Identifier' && target.name === name) {
        return { pending: rest, isMatched: true };
      }

      return { pending: rest.concat(childNodes(node)), isMatched: false };
    },
    { pending: [body], isMatched: false },
  );

  return found.isMatched;
}

function isNumericBound({ node, sourceCode }: { node: TSESTree.Node; sourceCode: TSESLint.SourceCode }): boolean {
  if (node.type === 'Literal' && typeof node.value === 'number') {
    return true;
  }
  if (node.type !== 'Identifier') {
    return false;
  }
  const variable = ASTUtils.findVariable(sourceCode.getScope(node), node.name);
  const defs = variable?.defs;
  const definition = defs === undefined ? undefined : defs[0];
  if (definition === undefined || definition.type !== 'Variable') {
    return false;
  }
  const declaration = definition.parent;
  if (declaration.kind !== 'const') {
    return false;
  }
  const declarator = definition.node;
  const init = declarator.init;

  return init !== null && init.type === 'Literal' && typeof init.value === 'number';
}

function counterName({
  test,
  sourceCode,
}: {
  test: TSESTree.Expression;
  sourceCode: TSESLint.SourceCode;
}): string | null {
  const boundOperators = new Set(['<', '<=', '>', '>=']);
  if (test.type !== 'BinaryExpression' || !boundOperators.has(test.operator)) {
    return null;
  }
  const left = test.left;
  if (left.type === 'Identifier' && isNumericBound({ node: test.right, sourceCode })) {
    return left.name;
  }
  const right = test.right;
  if (right.type === 'Identifier' && isNumericBound({ node: test.left, sourceCode })) {
    return right.name;
  }

  return null;
}

function loopNode({
  test,
  body,
  sourceCode,
}: {
  test: TSESTree.Expression | null;
  body: TSESTree.Statement;
  sourceCode: TSESLint.SourceCode;
}): TSESTree.Node | null {
  const name = test === null ? null : counterName({ test, sourceCode });
  if (name === null || !updatesCounter({ body, name })) {
    return test ?? body;
  }

  return null;
}

function rangeStart(node: TSESTree.Node): number {
  const range = node.range;

  return range[0];
}

function rangeEnd(node: TSESTree.Node): number {
  const range = node.range;

  return range[1];
}

function containsRange({ outer, inner }: { outer: TSESTree.Node; inner: TSESTree.Node }): boolean {
  return rangeStart(outer) <= rangeStart(inner) && rangeEnd(inner) <= rangeEnd(outer);
}

function blockOf(node: TSESTree.Node | undefined): TSESTree.Node | null {
  const steps = Array.from({ length: 64 });
  const found = steps.reduce(
    (state: { current: TSESTree.Node | undefined; block: TSESTree.Node | null }) => {
      const current = state.current;
      if (state.block !== null || current === undefined) {
        return state;
      }
      if (
        current.type === 'BlockStatement' ||
        current.type === 'Program' ||
        current.type === 'StaticBlock' ||
        current.type === 'TSModuleBlock'
      ) {
        return { current, block: current };
      }

      return { current: current.parent, block: null };
    },
    { current: node === undefined ? undefined : node.parent, block: null },
  );

  return found.block;
}

function scopeTarget({
  references,
  start,
}: {
  references: readonly TSESLint.Scope.Reference[];
  start: TSESTree.Node | null;
}): TSESTree.Node | null {
  const steps = Array.from({ length: 32 });

  return steps.reduce((target: TSESTree.Node | null) => {
    if (target === null) {
      return null;
    }
    const isCovered = references.every((reference) => containsRange({ outer: target, inner: reference.identifier }));

    return isCovered ? target : blockOf(target);
  }, start);
}

function declaratorViolation({
  node,
  declarator,
  sourceCode,
}: {
  node: TSESTree.VariableDeclaration;
  declarator: TSESTree.VariableDeclarator;
  sourceCode: TSESLint.SourceCode;
}): TSESTree.Identifier | null {
  const id = declarator.id;
  if (id.type !== 'Identifier') {
    return null;
  }
  const variable = ASTUtils.findVariable(sourceCode.getScope(declarator), id.name);
  if (variable === null) {
    return null;
  }
  const references2 = variable.references;
  const references = references2.filter((reference) => reference.identifier !== id);
  const declared = blockOf(node);
  const firstReference = references[0];
  const first = firstReference === undefined ? undefined : firstReference.identifier;
  if (declared === null || first === undefined) {
    return null;
  }
  const target = scopeTarget({ references, start: blockOf(first) });
  if (target === null || target === declared || !containsRange({ outer: declared, inner: target })) {
    return null;
  }
  const scope = sourceCode.getScope(target);
  const variables = scope.set;
  const existing = variables.get(id.name);
  if (existing === undefined || existing === variable) {
    return id;
  }

  return null;
}

function scopeViolations({
  node,
  sourceCode,
}: {
  node: TSESTree.VariableDeclaration;
  sourceCode: TSESLint.SourceCode;
}): TSESTree.Identifier[] {
  const parent = node.parent;
  if (
    parent.type === 'ExportNamedDeclaration' ||
    parent.type === 'ForStatement' ||
    parent.type === 'ForInStatement' ||
    parent.type === 'ForOfStatement'
  ) {
    return [];
  }
  const declarations = node.declarations;

  return declarations.flatMap((declarator) => {
    const violation = declaratorViolation({ node, declarator, sourceCode });

    return violation === null ? [] : [violation];
  });
}

function isIgnorableType(type: ts.Type): boolean {
  const parts = type.isUnion() ? type.types : [type];

  return parts.every((part) => {
    const typeFlags = ts.TypeFlags;

    return (part.flags & (typeFlags.Void | typeFlags.Undefined | typeFlags.Never)) !== 0;
  });
}

function skipWrappers(node: TSESTree.Node): TSESTree.Node | undefined {
  const steps = Array.from({ length: 8 });

  return steps.reduce((current: TSESTree.Node | undefined) => {
    if (current === undefined) {
      return undefined;
    }
    if (current.type === 'ChainExpression' || current.type === 'SequenceExpression') {
      return current.parent;
    }

    return current;
  }, node.parent);
}

function resultIsUnused(node: TSESTree.Node): boolean {
  const parent = skipWrappers(node);

  return (
    parent === undefined ||
    parent.type === 'ExpressionStatement' ||
    (parent.type === 'UnaryExpression' && parent.operator === 'void')
  );
}

function isEnumish(type: ts.Type): boolean {
  const typeFlags = ts.TypeFlags;
  if ((type.flags & (typeFlags.Enum | typeFlags.EnumLiteral)) !== 0) {
    return true;
  }
  if (type.isUnion()) {
    const types = type.types;

    return types.some((part) => (part.flags & (typeFlags.Enum | typeFlags.EnumLiteral)) !== 0);
  }
  const symbol = type.getSymbol();
  const symbolFlags = ts.SymbolFlags;

  return symbol !== undefined && (symbol.flags & symbolFlags.Enum) !== 0;
}
export const nasaRules = {
  'no-recursion': createRule({
    name: 'no-recursion',
    meta: {
      docs: { description: 'Reject direct and same-file indirect recursion.' },
      type: 'problem',
      schema: [],
      messages: { cycle: 'Do not call this function directly or through another function in the same file.' },
    },
    defaultOptions: [],
    create(context) {
      const initial: RecursionState = {
        sourceCode: context.sourceCode,
        functionNodes: [],
        ids: new Map(),
        variableIds: new Map(),
        methodIds: new Map(),
        edges: [],
        stack: [],
      };
      const box = { state: initial };

      return {
        'FunctionDeclaration, FunctionExpression, ArrowFunctionExpression'(node: FunctionNode) {
          const state = box.state;
          box.state = trackFunction({ state, node });
        },
        'FunctionDeclaration:exit'() {
          box.state = popStack(box.state);
        },
        'FunctionExpression:exit'() {
          box.state = popStack(box.state);
        },
        'ArrowFunctionExpression:exit'() {
          box.state = popStack(box.state);
        },
        VariableDeclarator(node) {
          const state = box.state;
          box.state = trackAssigned({ state, node });
        },
        CallExpression(node) {
          const state = box.state;
          box.state = trackCall({ state, node });
        },
        'Program:exit'() {
          const current = box.state;
          const edges = current.edges;
          const cyclic = functionsInCycles(edges);
          [...cyclic].forEach((id) => {
            const functionNodes = current.functionNodes;
            const node = functionNodes[id];
            if (node !== undefined) {
              context.report({ node, messageId: 'cycle' });
            }
          });
        },
      };
    },
  }),
  'bounded-loop': createRule({
    name: 'bounded-loop',
    meta: {
      docs: { description: 'Require while and do loops to count toward a literal bound.' },
      type: 'problem',
      schema: [],
      messages: {
        bound:
          'Compare a counter with a numeric literal, or a const initialized with one, and update that counter in the body.',
      },
    },
    defaultOptions: [],
    create(context) {
      return {
        WhileStatement(node) {
          const violation = loopNode({ test: node.test, body: node.body, sourceCode: context.sourceCode });
          if (violation !== null) {
            context.report({ node: violation, messageId: 'bound' });
          }
        },
        DoWhileStatement(node) {
          const violation = loopNode({ test: node.test, body: node.body, sourceCode: context.sourceCode });
          if (violation !== null) {
            context.report({ node: violation, messageId: 'bound' });
          }
        },
      };
    },
  }),
  'smallest-scope': createRule({
    name: 'smallest-scope',
    meta: {
      docs: { description: 'Declare a binding in the innermost block that uses it.' },
      type: 'suggestion',
      schema: [],
      messages: { scope: 'Declare this binding in the nested block that contains every reference.' },
    },
    defaultOptions: [],
    create(context) {
      return {
        VariableDeclaration(node) {
          const sourceCode = context.sourceCode;
          scopeViolations({ node, sourceCode }).forEach((id) => {
            context.report({ node: id, messageId: 'scope' });
          });
        },
      };
    },
  }),
  'checked-return': createRule({
    name: 'checked-return',
    meta: {
      docs: { description: 'Require the result of a non-void call, including await, to be used.' },
      type: 'problem',
      schema: [],
      messages: { unused: 'Use the result of this non-void call. void does not count.' },
    },
    defaultOptions: [],
    create(context) {
      const reportUnused = (node: TSESTree.CallExpression | TSESTree.NewExpression | TSESTree.AwaitExpression) => {
        if (!resultIsUnused(node)) {
          return;
        }
        const services = ESLintUtils.getParserServices(context);
        const program = services.program;
        const checker = program.getTypeChecker();
        const types = services.esTreeNodeToTSNodeMap;
        const tsNode = types.get(node);
        const signature =
          node.type === 'CallExpression' || node.type === 'NewExpression'
            ? checker.getResolvedSignature(types.get(node))
            : undefined;
        const type = signature ? checker.getReturnTypeOfSignature(signature) : checker.getTypeAtLocation(tsNode);
        if (!isIgnorableType(type)) {
          context.report({ node, messageId: 'unused' });
        }
      };

      return {
        'CallExpression, NewExpression': reportUnused,
        AwaitExpression: reportUnused,
      };
    },
  }),
  'single-dereference': createRule({
    name: 'single-dereference',
    meta: {
      docs: { description: 'Allow one member access, then a local.' },
      type: 'problem',
      schema: [],
      messages: { chain: 'Assign the inner member to a local before reading another member.' },
    },
    defaultOptions: [],
    create(context) {
      return {
        MemberExpression(node) {
          const object2 = node.object;
          if (object2.type === 'MemberExpression') {
            context.report({ node, messageId: 'chain' });
          }
        },
      };
    },
  }),
};

export const enumBooleanRule = {
  'no-enum-boolean': createRule({
    name: 'no-enum-boolean',
    meta: {
      docs: { description: 'Reject an enum used as a boolean.' },
      type: 'problem',
      schema: [],
      messages: { condition: 'Do not use an enum, or a union that includes one, as a condition, Boolean(), or !!.' },
    },
    defaultOptions: [],
    create(context) {
      const report = (node: TSESTree.Node) => {
        const services = ESLintUtils.getParserServices(context);
        const program = services.program;
        const checker = program.getTypeChecker();
        const types = services.esTreeNodeToTSNodeMap;
        const type = checker.getTypeAtLocation(types.get(node));
        if (isEnumish(type)) {
          context.report({ node, messageId: 'condition' });
        }
      };

      return {
        'IfStatement, WhileStatement, DoWhileStatement'(
          node: TSESTree.IfStatement | TSESTree.WhileStatement | TSESTree.DoWhileStatement,
        ) {
          report(node.test);
        },
        ConditionalExpression(node) {
          report(node.test);
        },
        "LogicalExpression[operator='&&'], LogicalExpression[operator='||']"(node: TSESTree.LogicalExpression) {
          report(node.left);
          report(node.right);
        },
        "CallExpression[callee.name='Boolean']"(node: TSESTree.CallExpression) {
          const args = node.arguments;
          const argument = args[0];
          if (argument) {
            report(argument);
          }
        },
        UnaryExpression(node: TSESTree.UnaryExpression) {
          const negatedTwice = (value: TSESTree.UnaryExpression): TSESTree.Expression | null => {
            const inner = value.argument;
            if (inner.type === 'UnaryExpression' && inner.operator === '!') {
              return inner.argument;
            }

            return null;
          };
          const value = node.operator === '!' ? negatedTwice(node) : null;
          if (value) {
            report(value);
          }
        },
      };
    },
  }),
};
