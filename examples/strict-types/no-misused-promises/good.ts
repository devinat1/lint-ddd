const load = (): Promise<boolean> => Promise.resolve(true);

export const ready = async (): Promise<void> => {
  if (await load()) {
    return;
  }
};
