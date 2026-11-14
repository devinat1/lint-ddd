// src/adapters/secondary/clock/wait.ts
export const wait = (run: () => void): void => {
  setTimeout(run, 250);
};
