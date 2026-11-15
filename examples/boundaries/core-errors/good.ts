// src/domain/order.ts
export class OrderRejected extends Error {}

export const reject = (): OrderRejected => new OrderRejected();
