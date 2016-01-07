/**
 * menucfg.js - central configuration of EZMenu
 * a part of EZMenu
 * @copyright Copyright 2015 MPI for Research on Collective Goods
 * @license: GPLv3+
 *
 * this is an ES6 Module & you probably want to edit it a lot
 */

// ~~~~~~~~~~~~~~~~ MAIN & COMMON ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// XXX: switch this our for deployment / local testing. for production, this needs to be the FQDN of your EZProxy
// export const PROXY_HOSTNAME = 'go.coll.mpg.de'
export const PROXY_HOSTNAME = 'localhost'

// XXX: switch for deployment / local testing
// export const BASE_URL = 'https://' + PROXY_HOSTNAME + '/loggedin/'
export const BASE_URL = 'http://' + PROXY_HOSTNAME + ':8000/'

// ~~~~~~~~~~~~~~~~ MENU LIB ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// XXX: switch for deployment / local testing
// export const IMPLANT_URL = BASE_URL + 'implant.htm'
export const IMPLANT_URL = BASE_URL + 'demo_implant.html'

// CSS ID of the main menu <ul>
export const MENU_UL_ID = 'go-librecommended'
// CSS ID of the <nav> holding the menu
export const MENU_NAV_ID = 'ezmenu-menu'
// CSS ID of the button that unhides the menu
export const MENU_BUTTON_ID = 'ezmenu-button'
// HTML added to the DOM to house the menu, you can e.g. change the label of the button here
export const MENU_HTML = "<nav style='display:hidden;' id='" + MENU_NAV_ID + "'><ul id='" + MENU_UL_ID + "'></ul></nav>" +
	"<div id='" + MENU_BUTTON_ID + "'><a href='#" + MENU_NAV_ID + "'>GO</a></div>"

// HTML added to the DOM in case fetching setlist.json fails
// TODO(krugar): make this pretty
export const MENU_ERROR_HTML = "<div id='" + MENU_BUTTON_ID + "'><a>EZMenu Error</a></div>"
// CSS ID of the <iframe> housing the localStorage provider
export const IMPLANT_ID = 'ezmenu-implant'
// HTML added to the DOM to insert said <iframe>
export const IMPLANTHTML = '<iframe id="' + IMPLANT_ID + '" src="' + IMPLANT_URL + '" height="1" width="0" frameborder="0" scrolling="no" marginheight="0" marginwidth="0"></iframe>'

// ~~~~~~~~~~~~~~~~ MENU LIB: mmenu: navbar content  ~~~~~~~~~~~~~~~~~~~~~~~~
// Array holding a single string with HTML that will be added as a centered navbar to mmenu. contains a search field + button
const SEARCHFIELD =  [ '<form method="GET" action="http://core.coll.mpg.de/Search/Results" name="searchForm" id="searchForm" class="core-search">' +
	'<input id="lookfor" name="lookfor" value="" placeholder="Search in CORE" type="text">' +
	'<input id="defaultSearchButton" name="submitButton" value="GO" type="submit"></form>' ]
// Array holding three strings with HTML, added as a navbar to mmenu. feel free to remove/edit this to your needs (you're still bound by the license, however)
const COPYRIGHT_NOTICE = [
	'<a href="http://www.coll.mpg.de" target="_blank">&copy;2015 COLL</a>',
	'<a href="http://www.gnu.org/licenses/gpl-3.0.en.html" target="_blank">GPLv3</a>',
	'<a href="https://github.com/bibliocoll/ezmenu/" target="_blank">Source</a>'
]

// ~~~~~~~~~~~~~~~~ MENU LIB: mmenu options ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
export const MMENU_OPTIONS = {
	// searchfield must be present to set the placeholder text
	searchfield: {
		add: false, // we add this manually as a navbar
		placeholder: 'Filter the Menu'
	},
	// edit this to change the "title bar" of the menu
	navbar: {
		title: "<a href='http://go.coll.mpg.de'>'GO' Resource Proxy</a>"
	},
	// these are additional navbars, listed from top to bottom
	navbars: [{
		// see mmenu options documentation, these are predefined keywords
		content: ['prev', 'title', 'close']
	}, {
		content: ['searchfield']
	},
	// however, navbars with "position: 'bottom'" are listed from bottom to top
	{
		position: 'bottom',
		content: COPYRIGHT_NOTICE
	}, {
		position: 'bottom',
		content: [
			// add useful stuff here
			'<a href="" target="_blank">some</a>',
			'<a href="" target="_blank">links</a>',
			// you will want to edit this to point to your installation
			'<a href="https://YOUR-EZPROXY.TLD/logout">logout</a>'
		]
	}, {
		position: 'bottom',
		content: SEARCHFIELD
	}],
	// uncomment the following two lines if your lists are alphabetical
	// sectionIndexer: true,
	// dividers: true,
	counters: true,
	// you can remove effect-slide-panels-100 to disable the sliding animation
	extensions: ['multiline', 'border-full', 'effect-slide-panels-100'],
	offCanvas: {
		'zposition': 'front'
	}
}

export const MMENU_CONFIGURATION = {
	panelNodetype: 'ul'
}
