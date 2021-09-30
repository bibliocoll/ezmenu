/**
 * encodes given string to a safe IPv6 URI
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURI}
 * @param {string} str string to be encoded for use as an URI
 * @returns {string} str, with non-URI characters replaced with their UTF-8 encodings
 * @license MPL
 */
export default function encodeV6URI(str: string): string {
  return encodeURI(str).replace(/%5B/g, '[').replace(/%5D/g, ']');
}
