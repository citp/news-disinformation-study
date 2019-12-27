import { localforage } from "/WebScience/dependencies/localforagees6.min.js"
import * as WebScience from "/WebScience/WebScience.js"
const debugLog = WebScience.Utilities.Debugging.getDebuggingLog("Studies.SocialMediaNewsExposure");

/* SocialMediaNewsExposure - This module is used to run studies that track the user's
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

  storage.pages = await localforage.createInstance( { name: "socialMediaNewsExposure.pages" } );
  storage.configuration = await localforage.createInstance( { name: "socialMediaNewsExposure.configuration" } );
}

/* runStudy - Starts a SocialMediaNewsExposure study. Note that only one study is supported
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
      //matches: socialmedia,
      matches: [ "*://*.youtube.com/*" ],
      js: [ { file: "/WebScience/Studies/content-scripts/socialMediaNewsExposure-youtube.js" } ],
      runAt: "document_idle"
  });

  await browser.contentScripts.register({
      //matches: socialmedia,
      matches: [ "*://*.facebook.com/*" ],
      js: [ { file: "/WebScience/Studies/content-scripts/socialMediaNewsExposure-fb.js" } ],
      runAt: "document_idle"
  });

  // Listen for initial link exposure messages and save them to the database
  browser.runtime.onMessage.addListener((message, sender) => {
    if((message == null) ||
        !("type" in message) ||
        message.type != "WebScience.SocialMediaNewsExposure")
      return;
    if(!("tab" in sender))
      return;
    storage.pages.setItem("" + nextPageId, message.content);
    nextPageId = nextPageId + 1;
    storage.configuration.setItem("nextPageId", nextPageId);
    debugLog("socialMediaNewsExposure: " + JSON.stringify(message.content));
  });
}

/* Utilities */

// Helper function that dumps the navigation study data as an object
export async function getStudyDataAsObject() {
  var output = {
    "socialMediaNewsExposure.pages": { },
    "socialMediaNewsExposure.configuration": { }
  };
  await storage.pages.iterate((value, key, iterationNumber) => {
    output["socialMediaNewsExposure.pages"][key] = value;
  });
  await storage.configuration.iterate((value, key, iterationNumber) => {
    output["socialMediaNewsExposure.configuration"][key] = value;
  });
  return output;
}
