export const names = (values: readonly string[]): string[] => {
  const found: string[] = [];
  for (const value of values) {
    found.push(value);
  }
  return found;
};
