// src/domain/order.ts
import { priceOf } from "./price.good.js";

export const orderLabel = (): string => `Order ${priceOf()}`;
