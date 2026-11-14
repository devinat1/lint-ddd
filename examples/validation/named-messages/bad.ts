// src/application/place-order.ts
export const fail = (): void => {
  throw new Error("Order was not found.");
};
