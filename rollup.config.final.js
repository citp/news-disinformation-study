/**
 * WebScience Final Build Step
 * -----------------------
 *   * Convert content script and HTML files to background script files with inlined content.
 */

import url from "@rollup/plugin-url";
import copy from "rollup-plugin-copy";

const intermediateDirectory = "intermediate";
const distributionDirectory = "dist";

export default (cliArgs) => {
  return [{
    input: `${intermediateDirectory}/background.js`,
    output: {
      dir: distributionDirectory,
      preserveModules: true,
      preserveModulesRoot: intermediateDirectory,
      format: "es"
    },
//    plugins: [
//      url({
//        include: [ "**/*.worker.js", "**/*.html" ],
//        limit: Number.MAX_VALUE // Inline regardless of content size
//      })
//    ]
  },
  {
    input: ".empty.js",
    plugins: [
      copy({
        targets: [{
          src: [
            `${intermediateDirectory}/**/*.worker.js`,
          ],
          dest: `${distributionDirectory}`
        }],
        flatten: false
      })
    ]
  }
  ];
}
