import {
    pageNavigation,
    pageTransition,
    pageManager
} from "@mozilla/web-science"

import {
    storageMethodology
} from "./databases.js"

/**
 * Add listeners for the events this module needs.
 * @param {matching.MatchPatternSet} matchPatterns - Match patterns for pages
 *  this module should track.
 */
export function registerListeners(matchPatterns) {
    console.log("hello from methodology");
    pageNavigation.onPageData.addListener(pageDataListener, {matchPatterns});
    pageTransition.onPageTransitionData.addListener(pageTransitionDataListener, {matchPatterns});
    pageManager.onPageVisitStart.addListener(pageVisitStartListener);
}

/** Listener for the onPageData event.
 * @param {Object} details - the additional information about the page visit.
 */
async function pageDataListener(details) {
    const pageRecord = await storageMethodology.get({pageId: details.pageId});
    pageRecord.pageVisitStopTime = details.pageVisitStopTime;
    pageRecord.attentionWebScience = details.attentionDuration;
    pageRecord.attentionDwellTime = pageRecord.pageVisitStopTime - pageRecord.pageVisitStartTime;

    const historyResults = await browser.history.search({
        text: details.url,
        // seems like the history time is always after the pageVisitStartTime
        startTime: pageRecord.pageVisitStartTime
    });

    let closest = null;
    for (const result of historyResults) {
        if (closest !== null &&
            Math.abs(result.lastVisitTime - details.pageVisitStartTime) <
            Math.abs(closest.lastVisitTime - details.pageVisitStartTime)) {
            closest = result;
        } else if (closest == null) {
            closest = result;
        }
    }
    console.log("closest", closest);
    if (closest !== null) {
        pageRecord.parentHistory = closest.url;
    }

    storageMethodology.set(pageRecord);
}

/** Listener for the pageManager.onPageVisit Start event.
 * @param {Object} details - information about the page visit
 */
async function pageVisitStartListener(details) {
    const newPageRecord = createPageRecord(details);

    await storageMethodology.set(newPageRecord);
    console.log("added", newPageRecord);
}

/** Listener for the pageTransition.onPageTransitionData event.
 * @param {Object} details - information about the transition.
 */
async function pageTransitionDataListener(details) {
    const pageRecord = await storageMethodology.get({pageId: details.pageId});
    console.log("found", pageRecord);
    if (details.transitionType == "link" ||
        details.transitionType == "reload" ||
        details.transitionQualifier == "forward_back" ||
        details.transitionQualifier == "client_redirect" ||
        details.transitionQualifier == "server_redirect") {
        pageRecord.parentWebScience = details.tabSourceUrl;
    }
    pageRecord.parentLoadTime = details.timeSourceUrl;
    pageRecord.parentReferrer = details.referrer;

    if (details.timeSourcePageId !== "") {
        console.log("looking up prev", details);
        const prevPageRecord = await storageMethodology.get({pageId: details.timeSourcePageId});
        console.log("found prev", prevPageRecord);
        prevPageRecord.attentionTimeToNextLoad =
            pageRecord.pageVisitStartTime - prevPageRecord.pageVisitStartTime;

        pageRecord.prevTTNL = prevPageRecord.attentionTimeToNextLoad;
        storageMethodology.set(prevPageRecord);
    }

    storageMethodology.set(pageRecord);

}

/** Create a mostly-blank page record object based on the information about the
 * visit's start.
 * @param {Object} details - information from the onPageVisitStart event
 */
function createPageRecord(details) {
    const pageRecord = {
        url: details.url,
        pageId: details.pageId,
        pageVisitStartTime: details.pageVisitStartTime,
        pageVisitStopTime: null, // filled by this page's onPageData

        attentionWebScience: null, // filled by this page's onPageData
        attentionDwellTime: null, // filled by this page's onPageData
        attentionDwellTimePlus: null, // TODO
        attentionTimeToNextLoad: null, // filled by next page's onTransition

        prevTTNL: null, // filled by this page's onTransition

        parentWebScience: null, // filled by this page's onTransition
        parentReferrer: null, // filled by this page's onTransition
        parentLoadTime: null, // filled by this page's onTransition
        parentHistory: null, // TODO
    }

    return pageRecord;
}
