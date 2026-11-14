import type { Order } from "./order.js";

export const label = (order: Order): string => order.id;
