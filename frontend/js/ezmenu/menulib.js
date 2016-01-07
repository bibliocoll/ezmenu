/**
 * menulib.js - handles DOM manipulation, transforms data into the actual EZMenu UI
 * a part of EZMenu
 * @copyright Copyright 2015 MPI for Research on Collective Goods
 * @license: GPLv3+
 *
 * This ES6 module handles the user facing aspects of EZMenu, namely building the UI
 * or displaying errors in case the menu cannot work as intended for some reason
 * TODO(help wanted): error handling currently is rudimentary at best
 *
 * JSDoc jQuery object definitions:
 * @external jQuery
 * @see {@link http://api.jquery.com/jQuery/}
 * @external mmenuApi
 * @see {@link http://mmenu.frebsite.nl/documentation/api.html}
 */
import domrdy from 'domready'
import jQ from 'jquery'
jQ.noConflict(true)
import mmenu from 'BeSite/jQuery.mmenu'
import * as cfg from './menucfg'


/**
 * Resolves when the DOM is ready
 * @type 	 Promise
 * @return undefined once the DOM is ready
 */
var waitfordom = new Promise(domrdy)

/**
 * injects a stylesheet link tag into the DOM
 * @method loadCss
 * @param  {[type]} url [description]
 * @return {[type]}     [description]
 */
function loadCss(url) {
	var link = document.createElement("link")
	link.type = "text/css"
	link.rel = "stylesheet"
	link.href = url
	document.getElementsByTagName("head")[0].appendChild(link)
	return true
}


/**
 * toggles a css class on the .$li field that displays a loading animation
 *
 * @param {Object|Promise} item, has to have a '$li' property referring to a jQuery obj
 * @returns {Object|Promise} item, unchanged
 */
export function toggleTheSpinner(item) {
	item.$li.toggleClass("mm-ajax-loading")
	return item
}


/**
 * createToplevelMenu()
 *
 * given an Array of SetlistItems (@see ezmenuclasses.js), create and initialize
 * an 1-level-deep jQuery.mmenu
 *
 * @param {Array|Promise} Promise for an Array containing SetlistItems
 * @returns {Array|Promise} input unchanged but changes have been made to the DOM
 */
export function createToplevel(setlist) {
	// make sure we do have a DOM to manipulate
	return Promise.all([setlist, waitfordom])
		.then((bothpromises) => {
			// we can throw away the domready promise at this point, and just work on the setlist array
			let arr = bothpromises[0]
				// make the browser load styles. this just adds link tags to the DOM
			loadCss(cfg.BASE_URL + 'menu.css')
			loadCss(cfg.BASE_URL + 'jquery.mmenu.all.css')
				// inject the static part of our menu into the DOM
			document.body.insertAdjacentHTML("beforeend", cfg.MENU_HTML)
			// we could do without jQuery here, but we need it for the LI's anyways so
			let $ul = jQ('#' + cfg.MENU_UL_ID)
			// now fire up the mmenu and keep the api object
			/**
			 * jQuery.mmenu stores its API object in a data-attribute of the DOM node it was created on
			 * @see {external:mmenuApi}
			 */
			let mmenuapi = jQ('#' + cfg.MENU_NAV_ID)
				.mmenu(cfg.MMENU_OPTIONS, cfg.MMENU_CONFIGURATION)
				.data("mmenu")

			// add one <li> per future submenu to the <ul>
			arr.forEach((item) => {
				//SetlistItem has a createElement() method
				let $li = jQ(item.buildElement())
					.appendTo($ul)
					// housekeeping. putting these references into the items allows the main script to be pretty readable from here on down
				item['$li'] = $li // this ones' home in the DOM
				item['mmenuapi'] = mmenuapi // keeping a reference of this here makes stuff easier later
			}) // end of forEach()
			return arr
		})
}


/**
 * display error when building the menu is not possible
 */
export function displayToplevelError(err) {
	if (err instanceof Error) {
		console.log('Menu main level creation error: ' + err.message)
	}
	// we're not recovering, we'll just notify the user and exit silently
	jQ("body")
		.append(cfg.MENU_ERROR_HTML)
}


/**
 * display error when loading submenu data failed but top level was built
 */
export function displaySublevelError(err) {
	if (err instanceof Error) {
		console.log('Menu sublevel creation error ' + err.message)
			// TODO(krugar): prettify
	}
}


/**
 * create a <li> and <a> for this data item and append to returnvalue
 *
 * this function is used in Promise.reduce() below
 * @param {Element} ret_ul, should be an <ul>, will be returned
 * @param {SetlistDataCollectionItem} data_item, exptected to be a single ReNa JSONP entry
 * @returns {Element} ret_ul, with one <li> appended
 */
function appendListItem(ret_ul, data_item, curIdx, arr) {
	//SetlistDataCollectionItem has a createElement() method
	ret_ul.appendChild(data_item.buildElement())
	return ret_ul // NOTE: elm.appendChild(other) returns other!
}


/**
 * given data for a submenu, build and add it to the DOM
 *
 * @param {Object|Promise} item, one item from the setlist JSONP result
 * @returns {Object|Promise} item, unmodified, but DOM is changed as a side effect
 */
export function addSubmenu(item) {
	var submenu = document.createElement('ul')
	submenu.className = 'generatedMenu'
	item.data.then((data) => {
		return Promise.resolve(data.reduce(appendListItem, submenu))
			.then((finished_submenu) => {
				// mmenu requires a jQuery object
				let $submenu = jQ(finished_submenu)
					.appendTo(item['$li'])
					// call mmenuapi.init() on the ul we just added into the DOM
				item['mmenuapi'].init($submenu)
				return item
			})
	})
}
