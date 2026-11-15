// src/adapters/secondary/http/load-orders.ts
export const loadOrders = (): Promise<Response> => fetch("/orders");
