import * as webScience from "./webScience.js"
import * as pageClassification from "./pageClassification.js"
import * as dataAnalysis from "./dataAnalysis.js"
import { destinationDomainMatchPatterns } from "./paths/destinationDomainMatchPatterns.js"
import { sourceOnlyMatchPatterns } from "./paths/sourceOnlyMatchPatterns.js"
import { facebookPageMatchPatterns } from "./paths/facebookPageMatchPatterns.js"
import { twitterPageMatchPatterns } from "./paths/twitterPageMatchPatterns.js"
import { youtubePageMatchPatterns } from "./paths/youtubePageMatchPatterns.js"
import polClassifierData from "./weights/pol-linearsvc_data.js"
import covidClassifierData from "./weights/covid-linearsvc_data.js"
import { storageTransitions, storageClassifications, storagePN, storageSMLS, storageLE } from "./databases.js"

const linkExposure = webScience.linkExposure;
const pageNavigation = webScience.pageNavigation;
const socialMediaLinkSharing = webScience.socialMediaLinkSharing;
const pageManager = webScience.pageManager;
const pageTransition = webScience.pageTransition;
const matching = webScience.matching;
const debugging = webScience.debugging;

/*
let integrationStorage;

let storagePN;
let storageLE;
let storageSMLS;
let storageClassifications;
*/
let destinationMatcher;
const debugLog = debugging.getDebuggingLog("newsAndDisinfo.eventHandling");

const allDestinationMatchPatterns = [
    ...destinationDomainMatchPatterns,
    ...facebookPageMatchPatterns,
    ...twitterPageMatchPatterns,
    ...youtubePageMatchPatterns];

const allSourceMatchPatterns = [
    ...allDestinationMatchPatterns,
    ...sourceOnlyMatchPatterns];

let rally;

/**
 * Starts the study by adding listeners and initializing measurement modules.
 * This study runs the pageNavigation, linkExposure, and socialMediaLinkSharing modules.
 */
export async function startStudy(rallyArg) {
    rally = rallyArg;
    await initialize();

    await addListeners();

    dataAnalysis.registerAnalysisScript("/dist/aggregateStatistics.worker.js",
        processAnalysisResult,
        [
            {storage: storagePN, store: "pageVisits", timeKey: "pageVisitStartTime"},
            {storage: storageLE, store: "linkExposures", timeKey: "firstSeen"},
            {storage: storageSMLS, store: "linkShares", timeKey: "shareTime"},
        ],
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

async function initialize() {
    destinationMatcher = webScience.matching.createMatchPatternSet(allDestinationMatchPatterns);
}

async function addListeners() {
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

    await startLinkExposureMeasurement({
        linkMatchPatterns: allDestinationMatchPatterns,
        pageMatchPatterns: allSourceMatchPatterns,
        privateWindows : false,
    });

    await startPageNavigationMeasurement({
        matchPatterns: allDestinationMatchPatterns,
        trackUserAttention: true});

    await startSMLSMeasurement({
        destinationMatchPatterns: allDestinationMatchPatterns,
        facebook: true,
        twitter: true,
        reddit: true
    });

    await startPageTransitionMeasurement({
        matchPatterns: allDestinationMatchPatterns,
    });

    pageManager.onPageVisitStart.addListener(pageVisitStartListener);
}

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


function pageVisitStartListener(pageData) {
    pageData.url = webScience.matching.normalizeUrl(pageData.url);
    if (!destinationMatcher.matches(pageData.url)) {
        storagePN.set(
            {type: "untracked", pageVisitStartTime: pageData.pageVisitStartTime}, "pageVisits");
    }
}

async function startPageNavigationMeasurement(options) {
    pageNavigation.onPageData.addListener(pageNavListener, options);
}

async function startSMLSMeasurement(options) {
    socialMediaLinkSharing.onShare.addListener(linkShareListener, options);
}

async function startLinkExposureMeasurement(options) {
    linkExposure.onLinkExposureData.addListener(linkExposureListener, options);
}

async function startPageTransitionMeasurement(options) {
    pageTransition.onPageTransitionData.addListener(pageTransitionListener, options);
}

function pageTransitionListener(details) {
    const sourceUrl = details.tabSourceUrl;
    const pageId = details.pageId;

    storageTransitions.set({pageId: pageId, sourceUrl: sourceUrl});
}

async function linkShareListener(shareData) {
    const currentTime = Date.now();
    if (shareData.type == "share") {
        shareData.value.url = webScience.matching.normalizeUrl(shareData.value.url);
        storeLinkShare(shareData);
    } else if (shareData.type == "untrackedTwitter") {
        storageSMLS.set({
            type: "untracked", platform: "twitter",
            count: shareData.value, shareTime: currentTime
        }, "linkShares");
    } else if (shareData.type == "untrackedFacebook") {
        storageSMLS.set({
            type: "untracked", platform: "facebook",
            count: shareData.value, shareTime: currentTime
        }, "linkShares");
    } else if (shareData.type == "untrackedReddit") {
        storageSMLS.set({
            type: "untracked", platform: "reddit",
            count: shareData.value, shareTime: currentTime
        }, "linkShares");
    }
}

async function storeLinkShare(shareData) {
    shareData = shareData.value;
    shareData.url = webScience.matching.normalizeUrl(shareData.url);
    shareData.type = "share";
    await storageSMLS.set(shareData, "linkShares");
}

async function linkExposureListener(exposureData) {
    console.log("exposures", exposureData);
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

async function pageNavListener(pageData) {
    storePageNavResult(pageData);
}

async function storePageNavResult(pageData) {
    pageData.url = webScience.matching.normalizeUrl(pageData.url);
    pageData.type = "pageVisit";
    await storagePN.set(pageData, "pageVisits");
}

function saveClassificationResult(result) {
    storageClassifications.set(result);
}

function saveClassificationResultPol(result) {
    saveClassificationResult({
        className: "pol-page-classifier",
        classification: result.predicted_class,
        pageId: result.pageId,
        url: result.url});
}

function saveClassificationResultCovid(result) {
    saveClassificationResult({
        className: "covid-page-classifier",
        classification: result.predicted_class,
        pageId: result.pageId,
        url: result.url});
}

function getExtensionVersion() {
    const manifest = browser.runtime.getManifest();
    if ("version" in manifest) return manifest.version;
    return "";
}
