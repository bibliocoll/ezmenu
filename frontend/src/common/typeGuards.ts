/**
 * typeof x === 'object' && x !== null
 * @param x unknown data to check for Record form
 * @returns {boolean} (typescript: x is Record<PropertyKey, unknown>
 */
export function isRecord(x: unknown): x is Record<PropertyKey, unknown> {
  return typeof x === 'object' && x !== null;
}
/**
 * hasOwnProperty invocation with type guard
 * @see Object.prototype.hasOwnProperty()
 * @param {Object} obj what to call hasOwnProperty on
 * @param {string} testKey argument array for the call
 * @return {boolean} (typescript: obj is also Record<'testKey': unknown>)
 */
export function hasProp<T extends PropertyKey>(
  obj: Record<PropertyKey, unknown>,
  testKey: T,
): obj is Record<PropertyKey, unknown> & Record<T, unknown> {
  return Object.prototype.hasOwnProperty.call(obj, testKey);
}
