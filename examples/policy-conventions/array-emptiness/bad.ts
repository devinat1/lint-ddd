declare const values: string[];

export const hasAny = (): boolean => {
  if (values.length) {
    return true;
  }
  return false;
};
