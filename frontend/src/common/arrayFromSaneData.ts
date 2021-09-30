/**
 * takes unknown data and a factory function and returns an array of objects
 * it was able to create from that data via factoryFunction
 * @param {Array<T>} arr Array that factory results are pushed to
 * @param {unknown} data is an Array or a single helping of data suitable as a parameter of factoryFunction
 * @param {(unknown) => T} factoryFunction that is responsible for type checking and marshalling an object
 * @param {(e:Error, data: unknown, resultArr: Array<T>) => void)} errorHandler? optional. override / custom errors
 */

function addItemFromSaneData<T>(
  arr: T[],
  data: unknown,
  factoryFunction: (x: unknown) => T,
  errorHandler?: ((e:Error, data: unknown, resultArr: Array<T>) => void),
): void {
  try {
    const marshalled = factoryFunction(data);
    arr.push(marshalled);
  } catch (e) {
    if (errorHandler !== undefined && e instanceof Error) {
      errorHandler(e, data, arr);
    } else {
      throw e;
    }
  }
}

/**
 * takes unknown data and a factory function and returns an array of objects
 * it was able to create from that data via factoryFunction
 * @template T
 * @param {unknown} maybeArray is an Array or a single helping of data suitable as a parameter of factoryFunction
 * @param {(unknown) => T} factoryFunction that is responsible for type checking and marshalling an object
 * @param {(e:Error, data: unknown, resultArr: Array<T>) => void)} errorHandler? optional. override / custom errors
 * @returns {Array<T>} Array of results from factoryFunction
 * @throws {TypeError} in case return value would have length === 0
 */
export default function arrayFromSaneData<T>(
  maybeArray: unknown,
  factoryFunction: (x:unknown) => T,
  errorHandler?: ((e:Error, data: unknown, resultArr: Array<T>) => void),
): Array<T> {
  const result: Array<T> = [];
  if (Array.isArray(maybeArray)) {
    maybeArray.forEach((item) => addItemFromSaneData(result, item, factoryFunction, errorHandler));
  } else {
    addItemFromSaneData(result, maybeArray, factoryFunction, errorHandler);
  }
  if (result.length !== 0) return result;
  throw new TypeError('arrayFromSaneData did not find any sane data');
}
