/**
 * This module measures several aspects of navigation using multiple methods,
 * allowing the measurements to be compared to each other later.
 */

import {
    pageNavigation,
    pageTransition,
    contentScripts,
    messaging,
    permissions
} from "@mozilla/web-science"

import {
    storageMethodology
} from "./databases.js"

/**
 * Whether the module has started configuring event handlers.
 * @private
 * @type {boolean}
 */
let initialized = false;

/**
 * Add listeners for the events this module needs.
 * @param {matching.MatchPatternSet} matchPatterns - Match patterns for pages
 *  this module should track. Note: passing a restricted set of match patterns
 *  will prevent the module from tracking some values for the tracked pages,
 *  including the `prevTTNL` -- the time between a (n untracked) page loading
 *  and the chronologically next (tracked) page loading. See below for why the
 *  `prevTTNL` is important, and consider passing "<all_urls>" for the matchPattern,
 *  then stripping data for unwanted pages before reporting to the backend server.
 */
export async function initializeMethodology(matchPatterns) {
    if(initialized) {
        return;
    }
    initialized = true;

    permissions.check({
        module: "newsAndDisinfo.methodology",
        requiredPermissions: [ "history" ],
        suggestedOrigins: [ "<all_urls>" ]
    });

    pageNavigation.onPageData.addListener(pageDataListener, {matchPatterns});

    pageTransition.onPageTransitionData.addListener(pageTransitionDataListener, {matchPatterns});

    // The simpleAttention content script calculates a measure of attention that a
    // website developer might use. Here, we register the content script and set up
    // a listener for its messages.
    contentScripts.registerContentScript(
        matchPatterns,
        "dist/content-scripts/simpleAttention.content.js"
    );
    messaging.onMessage.addListener(
        simpleAttentionListener,
        {
            type: "newsAndDisinfo.simpleAttention.pageData",
            schema: {
                pageId: "string",
                simpleAttentionDuration: "number"
            }
        }
    );
}

/**
 * The listener function for the study-specific simple attention module.
 * The module reports the total time that the page was both focused (`onFocus`, `onBlur`)
 * and visible (`visibilitychange`).
 * @param {Object} details - the object from the event
 */
async function simpleAttentionListener(details) {
    const pageRecord = { pageId: details.pageId }
    pageRecord.attentionDwellTimePlus = details.simpleAttentionDuration;
    await storageMethodology.set(pageRecord, "simpleAttentionRecords");
}

/** Listener for the onPageData event.
 * @param {Object} details - the additional information about the page visit.
 */
async function pageDataListener(details) {
    // Initialize an object with the basic details about the page visit.
    const pageRecord = {
        url: details.url,
        pageId: details.pageId,
        pageVisitStartTime: details.pageVisitStartTime,
        pageVisitStopTime: details.pageVisitStopTime,
        attentionWebScience: details.attentionDuration,
        attentionDwellTime: details.pageVisitStopTime - details.pageVisitStartTime,
        historyNumericId: -1,
        historyReferringVisitNumericId: -1
    }

    // Look up the visit in the history database. This will tell us two things:
    // 1: the numeric ID that the browser assigned to this page visit.
    // 2: the numeric ID of the visit that the browser considers the parent of this visit.
    //
    // When we aggregate the results from this module, we'll use the ID of the parent to
    // find the URL associated with that visit, and therefore the `parentHistory`.
    // We also store this visit's numeric ID so that we can look it up later, if this page
    // is itself a parent to a later page.
    const historyVisitItems = await browser.history.getVisits({url: details.url});

    let closest = null;
    for (const result of historyVisitItems) {
        if (closest !== null &&
            Math.abs(result.visitTime - details.pageVisitStartTime) <
            Math.abs(closest.visitTime - details.pageVisitStartTime)) {
            closest = result;
        } else if (closest == null) {
            closest = result;
        }
    }
    if (closest !== null) {
        pageRecord.historyNumericId = closest.visitId;
        // Note that this is distinct from the `id` field: `id` is a unique ID shared amongst
        // historyItems (i.e., all visits to the same URL share an `id`), while `visitId` uniquely
        // identifies *this* visit to this URL. The `id` doesn't help us, since it doesn't
        // give us a visitItem record to look at.
        pageRecord.historyReferringVisitNumericId = closest.referringVisitId;
    }

    // Store this record to be processed later, during aggregation.
    await storageMethodology.set(pageRecord, "pageNavigationRecords");
}

/** Listener for the pageTransition.onPageTransitionData event.
 * @param {Object} details - information about the transition.
 */
async function pageTransitionDataListener(details) {
    const pageRecord = { pageId: details.pageId };
    if (details.transitionType == "link" ||
        details.transitionType == "reload" ||
        details.transitionQualifier == "forward_back" ||
        details.transitionQualifier == "client_redirect" ||
        details.transitionQualifier == "server_redirect") {
        pageRecord.parentWebScience = details.tabSourceUrl;
    }

    pageRecord.isHistoryChange = details.isHistoryChange;

    pageRecord.parentLoadTime = details.timeSourceUrl;
    pageRecord.parentReferrer = details.referrer;

    // The transitions module directly tells us the page that loaded chronologically before
    // this one (`timeSourceUrl` above), but it doesn't tell us that page's load time. We need
    // the load time to calculate the difference between it and this page's load time, or what
    // we call the `attentionTimeToNextLoad`. So, we'll store a record linking the pageId of the
    // previous page (`timeSourcePageId`) to the pageId of this page. Then, during aggregation,
    // we can use the page visit records for each to calculate the attentionTimeToNextLoad.
    //
    // Note that this lets us calculate the attentionTimeToNextLoad for the *previous* page, which
    // is why the database is called nextTransitionsRecords -- a page uses this database to
    // find its own attentionTimeToNextLoad by finding the pageId of the chronologically next
    // page.
    pageRecord.timeSourceParentPageId = details.timeSourcePageId;

    if (details.timeSourcePageId !== "") {
        const parentsTransitionRecord = {pageId: details.timeSourcePageId};
        parentsTransitionRecord.timeSourceChildPageId = pageRecord.pageId;
        await storageMethodology.set(parentsTransitionRecord, "nextTransitionsRecords");
    }

    await storageMethodology.set(pageRecord, "transitionsRecords");
}
