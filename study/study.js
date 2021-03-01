import "webextension-polyfill";
import * as WebScience from "./WebScience.js"
import Rally from "@mozilla/rally";
import * as EventHandling from "./EventHandling.js"

WebScience.Utilities.Debugging.enableDebugging();
const debugLog = WebScience.Utilities.Debugging.getDebuggingLog("study");

async function runStudy() {
    debugLog("Beginning study");

    await EventHandling.startStudy();
}

const rally = new Rally();
rally.initialize(
  "citp-news-disinfo",
  {
    "crv": "P-256",
    "kty": "EC",
    "x": "LDByX3lSRSU624OfR9EMO3So_0uRt2sNCVzPdQUKbrY",
    "y": "4Qu2FsVM8834l0GJG2ZA0JyJlX5Oe83jV54PZNyCSCA"
  },
  // The following constant is automatically provided by
  // the build system.
  __ENABLE_DEVELOPER_MODE__,
).then(resolve => {
    runStudy();
}, reject =>{
  // Do not start the study in this case. Something
  // went wrong.
});
