/**
 * ezmenu-iframe
 *
 * this script is part of EZMenu and is meant to be loaded in an iframe that has been injected into a proxied site.
 * It will open a Messaging Channel with the parent frame and transfer data retrieved from Window.localStorage.
 * Should localStorage fail to provide the requested data, it will be fetched from JSON files hosted on the EZProxy
 * @copyright Copyright 2015-2021 MPI for Research on Collective Goods
 * @license: GPLv3+
 */

import {
  arrayFromSaneData,
  createSetlistItem,
  domReady,
  iSetlistItem,
  storageAvailable,
} from './common/index';

/** figure out once whether localStorage is available.
 * @todo it is possible that `lsAvailable === true` but localStorage is quota-limited.
 * we can check that via storage.estimate(), but that returns a promise, which makes the whole thing annoying.
 * the benefits don't outweigh the legibility burden, imho. the only thing we could do with the knowledge gained
 * would be to educate the user so they go and fix their setup. lsAvailable should return false in case there is a
 * zero byte quota, so the only error case we're missing is a too-small quota.
 * we're just try/catching setItem() calls for now.
 *
 * const storageEstimate = navigator.storage.estimate();
 * const spaceAvailablePromise = storageEstimate.then((estimate) => estimate.quota !== undefined && estimate.quota > 0);
 */
const lsAvailable: boolean = storageAvailable('localStorage');
// console.log('localStorage available: ', lsAvailable);
/**
 * make Window.fetch throw on http error code
 * @param {Response} response fetch response to check
 * @return {Response} input, unchanged
 * @throws {TypeError} in case there is no 'application/json' content-type header
 * @throws {Error} if Response.status not in the 200-299 range.
 */
function checkStatus(response: Response): Response {
  if (response.status >= 200 && response.status < 300) {
    const contentType = response.headers.get('content-type');
    if (contentType !== null
      && contentType.toLowerCase().indexOf('application/json') >= 0
    ) {
      return response;
    }
    throw new TypeError('checkStatus: no "application/json" content-type');
  } else {
    throw new Error(`checkStatus: non-OK HTTP status: "${response.status} - ${response.statusText}"`);
  }
}

/**
 * configures Window.fetch() and returns response.text()
 * @param {string} filename URL to fetch (filenames should work relative to our web location)
 * @returns {Promise<string>} text content of the fetch-Response
 */
function fetchFromWeb(filename: string): Promise<string> {
  return window.fetch(filename, {
      // makes fetch send cookies
      credentials: 'same-origin',
    })
    .then(checkStatus)
    // TODO: JSON.parse() should be safe, but this would be the spot to sanity check the JSON string.
    .then((response) => response.text());
}

/**
 * attempts to place data into localStorage under given name
 * stores a second value under key `${name}Time` containing either Date.now() or dateToUse
 * @param {string} data value to store
 * @param {string} name key to store value under
 * @param {number} dateToUse allows to set a custom date
 * @returns {boolean} true on success, false in case of exceptions or no storage available
 */
function store(data: string, name: string, dateToUse = 0): boolean {
  if (lsAvailable) {
    try {
      window.localStorage.setItem(name, data);
      window.localStorage.setItem(`${name}Time`, dateToUse !== 0 ? dateToUse.toString() : Date.now().toString(10));
      return true;
    } catch {
      // TODO: find a good way to educate the user about quota-errors
    }
  }
  return false;
}

/**
 * get something from localStorage with all the precautions handled transparently
 * maxAge can be used to treat localStorage as a cache with an expiration duration
 * compareDate can be used to check whether data was stored with a given timestamp
 * @param {string} name
 * @param {number?} maxAge maximum age of data in milliseconds. 0 for no check.
 * @param {number?} compareDate if set / not 0, throw RangeError if stored data has another date set under `${name}Time`
 * @returns {string} data
 * @throws {Error|RangeError} JSON.parse exceptions, Error on null, RangeError in case data is older than maxAge
 */
function retrieve(name: string, maxAge = 0, compareDate = 0): string {
  if (lsAvailable) {
    const storedTime = window.localStorage.getItem(`${name}Time`) ?? '0';
    const storedData = window.localStorage.getItem(name);
    if (storedData === null) { throw new Error(`localStorage returned null for data under key ${name}`); }
    const storedTimeNumber = parseInt(storedTime, 10);
    if (compareDate !== 0 && compareDate !== storedTimeNumber) {
      throw new RangeError(`dataset ${name} was not stored at expected time ${compareDate}, but ${storedTimeNumber}`);
    }
    if (maxAge === 0 || Date.now() < parseInt(storedTime, 10) + maxAge) {
      return storedData;
    }
    throw new RangeError(`data in localStorage under key ${name} was older than ${maxAge}ms`);
  }
  throw new Error('localStorage not available');
}

/**
 * provides data either fom localStorage or fetched from web, using {@see retrieve()} and {@see fetchFromWeb()}
 * @param {string} id
 * @param {number?} lsMaxAge items older than this many milliseconds are fetched from the web, 0 to not check (default)
 * @param {number?} compareDate if set / not 0, throw RangeError if stored data has other date set as age
 * @param {boolean?} forceRefetch fetch from the web regardless of age (default false)
 * @returns {Promise<string>} hopefully the Setlist
 * @throws {TypeError|Error} from checkStatus(). consumer needs to try/catch
 */
function getById(id:string, lsMaxAge = 0, compareDate = 0, forceRefetch = false): Promise<string> {
  if (!forceRefetch) {
    try {
      return Promise.resolve(retrieve(id, lsMaxAge, compareDate));
    } catch (e) {
      // too bad, fall back to fetchFromWeb() below
      if (e instanceof Error) console.log(e.message);
    }
  }
  return fetchFromWeb(`${id}.json`)
    .then((fromWeb) => {
        store(fromWeb, id, compareDate);
        return fromWeb;
      });
}

// we're not really listening :P
function handleMessage(evt: MessageEvent):void {
  console.log(evt);
}
// we're not really listening :P
function handleMessageError(err: MessageEvent):void {
  console.log(err);
}

/**
* main code block
*/
domReady().then(() => {
  const messageChannel = new MessageChannel();
  const messagePort = messageChannel.port1;
  let setlist: iSetlistItem[] = [];
  // this stores promises, they need to be await/then-ed
  const setlistData: Map<string, Promise<string>> = new Map();
  // TODO: is there anything smart we can tell the parent frame here?
  window.parent.postMessage('hi', window.parent.location.origin, [messageChannel.port2]);
  // console.log('postMessage "hi"');
  // setting messagePort.onmessage implies messageChannel.start();
  messagePort.onmessage = handleMessage;
  messagePort.onmessageerror = handleMessageError;
  getById('setlist', 3600000)
    .then((data) => {
      const deserialized = JSON.parse(data);
      if (Array.isArray(deserialized)) {
        setlist = arrayFromSaneData(deserialized, createSetlistItem);
        // TODO: does this work in a non-async context?
        setlist.forEach((item) => {
          try {
            setlistData.set(item.id, getById(item.id, 0, parseInt(item.timestamp, 10)));
          } catch (e) {
            // i'm not really sure which one of those two catch blocks will fire (see below)
            if (e instanceof Error) {
              console.log(`No data for submenu item ${item.id}, reason: ${e.message} (call)`);
            } else {
              console.log(`No data for submenu item ${item.id}, reason unclear (call)`);
            }
          }
        });
      }
      messagePort.postMessage(['setlist', data]);
      setlistData.forEach((value, key) => {
        try {
          // NOTE: the messages will not be posted in a deterministic order, the receiving end should use Promise.all()
          value.then(
            (resolvedValue) => {
              messagePort.postMessage([key, resolvedValue]);
              // console.log(`postMessage: ${key}`);
            },
            (e) => console.log(`No data for submenu item ${key}, reason: ${e.message} (then)`),
);
        } catch (e) {
          // i'm not really sure which one of those two catch blocks will fire (see above)
          if (e instanceof Error) {
            console.log(`No data for submenu item ${key}, reason: ${e.message} (try)`);
          } else {
            console.log(`No data for submenu item ${key}, reason unclear (try)`);
          }
        }
      });
    })
    .catch(console.log);
  // TODO: unload everything?
});

/**
 * OK, so I wanted to place something into the window.postMessage that the parent frame can recognize as unlikely
 * to have been forged.
 * The naive approach was to hash the session cookie value, but that unnecessarily exposes a secret on a new surface,
 * and salting via some hardcoded value in JS would be worthless.
 * also, window.crypto.subtle.digest('SHA-256', <session_cookie_value + something?> );
 * requires an ArrayBuffer, and converting an UTF-16 String may or may not run into Endianess problems on MAC?
 * In the end, the not-proven-to-be-added security is not worth the effort and maintenance burden
 */
/*
const EZ_COOKIE_NAME = 'something';
function getSession(): string {
  const ezCookie = document.cookie
    .split(';')
    .find((row) => row.trim().startsWith(`${EZ_COOKIE_NAME}=`));
  if (ezCookie) {
    return ezCookie.split('=')[1].trim();
  }
  throw RangeError(`no cookie named "${EZ_COOKIE_NAME}" present`);
}
*/
