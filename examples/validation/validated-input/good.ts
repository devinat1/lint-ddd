// src/adapters/primary/http/read-order.ts
import { z } from "zod";

const orderSchema = z.object({ id: z.string() });

export const readOrder = (text: string): { id: string } => orderSchema.parse(JSON.parse(text));
