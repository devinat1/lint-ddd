type Gate = { a: boolean; b: boolean; c: boolean; d: boolean; e: boolean };

export const pass = (gate: Gate): number => {
  if (!gate.a) {
    return 0;
  }
  if (!gate.b) {
    return 0;
  }
  if (!gate.c) {
    return 0;
  }
  if (!gate.d) {
    return 0;
  }
  if (!gate.e) {
    return 0;
  }
  return 1;
};
