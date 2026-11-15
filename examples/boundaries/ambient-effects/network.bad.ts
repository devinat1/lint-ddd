// src/application/load-orders.ts
export const loadOrders = (): Promise<Response> => fetch("/orders");
