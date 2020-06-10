/** 
 * This module complements the `PageEvents` module with additional
 * functionality for measuring user engagement with webpages.
 * 
 * The module currently implements the following measurements:
 *   * Page Height - the maximum page height (in pixels)
 *   * Scroll Depth - the maximum scroll depth (in pixels)
 *   * Article Character Count - the number of characters in an article, if the page can
 *     be parsed as an article
 *   * Audio Duration - the total time that audio played on the page (in milliseconds)
 *  
 * Some known limitations to be aware of:
 *   * This module uses dynamic content script injection to measure webpage
 *     engagement. The current WebExtensions API only supports dynamic script
 *     injection on the basis of tab IDs, rather than unique page IDs. This
 *     limitation leads to possible race conditions: 1) a study requests
 *     user engagement measurement, the page in the tab changes between the
 *     request and the content script injection, and the content script
 *     attaches to a different webpage than the study intended; and 2) while
 *     measuring user engagement, the page in the tab changes, and the study
 *     associates the measurement with the new page in the tab. The module
 *     attempts to mitigate these race condition risks by passing the page
 *     URL and referrer URL along with measurements.
 *   * This module does not keep track of whether a tab is in a private
 *     window. Callers are responsible for managing private window state (e.g.,
 *     using the `PageEvents` module).
 *   * The module uses an async lookup for tab audio and article state when it
 *     begins measuring user engagement with a page. This introduces another
 *     race condition risk. If we run into problems, we might start caching tab
 *     audio and article state (similar to the other tab state caching in
 *     `PageEvents`).
 * 
 * And some implementation quirks to be aware of for future development on this module:
 *   * This module relies on page visit events from the `PageEvents` module, so that
 *     page engagement measurement lifespan is synchronized with page visit lifespan.
 *     Without this synchronization (e.g., just using `tabs.onUpdated`), there is a
 *     possible race condition where the caller requests page engagement measurement
 *     for a new page in a tab, then this module learns that the page in the tab has
 *     changed and ends the measurement for that tab.
 *     
 * @module WebScience.Utilities.PageEngagement
 */

// TODO: avoid a race condition where the content script attaches to a successor page by
// binding the content script to the initial URL and referrer of the page

// TODO: avoid a race condition where the content script sends an update but the tab is
// changing in the background page, by binding the content script to a nonce associated
// with the page in the tab (generate in the content script and return with a Promise)

// TODO: avoid a race condition where the page changes while fetching audible and reader
// properties, by caching those properties for all tabs

import * as PageEvents from "./PageEvents.js"
import * as Messaging from "./Messaging.js"

/**
 * Internal state for measuring user engagement with a page and managing listeners.
 * @typedef {Object} PageEngagementInternalState
 * @property {Set<pageEngagementListener>} listeners - The set of listeners for the page.
 * @property {boolean} measured - Whether the measurement content script has executed.
 * @property {string} url - The URL of the page currently loaded in the tab.
 * @property {string} referrer - The referrer URL for the page currently loaded in the tab, or
 * "" if there is no referrer.
 * @property {string} requestId - The request ID for the page currently loaded in the tab, or
 * "" if not known.
 * @property {number} pageHeight - The maximum page height in pixels.
 * @property {number} scrollDepth - The maximum scroll depth in pixels.
 * @property {boolean} isArticle - Whether the page is recognized as an article.
 * @property {number} articleCharacterCount - The number of characters in the article (if it is recognized
 * as an article).
 * @property {number} audioDuration - The total time that audio played on the page (in
 * milliseconds).
 * @property {boolean} audible - Whether audio is currently playing on the page.
 * @property {boolean} lastAudioStart - The last time audio playback started on the page (in
 * milliseconds since the epoch).
 */

/**
 * The latest measurement of user engagement with a page, for sharing with listeners.
 * @typedef {Object} PageEngagementMeasurement
 * @property {string} url - The URL of the page.
 * @property {string} referrer - The referrer URL for the page, or "" if there is no referrer.
 * @property {number} pageHeight - The maximum page height in pixels.
 * @property {number} scrollDepth - The maximum scroll depth in pixels.
 * @property {boolean} isArticle - Whether the page is recognized as an article.
 * @property {number} articleCharacterCount - The number of characters in the article (if it is recognized
 * as an article).
 * @property {number} audioDuration - The total time that audio played on the page (in milliseconds).
 */

/**
 * A listener function for page engagement measurement updates.
 * @callback pageEngagementListener
 * @param {PageEngagementMeasurement} details - The latest page engagement measurement.
 */

/**
 * A Map that associates tab IDs with page engagement measurements.
 * @private
 * @constant {Map<number,PageEngagementInternalState>}
 */
const pageEngagementStateMap = new Map();

/**
 * Register a listener function that will be notified about updated page engagement measurements.
 * @param {number} - The tab ID for the tab containing the page to measure engagement on.
 * @param {pageEngagementListener} pageEngagementListener - The listener function.
 */
export async function registerPageEngagementListener(tabId, pageEngagementListener) {
    initialize();
    
    // If there isn't currently internal state for this tab, initialize the state and inject the
    // measurement content script
    var pageEngagementState = pageEngagementStateMap.get(tabId);
    if(pageEngagementState === undefined) {
        pageEngagementState = {
            listeners: new Set(),
            measured: false,
            url: "",
            referrer: "",
            requestId: "",
            pageHeight: -1,
            scrollDepth: -1,
            isArticle: false,
            articleCharacterCount: -1,
            audioDuration: 0,
            audible: false,
            lastAudioStart: -1
        };
        pageEngagementStateMap.set(tabId, pageEngagementState);
        browser.tabs.get(tabId).then(tab => {
            if(tab.isArticle) {
                pageEngagementState.isArticle = true;
                measureArticleLength(tabId);
            }
            if(tab.audible) {
                pageEngagementState.audible = true;
                lastAudioStart = Date.now();
            }
        });
        browser.tabs.executeScript(tabId, {
            file: "/WebScience/Utilities/content-scripts/pageEngagement-main.js",
            runAt: "document_idle"
        });
    }
    
    // Add the page engagement measurement listener to the listener set for the tab
    pageEngagementState.listeners.add(pageEngagementListener);
}

/** 
 * Notify page engagement listeners with the latest measurement.
 * @private
 * @param {number} tabId - The tab containing the page with updated engagement measurement.
 * @param {PageEngagementInternalState} [pageEngagementState=null] - The internal state for
 * the page associated with the tab, if the caller has already retrieved it.
 */
function notifyPageEngagementListeners(tabId, pageEngagementState = null) {
    if(pageEngagementState === null) {
        pageEngagementState = pageEngagementStateMap.get(tabId);
        if(pageEngagementState === undefined)
            return;
    }
    for(const pageEngagementListener of pageEngagementState.listeners)
        pageEngagementListener(pageEngagementMeasurement);
}

/** 
 * Update the engagement measurement for a page with article length.
 * @private
 * @param {number} tabId - The tab containing the page.
 */
function measureArticleLength(tabId) {
    browser.tabs.executeScript(tabId, {
        file: "/WebScience/dependencies/JSDOMParser.js",
        runAt: "document_idle"
    });
    browser.tabs.executeScript(tabId, {
        file: "/WebScience/dependencies/Readability.js",
        runAt: "document_idle"
    });
    browser.tabs.executeScript(tabId, {
        file: "/WebScience/Utilities/content-scripts/pageEngagement-article.js",
        runAt: "document_idle"
    });
}

/**
 * Whether the module has configured browser event handlers.
 * @private
 * @type {boolean}
 */
var initialized = false;

/**
 * Configure browser event handlers. Runs only once.
 * @private
 */
async function initialize() {
    if(initialized)
        return;

    // Configure event listeners

    // If there's a page visit stop event in a tab, and we're
    // measuring page engagement for that tab, end the measurement
    PageEvents.registerPageVisitStopListener(details => {
        if (details.tabId in pageEngagementMeasurementMap) {
            pageEngagementMeasurementMap.delete(details.tabId);
            pageEngagementListenerMap.delete(details.tabId);
        }
    });

    // If audio or article state changes for a tab,
    // and if we're measuring page engagement for that tab, update the audio and article state
    browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if(!initialized)
            return;
        var pageEngagementState = pageEngagementStateMap.get(tabId);
        if(pageEngagementState === undefined)
            return;
        if("audible" in changeInfo) {
            if(changeInfo.audible && !pageEngagementState.audible) {
                pageEngagementState.audible = true;
                pageEngagementState.lastAudioStart = Date.now();
            }
            if(!changeInfo.audible && pageEngagementState.audible) {
                pageEngagementState.audible = false;
                pageEngagementState.audioDuration = pageEngagementState.audioDuration + (Date.now() - pageEngagementState.lastAudioStart);
            }
        }
        if("isArticle" in changeInfo) {
            if(!pageEngagementState.isArticle && changeInfo.isArticle) {
                pageEngagementState.isArticle = true;
                measureArticleLength(tabId);
            }
        }
        if(pageEngagementState.measured)
            notifyPageEngagementListeners(tabId, pageEngagementState);
    }, {
        properties: [ "audible", "isArticle" ]
    });

    // Handle updates from page engagement measurement content scripts
    Messaging.registerListener("WebScience.Utilities.PageEngagement.MeasurementUpdate", (message, sender) => {
        if(!(tab in sender))
            return;
        var pageEngagementState = pageEngagementStateMap.get(tab.id);
        if(pageEngagementState === undefined)
            return;
        
        // Flag that there has been a measurement for this page
        pageEngagementState.measured = true;
        
        // Update the internal state with the latest measurement
        for(const key of Object.keys(message))
            if(key !== "type")
                pageEngagementState[key] = message[key];
        
        // Notify listeners about the latest measurement
        notifyPageEngagementListeners(tab.tabId, pageEngagementState);
    });

    initialized = true;
}
