export const read = async (load: () => Promise<string>): Promise<string> => await load();
