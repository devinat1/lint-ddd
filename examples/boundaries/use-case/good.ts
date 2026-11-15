// src/application/place-order.ts
const normalize = (value: string): string => value.trim();

export const place = ({ id }: { id: string }): string => normalize(id);
