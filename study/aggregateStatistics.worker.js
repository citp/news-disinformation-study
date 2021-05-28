/**
 * @file Script for computing aggregate statistics
 */

import * as webScience from "./webScience.js"
import { storageTransitions, storageClassifications, storagePN, storageSMLS, storageLE } from "./databases.js"

const fbRegex = /(facebook.com\/pages\/[0-9|a-z|A-Z|-]*\/[0-9]*(\/|$))|(facebook\.com\/[0-9|a-z|A-Z|.]*(\/|$))/i;
const ytRegex = /(youtube.com\/(user|channel)\/[0-9|a-z|A-Z|_|-]*(\/videos)?)(\/|$)|(youtube\.com\/[0-9|A-Z|a-z]*)(\/|$)|(youtube\.com\/profile\?user=[0-9|A-Z|a-z]*)(\/|$)/i;
const twRegex = /(twitter\.com\/[0-9|a-z|A-Z|_]*(\/|$))/;
let destinationMatcher;
let sourceMatcher;
let fbMatcher;
let twMatcher;
let ytMatcher;

/**
 * Event handler for messages from the main thread
 * On receiving data, the function computes aggregate statistics and
 * sends a message back to the caller with the result object.
 *
 * @param {MessageEvent} event - message object
 * @listens MessageEvent
 */
onmessage = async event => {
    const type = event.data.type;
    const data = event.data;
    if (type == "init") {
        initialize(data);
        return;
    } else if (type == "aggregate") {
        runAggregation(data);
    }
}

/**
 * @param {Object} initializationData - Object containing initialization parameters.
 * @param {Object} initializationData.destinationMatches - Serialized MatchPatternSet containing all tracked destination domains.
 * @param {Object} initializationData.sourceMatches - Serialized MatchPatternSet containing all tracked source domains.
 * @param {Object} initializationData.fbMatches - Serialized MatchPatternSet containing tracked Facebook pages.
 * @param {Object} initializationData.ytMatches - Serialized MatchPatternSet containing tracked YouTube channels.
 * @param {Object} initializationData.twMatches - Serialized MatchPatternSet containing tracked Twitter handles.
 */
function initialize(initializationData) {
    destinationMatcher = webScience.matching.createMatchPatternSet([]);
    destinationMatcher.import(initializationData.destinationMatches);

    sourceMatcher = webScience.matching.createMatchPatternSet([])
    sourceMatcher.import(initializationData.sourceMatches);

    fbMatcher = webScience.matching.createMatchPatternSet([])
    fbMatcher.import(initializationData.fbMatches);

    ytMatcher = webScience.matching.createMatchPatternSet([])
    ytMatcher.import(initializationData.ytMatches);

    twMatcher = webScience.matching.createMatchPatternSet([])
    twMatcher.import(initializationData.twMatches);
}

/**
 * @param {Object} aggregationData - Object containing data specific to a single aggregation run.
 * @param {integer} aggregationData.startTime - Timestamp before which events should not be included.
 * @param {integer} aggregationData.endTime - Timestamp before which events should be included.
 */
async function runAggregation(aggregationData) {
    const stats = {};
    const startTime = aggregationData.startTime;
    const endTime = aggregationData.endTime;
    const pageNavEvents = await storagePN.getEventsByRange(startTime, endTime);
    const linkShareEvents = await storageSMLS.getEventsByRange(startTime, endTime);
    const linkExposureEvents = await storageLE.getEventsByRange(startTime, endTime);

    stats["newsAndDisinfo.pageNavigation"] = await aggregatePageNav(pageNavEvents);
    stats["newsAndDisinfo.socialMediaLinkSharing"] = await aggregateLinkSharing(linkShareEvents);
    stats["newsAndDisinfo.linkExposure"] = await aggregateLinkExposure(linkExposureEvents);

    sendMessageToCaller("stats", stats);
}

/**
 * Error handler
 * @param {ErrorEvent} event - error object
 * @listens ErrorEvent
 */
onerror = event => {
    console.error(event.message);
}

/**
 * Sends messages to the main thread that spawned this worker thread.
 * Each message has a type property for the main thread to handle messages.
 * The data property in the message contains the data object that the worker
 * thread intends to send to the main thread.
 *
 * @param {string} messageType message type
 * @param {Object} data data to be sent
 */
function sendMessageToCaller(messageType, data) {
    postMessage({
        type: messageType,
        ...data
    });
}

/**
 * Functions for computing statistics
 */

/**
 * Function for computing page navigation statistics
 * @param {Object} pageNavigationStorage page navigation storage object
 */
async function aggregatePageNav(pageNavEvents) {
    const stats = {
        trackedVisitsByCategory: {},
        untrackedVisitsCount: 0
    };
    for (const pageNavEvent of pageNavEvents) {
        if (pageNavEvent.type == "pageVisit") {
            const transitionsEvent = await storageTransitions.get({pageId: pageNavEvent.pageId});
            const sourceDomainFromTransitions = transitionsEvent ?
                getTrackedPathSource(transitionsEvent.sourceUrl) :
                "";
            const classifierResults = {};
            const classificationEvents = await storageClassifications.search(
                {pageId: pageNavEvent.pageId});
            for (const classificationEvent of classificationEvents) {
                classifierResults[classificationEvent.className] = classificationEvent.classification;
            }
            const visitDomain = getTrackedPathDest(pageNavEvent.url);

            const date = new Date(pageNavEvent.pageVisitStartTime);
            const dayOfWeek = date.getUTCDay();
            const hourOfDay = date.getUTCHours();
            const timeOfDay = Math.floor(hourOfDay / 4) * 4;

            const index = JSON.stringify({
                visitDomain,
                sourceDomainFromReferrer: getTrackedPathSource(pageNavEvent.referrer),
                sourceDomainFromTransitions,
                dayOfWeek,
                timeOfDay,
                classifierResults
            });

            let categoryObj = stats.trackedVisitsByCategory[index];
            if (categoryObj) {
                categoryObj.categoryVisitsCount += 1;
                categoryObj.categoryAttention += pageNavEvent.attentionDuration;
                categoryObj.categoryScroll += Math.floor(pageNavEvent.maxRelativeScrollDepth * 100);
            } else {
                categoryObj = {};
                categoryObj.categoryVisitsCount = 1;
                categoryObj.categoryAttention = pageNavEvent.attentionDuration;
                categoryObj.categoryScroll = Math.floor(pageNavEvent.maxRelativeScrollDepth * 100);
                stats.trackedVisitsByCategory[index] = categoryObj;
            }
        } else if (pageNavEvent.type == "untracked") {
            stats.untrackedVisitsCount += 1;
        }
    }

    return formatPageNav(stats);
}

function formatPageNav(unformattedPageNavStats) {
    const formattedPageNavStats = {};
    formattedPageNavStats.trackedVisitsByCategory = [];
    for (const index in unformattedPageNavStats.trackedVisitsByCategory) {
        const aggregateData = unformattedPageNavStats.trackedVisitsByCategory[index];
        let category = JSON.parse(index);
        category = {...category, ...aggregateData};
        formattedPageNavStats.trackedVisitsByCategory.push(category);
    }
    formattedPageNavStats.untrackedVisitsCount = unformattedPageNavStats.untrackedVisitsCount;
    return formattedPageNavStats;
}


/**
 * Function for computing link exposure statistics
 * @param {Object} linkExposureStorage page navigation storage object
 */
function aggregateLinkExposure(linkExposureEvents) {
    const stats = {};
    stats.untrackedExposuresCount = 0;
    stats.trackedExposuresByCategory = {};

    for (const linkExposureEvent of linkExposureEvents) {
        if (linkExposureEvent.type == "exposure") {
            const date = new Date(linkExposureEvent.firstSeen);
            const hourOfDay = date.getUTCHours();
            const timeOfDay = Math.floor(hourOfDay / 4) * 4;
            const category = JSON.stringify({
                exposureSourceDomain: getTrackedPathSource(linkExposureEvent.pageUrl),
                exposureDestinationDomain: getTrackedPathDest(linkExposureEvent.url),
                dayOfWeek: (date).getUTCDay(),
                timeOfDay: timeOfDay
            });
            if (!(stats.trackedExposuresByCategory[category])) {
                stats.trackedExposuresByCategory[category] = {
                    categoryExposuresCount: 1
                };
            } else {
                const current = stats.trackedExposuresByCategory[category];
                stats.trackedExposuresByCategory[category] = {
                    categoryExposuresCount: current.numExposures + 1
                }
            }
        } else if (linkExposureEvent.type == "untracked") {
            stats.untrackedExposuresCount += linkExposureEvent.count;
        }
    }
    return formatLinkExposure(stats);
}

function formatLinkExposure(unformattedLinkExposureStats) {
    const formattedLinkExposureStats = {};
    formattedLinkExposureStats.trackedExposuresByCategory = [];
    for (const index in unformattedLinkExposureStats.trackedExposuresByCategory) {
        const aggregateData = unformattedLinkExposureStats.trackedExposuresByCategory[index];
        let category = JSON.parse(index);
        category = {...category, ...aggregateData};
        formattedLinkExposureStats.trackedExposuresByCategory.push(category);
    }
    formattedLinkExposureStats.untrackedExposuresCount = unformattedLinkExposureStats.untrackedExposuresCount;
    return formattedLinkExposureStats;
}


async function aggregateLinkSharing(linkShareEvents) {
    const fbIndex = JSON.stringify({platform: "facebook"});
    const twIndex = JSON.stringify({platform: "twitter"});
    const rdIndex = JSON.stringify({platform: "reddit"});

    const stats = {};
    stats.linkSharesByPlatform = {}
    stats.linkSharesByPlatform[fbIndex] = {trackedSharesByCategory: {}, untrackedSharesCount: 0};
    stats.linkSharesByPlatform[twIndex] = {trackedSharesByCategory: {}, untrackedSharesCount: 0};
    stats.linkSharesByPlatform[rdIndex] = {trackedSharesByCategory: {}, untrackedSharesCount: 0};

    for (const linkShareEvent of linkShareEvents) {
        if (linkShareEvent.type == "untracked") {
            stats.linkSharesByPlatform[JSON.stringify({platform: linkShareEvent.platform})]
                .untrackedSharesCount += linkShareEvent.untrackedCount;
        } else if (linkShareEvent.type == "tracked") {
            let platformIndex = "";
            if (linkShareEvent.platform == "facebook") platformIndex = fbIndex;
            if (linkShareEvent.platform == "twitter") platformIndex = twIndex;
            if (linkShareEvent.platform == "reddit") platformIndex = rdIndex;
            const platformObj = stats.linkSharesByPlatform[platformIndex];

            const pageVisits = await storagePN.search({url: linkShareEvent.url});
            let bestDistance = Infinity;
            let foundPageVisit = null;
            for (const pageVisit of pageVisits) {
                const distance = Math.abs(pageVisit.pageVisitStartTime - linkShareEvent.shareTime);
                if (distance < bestDistance) {
                    foundPageVisit = pageVisit;
                    bestDistance = distance;
                }
            }

            let visitSourceFromTransitions = "";
            const classifierResults = {};

            if (foundPageVisit) {
                const transitionsEvent = await storageTransitions.get({pageId: foundPageVisit.pageId});
                visitSourceFromTransitions = transitionsEvent ?
                    getTrackedPathSource(transitionsEvent.sourceUrl) :
                    "";
                const classificationEvents = await storageClassifications.search(
                    {pageId: foundPageVisit.pageId});
                for (const classificationEvent of classificationEvents) {
                    classifierResults[classificationEvent.className] =
                        classificationEvent.classification;
                }
            }

            const sharedDomain = getTrackedPathDest(linkShareEvent.url);
            const visitSourceFromReferrer = getTrackedPathSource(linkShareEvent.prevVisitReferrer);
            const date = new Date(linkShareEvent.shareTime);
            const dayOfWeek = date.getUTCDay();
            const hourOfDay = date.getUTCHours();
            const timeOfDay = Math.floor(hourOfDay / 4) * 4;

            const index = JSON.stringify({
                sharedDomain,
                visitSourceFromReferrer,
                visitSourceFromTransitions,
                classifierResults,
                shareAudience: linkShareEvent.audience,
                facebookReshareSource: linkShareEvent.source,
                dayOfWeek: dayOfWeek,
                timeOfDay: timeOfDay
            });
            let specificObj = platformObj.trackedSharesByCategory[index];
            if (specificObj) {
                specificObj.categorySharesCount += 1;
            } else {
                specificObj = {};
                specificObj.categorySharesCount = 1;
                platformObj.trackedSharesByCategory[index] = specificObj;
            }
        }
    }
    return formatLinkShare(stats);
}



function formatLinkShare(unformattedLinkShareStats) {
    const formattedLinkShareStats = {};
    formattedLinkShareStats.linkSharesByPlatform = [];

    for (const platformIndex in unformattedLinkShareStats.linkSharesByPlatform) {
        const rawPlatformData = unformattedLinkShareStats.linkSharesByPlatform[platformIndex];
        const formattedPlatformData = []
        for (const index in rawPlatformData.trackedSharesByCategory) {
            const aggregateData = rawPlatformData.trackedSharesByCategory[index];
            let category = JSON.parse(index);
            category = {...category, ...aggregateData};
            formattedPlatformData.push(category);
        }
        let platform = JSON.parse(platformIndex);
        platform = {...platform,
            trackedSharesByCategory: formattedPlatformData,
            untrackedSharesCount: rawPlatformData.untrackedSharesCount
        };
        formattedLinkShareStats.linkSharesByPlatform.push(platform);
    }

    return formattedLinkShareStats;
}

/**
 * Gets domain name from a url
 *
 * @param {string} url url string
 * @returns {string|null} hostname in the input url
 */
function getDomain(url) {
    let urlObj;
    try {
        urlObj = new URL(url);
    } catch { return ""; }
    return urlObj.hostname;
}

/**
 * Given a full URL, reduce it to the part that should be reported.
 * For most pages, this is just the domain, with no other URL parts.
 * For tracked social media pages, it also includes part of the path,
 * in order to indicate which orgnaization's social media page it is.
 * For example, https://twitter.com/nytimes/status/tweetID
 * would become twitter.com/nytimes, but a tweet from a non-tracked
 * account would just be reported as twitter.com.
 * @param {string} url - The full URL of the page.
 * @return {string} - The input URL stripped to the reportable portion.
 */
function getTrackedPathDest(url) {
    // if this is a dest, it must have passed a destination check already
    const fbResult = fbRegex.exec(url);
    if (fbResult && fbMatcher.matches(url)) { return fbResult[0]; }
    const twResult = twRegex.exec(url);
    if (twResult && twMatcher.matches(url)) { return twResult[0]; }
    const ytResult = ytRegex.exec(url);
    if (ytResult && ytMatcher.matches(url)) { return ytResult[0]; }
    return getDomain(url);
}

/**
 * Given a full URL of a page that was a referrer for a page visit or a source
 * for a link exposure, reduce it to the part that should be reported.
 * See `getTrackedPathDest` for more details. This function is separate because:
 * 1. A few sites are only reported when they are sources (e.g. google.com)
 * 2. We store sources without checking whether they are part of the tracked
 *   set of domains, so this function turns untracked sources into the string
 *   `"other"`.
 * @param {string} url - The full URL of the page.
 * @return {string} - The input URL stripped to the reportable portion.
 */
function getTrackedPathSource(url) {
    // a referrer hasn't necessarily passed a check
    const fbResult = fbRegex.exec(url);
    if (fbResult && fbMatcher.matches(url)) { return fbResult[0]; }
    const twResult = twRegex.exec(url);
    if (twResult && twMatcher.matches(url)) { return twResult[0]; }
    const ytResult = ytRegex.exec(url);
    if (ytResult && ytMatcher.matches(url)) { return ytResult[0]; }
    if (sourceMatcher.matches(url)) { return getDomain(url); }
    if (destinationMatcher.matches(url)) { return getDomain(url); }
    return "other";
}
