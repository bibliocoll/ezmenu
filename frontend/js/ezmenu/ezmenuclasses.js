/**
 * ezmenuclasses.js - ES6 class definitions for EZMenu data types
 * a part of EZMenu
 * @copyright Copyright 2015 MPI for Research on Collective Goods
 * @license: GPLv3+
 *
 * We're using the ES6 classes mainly to make our data format explicit,
 * but these have methods to create their expected DOM representations as well.
 */


/**
 * these are used to validate fields retrieved via json
 */
const re1 = new RegExp('\\W')
const re2 = new RegExp('<|>')
const re3 = new RegExp('\\D')
const desc_re1 = new RegExp('##', 'g') // styling
const desc_re2 = new RegExp('\"|\'', 'g') // XSS: prevent dangling markup injection
const xss_re1 = new RegExp('<|>|\W|"|\'')

/**
 * @class SetlistDataCollectionItem
 * This holds the data for a single submenu entry,
 * a.k.a. one of the actual links to a proxied resource
 */
export class SetlistDataCollectionItem extends Object {
	constructor(json) {
		if (typeof json['title'] !== 'string' ||
			typeof json['url'] !== 'string' ||
			typeof json['proxied'] !== 'boolean' ||
			typeof json['free'] !== 'boolean') {
			throw new Error('Collection contains malformed items')
		}
		// XSS security: titles will be added to the DOM via createTextNode,
		// which is supposedly safe. testing for strangeness anyways
		if (re2.test(json.title)) {
			throw new Error('Collection contains script tags in titles')
		}
		// NOTE: this is where you add more checks
		super()
		this.title = json.title
		this.url = json.url
		this.proxied = json.proxied
		this.free = json.free
			// TODO(krugar): this goes into the DOM -> sanity check
		this.desc = (json.hasOwnProperty('desc')) ? json.desc.replace(desc_re1, '\n')
			.replace(desc_re2, '&quot;') : undefined
	}

	buildElement() {
		let link = document.createElement('a')
		link.href = this.url
		if (this.desc) {
			link.title = this.desc
		}
		if (!this.proxied) {
			link.className = 'external'
			link.target = '_blank'
			if (!this.free) {
				link.className = 'external locked'
			}
		}
		link.appendChild(document.createTextNode(this.title))
		let menuitem = document.createElement('li')
		menuitem.appendChild(link)
		return menuitem // NOTE: elm.appendChild(other) returns other, so the extra line for return is required
	}
}


/**
 * @class SetlistItem
 * This holds the data for a single main menu entry,
 * a.k.a. one of the category names and information about the
 * data source for the corresponding submenu
 */
export class SetlistItem extends Object {
	constructor(json) {
		if (typeof json['id'] !== 'string' ||
			typeof json['name'] !== 'string' ||
			typeof json['timestamp'] !== 'string') {
			throw new Error('Setlist contains malformed items')
		}
		if (re1.test(json.id)) {
			// XSS security: id will be used to construct URLs, disallow non-word chars
			throw new Error('Setlist contains non-alphanumeric ids')
		}
		if (re2.test(json.name)) {
			// XSS security: names will be added to the DOM via createTextNode,
			// which is supposedly safe. testing for strangeness anyways
			throw new Error('Setlist contains script tags in names')
		}
		if (re3.test(json.timestamp)) {
			// make sure these are convertible to integer
			throw new Error('Setlist contains non-digit timestamps')
		}
		// NOTE: this is where you add more checks
		super()
		this.name = json.name
		this.id = json.id
		this.timestamp = json.timestamp
			// TODO(krugar): is that enough XSS safety check?
		this.logo = (json.logo && !xss_re1.test(json.logo)) ? json.logo : undefined
		this.data = undefined
		this.error = undefined
	}

	buildElement() {
		let li = document.createElement('li')
		let span = document.createElement('span')
		if (this.logo !== undefined) {
			span.className = 'logo-' + this.logo
		}
		span.appendChild(document.createTextNode(this.name)) // createTextNode() supposedly is XSS safe
		li.appendChild(span)
		return li // NOTE: elm.appendChild(other) returns other, so the extra line for return is required
	}
}
