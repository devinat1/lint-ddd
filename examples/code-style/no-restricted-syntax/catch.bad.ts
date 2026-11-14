export const read = (load: () => string): string => {
  try {
    return load();
  } catch {
    return "fallback";
  }
};
