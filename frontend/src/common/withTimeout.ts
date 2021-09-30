/**
 * Races a promise against setTimeout and rejects with an Error if setTimeout() was faster
 * @param prom the promise to decorate with a timeout
 * @param debugName will be referenced in the Error thrown
 * @param timeout the timeout in ms, defaults to 10000
 */
export default function withTimeout<T>(prom: Promise<T>, debugName: string, timeout = 10000): Promise<T> {
  return Promise.race([
    prom,
    new Promise<T>((resolve, reject) => setTimeout(() => {
      reject(new Error(`Promise "${debugName}" timed out after ${timeout.toString(10)}ms`));
    }, timeout)),
  ]);
}
