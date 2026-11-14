// src/adapters/secondary/clock/wait.ts
const retryDelayMs = 250;

export const wait = (run: () => void): void => {
  setTimeout(run, retryDelayMs);
};
