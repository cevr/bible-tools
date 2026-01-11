/**
 * Type-safe pattern matching for discriminated unions.
 *
 * @example
 * type State =
 *   | { _tag: 'idle' }
 *   | { _tag: 'loading' }
 *   | { _tag: 'success'; data: Data };
 *
 * const result = match(state, {
 *   idle: () => 'Waiting...',
 *   loading: () => 'Loading...',
 *   success: ({ data }) => `Got ${data.length} items`,
 * });
 */
export function match<T extends { _tag: string }, R>(
  value: T,
  handlers: { [K in T['_tag']]: (v: Extract<T, { _tag: K }>) => R }
): R {
  const handler = handlers[value._tag as T['_tag']];
  return handler(value as Extract<T, { _tag: T['_tag'] }>);
}

/**
 * Type guard to check if a discriminated union is a specific variant.
 *
 * @example
 * if (is(state, 'success')) {
 *   // state.data is now accessible
 * }
 */
export function is<T extends { _tag: string }, K extends T['_tag']>(
  value: T,
  tag: K
): value is Extract<T, { _tag: K }> {
  return value._tag === tag;
}
