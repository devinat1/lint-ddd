// src/domain/order.ts
export type Labels<Key extends string> = {
  readonly [KeyName in Key]: string;
};
