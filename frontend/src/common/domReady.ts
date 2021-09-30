/**
 * factory for a Promise that resolves on DOMContentLoaded or rejects after 10s
 * @param {number?} timeout optional timeout in ms, 0 for no timeout, default is 10000ms
 * @returns {Promise<undefined>} Promise resolving when DOMContentLoaded fires (or document.readystate !== 'loading')
 * @see: https://developer.mozilla.org/en-US/docs/Web/API/Document/DOMContentLoaded_event
 */
export default function domReady(timeout = 10000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.readyState === 'loading') { // Loading hasn't finished yet
      document.addEventListener('DOMContentLoaded', () => resolve());
    } else { // `DOMContentLoaded` has already fired
      resolve();
    }
    if (timeout !== 0) setTimeout(reject, timeout, new Error(`domReady timed out after ${timeout}ms`));
  });
}
