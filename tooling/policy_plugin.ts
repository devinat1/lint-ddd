import { boundaryRules } from './boundary_rules.ts';
import { conventionRules } from './convention_rules.ts';
import { hexagonalRules } from './hexagonal_rules.ts';
import { enumBooleanRule, nasaRules } from './nasa_rules.ts';
import { presentationRules } from './presentation_rules.ts';
import { validationRules } from './validation_rules.ts';

export const policyPlugin = {
  rules: {
    ...boundaryRules,
    ...conventionRules,
    ...enumBooleanRule,
    ...hexagonalRules,
    ...nasaRules,
    ...presentationRules,
    ...validationRules,
  },
};
