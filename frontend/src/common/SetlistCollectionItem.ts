/**
 * @copyright Copyright 2015-2021 MPI for Research on Collective Goods
 * @license: GPLv3+
 */

import { isRecord, hasProp } from './typeGuards';
import encodeV6URI from './encodeV6Uri';

/**
 * these are used to validate fields retrieved via json
 */
const re2 = new RegExp('[<>]'); // no script tags allowed
const DescRE1 = new RegExp('##', 'g'); // styling
const DescRE2 = new RegExp("[\"']", 'g'); // XSS: prevent dangling markup injection

export interface iSetlistCollectionItemData {
  title: string;
  url: string;
  proxied: boolean;
  free: boolean;
  desc?: string;
}
export interface iSetlistCollectionItem extends iSetlistCollectionItemData {
  buildElement(data: iSetlistCollectionItem): HTMLLIElement;
}

/**
 * type guard that checks for required fields of iSetlistCollectionItemData
 * @param {unknown} json
 * @returns {boolean} (typescript: {json is iSetlistCollectionItemData})
 */
export function typeGuardSetlistCollectionItem(json: unknown): json is iSetlistCollectionItemData {
  if (!isRecord(json)) {
    throw new TypeError('SetlistDataCollectionItem constructor parameter needs to be not null and typeof === object');
  }
  return !(!hasProp(json, 'title') || typeof json.title !== 'string'
    || !hasProp(json, 'url') || typeof json.url !== 'string'
    || !hasProp(json, 'proxied') || typeof json.proxied !== 'boolean'
    || !hasProp(json, 'free') || typeof json.free !== 'boolean');
}

/**
 * creates DOM elements representing a SetlistCollectionItem
 * @param {iSetlistCollectionItem} collectionItem to create DOM nodes for
 * @returns {HTMLLIElement} LI-Element usable for mmenu
 */
export function buildElementFromCollectionItem(collectionItem: iSetlistCollectionItem): HTMLLIElement {
  const link = document.createElement('a');
  link.href = collectionItem.url;
  if (collectionItem?.desc !== undefined) {
    link.title = collectionItem.desc;
  }
  if (!collectionItem.proxied) {
    link.className = 'external';
    link.target = '_blank';
    if (!collectionItem.free) {
      link.className = 'external locked';
    }
  }
  link.appendChild(document.createTextNode(collectionItem.title));
  const menuitem = document.createElement('li');
  menuitem.appendChild(link);
  // NOTE: elm.appendChild(other) returns other, so the extra line for return is required
  return menuitem;
}

/**
 * factory function for a SetlistCollectionItem
 * @param {iSetlistCollectionItemData|unknown} json data is type checked, {@link iSetlistCollectionItemData} format is expected
 * @returns {iSetlistCollectionItem} object created from data supplied
 */
export default function createSetlistCollectionItem(json: unknown): iSetlistCollectionItem {
    if (!typeGuardSetlistCollectionItem(json)) {
      throw new Error('Collection contains malformed items');
    }
    // XSS security: titles will be added to the DOM via createTextNode,
    // which is supposedly safe. testing for strangeness anyways
    if (re2.test(json.title)) {
      throw new Error('Collection contains script tags in titles');
    }
    // NOTE: this is where you add more checks
    const result: iSetlistCollectionItem = {
      title: json.title,
      url: encodeV6URI(json.url),
      proxied: json.proxied,
      free: json.free,
      buildElement: buildElementFromCollectionItem,
    };
    if (typeof json?.desc === 'string' && !re2.test(json.desc)) {
      result.desc = json.desc.replace(DescRE1, '\n').replace(DescRE2, '&quot;');
    }
    return result;
}
