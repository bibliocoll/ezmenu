/**
 * lslib.js - handles communication with the localstorage provider iframe
 * a part of EZMenu
 * @copyright Copyright 2015 MPI for Research on Collective Goods
 * @license: GPLv3+
 *
 * EZMenu uses localStorage to cache menu data. Since Browsers only allow access to localStorage
 * under the rules of their same-origin policy, we inject an iframe that loads a small html page
 * and javascript for actual interaction with the Browser localStorage API. The injected page comes
 * from a fixed URL (usually cfg.BASE_URL + implant.htm), so it can access persisted menu data
 * no matter into which proxied website the main script (and thus, this module) is injected.
 *
 * This ES6 module facilitates communication from the main script to the javascript running inside
 * the injected frame via the postMessage() system modern Browsers include, and provides a minimal
 * and abstract API to the main script for getting SetlistItems (ie: data for one submenu) from
 * localStorage or storing/updating them.
 */
import domrdy from 'domready'
import * as cfg from './menucfg'
import {
	SetlistItem, SetlistDataCollectionItem
}
from './ezmenuclasses'


/**
 * Resolves when the DOM is ready
 * @type 	 Promise
 * @return undefined once the DOM is ready
 */
var waitfordom = new Promise(domrdy)


/**
 * Object/Dictionary of Promises we need to hold on to in a pending state
 * @type {Object}
 */
var knownDeferreds = {}


/**
 *
 * returns a pending Promise that can be resolved or rejected via
 * knownDeferreds[id].resolve(value) or knownDeferreds[id].reject(error)
 * @method buildDeferred
 * @param  {string}      id key to store the Promise under in knownDeferreds
 * @return {Promise}         new pending Promise
 *
 * What we do here is to create an empty _pending_ Promise (something akin a
 * Deferred in jQuery parlance) once we begin to await an event (usually of the
 * 'message' type, right before we send a request via postMessage ourselves),
 * and then resolve that pending Promise once we get the answer we waited for
 * (or reject it in case of an error). That maneuver is not quite supported by
 * the Promise API, but the most concise translation mechanism we've found.
 * Better code comments or pointers to better solutions are very welcome
 */
function buildDeferred(id) {
	function defer(resolve, reject) {
		// TODO(krugar): setTimeout to reject? that way we can force error messages
		knownDeferreds[id] = {
			resolve: resolve,
			reject: reject
		}
	}
	return new Promise(defer)
}


/**
 * Promise for a verified setlist retrieved from the proxy. consumer needs to .catch()
 * @type   {Promise}
 * @return {Array} the resolved value is the result of buildSetlist called on a JSON string retrieved from the iframe
 * @throws {Error} the rejection reason is either a JSON.parse error or something forwarded from the iframe
 */
export var setlist = buildDeferred('setlist')


/**
 * We'll resolve this once the iframe has been inserted
 * @type   {Promise}
 * @return {Object} the resolved value is supposed to look like this: {window: iframe.contentFrame}
 */
var sourcePromise = buildDeferred('sourcePromise')


/**
 * We'll resolve this when we get a SYN msg from the iframe, meaning the it was able to run javascript
 * @type   {Promise}
 * @return {Object} the resolved value is supposed to look like this: {window: iframe.contentFrame}
 */
var iframeReady = buildDeferred('iframeReady')


/**
 * factory function for an Array of SetlistDataCollectionItems
 * does sanity checks on input data
 * @method buildSetlistDataCollection
 * @param  {Array}                   somejson Array of Objects (marshalled from JSON)
 * @return {Array}                            Array of SetlistDataCollectionItems
 */
function buildSetlistDataCollection(somejson) {
	// check that structure is as expected
	if (somejson.hasOwnProperty('name')) {
		if (somejson.hasOwnProperty('data') &&
			Array.isArray(somejson.data) &&
			somejson.data.length > 0) {
			let collection = []
			somejson.data.forEach((item) => collection.push(new SetlistDataCollectionItem(item)))
			return collection
		}
	}
	// if we haven't returned by now, we really shouldn't
	throw new Error('Collection structure unexpected')
}


/**
 * factory function for an Array of SetlistItems
 * @method buildSetlist
 * @param  {Array}     json Array of Objects (marshalled from JSON)
 * @return {Array}          Array of SetlistItems
 */
function buildSetlist(json) {
	if (Array.isArray(json)) {
		let setlist = []
		json.forEach((json_item) => setlist.push(new SetlistItem(json_item)))
		return setlist
	}
	// if we haven't returned by now, we really shouldn't
	throw new Error('Attempted to construct Setlist from something not a JSON Array')
}


/**
 * implements EventListener interface
 *
 * communication with the localstorage provider iframe happens via
 * .postMessage(), so we need to listen for 'message' events from our iframe
 * @param  {Event} event (supposedly of type "message")
 * @return false if we consumed the event, true otherwise
 */
function handleMessage(evt) {
	if (evt.type !== 'message') {
		return true
	} // not my circus, not my monkeys

	// TODO(krugar): this is correct, but building the correct origin during init would be better
	var originmatch = cfg.IMPLANT_URL.indexOf(evt.origin) === 0
		// sourcePromise.window should resolve to our iframe
	var sourcematch = sourcePromise.then((s) => evt.source === s.window)
		.catch((e) => false) // if checking for the iframe threw, we're through
	if (originmatch && sourcematch) {
		var message = evt.data
			//message came from our iframe, react to it according to message type

		// XXX: handling of the various expected message types happens here


		// SYN / iframe ready
		if (typeof message === 'string' && message === 'SYN') {
			// NOTE: browser security would cry that event.source.then()
			// may not be accessed so we wrap it into an object that can silently
			// fail a Promise thenable test.
			// in content sourcePromise and iframeReady
			// are the same now, but they embody two different states of the iframe
			console.log('parent recieved SYN')
			knownDeferreds['iframeReady'].resolve({'window': evt.source})
			iframeReady.then((iframe) => iframe.window.postMessage('ACK', cfg.IMPLANT_URL))
			evt.preventDefault ? evt.preventDefault() : evt.returnValue = false
			return evt.returnValue
		}


		// SET|... / setlist
		else if (typeof message === 'string' && message.substr(0, 4) === 'SET|') {
			let response = message.substring(4)
			try {
				let setlist_data = JSON.parse(response)
				knownDeferreds['setlist'].resolve(buildSetlist(setlist_data))
			} catch (e) {
				knownDeferreds['setlist'].reject(e)
			}
			evt.preventDefault ? evt.preventDefault() : evt.returnValue = false
			return evt.returnValue
		}


		// FAIL / setlist retrieval failed
		else if (typeof message === 'string' && message.substr(0, 5) === 'FAIL|') {
			//TODO(krugar): sanity check the error message before handing it to displayToplevelError etc
			knownDeferreds['setlist'].reject(new Error('Setlist retrieval failed:' + message.substring(5)))
			evt.preventDefault ? evt.preventDefault() : evt.returnValue = false
			return evt.returnValue
		}


		// COLL_OK / collection data
		else if (typeof message === 'string' && message.substr(0, 8) === 'COLL_OK|') {
			// coll_id is supposed to be between two '|', we found the first one, find the second and cut before
			let coll_id = message.substring(8, message.indexOf('|', 8))
				// all the rest BEHIND the second '|' is supposed to be JSON
			let collection_string = message.substring(9 + coll_id.length)
			try {
				let data_collection = buildSetlistDataCollection(JSON.parse(collection_string))
				if (knownDeferreds.hasOwnProperty(coll_id)) {
					knownDeferreds[coll_id].resolve(data_collection)
					delete knownDeferreds[coll_id]
				} else {
					throw new Error('got COLL_OK for unknown Collection: ' + coll_id)
				}
			} catch (e) {
				if (knownDeferreds.hasOwnProperty(coll_id)) {
					knownDeferreds[coll_id].reject('Parsing JSON for ' + coll_id + ' failed')
					delete knownDeferreds[coll_id]
				}
			}
			evt.preventDefault ? evt.preventDefault() : evt.returnValue = false
			return evt.returnValue
		}


		// COLL_FAIL / collection retrieval failed
		else if (typeof message === 'string' && message.substring(0, 10) === 'COLL_FAIL|') {
			// coll_id is supposed to be between two '|', we found the first one, find the second and cut before
			let coll_id = message.substring(8, message.indexOf('|', 10))
			let error_string = message.substring(11 + coll_id.length)
				//TODO(krugar): sanity check the error message before handing it to displaySublevelError etc
			if (knownDeferreds.hasOwnProperty(coll_id)) {
				knownDeferreds[coll_id].reject(error_string)
				delete knownDeferreds[coll_id]
			} else {
				throw new Error('got COLL_FAIL for unknown Collection: ' + coll_id)
			}
			evt.preventDefault ? evt.preventDefault() : evt.returnValue = false
			return evt.returnValue
		}
	} // end sanity checking if
	return true
} // end handleMessage


/**
 * try to get data for an item from the iframe
 *
 * returns a deferred in the .data field. when the deferred is resolved
 * item.from_local is set to true
 * @param  {SetlistItem} item, item with .data field = false
 * @return {SetlistItem} same item, with .data field containing a deferred for Submenu data
 */
export function get(item) {
	// we shouldn't send messages before someone listens to us (we shouldnt have a reason to, but who knows)
	return iframeReady.then((iframe) => {
			item.data = buildDeferred(item.id)
			let req_obj = {
				'id': item.id,
				'timestamp': item.timestamp
			}
			iframe.window.postMessage('REQ|' + JSON.stringify(req_obj), cfg.IMPLANT_URL)
			return item
		})
		.catch((e) => console.log('lslib get error:' + e.message))
}


// bootstrapping code, IIFE wrapped
(() => {
	waitfordom.then(() => {
		// get ready to receive messages from the implant iframe we're about to insert into the DOM
		window.addEventListener("message", handleMessage)
		document.body.insertAdjacentHTML("beforeend", cfg.IMPLANTHTML)
		let ifrmWindow = document.getElementById(cfg.IMPLANT_ID)
			.contentWindow
		if (typeof ifrmWindow === 'object') {
			knownDeferreds['sourcePromise'].resolve({
				'window': ifrmWindow
			})
		} else {
			knownDeferreds['sourcePromise'].reject(new Error('no contentWindow attribute on iframe element'))
		}
		sourcePromise.catch((e) => {
				// TODO(krugar): show in interface and explain to user, they likely have a privacy plugin
				// it would probably also make sense to replace the public api with cheap NOOPs here
				console.log('creating localStorage provider iframe failed: ' + e.messsage)
				throw e
			})
			// preparations are finished. next, we either get a 'ready' message, or our get() is called
	})
})()
