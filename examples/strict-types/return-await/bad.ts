const fetchText = (): Promise<string> => Promise.resolve("ok");

export const read = async (): Promise<string> => {
  try {
    return fetchText();
  } catch (error) {
    throw new Error("Read failed.", { cause: error });
  }
};
