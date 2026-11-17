/**
 *
 */
export const readField = <Value, Key extends keyof Value>({ value, key }: { value: Value; key: Key }): Value[Key] =>
  value[key];

/**
 *
 */
export const readPath = <Value, First extends keyof Value, Second extends keyof Value[First]>({
  value,
  first,
  second,
}: {
  value: Value | null | undefined;
  first: First;
  second: Second;
}): Value[First][Second] | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }
  const inner = value[first];

  return inner[second];
};

/**
 *
 */
export const readFieldIf = <Value, Key extends keyof Value>({
  value,
  key,
}: {
  value: Value | null | undefined;
  key: Key;
}): Value[Key] | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }
  const current = value;

  return current[key];
};
