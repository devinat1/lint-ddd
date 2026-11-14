const load = (): Promise<boolean> => Promise.resolve(true);

export const ready = (): void => {
  if (load()) {
    return;
  }
};
