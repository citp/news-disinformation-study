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
    "kid": "citp-news-disinfo-two",
    "kty": "EC",
    "x": "Q20tsJdrryWJeuPXTM27wIPb_YbsdYPpkK2N9O6aXwM",
    "y": "1onW1swaCcN1jkmkIwhXpCm55aMP8GRJln5E8WQKLJk"
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
