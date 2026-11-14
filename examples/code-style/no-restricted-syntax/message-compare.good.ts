class OrderNotFound extends Error {}

export const isMissing = (error: unknown): boolean => error instanceof OrderNotFound;
