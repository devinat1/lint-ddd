export const read = (ready: boolean): number => {
  while (ready) {
    return 1;
  }

  return 0;
};
