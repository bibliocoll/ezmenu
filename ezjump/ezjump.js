/**
 * ezjump.js
 *
 * @author Alexander Krug <krug@coll.mpg.de>
 * @licence GPLv3+
 */

/**
 * higher order function that puts configuration into ezjumpUrlHandler
 * @param validCSSClass the CSS class to toggle if the input field contains a valid URL
 * @returns {function} ezjumpUrlHandler with a CSS class to toggle set
 */
function configureURLHandler(validCSSClass) {
    /**
     * Handle input events and toggle the "valid" CSS class if the target's value is a valid URL
     * @param {InputEvent} event Input event from a text field
     * @returns {boolean} event handler standard return
     */
    return function ezjumpUrlHandler(event) {
        // let's make sure we got an event and it was called on an input element
        if (event instanceof Event && event.target instanceof HTMLInputElement) {
            let val = event.target.value;
            if (
                val.substr(0, 7).toLowerCase() !== 'http://'
                && val.substr(0, 8).toLowerCase() !== 'https://'
                && val !== ''
            ) {
                // be helpful and prepend "https://"
                val = `https://${val}`;
            } // TODO: handle non-http urls that do have a protocol part
            const urlRE = new RegExp(
                'https?://[-a-zA-Z0-9@:%._+~#=]{2,256}?[.][a-z]{2,24}(/[-a-zA-Z0-9@:%_+.~#?&=/]*?)?',
            );
            // legacy memento: classList.toggle, but compatible for IE < 11 ...
            /*
            if (val.search(urlRE) === -1) {
              event.target.classList.remove('valid');
            } else {
              event.target.classList.add('valid');
            }
            */
            event.target.classList.toggle(validCSSClass, (val.search(urlRE) === 0));
            event.target.value = val;
            return true;
        }
        // eslint-disable-next-line max-len
        // console.warn('ezjumpUrlHandler was called with a non-event parameter, or the event was not fired from an input element:');
        // console.dir(event);
        return true;
    }
}
/**
 * higher order function that puts configuration into ezjumpUrlHandler
 * @param textInputId the id of the relevant text input element inside the form
 * @returns {function} ezjumpUrlHandler with a CSS class to toggle set
 */
function configureFormHandler(textInputId) {
    /**
     * Catch an onsubmit event and reroute the browser to the EZProxy "entry URL"
     * @param {Event} event an onsubmit event
     * @returns {boolean} event handler standard return
     */
    return function ezjumpFormHandler(event) {
        if (event instanceof Event && event.target instanceof HTMLFormElement) {
            const textinput = event.target.querySelector(`#${textInputId}`);
            if (textinput instanceof HTMLInputElement) {
                document.location.assign(`${event.target.action}?url=${textinput.value}`);
                event.preventDefault(); // we just did location.assign. don't send the form & ruin everything
                return false; // cancel submit event
            }
            // console.warn('ezjumpFormHandler could not find an input with id "ezjumpURL" in the form');
        }
        // console.warn('ezjumpFormHandler was not called on an HTMLFormElement or something...');
        // console.dir(event);
        return true; // something's wrong here, lets propagate that event
    }
}

/**
 * Registers event handlers on a Form and text Input (contained therein) that validate an URL
 * and rewrite it into an EZProxy Entry URL. To be used as part of an EZProxy installation ;)
 *
 * @param {string} ezjumpForm - HTML ID of the Form element, default "ezjumpForm"
 * @param {string} ezjumpURL - HTML ID of the Input element where URLs are entered, default "ezjumpURL"
 * @param {string} validCSSClass - CSS class to toggle on the text Input element if it contains a valid URL
 * @returns undefined
 */
function registerEzJumpHandlers(ezjumpForm = 'ezjumpForm', ezjumpURL = 'ezjumpURL', validCSSClass = 'valid') {
    const myForm = document.getElementById(ezjumpForm);
    if (myForm instanceof HTMLFormElement) {
        const textinput = myForm.querySelector(`#${ezjumpURL}`);
        if (textinput instanceof HTMLInputElement) {
            const myFormHandler = configureFormHandler(ezjumpURL);
            const myURLHandler = configureURLHandler(validCSSClass);
            textinput.addEventListener('input', myURLHandler);
            myForm.addEventListener('submit', myFormHandler);
        }
    }
}
// you might want to turn this into an es6 module:
// export default registerEzJumpHandlers
