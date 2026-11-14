type Gate = { a: boolean; b: boolean; c: boolean; d: boolean; e: boolean };

export const pass = (gate: Gate): number => {
  if (gate.a) {
    if (gate.b) {
      if (gate.c) {
        if (gate.d) {
          if (gate.e) {
            return 1;
          }
        }
      }
    }
  }
  return 0;
};
