// src/application/place-order.ts
const orderNotFound = "Order was not found.";

export const fail = (): void => {
  throw new Error(orderNotFound);
};
