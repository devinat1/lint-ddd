import { orderLabel } from "./a.js";
import { priceOf } from "./b.js";

export const label = (): string => `${orderLabel()} ${priceOf()}`;
