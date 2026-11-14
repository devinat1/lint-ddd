export const load = async (name: string): Promise<unknown> => import(name);
