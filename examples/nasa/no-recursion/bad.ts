const walk = (value: number): number => (value === 0 ? value : walk(value - 1));

export const depth = walk(1);
