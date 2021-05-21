/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import commonjs from "@rollup/plugin-commonjs";
import copy from "rollup-plugin-copy";
import replace from "@rollup/plugin-replace";
import resolve from "@rollup/plugin-node-resolve";
//import { terser } from "rollup-plugin-terser";
import globby from "globby";

const sourceDirectory = "study";
const intermediateDirectory = "intermediate";

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
      /*
    input: "study/polClassifier.js",
    output: {
      file: "dist/polClassifier.js",
      format: "esm",
    },
    plugins: [
      resolve(),
      terser({
        warnings: true,
        mangle: {
          module: true,
        },
        format: {
          ascii_only: true,
        },
      }),
      {
        name: "worker-to-string",
        renderChunk(code) {
          return `export default '${code}';`;
        },
      },
    ],
  },
  {
  */
  {
    input: ".empty.js",
    output: {file: `${intermediateDirectory}/.empty.js`},
    plugins: [
      copy({
        targets: [{
          src: [
            `${sourceDirectory}/**/*.js`,
            `${sourceDirectory}/**/*.html`,
            //`!${sourceDirectory}/study.js`,
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
      file: "intermediate/background.js",
      sourcemap: isDevMode(cliArgs) ? "inline" : false,
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
  },
  {
    input: "study/content-script.js",
    output: {
      file: "intermediate/content-script.js",
      sourcemap: isDevMode(cliArgs) ? "inline" : false,
    },
    plugins: [
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
