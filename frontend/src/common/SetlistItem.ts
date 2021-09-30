/**
 * @copyright Copyright 2015-2021 MPI for Research on Collective Goods
 * @license: GPLv3+
 */

import { isRecord, hasProp } from './typeGuards';
import type { iSetlistCollectionItem } from './SetlistCollectionItem';
import createSetlistCollectionItem from './SetlistCollectionItem';
import { arrayFromSaneData } from './index';

/**
 * these are used to validate fields retrieved via json
 */
const re1 = new RegExp('\\W');
const re2 = new RegExp('[<>]'); // no script tags allowed

export interface iSetlistItemData {
  id: string;
  name: string;
  timestamp: string;
  logo?: string;
  data?: Array<iSetlistCollectionItem>;
  error?: Error;
}
export interface iSetlistItem extends iSetlistItemData {
  buildElement(item: iSetlistItem): HTMLLIElement
}

/**
 * type guard that checks for required fields of iSetlistItemData
 * @param {unknown} json
 * @returns {boolean} (typescript: {json is iSetlistItemData})
 */
export function typeGuardSetlistItemData(json: unknown): json is iSetlistItemData {
  if (!isRecord(json)) {
    throw new TypeError('SetlistItemData needs to be not null and typeof === object');
  }
  if (!hasProp(json, 'id') || typeof json.id !== 'string'
    || !hasProp(json, 'name') || typeof json.name !== 'string'
    || !hasProp(json, 'timestamp') || typeof json.timestamp !== 'string'
  ) {
    throw new TypeError('SetlistItemData candidate contained malformed items');
  }
  return true;
}

/**
 * creates DOM elements representing a SetlistItem
 * @param {iSetlistItem} item to create DOM nodes for
 * @returns {HTMLLIElement} LI-Element usable for mmenu
 */
export function buildElementFromSetlistItem(item: iSetlistItem): HTMLLIElement {
  const li = document.createElement('li');
  const span = document.createElement('span');
  if (item?.logo !== undefined) {
    span.className = `logo-${item.logo}`;
  }
  span.appendChild(document.createTextNode(item.name)); // createTextNode() supposedly is XSS safe
  // NOTE: elm.appendChild(other) returns other, so the extra line for return is required
  li.appendChild(span);
  li.id = `menuAnchor_${item.id}`;
  if (Array.isArray(item.data)) {
    const ul = document.createElement('ul');
    item.data.forEach((dataItem) => ul.appendChild(dataItem.buildElement(dataItem)));
    li.appendChild(ul);
  }
  return li;
}

/**
 * factory function for a SetlistItem
 * @param {iSetlistItemData|unknown} json data is type checked, {@link iSetlistItemData} format is expected
 * @returns {iSetlistItem} object created from data supplied
 */
export default function createSetlistItem(json: iSetlistItemData|unknown): iSetlistItem {
  if (!typeGuardSetlistItemData(json)) {
    throw new TypeError('SetlistItem constructor called with malformed data');
  }
  if (re1.test(json.id)) {
    // XSS security: id will be used to construct URLs, disallow non-word chars
    throw new Error('Setlist contains non-alphanumeric ids');
  }
  if (re2.test(json.name)) {
    // XSS security: names will be added to the DOM via createTextNode,
    // which is supposedly safe. testing for strangeness anyways
    throw new Error('Setlist contains script tags in names');
  }
  if (Number.isNaN(parseInt(json.timestamp, 10))) {
    // make sure these are convertible to integer
    throw new Error('Setlist contains non-digit timestamps');
  }
  const result: iSetlistItem = {
    name: json.name,
    id: json.id,
    timestamp: json.timestamp,
    buildElement: buildElementFromSetlistItem,
  };
  // provision optionals in case they're missing
  if (typeof json?.logo === 'string' && !re1.test(json.logo)) {
    // re1.test, as this is going to be part of a CSS classname
    result.logo = json.logo;
  }
  if (Array.isArray(json?.data)) {
    try {
      result.data = arrayFromSaneData(json.data, createSetlistCollectionItem);
    } catch (e) {
      // console.log(`bad data: ${e.message}`);
    }
  }
  if (json?.error instanceof Error) {
    result.error = json.error;
  }
  return result;
}
