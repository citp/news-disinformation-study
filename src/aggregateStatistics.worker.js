/**
 * @file Script for computing aggregate statistics.
 * Receives messages from background page with a time range, then gets events in that range,
 * aggregates them by event type and sends the aggregated data back.
 */

import * as webScience from "@mozilla/web-science"
import { storageTransitions, storageClassifications, storagePN,
    storageSMLS, storageLE, storageMethodology } from "./databases.js"
import { destinationDomainMatchPatterns } from "./data/destinationDomainMatchPatterns.js"
import { sourceOnlyMatchPatterns } from "./data/sourceOnlyMatchPatterns.js"
import { facebookPageMatchPatterns } from "./data/facebookPageMatchPatterns.js"
import { twitterPageMatchPatterns } from "./data/twitterPageMatchPatterns.js"
import { youtubePageMatchPatterns } from "./data/youtubePageMatchPatterns.js"

// We don't usually report anything other than the hostname of a URL, but do report parts of the
//  path for specified social media profiles. These regexes match URLs for those sites and separate
//  the profile name (Facebook page, Twitter handle, Youtube channel) so that we can report the
//  right amount of the URL.
//const fbRegex = /(facebook.com\/pages\/[0-9|a-z|A-Z|-]*\/[0-9]*(\/|$))|(facebook\.com\/[0-9|a-z|A-Z|.]*(\/|$))/i;
const fbRegex = /(?:(facebook.com\/pages\/[0-9|a-z|A-Z|-]*\/)[0-9]*(?:\/|$))|(facebook\.com\/[0-9|a-z|A-Z|.]*(?:\/|$))/i;
const ytRegex = /(youtube.com\/(?:user|channel)\/[0-9|a-z|A-Z|_|-]*(?:\/videos)?(?:\/|$))|(youtube\.com\/[0-9|A-Z|a-z]*(?:\/|$))|(youtube\.com\/profile\?user=[0-9|A-Z|a-z]*(?:\/|$))/i;
const twRegex = /(twitter\.com\/[0-9|a-z|A-Z|_]*(?:\/|$))/;

// `MatchPatternSet`s for checking which URLs to report, and how much (hostname, or part of path)
//  to report.
let destinationMatcher;
let sourceMatcher;
let fbMatcher;
let twMatcher;
let ytMatcher;

const allDestinationMatchPatterns = [
    ...destinationDomainMatchPatterns,
    ...facebookPageMatchPatterns,
    ...twitterPageMatchPatterns,
    ...youtubePageMatchPatterns];

const allSourceMatchPatterns = [
    ...allDestinationMatchPatterns,
    ...sourceOnlyMatchPatterns];

/**
 * Event handler for messages from the main thread
 * On receiving data, the function computes aggregate statistics and
 * sends a message back to the caller with the result object.
 *
 * @param {MessageEvent} event - message object
 */
function messageListener(event) {
    const type = event.data.type;
    const data = event.data;
    if (type == "init") {
        initialize();
        return;
    } else if (type == "aggregate") {
        runAggregation(data);
    }
}
onmessage = messageListener;

/**
 * Create `MatchPatternSet`s from the study match patterns.
 */
function initialize() {
    destinationMatcher = webScience.matching.createMatchPatternSet(allDestinationMatchPatterns);
    sourceMatcher = webScience.matching.createMatchPatternSet(allSourceMatchPatterns);
    fbMatcher = webScience.matching.createMatchPatternSet(facebookPageMatchPatterns);
    ytMatcher = webScience.matching.createMatchPatternSet(youtubePageMatchPatterns);
    twMatcher = webScience.matching.createMatchPatternSet(twitterPageMatchPatterns);
}

/**
 * Aggregate events for each measurement, then send data back to background page.
 * @param {Object} aggregationData - Object containing data specific to a single aggregation run.
 * @param {integer} aggregationData.startTime - Timestamp strictly before which events should not be included.
 * @param {integer} aggregationData.endTime - Timestamp strictly before which events should be included.
 */
async function runAggregation(aggregationData) {
    const stats = {};
    const startTime = aggregationData.startTime;
    const endTime = aggregationData.endTime;

    // Get events from each storage area within the specified time range.
    const pageNavEvents = await storagePN.getEventsByRange(startTime, endTime);
    const linkShareEvents = await storageSMLS.getEventsByRange(startTime, endTime);
    const linkExposureEvents = await storageLE.getEventsByRange(startTime, endTime);
    const methodologyEvents = await storageMethodology.getEventsByRange(startTime, endTime, "pageNavigationRecords");

    // Run each measurement's aggregation function on its events and store the results.
    stats["newsAndDisinfo.pageNavigation"] = await aggregatePageNav(pageNavEvents);
    stats["newsAndDisinfo.socialMediaLinkSharing"] = await aggregateLinkSharing(linkShareEvents);
    stats["newsAndDisinfo.linkExposure"] = await aggregateLinkExposure(linkExposureEvents);
    stats["newsAndDisinfo.methodology"] = await aggregateMethodology(methodologyEvents);

    // Send the aggregated data back to the caller.
    postMessage({
        type: "stats",
        ...stats
    });
}

/**
 * Error handler
 * @param {ErrorEvent} event - error object
 */
onerror = event => {
    console.error("Error in aggregation script:", event.message);
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
        untrackedVisitsCount: 0,
        untrackedAttention: 0.0
    };
    for (const pageNavEvent of pageNavEvents) {
        if (pageNavEvent.type == "pageVisit") {
            const transitionsEvent = await storageTransitions.get({pageId: pageNavEvent.pageId});
            const sourceTrimmedUrlFromTransitions = transitionsEvent ?
                trimUrlToReportedPortion(transitionsEvent.sourceUrl, true) :
                "";
            const classifierResults = {};
            // Classification results from each classifier are stored separately, so use
            //  `search` (returns all results) instead of `get` (returns one result).
            const classificationEvents = await storageClassifications.search(
                {pageId: pageNavEvent.pageId});
            for (const classificationEvent of classificationEvents) {
                classifierResults[classificationEvent.className] = classificationEvent.classification;
            }
            const visitTrimmedUrl = trimUrlToReportedPortion(pageNavEvent.url);

            const date = new Date(pageNavEvent.pageVisitStopTime);
            // Use UTC to avoid issues when participants change timezones.
            const dayOfWeek = date.getUTCDay();
            const hourOfDay = date.getUTCHours();
            const timeOfDay = Math.floor(hourOfDay / 4) * 4;

            // This index contains all the fields that identify a category of page visit event.
            // We use this to identify the object that this event belongs to (if it exists --
            //  creating it if not). When all the events have been processed, the index will
            //  be turned back into an object.
            const index = JSON.stringify({
                visitTrimmedUrl,
                sourceTrimmedUrlFromReferrer: trimUrlToReportedPortion(pageNavEvent.referrer, true),
                sourceTrimmedUrlFromTransitions,
                dayOfWeek,
                timeOfDay,
                classifierResults
            });

            let categoryObj = stats.trackedVisitsByCategory[index];
            // Once we've found the category object to which this event belongs, update
            //  it with the information from this event -- increment the count of visits,
            //  and add the attention and scroll values. If this is the first event in the
            //  category, create the object and initialize it with this event's data.
            if (categoryObj) {
                categoryObj.categoryVisitsCount += 1;
                categoryObj.categoryAttention += pageNavEvent.attentionDuration;
                categoryObj.categoryScroll += pageNavEvent.maxRelativeScrollDepth;
            } else {
                categoryObj = {};
                categoryObj.categoryVisitsCount = 1;
                categoryObj.categoryAttention = pageNavEvent.attentionDuration;
                categoryObj.categoryScroll = pageNavEvent.maxRelativeScrollDepth;
                stats.trackedVisitsByCategory[index] = categoryObj;
            }
        } else if (pageNavEvent.type == "untracked") {
            stats.untrackedVisitsCount += 1;
            stats.untrackedAttention += pageNavEvent.attentionDuration;
        }
    }

    // Turn the stringified indexes back into objects and combine with the data for the category.
    // This sets up the aggregated data to match the schema.
    const formattedPageNavStats = {};
    formattedPageNavStats.trackedVisitsByCategory = [];
    for (const index in stats.trackedVisitsByCategory) {
        const aggregateData = stats.trackedVisitsByCategory[index];
        let category = JSON.parse(index);
        category = {...category, ...aggregateData};
        formattedPageNavStats.trackedVisitsByCategory.push(category);
    }
    formattedPageNavStats.untrackedVisitsCount = stats.untrackedVisitsCount;
    formattedPageNavStats.untrackedAttention = stats.untrackedAttention;
    return formattedPageNavStats;
}


/**
 * Function for computing link exposure statistics
 * @param {Object} linkExposureStorage - Link exposure storage object
 */
function aggregateLinkExposure(linkExposureEvents) {
    const stats = {};
    stats.trackedExposuresByCategory = {};

    for (const linkExposureEvent of linkExposureEvents) {
        if (linkExposureEvent.type == "exposure") {
            const date = new Date(linkExposureEvent.firstSeen);
            // Use UTC to avoid issues when participants change timezones.
            const hourOfDay = date.getUTCHours();
            const timeOfDay = Math.floor(hourOfDay / 4) * 4;
            // This index contains all the fields that identify a category of link exposure event.
            // We use this to identify the object that this event belongs to (if it exists --
            //  creating it if not). When all the events have been processed, the index will
            //  be turned back into an object.
            const index = JSON.stringify({
                exposureSourceTrimmedUrl: trimUrlToReportedPortion(linkExposureEvent.pageUrl, true),
                exposureDestinationTrimmedUrl: trimUrlToReportedPortion(linkExposureEvent.url),
                dayOfWeek: (date).getUTCDay(),
                timeOfDay: timeOfDay
            });
            // Once we've found the category object to which this event belongs, update
            //  it with the information from this event by incrementing the count of exposures.
            // If this is the first event in the category, create the object and initialize
            //  it with this event's data.
            if (!(stats.trackedExposuresByCategory[index])) {
                stats.trackedExposuresByCategory[index] = {
                    categoryExposuresCount: 1
                };
            } else {
                const current = stats.trackedExposuresByCategory[index];
                stats.trackedExposuresByCategory[index] = {
                    categoryExposuresCount: current.categoryExposuresCount + 1
                }
            }
        }
    }

    // Turn the stringified indexes back into objects and combine with the data for the category.
    // This sets up the aggregated data to match the schema.
    const formattedLinkExposureStats = {};
    formattedLinkExposureStats.trackedExposuresByCategory = [];
    for (const index in stats.trackedExposuresByCategory) {
        const aggregateData = stats.trackedExposuresByCategory[index];
        let category = JSON.parse(index);
        category = {...category, ...aggregateData};
        formattedLinkExposureStats.trackedExposuresByCategory.push(category);
    }
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
                if (pageVisit.pageVisitStartTime < linkShareEvent.shareTime &&
                    distance < bestDistance) {
                    foundPageVisit = pageVisit;
                    bestDistance = distance;
                }
            }

            const visitPresentInPageNavigation = foundPageVisit != null;
            let visitAttentionDuration = 0;

            if (visitPresentInPageNavigation) {
                visitAttentionDuration = foundPageVisit.attentionDuration
            }

            let visitSourceFromTransitions = "";
            const classifierResults = {};

            if (foundPageVisit) {
                const transitionsEvent = await storageTransitions.get({pageId: foundPageVisit.pageId});
                visitSourceFromTransitions = transitionsEvent ?
                    trimUrlToReportedPortion(transitionsEvent.sourceUrl, true) :
                    "";
                // Classification results from each classifier are stored separately, so use
                //  `search` (returns all results) instead of `get` (returns one result).
                const classificationEvents = await storageClassifications.search(
                    {pageId: foundPageVisit.pageId});
                for (const classificationEvent of classificationEvents) {
                    classifierResults[classificationEvent.className] =
                        classificationEvent.classification;
                }
            }

            const sharedTrimmedUrl = trimUrlToReportedPortion(linkShareEvent.url);
            const date = new Date(linkShareEvent.shareTime);
            // Use UTC to avoid issues when participants change timezones.
            const dayOfWeek = date.getUTCDay();
            const hourOfDay = date.getUTCHours();
            const timeOfDay = Math.floor(hourOfDay / 4) * 4;

            // This index contains all the fields that identify a category of link share event.
            // We use this to identify the object that this event belongs to (if it exists --
            //  creating it if not). When all the events have been processed, the index will
            //  be turned back into an object.
            const index = JSON.stringify({
                sharedTrimmedUrl,
                visitSourceFromTransitions,
                classifierResults,
                shareAudience: linkShareEvent.audience,
                facebookReshareSource: linkShareEvent.source,
                dayOfWeek: dayOfWeek,
                timeOfDay: timeOfDay
            });
            // Once we've found the category object to which this event belongs, update
            //  it with the information from this event by incrementing the count of shares.
            // If this is the first event in the category, create the object and initialize
            //  it with this event's data.
            let categoryObj = platformObj.trackedSharesByCategory[index];
            if (categoryObj) {
                categoryObj.categorySharesCount += 1;
                categoryObj.categoryVisitsInPageNavigationCount += visitPresentInPageNavigation ? 1 : 0;
                categoryObj.categoryVisitAttention += visitAttentionDuration;
                categoryObj.categoryVisitsInHistoryCount += linkShareEvent.visitPresentInHistory ? 1 : 0;
            } else {
                categoryObj = {};

                categoryObj.categorySharesCount = 1;
                categoryObj.categoryVisitsInPageNavigationCount = visitPresentInPageNavigation ? 1 : 0;
                categoryObj.categoryVisitAttention = visitAttentionDuration;
                categoryObj.categoryVisitsInHistoryCount = linkShareEvent.visitPresentInHistory ? 1 : 0;

                platformObj.trackedSharesByCategory[index] = categoryObj;
            }
        }
    }

    // Turn the stringified indexes back into objects and combine with the data for the category.
    // This sets up the aggregated data to match the schema.
    const formattedLinkShareStats = {};
    formattedLinkShareStats.linkSharesByPlatform = [];

    for (const platformIndex in stats.linkSharesByPlatform) {
        const rawPlatformData = stats.linkSharesByPlatform[platformIndex];
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
 * Function for computing methodology statistics
 * @param {Object} methodologyEvents - Methodology storage object
 */
async function aggregateMethodology(methodologyEvents) {
    // create object to hold processed records
    const stats = { methodologyVisits: [] };

    // We'll process each raw event from the methodologyEvents database by combining
    // it with data from the other databases and then add it to the stats object.
    for (const pageVisitRecord of methodologyEvents) {
        const methodologyRecord = createEmptyMethodologyRecord();

        methodologyRecord.visitTrimmedUrl = trimUrlToReportedPortion(pageVisitRecord.url);

        // ATTENTION MEASURES
        // Here, we collect four measures of attention:
        //   - attentionWebScience and attentionDwellTime are in the visit record itself
        //   - attentionDwellTimePlus is in the simpleAttention database
        //   - attentionTimeToNextLoad is in the transitions database

        methodologyRecord.attentionDwellTime = pageVisitRecord.attentionDwellTime;
        methodologyRecord.attentionWebScience = pageVisitRecord.attentionWebScience;

        // simple attention is a study-specific module, so its records are in a separate
        // database, indexed by the pageId.
        const simpleAttentionRecord = await storageMethodology.get(
            {pageId: pageVisitRecord.pageId},
            "simpleAttentionRecords");
        if (simpleAttentionRecord) {
            methodologyRecord.attentionDwellTimePlus = simpleAttentionRecord.attentionDwellTimePlus;
        }

        // the "time child" is the chronologically next page to load after the current page.
        const timeChildsTransitionRecord = await storageMethodology.get(
            {pageId: pageVisitRecord.pageId},
            "nextTransitionsRecords");
        if (timeChildsTransitionRecord) {
            const timeChildsPageRecord = await storageMethodology.get(
                {pageId: timeChildsTransitionRecord.timeSourceChildPageId},
                "pageNavigationRecords");
            if (timeChildsPageRecord) {
                methodologyRecord.attentionTimeToNextLoad = timeChildsPageRecord.pageVisitStartTime -
                    pageVisitRecord.pageVisitStartTime;
            }
        }

        // PARENT MEASURES
        // We collect four measures of parent pages:
        //   - parentLoadTime, parentWebScience, and parentReferrer are in the transitions database
        //   - parentHistory is in the history database
        // We also grab the prevTTNL here, see below.

        // The URLs that we report will be trimmed versions of the originals, with either the
        // path or the entire URL removed. However, before that happens, we want to compare
        // the raw values to each other.
        let parentLoadTimeRaw = "";
        let parentWebScienceRaw = "";
        let parentReferrerRaw = "";
        let parentHistoryRaw = "";

        const transitionRecord = await storageMethodology.get(
            {pageId: pageVisitRecord.pageId},
            "transitionsRecords");
        if (transitionRecord) {
            methodologyRecord.isHistoryChange = transitionRecord.isHistoryChange;

            parentWebScienceRaw = transitionRecord.parentWebScience;
            parentLoadTimeRaw = transitionRecord.parentLoadTime;
            parentReferrerRaw = transitionRecord.parentReferrer;
            // Using the pageId of the parentLoadTime, we can look up the
            // `prevTTNL` -- the amount of time between when
            // parentLoadTime loaded and when this page loaded. We need this to be able to mimic
            // choosing a threshold for dividing browsing into sessions. Previous work in this space
            // usually chooses an amount of time (say, five minutes) and says that when users load
            // pages less than five minutes apart, those page loads are part of the same logical
            // session -- they are connected in the user's mind. Page loads separated by more
            // than five minutes are considered to be part of different sessions. `parentLoadTime` is
            // only relevant when the pages are part of the same sesssion. Since we don't have a
            // threshold defined a priori, we instead report the raw time between loads, so that we
            // can consider possible thresholds during analysis.
            if (transitionRecord.timeSourceParentPageId) {
                const timeParentsPageRecord = await storageMethodology.get(
                    {pageId: transitionRecord.timeSourceParentPageId},
                    "pageNavigationRecords");
                if (timeParentsPageRecord) {
                    methodologyRecord.prevTTNL = pageVisitRecord.pageVisitStartTime -
                        timeParentsPageRecord.pageVisitStartTime;
                }
            }
        }

        const historyParentRecord = await storageMethodology.get(
            {historyNumericId: pageVisitRecord.historyReferringVisitNumericId},
            "pageNavigationRecords");
        if (historyParentRecord) {
            parentHistoryRaw = historyParentRecord.url;
        }

        // Report whether the parentReferrer has a path at all, since it often gets stripped.
        if (parentReferrerRaw) {
            methodologyRecord.parentReferrerPathPresent =
                (new URL(parentReferrerRaw)).pathname !== "/";
        }

        // For ground truth, report whether the parentWebScience has a path.
        if (parentWebScienceRaw) {
            methodologyRecord.parentWebSciencePathPresent =
                (new URL(parentWebScienceRaw)).pathname !== "/";
        }

        // Trim the parent page URLs to just the domain. Note that we include a few more
        // match patterns when reporting a source URL (e.g., Google is included as a source,
        // but not as a destination).
        methodologyRecord.parentWebScience = trimUrlToReportedPortion(parentWebScienceRaw, true);
        methodologyRecord.parentReferrer = trimUrlToReportedPortion(parentReferrerRaw, true);
        methodologyRecord.parentLoadTime = trimUrlToReportedPortion(parentLoadTimeRaw, true);
        methodologyRecord.parentHistory = trimUrlToReportedPortion(parentHistoryRaw, true);

        // Since we're removing the paths for the parent page URLs, do a pairwise comparison
        // between them all.
        methodologyRecord.parentWebScienceToReferrer = parentWebScienceRaw === parentReferrerRaw;
        methodologyRecord.parentWebScienceToLoadTime = parentWebScienceRaw === parentLoadTimeRaw;
        methodologyRecord.parentWebScienceToHistory = parentWebScienceRaw === parentHistoryRaw;
        methodologyRecord.parentReferrerToLoadTime = parentReferrerRaw === parentLoadTimeRaw;
        methodologyRecord.parentReferrerToHistory = parentReferrerRaw === parentHistoryRaw;
        methodologyRecord.parentLoadTimeToHistory = parentLoadTimeRaw === parentHistoryRaw;

        // Report the time of day, day of month, month of year, and year that the page visit
        // started. Note that time of day is bucketed into four-hour time periods.
        // Also note that the day of the month is 1-indexed (i.e., the same way we talk about
        // dates normally), while the month is 0-indexed.
        const date = new Date(pageVisitRecord.pageVisitStartTime);
        // Use UTC to avoid issues when participants change timezones.
        const hourOfDay = date.getUTCHours();
        methodologyRecord.timeOfDayStart = Math.floor(hourOfDay / 4) * 4;
        methodologyRecord.dayOfMonthStart = date.getUTCDate(); // 1-31
        methodologyRecord.monthOfYearStart = date.getUTCMonth(); // 0-11
        methodologyRecord.yearStart = date.getUTCFullYear();

        // Add the completed record to the stats object.
        stats.methodologyVisits.push(methodologyRecord);
    }
    return stats;
}

/**
 * Creates an object for a visit tracked by methodology, with all the fields present
 * and initialized. Ensures that fields are present even when we can't find the value
 * during aggregation.
 * @return {Object}
 */
function createEmptyMethodologyRecord() {
    return {
        visitTrimmedUrl: "",

        attentionDwellTime: -1,
        attentionDwellTimePlus: -1,
        attentionTimeToNextLoad: -1,
        attentionWebScience: -1,

        parentHistory: "",
        parentLoadTime: "",
        parentWebScience: "",
        parentReferrer: "",

        isHistoryChange: false,

        parentReferrerPathPresent: false,
        parentWebSciencePathPresent: false,

        parentLoadTimeToHistory: false,
        parentReferrerToHistory: false,
        parentReferrerToLoadTime: false,
        parentWebScienceToHistory: false,
        parentWebScienceToLoadTime: false,
        parentWebScienceToReferrer: false,

        prevTTNL: -1,

        timeOfDayStart: -1,
        yearStart: -1,
        dayOfMonthStart: -1,
        monthOfYearStart: -1
    };
}

/**
 * Gets hostname from a url
 *
 * @param {string} url url string
 * @returns {string|null} hostname in the input url
 */
function getHostname(url) {
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
function trimUrlToReportedPortion(url, includeSources=false) {
    if (url == "") { return ""; }

    // Check whether the URL is for a social media site where we might be tracking
    //  the individual page.
    const fbRegexResult = fbRegex.exec(url);
    if (fbRegexResult) { return trimUrlFacebook(url, fbRegexResult, includeSources); }
    const twRegexResult = twRegex.exec(url);
    if (twRegexResult) { return trimUrlTwitter(url, twRegexResult, includeSources); }
    const ytRegexResult = ytRegex.exec(url);
    if (ytRegexResult) { return trimUrlYoutube(url, ytRegexResult, includeSources); }

    // If not, just trim to the hostname.
    return trimDefault(url, includeSources);
}

/**
 * Given a URL, trims it to the reportable portion, ignoring the possibility of
 * social media profile URLs.
 * @param {string} url  - The URL to trim.
 * @param {boolean} includeSources - Whether to consider source-only patterns.
 * @return {string} - The trimmed URL, or `"other"`.
 */
function trimDefault(url, includeSources) {
    if (includeSources && sourceMatcher.matches(url)) { return getHostname(url); }
    if (destinationMatcher.matches(url)) { return getHostname(url); }
    return "other";
}

/**
 * Given a URL that goes to Facebook, trim it to the reportable portion.
 * @param {string} url - The URL to trim.
 * @param {Object} fbRegexResult - Result of running the Facebook regex on this URL.
 * @param {boolean} includeSources - Whether to consider source-only patterns.
 * @return {string} - The trimmed URL, or `"other"`.
 */
function trimUrlFacebook(url, fbRegexResult, includeSources) {
    // Use the Facebook regex to extract just the page and check whether it's a tracked page.
    let fbPage = ""
    if (fbRegexResult[1]) { fbPage = fbRegexResult[1]; }
    if (fbRegexResult[2]) { fbPage = fbRegexResult[2]; }
    if (fbPage != "" && fbMatcher.matches("https://" + fbPage)) { return fbPage; }
    return trimDefault(url, includeSources);
}

/**
 * Given a URL that goes to Twitter, trim it to the reportable portion.
 * @param {string} url - The URL to trim.
 * @param {Object} twRegexResult - Result of running the Twitter regex on this URL.
 * @param {boolean} includeSources - Whether to consider source-only patterns.
 * @return {string} - The trimmed URL, or `"other"`.
 */
function trimUrlTwitter(url, twRegexResult, includeSources) {
    // Use the Twitter regex to extract just the handle and check whether it's a tracked handle.
    let twHandle = ""
    if (twRegexResult[1]) { twHandle = twRegexResult[1]; }
    if (twHandle != "" && twMatcher.matches("https://" + twHandle)) { return twHandle; }
    return trimDefault(url, includeSources);
}

/**
 * Given a URL that goes to Youtube, trim it to the reportable portion.
 * @param {string} url - The URL to trim.
 * @param {Object} ytRegexResult - Result of running the Youtube regex on this URL.
 * @param {boolean} includeSources - Whether to consider source-only patterns.
 * @return {string} - The trimmed URL, or `"other"`.
 */
function trimUrlYoutube(url, ytRegexResult, includeSources) {
    // Use the Youtube regex to extract just the channel and check whether it's a tracked channel.
    let ytChannel = ""
    if (ytRegexResult[1]) { ytChannel = ytRegexResult[1]; }
    if (ytRegexResult[2]) { ytChannel = ytRegexResult[2]; }
    if (ytRegexResult[3]) { ytChannel = ytRegexResult[3]; }
    if (ytChannel != "" && ytMatcher.matches("https://" + ytChannel)) { return ytChannel; }
    return trimDefault(url, includeSources);
}

