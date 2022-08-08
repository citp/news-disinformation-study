import {
    timing,
    linkExposure,
    pageNavigation,
    socialMediaLinkSharing,
    pageTransition,
    matching,
    debugging,
    userSurvey
} from "@mozilla/web-science"
import * as pageClassification from "./pageClassification.js"
import * as dataAnalysis from "./dataAnalysis.js"

import { destinationDomainMatchPatterns } from "./data/destinationDomainMatchPatterns.js"
import { facebookPageMatchPatterns } from "./data/facebookPageMatchPatterns.js"
import { twitterPageMatchPatterns } from "./data/twitterPageMatchPatterns.js"
import { youtubePageMatchPatterns } from "./data/youtubePageMatchPatterns.js"

import polClassifierData from "./weights/pol-linearsvc_data.js"
import covidClassifierData from "./weights/covid-linearsvc_data.js"

import {
    storageTransitions,
    storageClassifications,
    storagePN,
    storageSMLS,
    storageLE,
} from "./databases.js"

import { initializeMethodology } from "./methodology.js"

const debugLog = debugging.getDebuggingLog("newsAndDisinfo.eventHandling");

// We track visits, exposures, and shares for specific sites. The majority
//  are identified by the domain (destinationDomainMatchPatterns), and the rest are
//  profiles owned by news organizations on social media platforms (facebookPageMatchPatterns,
//  twitterPageMatchPatterns, and youtubePageMatchPatterns).
const allDestinationMatchPatterns = [
    ...destinationDomainMatchPatterns,
    ...facebookPageMatchPatterns,
    ...twitterPageMatchPatterns,
    ...youtubePageMatchPatterns];


let destinationMatcher;
let rally;

const secondsPerMinute = 60;
const minutesPerHour = 60;
const hoursPerDay = 24;

/**
 * Starts the study by adding listeners and initializing measurement modules.
 * This study runs the pageNavigation, linkExposure, and socialMediaLinkSharing modules.
 * @param {Object} rally - Rally study object, used for sending data pings.
 */
export async function startStudy(rallyArg) {
    rally = rallyArg;
    destinationMatcher = matching.createMatchPatternSet(allDestinationMatchPatterns);

    // Start the methodology module. Note that it collects runtime data on all urls,
    // but that URLs not matching predetermined study domains are removed before
    // reporting data.
    initializeMethodology([ "<all_urls>" ]);

    // Register classifiers to evaluate content from pages from relevant domains
    pageClassification.registerWorker("/dist/polClassifier.worker.js",
        allDestinationMatchPatterns,
        "pol-page-classifier",
        polClassifierData,
        saveClassificationResultPol
    );
    pageClassification.registerWorker("/dist/covidClassifier.worker.js",
        allDestinationMatchPatterns,
        "covid-page-classifier",
        covidClassifierData,
        saveClassificationResultCovid
    );

    // Register listener for link exposure events. We listen for all exposures,
    //  but only report specific information about links to sites on our lists. This
    //  reduction happens in the aggregation step.
    linkExposure.onLinkExposureData.addListener(linkExposureListener, {
        linkMatchPatterns: [ "<all_urls>" ],
        pageMatchPatterns: [ "<all_urls>" ],
        privateWindows : false,
    });

    // Register listener for shares of links to tracked domains on Facebook, Twitter, and Reddit.
    socialMediaLinkSharing.onShare.addListener(linkShareListener, {
        destinationMatchPatterns: allDestinationMatchPatterns,
        facebook: true,
        twitter: true,
        reddit: true
    });

    // Register listener for page visits. The listener separates tracked visits from untracked.
    // Receiving data about untracked visits allows us to reporthihgly-aggregated baseline
    // browsing data for comparisons with tracked visits.
    pageNavigation.onPageData.addListener(pageNavigationListener, {
        matchPatterns: [ "<all_urls>" ]
    });

    // Register listener for shares of links to tracked domains on Facebook, Twitter, and Reddit.
    socialMediaLinkSharing.onShare.addListener(linkShareListener, {
        destinationMatchPatterns: allDestinationMatchPatterns,
        facebook: true,
        twitter: true,
        reddit: true
    });

    // We'll add page transitions data to page visit events.
    pageTransition.onPageTransitionData.addListener(pageTransitionListener, {
        matchPatterns: allDestinationMatchPatterns,
    });

    // Run periodic aggregation.
    dataAnalysis.registerAnalysisScript("/dist/aggregateStatistics.worker.js", processAnalysisResult, {});


    // Prompt the participant to respond to an initial demographic survey.
    // If they do not complete it, they will be reminded every three days until they complete it
    //  or ask to no longer be reminded.
    userSurvey.setSurvey({
        surveyName: "Initial Survey",
        popupNoPromptMessage: "You are currently participating in the Political and COVID-19 News Information Flows Study. If you would like to hide this icon, right click and select \"Remove from Toolbar\".",
        popupPromptMessage: "You are currently participating in the Political and COVID-19 News Information Flows Study. Please answer a few survey questions for the Political and COVID-19 News Information Flows Study. Clicking Continue will take you to Princeton’s survey.",
        // Interval specifed in seconds
        reminderInterval: secondsPerMinute * minutesPerHour * hoursPerDay * 3,
        reminderMessage: "A survey is available for your Rally study. Click the Princeton logo in the toolbar to continue.",
        reminderTitle: "Rally survey available",
        surveyCompletionUrl: "https://citpsurveys.cs.princeton.edu/thankyou",
        surveyUrl: "https://citpsurveys.cs.princeton.edu/rallyPolInfoSurvey"
    });
}

/**
 * Callback for responses from the aggregateStatistics.js script. Submits data to Rally pipeline.
 * @param {Object} result - message from analysis script.
 * @param {Object} result.data - aggregated data from analysis script
 */
async function processAnalysisResult(result) {
    const analysisResult = result.data;
    if (analysisResult.type === "stats") {
        delete analysisResult.type;
        // Report survey ID given to Qualtrics, so that survey responses can be linked to
        //  browsing data.
        analysisResult["newsAndDisinfo.surveyId"] = await userSurvey.getSurveyId();
        analysisResult["newsAndDisinfo.version"] = browser.runtime.getManifest().version;
        debugLog("Submitting results through Rally = " + JSON.stringify(analysisResult));
        if (__ENABLE_DEVELOPER_MODE__) console.log(analysisResult);
        rally.sendPing("rallymeasurements", analysisResult);
    } else {
        console.warn("Unexpected message from analysis script:", result);
    }
}

/**
 * Callback for page transition events. Stores the source of the transition.
 * @param {Object} details - Information about the page transition event.
 * @param {string} details.tabSourceUrl - The "referrer" for this transition, as measured by
 *   the last page in the same tab (or opener tab, if page is opening in a new tab).
 * @param {string} details.pageId - The unique ID for the visited page.
 */
function pageTransitionListener(details) {
    const sourceUrl = details.tabSourceUrl;
    const pageId = details.pageId;

    storageTransitions.set({pageId: pageId, sourceUrl: sourceUrl});
}

/**
 * Callback for social media link share events. Stores the event.
 * @param {Object} shareData - Information about the link share event.
 * @param {string} shareData.type - Indicates whether the event represents a tracked or
 *   untracked share.
 * @param {string} shareData.url - For a tracked share event, the URL of the shared page.j
 * @param {number} shareData.untrackedCount - For an untracked share event, the number of
 *   untracked URLs that were shared.
 */
async function linkShareListener(shareData) {
    if (shareData.type == "tracked") {
        shareData.url = matching.normalizeUrl(shareData.url);
        const historyVisits = await browser.history.search({
            text: shareData.url,
            startTime: 0, //search all history
            endTime: shareData.shareTime
        });
        shareData.visitPresentInHistory = historyVisits.length > 0;
    }
    if (shareData.type == "tracked" ||
        (shareData.type == "untracked" && shareData.untrackedCount > 0)) {
        storageSMLS.set(shareData, "linkShares");
    }
}

/**
 * Callback for link exposure events. Stores the event.
 * @param {Object} exposureData - Details about the exposure event.
 * @param {string} exposureData.url - URL of the loaded page where links were viewed.
 * @param {Object[]} exposureData.matchingLinkUrls - Array of exposed URLs.
 * @param {number} exposureData.nonmatchingLinkCount - Number of exposured URLs whose domains
 *   were not part of the tracked set.
 */
async function linkExposureListener(exposureData) {
    const firstSeen = timing.now();
    exposureData.url = matching.normalizeUrl(exposureData.url);
    for (const exposedUrl of exposureData.matchingLinkUrls) {
        const singleExposure = {
            type: "exposure",
            url: matching.normalizeUrl(exposedUrl),
            pageUrl: exposureData.url,
            firstSeen: firstSeen
        };
        storageLE.set(singleExposure, "linkExposures");
    }
}

/**
 * Callback for a tracked page visit. Stores the event.
 * @param {Object} pageData - Information about the page visit event.
 * @param {string} pageData.url - URL of the visited page.
 */
async function pageNavigationListener(pageData) {
    if (destinationMatcher.matches(pageData.url)) {
        pageData.url = matching.normalizeUrl(pageData.url);
        pageData.type = "pageVisit";
        await storagePN.set(pageData, "pageVisits");
    } else {
        storagePN.set({
            type: "untracked",
            pageVisitStopTime: pageData.pageVisitStopTime,
            pageVisitStartTime: pageData.pageVisitStartTime,
            attentionDuration: pageData.attentionDuration
        }, "pageVisits");
    }
}

/**
 * Callback for a classification result from the political news classifier.
 * Stores the event.
 * @param {Object} result - Information about the classification result.
 * @param {number} result.predicted_class - The output from the classifier.
 * @param {string} result.pageId - Unique ID for the classified page.
 * @param {string} result.url - URL of the classified page.
 */
function saveClassificationResultPol(result) {
    storageClassifications.set({
        className: "pol-page-classifier",
        classification: result.predicted_class,
        pageId: result.pageId,
        url: result.url
    });
}

/**
 * Callback for a classification result from the covid news classifier.
 * Stores the event.
 * @param {Object} result - Information about the classification result.
 * @param {number} result.predicted_class - The output from the classifier.
 * @param {string} result.pageId - Unique ID for the classified page.
 * @param {string} result.url - URL of the classified page.
 */
function saveClassificationResultCovid(result) {
    storageClassifications.set({
        className: "covid-page-classifier",
        classification: result.predicted_class,
        pageId: result.pageId,
        url: result.url});
}
