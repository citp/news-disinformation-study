/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import commonjs from "@rollup/plugin-commonjs";
import replace from "@rollup/plugin-replace";
import resolve from "@rollup/plugin-node-resolve";
import copy from "rollup-plugin-copy";
import globby from "globby";
import webScienceRollupPlugin from "@mozilla/web-science/rollup-plugin";

/**
 * Helper to detect developer mode.
 *
 * @param cliArgs the command line arguments.
 * @return {Boolean} whether or not developer mode is enabled.
 */
function isDevMode(cliArgs) {
  return Boolean(cliArgs["config-enable-developer-mode"]);
}

export default (cliArgs) => {
  // Configuration for the main background script, study/study.js.
  // The script will be output to dist/background.js with any module
  // dependencies (your own modules or modules from NPM) bundled in.
  const rollupConfig = [
    {
      input: "src/background.js",
      output: {
        file: "dist/background.js",
        sourcemap: isDevMode(cliArgs) ? "inline" : false,
      },
      plugins: [
        replace({
          // In Developer Mode, the study does not submit data and
          // gracefully handles communication errors with the Core
          // Add-on.
          __ENABLE_DEVELOPER_MODE__: isDevMode(cliArgs),
        }),
        webScienceRollupPlugin(),
        resolve({
          browser: true,
        }),
        commonjs(),
        // Configuration for non-JavaScript assets (study/**/*) that
        // are not JavaScript files (i.e., do not end in .js). These
        // files will be copied to dist/ with the same relative path
        // they have in study/.
        copy({
          targets: [{
            src: [
              "src/**/*",
              "!src/**/*.js",
            ],
            dest: "dist/",
          }],
          flatten: false,
        }),
      ],
    }
  ];

  // Configuration for content scripts (study/**/*.content.js) and
  // worker scripts (study/**/*.worker.js). These files will be
  // output to dist/ with the same relative path they have in
  // study/, but with any module dependencies (your own modules or
  // modules from npm) bundled in. We provide this configuration
  // because content scripts and worker scripts have separate
  // execution environments from background scripts, and a
  // background script might want to reference the bundled
  // scripts (e.g., browser.contentScripts.register() or new
  // Worker()).
  const scriptPaths = globby.sync([ `src/**/*.content.js`, `src/**/*.worker.js` ]);
  for(const scriptPath of scriptPaths) {
    rollupConfig.push({
      input: scriptPath,
      output: {
        file: `dist/${scriptPath.slice("study/".length)}`,
        format: "iife",
        sourcemap: isDevMode(cliArgs) ? "inline" : false,
      },
      plugins: [
        webScienceRollupPlugin(),
        resolve({
          browser: true,
        }),
        commonjs(),
      ],
    });
  }

  return rollupConfig;
}
