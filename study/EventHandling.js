import * as webScience from "./webScience.js"
import * as indexedStorage from "./indexedStorage.js"
import * as pageClassification from "./pageClassification.js"
import * as dataAnalysis from "./dataAnalysis.js"
import { destinationDomainMatchPatterns } from "./paths/destinationDomainMatchPatterns.js"
import { referrerOnlyMatchPatterns } from "./paths/referrerOnlyMatchPatterns.js"
import { facebookPageMatchPatterns } from "./paths/facebookPageMatchPatterns.js"
import { twitterPageMatchPatterns } from "./paths/twitterPageMatchPatterns.js"
import { youtubePageMatchPatterns } from "./paths/youtubePageMatchPatterns.js"
import polClassifierData from "./weights/pol-linearsvc_data.js"
import covidClassifierData from "./weights/covid-linearsvc_data.js"

const linkExposure = webScience.linkExposure;
const pageNavigation = webScience.pageNavigation;
const socialMediaLinkSharing = webScience.socialMediaLinkSharing;
const pageManager = webScience.pageManager;
const pageTransition = webScience.pageTransition;
const matching = webScience.matching;
const debugging = webScience.debugging;

let integrationStorage;

let storagePN;
let storageLE;
let storageSMLS;
let storageClassifications;
let destinationMatcher;
const classificationsPN = {};
const transitionsPN = {};
const classificationsSMLS = {};
const debugLog = debugging.getDebuggingLog("newsAndDisinfo.eventHandling");

const allDestinationMatchPatterns = [
    ...destinationDomainMatchPatterns,
    ...facebookPageMatchPatterns,
    ...twitterPageMatchPatterns,
    ...youtubePageMatchPatterns];

const allReferrerMatchPatterns = [
    ...allDestinationMatchPatterns,
    ...referrerOnlyMatchPatterns];

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
            referrerMatches: (matching.createMatchPatternSet(allReferrerMatchPatterns)).export(),
            fbMatches: (matching.createMatchPatternSet(facebookPageMatchPatterns)).export(),
            ytMatches: (matching.createMatchPatternSet(youtubePageMatchPatterns)).export(),
            twMatches: (matching.createMatchPatternSet(twitterPageMatchPatterns)).export()
        });


    // TODO re-enable 
    /*
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
    */
}

async function initialize() {
    destinationMatcher = webScience.matching.createMatchPatternSet(allDestinationMatchPatterns);

    integrationStorage = new indexedStorage.indexedStorage(
        "NewsAndDisinfo.Integration", {integration: "url"});

    storageClassifications = new indexedStorage.indexedStorage(
        "NewsAndDisinfo.Classification", {classResults: "++,url,pageId"});
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
        pageMatchPatterns: allReferrerMatchPatterns,
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
    const analysisResult = result.data.data;
    const data = {};
    const pageNav = analysisResult["NewsAndDisinfo.pageNavigation.pageVisits"];
    const linkExp = analysisResult["NewsAndDisinfo.linkExposure.linkExposures"];
    const linkSharing = analysisResult["NewsAndDisinfo.socialMediaLinkSharing.linkShares"];
    data["webScience.pageNavigation"] = pageNav ? pageNav : {};
    data["webScience.linkExposure"] = linkExp ? linkExp : {};
    data["webScience.socialMediaLinkSharing"] = linkSharing ? linkSharing : {};
    data["webScience.SurveyId"] = await webScience.userSurvey.getSurveyId();
    data["webScience.version"] = getExtensionVersion();
    debugLog("Submitting results through Rally = " + JSON.stringify(data));
    if (__ENABLE_DEVELOPER_MODE__) console.log(data);
    rally.sendPing("measurements", data);
}


function pageVisitStartListener(pageData) {
    pageData.url = webScience.matching.normalizeUrl(pageData.url);
    if (destinationMatcher.matches(pageData.url)) {
        addEvent("visit", pageData.url, pageData.referrer);
        return;
    }
    storagePN.set({type: "untracked", pageVisitStartTime: pageData.pageVisitStartTime}, "pageVisits");
}

async function startPageNavigationMeasurement(options) {
    storagePN = new indexedStorage.indexedStorage(
        "NewsAndDisinfo.pageNavigation", {
            pageVisits: "++, pageId, url, pageVisitStartTime",
        });
    pageNavigation.onPageData.addListener(pageNavListener, options);
}

async function startSMLSMeasurement(options) {
    storageSMLS = new indexedStorage.indexedStorage(
        "NewsAndDisinfo.socialMediaLinkSharing", {
            linkShares:"shareId++, url, shareTime",
        });
    socialMediaLinkSharing.onShare.addListener(linkShareListener, options);
}

async function startLinkExposureMeasurement(options) {
    storageLE = new indexedStorage.indexedStorage(
        "NewsAndDisinfo.linkExposure", {
            linkExposures: "exposureId++, url, firstSeen",
        });
    linkExposure.onLinkExposureData.addListener(linkExposureListener, options);
}

async function startPageTransitionMeasurement(options) {
    pageTransition.onPageTransitionData.addListener(pageTransitionListener, options);
}

function pageTransitionListener(details) {
    const sourceUrl = details.tabSourceUrl;
    const pageId = details.pageId;

    transitionsPN[pageId] = {sourceUrl};
}

async function linkShareListener(shareData) {
    const currentTime = Date.now();
    if (shareData.type == "share") {
        shareData.value.url = webScience.matching.normalizeUrl(shareData.value.url);
        const classResults = await storageClassifications.get({url:shareData.value.url});
        if (classResults == null ||
            !("pol-page-classifier" in classResults) ||
            !("covid-page-classifier" in classResults)) {
            pageClassification.fetchClassificationResult(
                shareData.value.url,
                "covid-page-classifier");

            pageClassification.fetchClassificationResult(
                shareData.value.url,
                "pol-page-classifier");

            setTimeout(storeLinkShare, 10000, shareData);
        } else storeLinkShare(shareData, classResults);
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

async function storeLinkShare(shareData, classResults = null) {
    if (classResults == null) classResults = classificationsSMLS[shareData.value.url];

    shareData = shareData.value;
    shareData.classifierResults = classResults;
    shareData.url = webScience.matching.normalizeUrl(shareData.url);
    shareData.type = "share";

    const urlEvents = await integrationStorage.get(shareData.url);
    shareData.previouslyExposed = urlEvents ? urlEvents["exposure"].length > 0 : false;

    shareData.prevVisitReferrer = checkPrevVisitReferrer(shareData, urlEvents);
    await storageSMLS.set(shareData, "linkShares");
}

function checkPrevVisitReferrer(shareData, urlEvents) {
    return urlEvents ? urlEvents.visit : "";
}

async function linkExposureListener(exposureData) {
    const firstSeen = Date.now();
    exposureData.url = webScience.matching.normalizeUrl(exposureData.url);
    for (const exposedUrl of exposureData.matchingLinkUrls) {
        addEvent("exposure", exposedUrl);
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
 * Store the results from a page visit. If the classifier results haven't
 * arrived yet (likely because the page was closed quickly after opening)
 * wait 5 seconds to give them time, then save the event with or without them.
 * @param {Object} pageData - visit information
 */
async function pageNavListener(pageData) {
    const classResults = classificationsPN[pageData.pageId];
    const transitionResult = transitionsPN[pageData.pageId];
    if (classResults == null ||
        !("pol-page-classifier" in classResults) ||
        !("cov-page-classifier" in classResults) ||
        transitionResult == null) {
        setTimeout(storePageNavResult, 5000, pageData);
    } else {
        storePageNavResult(pageData);
    }
}

async function storePageNavResult(pageData) {
    pageData.url = webScience.matching.normalizeUrl(pageData.url);
    pageData.type = "pageVisit";
    pageData.classResults = classificationsPN[pageData.pageId];
    delete classificationsPN[pageData.pageId];
    if (pageData.pageId in transitionsPN) {
        pageData.sourceUrl = transitionsPN[pageData.pageId].sourceUrl;
    }
    delete transitionsPN[pageData.pageId];
    await storagePN.set(pageData, "pageVisits");
    /* Note: we don't call addEvent here because it gets called from pageVisitStartListener instead.
     * Consider the following scenario:
     * - user browses to a news article
     * - user opens Facebook another tab and pastes the article url in to share
     * - without closing the article, user completes the share
     * - if we hadn't logged the article visit when it started, we'd miss that it had happened in the share
     */
}

async function addEvent(typeOfEvent, url, referrer="") {
    let urlEvents = await integrationStorage.get(url);
    if (!urlEvents) urlEvents = {
        url: url,
        exposure: false,
        visit: ""
    };
    if (typeOfEvent == "exposure" && !(urlEvents.exposure)) {
        urlEvents.exposure = true;
        await integrationStorage.set(urlEvents);
    } else if (typeOfEvent == "visit") {
        urlEvents.visit = referrer;
        await integrationStorage.set(urlEvents);
    }
}

function saveClassificationResult(result) {
    storageClassifications.set(result);
    if (result.pageId != null) {
        if (!classificationsPN[result.pageId]) classificationsPN[result.pageId] = {};
        classificationsPN[result.pageId][result.className] = result.classification;
    } else {
        if (!classificationsSMLS[result.url]) classificationsSMLS[result.url] = {};
        classificationsSMLS[result.url][result.className] = result.classification;
    }
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
