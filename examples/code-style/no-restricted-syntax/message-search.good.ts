type CodedFailure = { code: string };

export const isMissing = (error: CodedFailure): boolean => error.code === "order_not_found";
