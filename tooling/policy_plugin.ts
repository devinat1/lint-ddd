import { boundaryRules } from "./boundaryRules.ts";
import { conventionRules } from "./conventionRules.ts";
import { hexagonalRules } from "./hexagonalRules.ts";
import { presentationRules } from "./presentationRules.ts";
import { validationRules } from "./validationRules.ts";

export const policyPlugin = {
  rules: { ...boundaryRules, ...conventionRules, ...hexagonalRules, ...presentationRules, ...validationRules },
};
