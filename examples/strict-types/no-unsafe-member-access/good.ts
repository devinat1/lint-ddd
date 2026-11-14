const read = (): { id: string } => ({ id: "1" });

export const label = (): string => read().id;
