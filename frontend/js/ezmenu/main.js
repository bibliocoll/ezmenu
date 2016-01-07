/**
 * main.js - central control flow of EZMenu
 * a part of EZMenu
 * @copyright Copyright 2015 MPI for Research on Collective Goods
 * @license: GPLv3+
 *
 * This ES6 module makes use of the library modules
 * (menulib and lslib, plus the menucfg module)
 * to conduct the construction of the EZMenu UI from data
 * that is either fetched from the Browser localStorage
 * or from the EZProxy web server
 *
 * This project is written mostly in ES6/ES2015 JavaScript
 * and needs to be transpiled (or 'compiled down') to the
 * language specs current browsers support. For example,
 * we rely on Promises in this project, which need to be
 * polyfill()'d to make this work in Internet Explorer
 *
 * The menu UI is delivered by jQuery.mmenu, additional
 * content is configured in the menucfg module, look and feel
 * is adjusted in sass/menu.sass
 *
 * currently jQuery is required by mmenu (used in menulib),
 * the rest of the code has no dependencies on it (other than
 * creating jQuery objects for mmenu to operate on).
 */

import es6prom from 'es6-promise'
es6prom.polyfill() // patches global environment for old browsers. it is enough to run this once per browsing context
import * as data from './lslib'
import * as menu from './menulib'


data.setlist // lslib holds a promise for a verified setlist, which implies DOM readiness
	.then(menu.createToplevel) // if the promise resolves, we can build the first level of our menu
	.catch(menu.displayToplevelError) // if not, at least notify the user
	.then((arr) => arr.map((item) => { // we're going through all the SetlistItems now
		Promise.resolve(item) // (make item thenable)
			.then(menu.toggleSpinner) // display loading animation
			.then(data.get) // request adding .data to item from our local storage provider
			.then(menu.addSubmenu) // use item.data to add a submenu to the DOM and mmenu.init() it
			.then(menu.toggleSpinner) // if that all worked out, disable the loading animation
			.catch(menu.displaySublevelError) // if it didn't, show error message for that submenu
		})
	)
