export const read = (load: () => string): string => {
  try {
    return load();
  } catch (error) {
    console.error("Load failed.", error);
    return "fallback";
  }
};
