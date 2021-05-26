/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import commonjs from "@rollup/plugin-commonjs";
import copy from "rollup-plugin-copy";
import replace from "@rollup/plugin-replace";
import resolve from "@rollup/plugin-node-resolve";
import globby from "globby";

const sourceDirectory = "study";
const intermediateDirectory = "dist";

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
  const rollupConfig = [
  {
    input: ".empty.js",
    output: {file: `${intermediateDirectory}/.empty.js`},
    plugins: [
      copy({
        targets: [{
          src: [
            `${sourceDirectory}/**/*.js`,
            `${sourceDirectory}/**/*.html`,
            `!${sourceDirectory}/**/*.worker.js`
          ],
          dest: `${intermediateDirectory}`
        }],
        flatten: false
      })
    ]
  },
  {
    input: "study/study.js",
    output: {
      file: "dist/background.js",
      sourcemap: isDevMode(cliArgs) ? "inline" : false,
      preserveModulesRoot: intermediateDirectory,
      format: "es"
    },
    plugins: [
      replace({
        // In Developer Mode, the study does not submit data and
        // gracefully handles communication errors with the Core
        // Add-on.
        __ENABLE_DEVELOPER_MODE__: isDevMode(cliArgs),
      }),
      resolve({
        browser: true,
      }),
      commonjs(),
    ],
  }];

  const workerPaths = globby.sync(`${sourceDirectory}/**/*.worker.js`);
  for (const workerPath of workerPaths) {
    rollupConfig.push({
      input: workerPath,
      output: {
        file: `${intermediateDirectory}${workerPath.slice(sourceDirectory.length)}`,
        format: "iife"
      },
      plugins: [
        commonjs(),
        resolve({
          browser: true
        })
      ]
    });
  }

  return rollupConfig;

};
