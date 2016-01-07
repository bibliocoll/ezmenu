#!/bin/sh
echo "=== resetting dist directory ==="
rm -rf ./dist/
mkdir -p dist/loggedin dist/public
echo '=== copying static files ==='
cp frontend/html/*.htm dist/
cp frontend/html/loggedin/*.htm dist/loggedin/
cp frontend/fonts/Roboto* dist/public/
cp `find jspm_packages -name jquery.mmenu.all.css` dist/loggedin/
echo '=== compiling SASS ==='
node-sass frontend/sass/loggedin/menu.sass -o dist/loggedin/
node-sass frontend/sass/public/coll.sass -o dist/public/
echo '=== transpiling & minifying scripts ==='
jspm bundle-sfx --minify --skip-source-maps frontend/js/ezmenu/main.js dist/loggedin/injectmenu.js
jspm bundle-sfx --minify --skip-source-maps frontend/js/ez_implant/main.js dist/loggedin/implant.js
