import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import { ESLintUtils } from '@typescript-eslint/utils';

import { readPath } from './read_field.ts';

const createRule = ESLintUtils.RuleCreator(() => 'docs/lint-policy.md');
type ClassJob =
  | { op: 'eval'; node: TSESTree.Node | null }
  | { op: 'concat' }
  | { op: 'product' }
  | { op: 'template'; quasis: string[]; count: number };

function combineClasses({
  job,
  values,
  jobs,
}: {
  job: ClassJob;
  values: string[][];
  jobs: ClassJob[];
}): { jobs: ClassJob[]; values: string[][] } | null {
  if (job.op === 'concat' || job.op === 'product') {
    const right = values.at(-1) ?? [];
    const left = values.at(-2) ?? [];
    const combined =
      job.op === 'concat' ? left.concat(right) : left.flatMap((part) => right.map((value) => part + value));
    const rest = values.slice(0, -2);

    return { jobs, values: rest.concat([combined]) };
  }
  if (job.op !== 'template') {
    return null;
  }
  const count = job.count;
  const parts = count === 0 ? [] : values.slice(-count);
  const quasis = job.quasis;
  const folded = parts.reduce(
    (current: string[], expressionValues, index) => {
      const suffix = quasis[index + 1] ?? '';

      return current.flatMap((part) => expressionValues.map((value) => part + value + suffix));
    },
    [quasis[0] ?? ''],
  );
  const rest = count === 0 ? values : values.slice(0, -count);

  return { jobs, values: rest.concat([folded]) };
}

function expandClass({
  current,
  jobs,
  values,
}: {
  current: TSESTree.Node | null;
  jobs: ClassJob[];
  values: string[][];
}): { jobs: ClassJob[]; values: string[][] } {
  if (current === null) {
    return { jobs, values: values.concat([[]]) };
  }
  if (current.type === 'Literal' && ['string', 'number', 'boolean'].includes(typeof current.value)) {
    return { jobs, values: values.concat([[String(current.value)]]) };
  }
  if (current.type === 'JSXExpressionContainer') {
    return { jobs: [{ op: 'eval', node: current.expression }, ...jobs], values };
  }
  if (current.type === 'ConditionalExpression') {
    return {
      jobs: [
        { op: 'eval', node: current.consequent },
        { op: 'eval', node: current.alternate },
        { op: 'concat' },
        ...jobs,
      ],
      values,
    };
  }
  if (current.type === 'TemplateLiteral') {
    const quasis2 = current.quasis;
    const quasis = quasis2.map((entry) => readPath({ value: entry, first: 'value', second: 'cooked' }) ?? '');
    const expressions = current.expressions;
    const expressionJobs: ClassJob[] = expressions.map((expression) => ({ op: 'eval', node: expression }));
    const templateJob: ClassJob = { op: 'template', quasis, count: expressionJobs.length };

    return { jobs: [...expressionJobs, templateJob, ...jobs], values };
  }
  if (current.type === 'BinaryExpression' && current.operator === '+') {
    return {
      jobs: [{ op: 'eval', node: current.left }, { op: 'eval', node: current.right }, { op: 'product' }, ...jobs],
      values,
    };
  }

  return { jobs, values: values.concat([[]]) };
}

function stepClasses(state: { jobs: ClassJob[]; values: string[][] }): { jobs: ClassJob[]; values: string[][] } {
  const queued = state.jobs;
  const values = state.values;
  const job = queued[0];
  if (job === undefined) {
    return state;
  }
  const jobs = queued.slice(1);
  const combined = combineClasses({ job, values, jobs });
  if (combined !== null) {
    return combined;
  }
  if (job.op !== 'eval') {
    return { jobs, values };
  }

  return expandClass({ current: job.node, jobs, values });
}

function readClasses(node: TSESTree.Node | null): string[] {
  const steps = Array.from({ length: 128 });
  const finished = steps.reduce(stepClasses, { jobs: [{ op: 'eval', node }], values: [] });
  const values = finished.values;

  return values[0] ?? [];
}

export const presentationRules = {
  'static-tailwind': createRule({
    name: 'static-tailwind',
    meta: {
      docs: { description: 'Enforce the documented authored-code convention.' },
      type: 'suggestion',
      schema: [],
      messages: {
        margin: 'Use parent gap or padding instead of margins, including responsive and negative margins.',
        spacing: 'Use even-numbered Tailwind spacing increments.',
        redundant:
          'Remove a provably redundant default-breakpoint class with the same static utility and no intervening overlapping override.',
      },
    },
    defaultOptions: [],
    create(context) {
      return {
        JSXAttribute(node) {
          const name2 = node.name;
          const name3 = node.name;
          if (name2.type !== 'JSXIdentifier' || name3.name !== 'className') {
            return;
          }
          readClasses(node.value).forEach((classes) => {
            reportClassIssues({ context, node, classes });
          });
        },
      };
    },
  }),
  'used-react-props': createRule({
    name: 'used-react-props',
    meta: {
      docs: { description: 'Enforce the documented authored-code convention.' },
      type: 'suggestion',
      schema: [],
      messages: { unused: 'Remove the unused authored React prop field {{name}} or read it in the component.' },
    },
    defaultOptions: [],
    create(context) {
      return {
        'FunctionDeclaration, FunctionExpression, ArrowFunctionExpression'(
          node: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression,
        ) {
          reportUnusedProps({ context, node });
        },
      };
    },
  }),
};

type ClassContext = TSESLint.RuleContext<'margin' | 'spacing' | 'redundant', []>;
type PropContext = TSESLint.RuleContext<'unused', []>;
type ComponentNode = TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression;
type ParserServices = ReturnType<typeof ESLintUtils.getParserServices>;
interface ResponsiveEntry {
  token: string;
  utility: string;
  rank: number;
}

function displayUtilities(): readonly string[] {
  return [
    'block',
    'inline',
    'inline-block',
    'flex',
    'inline-flex',
    'grid',
    'inline-grid',
    'hidden',
    'contents',
    'flow-root',
    'table',
    'inline-table',
    'table-row',
    'table-cell',
    'table-caption',
    'table-row-group',
    'table-column',
    'table-column-group',
    'table-header-group',
    'table-footer-group',
    'list-item',
  ];
}

function spacingEffects(spacing: RegExpExecArray): string[] {
  const directions: Partial<Record<string, string[]>> = {
    '': ['t', 'r', 'b', 'l', 's', 'e'],
    x: ['r', 'l', 's', 'e'],
    y: ['t', 'b'],
    t: ['t'],
    r: ['r'],
    b: ['b'],
    l: ['l'],
    s: ['s', 'r', 'l'],
    e: ['e', 'r', 'l'],
  };

  return (directions[spacing.at(2) ?? ''] ?? []).map((direction) => `${spacing.at(1) ?? ''}-${direction}`);
}

function effectsFor(utility: string): string[] {
  const spacing = /^(p|m)([trblxyse]?)-/.exec(utility);
  if (spacing) {
    return spacingEffects(spacing);
  }
  if (/^gap-/.test(utility)) {
    return utility.startsWith('gap-x-') ? ['gap-x'] : utility.startsWith('gap-y-') ? ['gap-y'] : ['gap-x', 'gap-y'];
  }
  if (displayUtilities().includes(utility)) {
    return ['display'];
  }
  if (utility.startsWith('size-')) {
    return ['w', 'h'];
  }
  if (utility === 'container') {
    return ['w', 'max-w'];
  }
  if (/^flex-(row|col)(-reverse)?$/.test(utility)) {
    return ['flex-direction'];
  }
  if (/^flex-/.test(utility)) {
    return ['flex-grow', 'flex-shrink', 'flex-basis'];
  }
  // Unknown utilities may overlap supported effects; they disable redundancy proofs.
  const prefix = /^(w|min-w|max-w|h|min-h|max-h|grid-cols|items|justify)-/.exec(utility)?.[1];

  return prefix !== undefined ? [prefix] : [];
}

function reportSpacing({
  context,
  node,
  tokens,
}: {
  context: ClassContext;
  node: TSESTree.JSXAttribute;
  tokens: string[];
}) {
  tokens.forEach((token) => {
    const utility = token.split(':').at(-1)?.replace(/^!|!$/g, '') ?? '';
    if (/^-?m[trblxyse]?-/.test(utility)) {
      context.report({ node, messageId: 'margin' });
    }
    const value = /^-?(?:gap(?:-[xy])?|[mp][trblxyse]?)-(\d+(?:\.\d+)?)$/.exec(utility)?.[1];
    if (value !== undefined && Number(value) % 2 !== 0) {
      context.report({ node, messageId: 'spacing' });
    }
  });
}

function responsiveEntries(tokens: string[]): ResponsiveEntry[] {
  return tokens
    .map((token) => {
      const breakpoints = ['', 'sm', 'md', 'lg', 'xl', '2xl'];
      const parts = token.split(':');
      const breakpoint = parts.length === 1 ? '' : parts.length === 2 ? (parts[0] ?? '') : 'unsupported';

      return { token, utility: parts.at(-1) ?? '', rank: breakpoints.indexOf(breakpoint) };
    })
    .filter((entry) => entry.rank >= 0)
    .sort((left, right) => left.rank - right.rank);
}

function sharesEffect({ utility, effects }: { utility: string; effects: string[] }) {
  return effectsFor(utility).some((effect) => effects.includes(effect));
}

function isRedundant({
  entry,
  index,
  responsive,
}: {
  entry: ResponsiveEntry;
  index: number;
  responsive: ResponsiveEntry[];
}) {
  const utility2 = entry.utility;
  const utility3 = entry.utility;
  if (entry.rank === 0 || utility2.includes('[') || utility3.includes('!')) {
    return false;
  }
  const effects = effectsFor(entry.utility);
  if (effects.length === 0) {
    return false;
  }
  const previous = responsive
    .slice(0, index)
    .filter((candidate) => candidate.rank < entry.rank && sharesEffect({ utility: candidate.utility, effects }));
  const latest = previous.at(-1);

  return (
    latest?.utility === entry.utility &&
    !previous.some((candidate) => candidate.rank === latest.rank && candidate.utility !== latest.utility) &&
    !responsive.some(
      (candidate) =>
        candidate.rank === entry.rank && candidate !== entry && sharesEffect({ utility: candidate.utility, effects }),
    )
  );
}

function reportRedundant({
  context,
  node,
  tokens,
}: {
  context: ClassContext;
  node: TSESTree.JSXAttribute;
  tokens: string[];
}) {
  const responsive = responsiveEntries(tokens);
  if (
    responsive.length !== tokens.length ||
    tokens.some((token) => token.includes('[') || token.includes('!')) ||
    responsive.some((entry) => effectsFor(entry.utility).length === 0)
  ) {
    return;
  }
  responsive.forEach((entry, index) => {
    if (isRedundant({ entry, index, responsive })) {
      context.report({ node, messageId: 'redundant' });
    }
  });
}

function reportClassIssues({
  context,
  node,
  classes,
}: {
  context: ClassContext;
  node: TSESTree.JSXAttribute;
  classes: string;
}) {
  const tokens = classes.trim().split(/\s+/);
  reportSpacing({ context, node, tokens });
  reportRedundant({ context, node, tokens });
}

function readComponentName(node: ComponentNode): string | null {
  if (node.type === 'FunctionDeclaration') {
    const id2 = node.id;

    return id2?.name ?? null;
  }
  const parent2 = node.parent;
  if (parent2.type !== 'VariableDeclarator') {
    return null;
  }
  const id3 = parent2.id;

  return id3.type === 'Identifier' ? id3.name : null;
}

function presentationFields({ parameter, services }: { parameter: TSESTree.Node; services: ParserServices }) {
  const program2 = services.program;
  if (program2 === null) {
    return [];
  }
  const checker = program2.getTypeChecker();
  const esTreeNodeToTSNodeMap2 = services.esTreeNodeToTSNodeMap;
  const type = checker.getTypeAtLocation(esTreeNodeToTSNodeMap2.get(parameter));

  return type.getProperties().filter((field) => {
    const declarations2 = field.declarations;

    return (
      declarations2?.some((declaration) => {
        const fileName = declaration.getSourceFile().fileName;

        return /\/src\/presentation\//.test(fileName);
      }) === true
    );
  });
}

function reportUnusedNames({
  context,
  node,
  names,
  fields,
}: {
  context: PropContext;
  node: TSESTree.Node;
  names: string[];
  fields: ReturnType<typeof presentationFields>;
}) {
  fields
    .filter((field) => !names.includes(field.name))
    .forEach((field) => {
      context.report({ node, messageId: 'unused', data: { name: field.name } });
    });
}

function reportUnusedPattern({
  context,
  parameter,
  fields,
}: {
  context: PropContext;
  parameter: TSESTree.ObjectPattern;
  fields: ReturnType<typeof presentationFields>;
}) {
  const properties2 = parameter.properties;
  if (properties2.some((property) => property.type === 'RestElement')) {
    return;
  }
  const properties3 = parameter.properties;
  const used = properties3.flatMap((property) => {
    if (property.type !== 'Property') {
      return [];
    }
    const key2 = property.key;

    return key2.type === 'Identifier' ? [key2.name] : [];
  });
  reportUnusedNames({ context, node: parameter, names: used, fields });
}

function reportUnusedBinding({
  context,
  node,
  parameter,
  fields,
}: {
  context: PropContext;
  node: ComponentNode;
  parameter: TSESTree.Identifier;
  fields: ReturnType<typeof presentationFields>;
}) {
  const sourceCode2 = context.sourceCode;
  const variable = sourceCode2.getDeclaredVariables(node).find((binding) => binding.name === parameter.name);
  const references2 = variable?.references;
  const references = references2?.filter((reference) => reference.isRead()) ?? [];
  // Escaping/spreading the whole props object makes individual reads unprovable.
  if (
    references.some((reference) => {
      const identifier2 = reference.identifier;
      const parent5 = identifier2.parent;

      return parent5.type !== 'MemberExpression' || parent5.computed;
    })
  ) {
    return;
  }
  const used = references.flatMap((reference) => {
    const identifier4 = reference.identifier;
    const parent7 = identifier4.parent;
    if (parent7.type !== 'MemberExpression') {
      return [];
    }
    const property = parent7.property;

    return property.type === 'Identifier' ? [property.name] : [];
  });
  reportUnusedNames({ context, node: parameter, names: used, fields });
}

function reportUnusedProps({ context, node }: { context: PropContext; node: ComponentNode }) {
  const services = ESLintUtils.getParserServices(context);
  const name = readComponentName(node);
  const params2 = node.params;
  if (name === null || !/^[A-Z]/.test(name) || params2.length !== 1) {
    return;
  }
  const params3 = node.params;
  const parameter = params3.at(0);
  if (!parameter) {
    return;
  }
  const fields = presentationFields({ parameter, services });
  if (parameter.type === 'ObjectPattern') {
    reportUnusedPattern({ context, parameter, fields });
  } else if (parameter.type === 'Identifier') {
    reportUnusedBinding({ context, node, parameter, fields });
  }
}
