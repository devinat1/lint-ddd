// src/adapters/primary/web/wait.ts
export const wait = (done: () => void): void => {
  setTimeout(done, 0);
};
