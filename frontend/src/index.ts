/**
 * ezmenu-menu-js - central control flow of EZMenu
 * a part of EZMenu
 * @copyright Copyright 2015-2021 MPI for Research on Collective Goods
 * @license GPLv3+
 *
 * The menu UI is delivered by mmenu-js, additional
 * content is configured in the menucfg module, look and feel
 * is adjusted in sass/menu.sass
 */

// styles via webpack magic // TODO: load later?
import 'mmenu-js/dist/mmenu.css';
import '../sass/loggedin/menu.sass';

import {
  arrayFromSaneData,
  createSetlistCollectionItem,
  createSetlistItem,
  domReady,
  iSetlistItem,
  storageAvailable,
} from './common/index';

/* @ts-ignore */ // we don't have a .d.ts for Mmenu
import Mmenu from 'mmenu-js';

import {
  BASE_ORIGIN, GO_AWAY_ID,
  IMPLANT_ID,
  IMPLANT_URL,
  LAZY_LOAD,
  MENU_BUTTON_ID,
  MENU_NAV_ID,
  MENU_UL_ID,
  MMENU_CONFIGURATION,
  MMENU_OPTIONS,
} from './menucfg';

const lsAvailable = storageAvailable('localStorage');
let setlist: iSetlistItem[] = [];

/**
 * creates a nav element and adds an ul/li representation of the menu data structure into it
 * @param sl SetlistItems (and SetlistCollectionItems) to (recursively) call .buildElement() on
 */
function buildMenuDOM(sl: iSetlistItem[]): HTMLElement {
  const navigation = document.createElement('nav');
  navigation.id = MENU_NAV_ID;
  navigation.setAttribute('style', 'display:none;');
  const ul = document.createElement('ul');
  ul.id = MENU_UL_ID;
  sl.forEach((item) => ul.appendChild(item.buildElement(item)));
  navigation.appendChild(ul);
  return navigation;
}

/**
 * creates two divs and a link
 */
function buildButtonDOM(): HTMLDivElement {
  const buttonContainer = document.createElement('div');
  const button = document.createElement('div');
  button.id = MENU_BUTTON_ID;
  const buttonLink = document.createElement('a');
  buttonLink.href = `#${MENU_NAV_ID}`;
  buttonLink.text = 'GO';
  buttonContainer.appendChild(button);
  button.appendChild(buttonLink);
  return buttonContainer;
}

/**
 * allows setting the LAZY_LOAD flag
 * @param {MouseEvent} event expected to be a 'click' event
 */
function goAwayHandler(event: MouseEvent): false {
  if (lsAvailable) {
    if (window.localStorage.getItem(LAZY_LOAD) === null) {
      window.localStorage.setItem(LAZY_LOAD, '1');
    } else {
      window.localStorage.removeItem(LAZY_LOAD);
    }
    document.location.reload();
  }
  event.preventDefault();
  return false;
}

/**
 * calls new Mmenu(elm, MMENU_OPTIONS, MMENU_CONFIGURATION)
 * @param elm the nav element housing an ul/li structure that Mmenu understands
 * @param event optional mouse event that triggered the call
 */
function initializeMenu(elm: HTMLElement, event?: MouseEvent): unknown {
  // if we've been called with a mouse event, remove LAZY_LOAD from localstorage
  // TODO: it might make more sense to only do this on a second click on the "go away" button
  if (event !== null && typeof event !== 'undefined' && lsAvailable) {
    window.localStorage.removeItem(LAZY_LOAD);
  }
  // in any case, build the menu
  const menu = new Mmenu(elm, MMENU_OPTIONS, MMENU_CONFIGURATION);
  // add functionality to the 'go away' button
  const goAwayLink = document.getElementById(GO_AWAY_ID);
  if (goAwayLink !== null) goAwayLink.addEventListener('click', goAwayHandler);
  elm.removeAttribute('style');
  return menu;
}

/**
 * to be attached to a MessagePort sent over from the iFrame. Receives all the menu content data
 * @param event
 */
function portListener(event: MessageEvent): void {
  // basic sanity check for received data
  if (Array.isArray(event.data) && event.data.length === 2) {
    // console.log(`received postMessage: ${event.data[0]}`);
    // setlist is meant to be sent first, and it needs special treatment
    if (event.data[0] === 'setlist') {
      const deserialized = JSON.parse(event.data[1]);
      if (Array.isArray(deserialized)) {
        try {
          setlist = arrayFromSaneData(deserialized, createSetlistItem);
        } catch (e) {
          if (e instanceof TypeError) {
            console.log('Setlist deserialized to 0 items length');
            console.log(e.message);
          }
        }
      }
    } else {
      // deserialize collections into the .data attribute of the corresponding setlist entry
      // this only works if setlist gets sent first, but otherwise the ScriptJob queue should debounce the events
      const found = setlist.findIndex((value) => event.data[0] === value.id);
      if (found >= 0) {
        const deserialized = JSON.parse(event.data[1]);
        if (deserialized.data !== undefined && Array.isArray(deserialized.data)) {
          try {
            setlist[found].data = arrayFromSaneData(deserialized.data, createSetlistCollectionItem);
          } catch (e) {
            if (e instanceof TypeError) {
              console.log(`Collection ${setlist[found].name} (${setlist[found].id}) deserialized to 0 items length`);
              console.log(e.message);
            }
          }
        }
      }
      // after handling a received collection is finished, check if we still expect more messages
      // TODO: shouldn't this be value.?data ??
      if (!(setlist.some((value) => value.data === undefined))) {
        // all setlist collections have been marshalled. we're done listening. time to build the menu

        // const messagePort = event.ports[0];
        // messagePort.onmessage = null;

        // create the menu DOM tree
        const nav = buildMenuDOM(setlist);
        // create the button
        const button = buildButtonDOM();
        // add either into the document.
        document.body.appendChild(nav);
        document.body.appendChild(button);
        // everything needed to initialize the menu is now present in the DOM. We'll hold off on running the JS based
        // on whether LAZY_LOAD is set for this domain - the "go away" button functionality
        if (lsAvailable && window.localStorage.getItem(LAZY_LOAD) !== null) {
          // if LAZY_LOAD is set, initialize the menu only after the button is clicked
          button.addEventListener('click', (ev) => initializeMenu(nav, ev), { once: true });
        } else { // otherwise, do it now
          // console.log('LAZY_LOAD not active, calling Mmenu');
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const menu = initializeMenu(nav);
        }
      }
    }
  }
}

/**
 * this waits for a Window.postMessage() from the iFrame, expecting a message with an attached MessagePort
 * Sets up the MessageChannel and attaches portListener() to the associated MessagePort
 * @param event the MessageEvent it was listening for
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/MessageChannel}
 */
function portGrabber(event: MessageEvent): void {
  // console.log('portGrabber called');
  // console.dir(event);
  // console.log(BASE_ORIGIN);
  if (event.origin !== BASE_ORIGIN) return;
  // TODO: any more checks to do here?
  if (event.ports[0] instanceof MessagePort) {
    const messagePort: MessagePort = event.ports[0];
    messagePort.onmessage = portListener;
    // console.log('portListener installed');
    event.preventDefault();
    // deregister self as event listener. we have what we came for
    window.removeEventListener('message', portGrabber);
  }
}

/**
 * main code block
 */
domReady().then(() => {
  // load CSS files
  // register Windows.postMessage() MessageEvent listener
  window.addEventListener('message', portGrabber);
  // console.log('portGrabber installed');
  // inject iframe. the frame will load @bibliocoll/ezmenu-iframe
  const iframe = document.createElement('iframe');
  iframe.id = IMPLANT_ID;
  iframe.src = IMPLANT_URL;
  iframe.setAttribute('style', 'display:none;');
  document.body.appendChild(iframe);
});
