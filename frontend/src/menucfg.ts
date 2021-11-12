/**
 * menucfg.js - central configuration of EZMenu
 * a part of EZMenu
 * @copyright Copyright 2015 MPI for Research on Collective Goods
 * @license: GPLv3+
 *
 * this is an ES6 Module & you probably want to edit it a lot
 */

// ~~~~~~~~~~~~~~~~ MAIN & COMMON ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

export const PROXY_HOSTNAME = (process.env.NODE_ENV === 'production') ? 'go.coll.mpg.de' : 'localhost';
export const BASE_ORIGIN = (process.env.NODE_ENV === 'production') ? `https://${PROXY_HOSTNAME}` : `http://${PROXY_HOSTNAME}:8080`;
export const BASE_URL = `${BASE_ORIGIN}/`;

// ~~~~~~~~~~~~~~~~ MENU LIB ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

export const IMPLANT_URL = `${BASE_URL}loggedin/implant.htm`;

// CSS ID of the main menu <ul>
export const MENU_UL_ID = 'go-librecommended';
// CSS ID of the <nav> holding the menu
export const MENU_NAV_ID = 'ezmenu-menu';
// CSS ID of the button that unhides the menu
export const MENU_BUTTON_ID = 'ezmenu-button';

// HTML added to the DOM in case fetching setlist.json fails
// TODO(krugar): make this pretty
export const MENU_ERROR_HTML = `<div id='${MENU_BUTTON_ID}'><a>EZMenu Error</a></div>`;
// CSS ID of the <iframe> housing the localStorage provider
export const IMPLANT_ID = 'ezmenu-implant';

// "go away" button functionality
export const LAZY_LOAD = `${PROXY_HOSTNAME}-menu_lazy_load`;
export const GO_AWAY_ID = 'please_just_go_away';

// part of an example addon, see coll_lib.js
// array of form element ids that should have the gosify handlers applied
export const EZJUMP_FORM_ID_ARRAY = ['ezjumpForm', 'ezjumpForm2'];
// name of the text input element inside that form // FIXME: this should be an array, too
export const EZJUMP_INPUT_ID = ['ezjumpURL', 'ezjumpURL2'];
// CSS class to toggle on if the text input contains a valid URL
export const EZJUMP_VALID_CLASS = 'valid';

const EZJUMP = [
  `<form method="GET" action="${BASE_URL}login" name="gosify" id="${EZJUMP_FORM_ID_ARRAY[0]}" class="core-search">
  <input id="${EZJUMP_INPUT_ID[0]}" name="url" value="" placeholder="Paste URL here to open it via EZProxy" type="text">
  <input id="ezjumpButton" value="EZJump!" type="submit"></form>`,
];

// Example array holding three strings with HTML, added as a navbar to mmenu.
// feel free to remove/edit this to your needs
// the first string is part of an example addon, see coll_lib.js
const LINKS = [
  `<abbr title="Reloads this page with the EZMenu disabled, hopefully leaving you with an un-broken page"><a href="#" id="${GO_AWAY_ID}">"go away"</a></abbr>`,
  '<a href="https://www.coll.mpg.de" target="_blank">COLL</a>',
  `<a href="${BASE_URL}logout">logout</a>`,
];

// ~~~~~~~~~~~~~~~~ MENU LIB: mmenu: navbar content  ~~~~~~~~~~~~~~~~~~~~~~~~
// Array holding a single string with HTML that will be added as a centered navbar to mmenu.
// contains a search field + button
const CORE_SEARCH = [
  '<form method="GET" action="https://core.coll.mpg.de/Search/Results" name="searchForm" id="searchForm" class="core-search">'
    + '<input id="lookfor" name="lookfor" value="" placeholder="Search in CORE" type="text">'
    + '<input id="defaultSearchButton" name="submitButton" value="GO" type="submit"></form>',
];
// Array holding three strings with HTML, added as a navbar to mmenu.
// feel free to remove/edit this to your needs (you're still bound by the license, however)

// ~~~~~~~~~~~~~~~~ MENU LIB: mmenu options ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
export const MMENU_OPTIONS = {
  // searchfield must be present to set the placeholder text
  searchfield: {
    add: false, // we add this manually as a navbar
    placeholder: 'Filter the Menu',
  },
  // edit this to change the "title bar" of the menu
  navbar: {
    title: "<a href='https://YOUR-EZPROXY.TLD/'>'EZMenu' Resource Proxy</a>",
  },
  // these are additional navbars, listed from top to bottom
  navbars: [
    {
      // see mmenu options documentation, these are predefined keywords
      content: ['prev', 'title', 'close'],
    },
    {
      content: EZJUMP,
    },
    {
      content: ['searchfield'],
    },
    // however, navbars with "position: 'bottom'" are listed from bottom to top
    {
      position: 'bottom',
      content: [
        // add useful stuff here
        '<a href="" target="_blank">some</a>',
        '<a href="" target="_blank">links</a>',
        // you will want to edit this to point to your installation
        '<a href="https://YOUR-EZPROXY.TLD/logout">logout</a>',
      ],
    },
    {
      position: 'bottom',
      content: LINKS,
    },
    {
      position: 'bottom',
      content: CORE_SEARCH,
    },
  ],
  // uncomment the following two lines if your lists are alphabetical
  // sectionIndexer: true,
  // dividers: true,
  counters: true,
  // you can remove effect-slide-panels-100 to disable the sliding animation
  extensions: ['multiline', 'border-full', 'fx-menu-slide', 'fx-panel-slide-100'],
  offCanvas: {
    zposition: 'front',
  },
};

/*
export const MMENU_CONFIGURATION = {
  panelNodetype: ['ul'],
  offCanvas: {
    clone: true,
  },
};
*/
export const MMENU_CONFIGURATION = {
  panelNodetype: ['ul'],
};
