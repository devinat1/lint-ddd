// src/presentation/order.tsx
export const wait = (done: () => void): void => {
  setTimeout(done, 0);
};
