// src/domain/order.ts
export type Labels<Key extends string> = {
  [KeyName in Key]: string;
};
