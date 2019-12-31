import { localforage } from "/WebScience/dependencies/localforagees6.min.js"
import * as WebScience from "/WebScience/WebScience.js"
const debugLog = WebScience.Utilities.Debugging.getDebuggingLog("Studies.SocialMediaAccountExposure");

/* SocialMediaAccountExposure - This module is used to run studies that track the user's
   exposure to news through social media. */

// Storage spaces for navigation studies
var storage = {
  pages: null, // key-value store for information about page loads
  configuration: null // key-value store for study state
};

// Helper function to set up the storage spaces
async function initializeStorage() {
  await localforage.config({
      driver: [localforage.INDEXEDDB,
               localforage.WEBSQL,
               localforage.LOCALSTORAGE],
  });

  storage.pages = await localforage.createInstance( { name: "socialMediaAccountExposure.pages" } );
  storage.configuration = await localforage.createInstance( { name: "socialMediaAccountExposure.configuration" } );
}

/* runStudy - Starts a SocialMediaAccountExposure study. Note that only one study is supported
   per extension. runStudy requires an options object with the following
   property.

     * domains - array of domains for tracking link exposure events through social media */

export async function runStudy() {

  await initializeStorage();

  // Use a unique identifier for each webpage the user visits
  var nextPageId = await storage.configuration.getItem("nextPageId");
  if(nextPageId == null) {
    nextPageId = 0;
    await storage.configuration.setItem("nextPageId", nextPageId);
  }

  // Add the content script for checking links on pages
  await browser.contentScripts.register({
      matches: [ "*://*.youtube.com/*" ],
      js: [ { file: "/WebScience/Studies/content-scripts/socialMediaAccountExposure-youtube.js" } ],
      runAt: "document_idle"
  });

  await browser.contentScripts.register({
      matches: [ "*://*.facebook.com/*" ],
      js: [ { file: "/WebScience/Studies/content-scripts/socialMediaAccountExposure-fb.js" } ],
      runAt: "document_idle"
  });

  // Listen for initial link exposure messages and save them to the database
  browser.runtime.onMessage.addListener((message, sender) => {
    if((message == null) ||
        !("type" in message) ||
        message.type != "WebScience.SocialMediaAccountExposure")
      return;
    if(!("tab" in sender))
      return;
    storage.pages.setItem("" + nextPageId, message.content);
    nextPageId = nextPageId + 1;
    storage.configuration.setItem("nextPageId", nextPageId);
    debugLog("socialMediaAccountExposure: " + JSON.stringify(message.content));
  });
}

/* Utilities */

// Helper function that dumps the navigation study data as an object
export async function getStudyDataAsObject() {
  var output = {
    "socialMediaAccountExposure.pages": { },
    "socialMediaAccountExposure.configuration": { }
  };
  await storage.pages.iterate((value, key, iterationNumber) => {
    output["socialMediaAccountExposure.pages"][key] = value;
  });
  await storage.configuration.iterate((value, key, iterationNumber) => {
    output["socialMediaAccountExposure.configuration"][key] = value;
  });
  return output;
}
