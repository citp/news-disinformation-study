import * as webScience from "./webScience.js"
import * as pageClassification from "./pageClassification.js"
import * as dataAnalysis from "./dataAnalysis.js"
import { destinationDomainMatchPatterns } from "./data/destinationDomainMatchPatterns.js"
import { sourceOnlyMatchPatterns } from "./data/sourceOnlyMatchPatterns.js"
import { facebookPageMatchPatterns } from "./data/facebookPageMatchPatterns.js"
import { twitterPageMatchPatterns } from "./data/twitterPageMatchPatterns.js"
import { youtubePageMatchPatterns } from "./data/youtubePageMatchPatterns.js"
import polClassifierData from "./weights/pol-linearsvc_data.js"
import covidClassifierData from "./weights/covid-linearsvc_data.js"
import { storageTransitions, storageClassifications, storagePN, storageSMLS, storageLE } from "./databases.js"

// Module mappings for brevity
const linkExposure = webScience.linkExposure;
const pageNavigation = webScience.pageNavigation;
const socialMediaLinkSharing = webScience.socialMediaLinkSharing;
const pageManager = webScience.pageManager;
const pageTransition = webScience.pageTransition;
const matching = webScience.matching;
const debugging = webScience.debugging;

const debugLog = debugging.getDebuggingLog("newsAndDisinfo.eventHandling");

const allDestinationMatchPatterns = [
    ...destinationDomainMatchPatterns,
    ...facebookPageMatchPatterns,
    ...twitterPageMatchPatterns,
    ...youtubePageMatchPatterns];

const allSourceMatchPatterns = [
    ...allDestinationMatchPatterns,
    ...sourceOnlyMatchPatterns];

let destinationMatcher;
let rally;

/**
 * Starts the study by adding listeners and initializing measurement modules.
 * This study runs the pageNavigation, linkExposure, and socialMediaLinkSharing modules.
 * @param {Object} rally - Rally study object, used for sending data pings.
 */
export async function startStudy(rallyArg) {
    rally = rallyArg;
    destinationMatcher = webScience.matching.createMatchPatternSet(allDestinationMatchPatterns);

    // Configure and start measurement modules
    await addListeners();

    dataAnalysis.registerAnalysisScript("/dist/aggregateStatistics.worker.js",
        processAnalysisResult,
        {
            destinationMatches: (matching.createMatchPatternSet(allDestinationMatchPatterns)).export(),
            sourceMatches: (matching.createMatchPatternSet(allSourceMatchPatterns)).export(),
            fbMatches: (matching.createMatchPatternSet(facebookPageMatchPatterns)).export(),
            ytMatches: (matching.createMatchPatternSet(youtubePageMatchPatterns)).export(),
            twMatches: (matching.createMatchPatternSet(twitterPageMatchPatterns)).export()
        });


    webScience.userSurvey.setSurvey({
        surveyName: "Initial Survey",
        popupNoPromptMessage: "<p>You are currently participating in the Political and COVID-19 News Information Flows Study. If you would like to hide this icon, right click and select <i>Remove from Toolbar</i>. </p>",
        popupPromptMessage: "<p>You are currently participating in the Political and COVID-19 News Information Flows Study. </p> <p> Please answer a few survey questions for the Political and COVID-19 News Information Flows Study. Clicking Continue will take you to Princeton’s survey.",
        reminderInterval: 60 * 60 * 24 *3,
        reminderMessage: "A survey is available for your Rally study. Click the Princeton logo in the toolbar to continue.",
        reminderTitle: "Rally survey available",
        surveyCompletionUrl: "https://citpsurveys.cs.princeton.edu/thankyou",
        surveyUrl: "https://citpsurveys.cs.princeton.edu/rallyPolInfoSurvey"
    });
}

/**
 * Starts measurements for link exposure, page navigation,
 * and social media link sharing, with associated extra utlities.
 */
async function addListeners() {
    // Run political and covid news classifiers on pages from relevant domains
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

    linkExposure.onLinkExposureData.addListener(linkExposureListener, {
        linkMatchPatterns: allDestinationMatchPatterns,
        pageMatchPatterns: allSourceMatchPatterns,
        privateWindows : false,
    });

    pageNavigation.onPageData.addListener(storePageNavResult, {
        matchPatterns: allDestinationMatchPatterns,
        trackUserAttention: true});

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

    // Counting page visit starts lets us count untracked page visits.
    pageManager.onPageVisitStart.addListener(pageVisitStartListener);
}

/**
 * Callback for aggregation runs. Submits data to Rally pipeline.
 * @param {Object} result - message from analysis script.
 * @param {Object} result.data - aggregated data from analysis script
 */
async function processAnalysisResult(result) {
    const analysisResult = result.data;
    const data = {};
    const pageNav = analysisResult["newsAndDisinfo.pageNavigation"];
    const linkExp = analysisResult["newsAndDisinfo.linkExposure"];
    const linkSharing = analysisResult["newsAndDisinfo.socialMediaLinkSharing"];
    data["newsAndDisinfo.pageNavigation"] = pageNav ? pageNav : {};
    data["newsAndDisinfo.linkExposure"] = linkExp ? linkExp : {};
    data["newsAndDisinfo.socialMediaLinkSharing"] = linkSharing ? linkSharing : {};
    data["newsAndDisinfo.surveyId"] = await webScience.userSurvey.getSurveyId();
    data["newsAndDisinfo.version"] = getExtensionVersion();
    debugLog("Submitting results through Rally = " + JSON.stringify(data));
    if (__ENABLE_DEVELOPER_MODE__) console.log(data);
    rally.sendPing("measurements", data);
}

/**
 * Callback for the beginning of a page visit. Counts a new untracked page visit
 * if the page doesn't match our list of domains.
 * @param {Object} pageData - Information about the page visit start event.
 * @param {string} pageData.url - Url of the page the user is visiting.
 * @param {number} pageData.pageVisitStartTime - Timestamp of the start of the page visit.
 */
function pageVisitStartListener(pageData) {
    pageData.url = webScience.matching.normalizeUrl(pageData.url);
    if (!destinationMatcher.matches(pageData.url)) {
        storagePN.set(
            {type: "untracked", pageVisitStartTime: pageData.pageVisitStartTime}, "pageVisits");
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
        shareData.url = webScience.matching.normalizeUrl(shareData.url);
        storageSMLS.set(shareData, "linkShares");
    } else if (shareData.type == "untracked" && shareData.untrackedCount > 0) {
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
    const firstSeen = Date.now();
    exposureData.url = webScience.matching.normalizeUrl(exposureData.url);
    for (const exposedUrl of exposureData.matchingLinkUrls) {
        const singleExposure = {
            type: "exposure",
            url: webScience.matching.normalizeUrl(exposedUrl),
            pageUrl: exposureData.url,
            firstSeen: firstSeen
        };
        storageLE.set(singleExposure, "linkExposures");
    }
    if (exposureData.nonmatchingLinkCount > 0) {
        const untrackedData = {
            type: "untracked",
            count: exposureData.nonmatchingLinkCount,
            firstSeen: firstSeen
        };
        storageLE.set(untrackedData, "linkExposures");
    }
}

/**
 * Callback for a tracked page visit. Stores the event.
 * @param {Object} pageData - Information about the page visit event.
 * @param {string} pageData.url - URL of the visited page.
 */
async function storePageNavResult(pageData) {
    pageData.url = webScience.matching.normalizeUrl(pageData.url);
    pageData.type = "pageVisit";
    await storagePN.set(pageData, "pageVisits");
}

/**
 * Store a classification result to storage.
 */
function saveClassificationResult(result) {
    storageClassifications.set(result);
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
    saveClassificationResult({
        className: "pol-page-classifier",
        classification: result.predicted_class,
        pageId: result.pageId,
        url: result.url});
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
    saveClassificationResult({
        className: "covid-page-classifier",
        classification: result.predicted_class,
        pageId: result.pageId,
        url: result.url});
}

/**
 * Return the extension version specified in the manifest.
 * @return {string} - The study version.
 */
function getExtensionVersion() {
    const manifest = browser.runtime.getManifest();
    if ("version" in manifest) return manifest.version;
    return "";
}
