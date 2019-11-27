import * as WebScience from "/WebScience/WebScience.js"
const debugLog = WebScience.Utilities.Debugging.getDebuggingLog("Studies.SocialMediaNewsExposure");

/*  SocialMediaNewsExposure - This module is used to run studies that track the user's
    exposure to links. */

var storage = null;

/*  runStudy - Starts a SocialMediaNewsExposure study. Note that only one study is supported
    per extension. runStudy requires an options object with the following
    property.

        * socialmedia - array of social media on which we can track exposure to news */

export async function runStudy() {

    storage = await (new WebScience.Utilities.Storage.KeyValueStorage("WebScience.Studies.SocialMediaNewsExposure")).initialize();

    // Use a unique identifier for each webpage the user visits
    var nextPageIdCounter = await (new WebScience.Utilities.Storage.Counter("WebScience.Studies.SocialMediaNewsExposure.nextPageId")).initialize();
    // Add the content script for checking links on pages
    await browser.contentScripts.register({
        matches: [ "http://*/*", "https://*/*" ],
        js: [ { file: "/WebScience/Studies/content-scripts/socialMediaNewsExposure.js" } ],
        runAt: "document_idle"
    });

    // Listen for initial link exposure messages and save them to the database
    browser.runtime.onMessage.addListener(async (message, sender) => {
        if((message == null) ||
              !("type" in message) ||
              message.type != "WebScience.SocialMediaNewsExposure")
          return;

        // If the exposure message isn't from a tab, ignore the message
        // (this shouldn't happen)
        if(!("tab" in sender))
            return;

        await storage.set((await nextPageIdCounter.getAndIncrement()).toString(), message.content);
        debugLog("SocialMediaLinkExposure: " + JSON.stringify(message.content));
    });

}

/* Utilities */

// Helper function that dumps the link exposure study data as an object
export async function getStudyDataAsObject() {
    if(storage != null)
        return await storage.getContentsAsObject();
    return null;
}
