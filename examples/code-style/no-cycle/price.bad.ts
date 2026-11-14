// src/domain/price.ts
import { orderLabel } from "./order.bad.js";

export const priceOf = (): string => orderLabel();
