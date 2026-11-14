import { priceOf } from "./b.js";
import { orderLabel } from "./a.js";

export const label = (): string => `${orderLabel()} ${priceOf()}`;
