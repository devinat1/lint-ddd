export const read = (load: () => Promise<string>): Promise<string> => load().then((value) => value);
