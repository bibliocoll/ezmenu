/**
 * (implant) main.js - handles communication with the Browser localstorage API
 * a part of EZMenu
 * @copyright Copyright 2015 MPI for Research on Collective Goods
 * @license: GPLv3+
 *
 * EZMenu uses localStorage to cache menu data. Since Browsers only allow access to localStorage
 * under the rules of their same-origin policy, we inject an iframe that loads a small html page
 * that loads this script for actual interaction with the Browser localStorage API. The injected page comes
 * from a fixed URL (usually config.BASE_URL + implant.htm), so it can access persisted menu data
 * no matter into which proxied website the main script (the parent frame) is injected.
 *
 * This ES6 module uses postMessage to communicate with its parent frame, which it assumes (after some
 * checks on the domain name) to be part of the same EZMenu installation.
 */

import es6prom from 'es6-promise'
es6prom.polyfill() // patches global environment for old browsers. enough to run this once per browsing context
import fetch from 'whatwg-fetch'
import domrdy from 'domready'


/**
 * Resolves when the DOM is ready
 * @type 	 Promise
 * @return undefined once the DOM is ready
 */
var waitfordom = new Promise(domrdy)

/**
 * hostname of the document this script is run in
 * @type {string}
 */
const myloc = document.location.hostname

// needed for sanity checks in handleMessage
const re1 = new RegExp('\\W')
const re2 = new RegExp('\\D')


/**
 * make fetch throw on http error code
 *  @see {link https://github.com/github/fetch}
 */
function checkStatus(response) {
	if (response.status >= 200 && response.status < 300) {
		if (response.headers.get("content-type") && response.headers.get("content-type").toLowerCase().indexOf("application/json") >= 0) {
			return response
		} else {
			throw new TypeError()
		}
	} else {
		var error = new Error(response.statusText)
		error.response = response
		throw error
	}
}


/**
 * retrieve setlist.json from our location on the web, send cookies
 * @method fetch
 * @param  {URL} 'setlist.json' URL to fetch
 * @param  {Object} {	credentials: 'same-origin'} makes fetch send cookies
 * @return {Promise} should resolve to a JSON string eventually
 */
var setlistPromise = window.fetch('setlist.json', {
		credentials: 'same-origin'
	})
	.then(checkStatus)


/**
 * localStorage adapter
 * @type {Object}
 * @method get(key)
 * @method set(key, string)
 * @method remove(key)
 * @attribute isSupported
 */
var ls = {
	// this was trivially derived from lsjs code carrying the following copyright notice:
	/*
	  Copyright (c) 2004-2011, The Dojo Foundation All Rights Reserved.
	  Available via Academic Free License >= 2.1 OR the modified BSD license.
	  see: http://dojotoolkit.org/license for details
	*/
	/**
	 * checks localStorage availability
	 * @method isSupported
	 * @return {boolean} true if localStorage is available, false otherwise
	 */
	isSupported: (() => {
		try {
			return 'localStorage' in window && window['localStorage'] !== null;
		} catch (e) {
			return false;
		}
	})(),

	/**
	 * deletes a key/value pair, returns value
	 * @method remove
	 * @param  {string} key, the dict key for which to remove the key/value pair
	 * @return {string} string now gone from localStorage or null if Exception
	 */
	remove: function (key) {
		if (this.isSupported) {
			try {
				var value = localStorage[key];
				if (value !== undefined && value !== null) {
					localStorage.removeItem(key);
					return value
				} else {
					// console.log("Failed to remove nonexistant value from local storage [" + key + "]");
					return null
				}
			} catch (e) {
				return null
			}
		} else {
			return null
		}
	},

	/**
	 * retrieve string for key
	 * @method get
	 * @param  {string} key, the dict key to the value to be retrieved
	 * @return {string} data from localstorage
	 * @throws a lot :P
	 */
	get: function (key) {
		if (!this.isSupported) {
			throw new Error('localStorage not supported')
		}
		try {
			var value = localStorage[key]
			if (value !== undefined && value !== null) {
				return value
			} else {
				throw new Error('Value nonexistant')
			}
		} catch (e) {
			throw e
		}
	},

	/**
	 * commit string to localStorage
	 * @method set
	 * @param  {string} key, dict key to store entry under
	 * @param  {string} entry, Object to JSON.stringify and store in localStorage
	 * @return {string} entry, unchanged, or null if Exceptions were thrown
	 */
	set: function (key, entry) {
		try {
			localStorage[key] = entry
			return entry
		} catch (e) {
			// console.log("Failed to set value in local storage [" + key + "] : " + e);
			return null
		}
	}
}


/**
 * haphazardly cut hostname from an URL string
 * @method getHostFromUrlString
 * @param  {string} url, expected to contain protocol://hostname{:port|/dir}
 * @return {string} hostname, hopefully
 */
function getHostFromUrlString(url) {
	var hoststart = url.indexOf('://') + 3
	var hostend = url.length;
	[':', '/'].forEach(function (symbol) {
		var temp = url.indexOf(symbol, hoststart)
		if (temp > 0) hostend = Math.min(hostend, temp)
	})
	return url.substring(hoststart, hostend)
}


/**
 * implements EventListener interface to communicate with the parent frame via window.postMessage()
 *
 * only reacts to messages from window.parent if the hostname ends in the
 * local hostname (same-origin or subdomain).
 *
 * @method handleMessage
 * @param  {Event} event, a "message" event
 * @return nothing, but sends postMessage messages as a side effect
 */
function handleMessage(event) {
	var originhost = getHostFromUrlString(event.origin)
	var originmatch = (originhost.lastIndexOf(myloc) >= 0)
	var sourcematch = event.source === window.parent
	if (originmatch && sourcematch) {
		// the other guy's hostname ends in our hostname, thats a good sign
		// and they're our parent frame. we talk to them
		var message = event.data

		// XXX: handling of the various expected message types happens here
		// Older versions of Internet Explorer can only send strings via postMessage
		// for some reason we felt compelled to support that, so brace yourself for
		// hacky string/json stuff that modern browsers wouldnt have needed. happy times
		// TODO(krugar): put the string/json stuff into a second, IE only code path


		// ACK / Setlist request -- we do only 2-way-handshakes here, we're cheap
		if (typeof message === 'string' && message === 'ACK') {
			// once we know the other side can hear us, send the setlist json as a string
			setlistPromise
				.then(response => response.text())
				.then(response_text => event.source.postMessage('SET|' + response_text, event.origin))
				.catch(error => event.source.postMessage('FAIL|' + error.message, event.origin))
		}


		// REQ / Collection request
		else if (typeof message === 'string' && message.substr(0, 4) === 'REQ|') {
			let request = JSON.parse(message.substr(4)) // everything but 'REQ|'
				// sanity checks, re1 tests for non-alpha, re2 for non.digit
			if (request.hasOwnProperty('id') &&
				!re1.test(request.id) &&
				request.hasOwnProperty('timestamp') &&
				!re2.test(request.timestamp)) {
				let returnPromise = undefined
				let ls_is_current = false
				try {
					let data_timestamp = ls.get(request.id + 'time')
					if (data_timestamp === request.timestamp) {
						let datastring = ls.get(request.id)
						ls_is_current = true // no need to update ls later
						returnPromise = Promise.resolve(datastring) // happiness, send back ls data
					} else {
						ls.remove(request.id + 'time')
						ls.remove(request.id) // remove outdated ls data
						throw new Error('timestamp missmatch')
					}
				} catch (e) {
					// localstorage unsupported/failed or timestamp errored, promise to fetch data
					returnPromise = window.fetch(request.id + '.json', {
							credentials: 'same-origin'
						})
						.then(response => response.text())
				} finally {
					//returnPromise either resolved to datastring or will resolve to the fetch promise, go async
					returnPromise.then((promised_data) => {
							event.source.postMessage('COLL_OK|' + request.id + '|' + promised_data, event.origin)
							if (!ls_is_current && ls.isSupported) {
								// FIXME(krugar): this can lead to inconsistent data, once the second code path is in, JSON parse happens
								ls.set(request.id + 'time', request.timestamp)
								ls.set(request.id, promised_data)
							}
						})
						.catch((error) => event.source.postMessage('COLL_FAIL|' + request.id + '|' + error.message, event.origin))
				} // end try / catch / finally
			} // end sanity check if
		} // end REQ message handling
	} // end if (originmatch && sourcematch)
} // end handleMessage

// bootstrapping code, IIFE wrapped
(() => {
	waitfordom.then(() => {
		window.addEventListener("message", handleMessage)
		window.parent.postMessage('SYN', '*')
	})
})()
