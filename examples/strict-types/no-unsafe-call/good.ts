const read = (): (() => string) => (): string => "ada";

export const label = (): string => read()();
