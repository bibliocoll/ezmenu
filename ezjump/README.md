# EZJump

This is a little demo of an HTML form that accepts an URL as input and forwards the user to the respective EZProxy [starting point URL](https://help-de.oclc.org/Library_Management/EZproxy/EZproxy_configuration/Starting_point_URLs_and_config_txt).

This is the form is being displayed by `ezjump.html`
```html
<!-- The form action needs to point to the EZProxy login URL -->
<form method="GET" action="./login" name="gosify" id="gosifyForm">
    <input id="gosifyURL" name="url" value="" placeholder="Paste URL here to open it via EZProxy" type="text">
    <input id="gosifyButton" value="GOsify!" type="submit">
</form>
<script type="text/javascript">
    registerEzJumpHandlers('gosifyForm', 'gosifyURL');
</script>
```
The signature of the `registerEzJumpHandlers()` function called above looks like this (see `ezjump.js` for the code):
```js
/**
* Registers event handlers on a Form and text Input (contained therein) that validate an URL
* and rewrite it into an EZProxy Entry URL. To be used as part of an EZProxy installation ;)
*
* @param {string} ezjumpForm - HTML ID of the Form element, default "ezjumpForm"
* @param {string} ezjumpURL - HTML ID of the Input element where URLs are entered, default "ezjumpURL"
* @param {string} validCSSClass - CSS class to toggle on the text Input element if it contains a valid URL
* @returns undefined
*/
```
The example uses some non-default values for the form element IDs to show how to provide them to the function,
but you can also just use `ezjumpForm` as the id attribute for the form and `ezjumpURL` for the text input field
and call `registerEzJumpHandlers()` without any parameters.

Don't forget to define a CSS style for `input.valid` (you can also use another CSS class name for this, and provide it as the third parameter)
