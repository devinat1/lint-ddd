// src/ports/order-repository.ts
declare const refine: (check: (value: string) => boolean) => string;

export type OrderRepository = {
  save: (value: string) => void;
};

export const schema = refine((value) => value.length > 0);
