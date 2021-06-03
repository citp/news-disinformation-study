/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// This is the web-ext configuration for the study template. It is
// part of the build system, and you should not have to modify it.

// Try to read the extension ID from the WebExtensions manifest.
let extensionID = null;
try {
  const fs = require("fs");
  const manifestJSON = fs.readFileSync("./manifest.json");
  const manifestObj = JSON.parse(manifestJSON);
  extensionID = manifestObj.browser_specific_settings.gecko.id;
}
catch(error) {
  // If this block is empty, there is a linter error.
  extensionID = null;
}

module.exports = {
  // Global options:
  verbose: true,
  // Command options:
  build: {
    overwriteDest: true,
  },
  run: {
    startUrl: [
      extensionID !== null ? `about:devtools-toolbox?id=${extensionID}&type=extension`: "about:debugging#/runtime/this-firefox"
    ]
  },
  ignoreFiles: [
    "bin",
    "docs",
    "scripts",
    "src",
    "stories",
    "support",
    "tests",
    "CHANGELOG.md",
    "CODE_OF_CONDUCT.md",
    "copyright.txt",
    "LICENSE",
    "package-lock.json",
    "package.json",
    "README.md",
    "rollup.config.*",
    "web-ext-config.js",
    "public/**/*.map",
  ],
};
