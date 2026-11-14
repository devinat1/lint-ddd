// src/domain/order.ts
import { priceOf } from "./price.bad.js";

export const orderLabel = (): string => priceOf();
