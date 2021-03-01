import * as WebScience from "./WebScience.js"
import { destinationDomainMatchPatterns } from "./paths/destinationDomainMatchPatterns.js"
import { referrerOnlyMatchPatterns } from "./paths/referrerOnlyMatchPatterns.js"
import { facebookPageMatchPatterns } from "./paths/facebookPageMatchPatterns.js"
import { twitterPageMatchPatterns } from "./paths/twitterPageMatchPatterns.js"
import { youtubePageMatchPatterns } from "./paths/youtubePageMatchPatterns.js"
import polClassifierData from "./weights/pol-linearsvc_data.js"
import covidClassifierData from "./weights/covid-linearsvc_data.js"

const LinkExposure = WebScience.Measurements.LinkExposure;
const PageNavigation = WebScience.Measurements.PageNavigation;
const SocialMediaLinkSharing = WebScience.Measurements.SocialMediaLinkSharing;
const PageClassification = WebScience.Utilities.PageClassification;
const PageManager = WebScience.Utilities.PageManager;

let integrationStorage;

let storagePN;
let storageLE;
let storageSMLS;
let storageClassifications;
let destinationMatcher;
const classificationsPN = {};
const classificationsSMLS = {};

const allDestinationMatchPatterns = [
    ...destinationDomainMatchPatterns,
    ...facebookPageMatchPatterns,
    ...twitterPageMatchPatterns,
    ...youtubePageMatchPatterns];

const allReferrerMatchPatterns = [
    ...allDestinationMatchPatterns,
    ...referrerOnlyMatchPatterns];

export async function startStudy() {
    WebScience.Utilities.LinkResolution.initialize();

    destinationMatcher = new WebScience.Utilities.Matching.MatchPatternSet(allDestinationMatchPatterns);

    await PageClassification.onClassificationResult.addListener(saveClassificationResultPol,
        {
            workerId: "pol-page-classifier",
            filePath: "/study/PolClassifier.js",
            matchPatterns: allDestinationMatchPatterns,
            exportedMatcher: destinationMatcher.export(),
            initArgs: polClassifierData
        });
    await PageClassification.onClassificationResult.addListener(saveClassificationResultCov,
        {
            workerId: "covid-page-classifier",
            filePath: "/study/CovidClassifier.js",
            matchPatterns: allDestinationMatchPatterns,
            exportedMatcher: destinationMatcher.export(),
            initArgs: covidClassifierData
        });

    integrationStorage = new WebScience.Utilities.Storage.IndexedStorage(
        "NewsAndDisinfo.Integration", {integration: "url"});
    storageClassifications = new WebScience.Utilities.Storage.IndexedStorage(
        "NewsAndDisinfo.Classification", {classResults: "++,url,pageId"});

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


    PageManager.onPageVisitStart.addListener(pageVisitStartListener);

    WebScience.Utilities.DataAnalysis.runStudy({

        analysisTemplate : {
            path : "/WebScience/Measurements/AggregateStatistics.js",
            resultListener : async (result) => {
                const data = {};
                const pageNav = result["NewsAndDisinfo.Measurements.PageNavigation.pageVisits"];
                const linkExp = result["NewsAndDisinfo.Measurements.LinkExposure.linkExposures"];
                const linkSharing = result["NewsAndDisinfo.Measurements.SocialMediaLinkSharing.linkShares"];
                data["WebScience.Measurements.PageNavigation"] = pageNav ? pageNav : {};
                data["WebScience.Measurements.LinkExposure"] = linkExp ? linkExp : {};
                data["WebScience.Measurements.SocialMediaLinkSharing"] = linkSharing ? linkSharing : {};
                data["WebScience.SurveyId"] = await WebScience.Utilities.UserSurvey.getSurveyId();
                data["WebScience.version"] = WebScience.Utilities.Debugging.getExtensionVersion();
                console.log(data);
                /*
                debugLog("Submitting results to Telemetry = " + JSON.stringify(data));
                browser.telemetry.submitEncryptedPing(data, options);
                */
            }
        }
    }, {
        destinationMatches: (new WebScience.Utilities.Matching.MatchPatternSet(
            allDestinationMatchPatterns)).export(),
        referrerMatches: (new WebScience.Utilities.Matching.MatchPatternSet(allReferrerMatchPatterns)).export(),
        fbMatches: (new WebScience.Utilities.Matching.MatchPatternSet(facebookPageMatchPatterns)).export(),
        ytMatches: (new WebScience.Utilities.Matching.MatchPatternSet(youtubePageMatchPatterns)).export(),
        twMatches: (new WebScience.Utilities.Matching.MatchPatternSet(twitterPageMatchPatterns)).export()
    }, [
        {storage: storagePN, store: "pageVisits", timeKey: "pageVisitStartTime"},
        {storage: storageLE, store: "linkExposures", timeKey: "firstSeen"},
        {storage: storageSMLS, store: "linkShares", timeKey: "shareTime"},
    ]);

    WebScience.Utilities.UserSurvey.runStudy({
        surveyUrl: "https://citpsurveys.cs.princeton.edu/rallyPolInfoSurvey"
    });
}

function pageVisitStartListener(pageData) {
    pageData.url = WebScience.Utilities.Matching.normalizeUrl(pageData.url);
    if (destinationMatcher.matches(pageData.url)) {
        addEvent("visit", pageData.url, pageData.referrer);
        return;
    }
    storagePN.set({type: "untracked", pageVisitStartTime: pageData.pageVisitStartTime}, "pageVisits");
}

async function startPageNavigationMeasurement(options) {
    storagePN = new WebScience.Utilities.Storage.IndexedStorage(
        "NewsAndDisinfo.Measurements.PageNavigation", {
            pageVisits: "++, pageId, url, pageVisitStartTime",
        });
    PageNavigation.onPageData.addListener(pageNavListener, options);
}

async function startSMLSMeasurement(options) {
    storageSMLS = new WebScience.Utilities.Storage.IndexedStorage(
        "NewsAndDisinfo.Measurements.SocialMediaLinkSharing", {
            linkShares:"shareId++, url, shareTime",
        });
    SocialMediaLinkSharing.onShare.addListener(linkShareListener, options);
}

async function startLinkExposureMeasurement(options) {
    storageLE = new WebScience.Utilities.Storage.IndexedStorage(
        "NewsAndDisinfo.Measurements.LinkExposure", {
            linkExposures: "exposureId++, url, firstSeen",
        });
    LinkExposure.onLinkExposure.addListener(linkExposureListener, options);
    LinkExposure.onUntracked.addListener(untrackedLEListener);
}

async function linkShareListener(shareData) {
    const currentTime = Date.now();
    if (shareData.type == "share") {
        shareData.value.url = WebScience.Utilities.Matching.normalizeUrl(shareData.value.url);
        const classResults = await storageClassifications.get({url:shareData.value.url});
        if (classResults == null ||
            !("pol-page-classifier" in classResults) ||
            !("covid-page-classifier" in classResults)) {
            WebScience.Utilities.PageClassification.fetchClassificationResult(
                shareData.value.url,
                "covid-page-classifier");

            WebScience.Utilities.PageClassification.fetchClassificationResult(
                shareData.value.url,
                "pol-page-classifier");

            setTimeout(storeLinkShare, 10000, shareData);
        } else storeLinkShare(shareData, classResults);
    } else if (shareData.type == "untrackedTwitter") {
        storageSMLS.set({type: "untracked", platform: "twitter", count: shareData.value, shareTime: currentTime}, "linkShares");
    } else if (shareData.type == "untrackedFacebook") {
        storageSMLS.set({type: "untracked", platform: "facebook", count: shareData.value, shareTime: currentTime}, "linkShares");
    } else if (shareData.type == "untrackedReddit") {
        storageSMLS.set({type: "untracked", platform: "reddit", count: shareData.value, shareTime: currentTime}, "linkShares");
    }

}

async function storeLinkShare(shareData, classResults = null) {
    if (classResults == null) classResults = classificationsSMLS[shareData.value.url];

    shareData = shareData.value;
    shareData.classifierResults = classResults;
    shareData.url = WebScience.Utilities.Matching.normalizeUrl(shareData.url);
    shareData.type = "share";

    const urlEvents = await integrationStorage.get(shareData.url);
    shareData.previouslyExposed = urlEvents ? urlEvents["exposure"].length > 0 : false;

    shareData.prevVisitReferrer = checkPrevVisitReferrer(shareData, urlEvents);
    await storageSMLS.set(shareData, "linkShares");
}

function checkPrevVisitReferrer(shareData, urlEvents) {
    return urlEvents ? urlEvents.visit : "";
}


async function untrackedLEListener(untrackedData) {
    storageLE.set(
        {type: "untracked", count: untrackedData.count, firstSeen: untrackedData.timeStamp},
        "linkExposures");
}

async function linkExposureListener(exposureData) {
    exposureData.url = WebScience.Utilities.Matching.normalizeUrl(exposureData.url);
    const exposedUrl = exposureData.url;
    exposureData.type = "exposure";
    await storageLE.set(exposureData, "linkExposures");
    await addEvent("exposure", exposedUrl);
}

/**
 * Store the results from a page visit. If the classifier results haven't
 * arrived yet (likely because the page was closed quickly after opening)
 * wait 5 seconds to give them time, then save the event with or without them.
 * @param {Object} pageData - visit information
 */
async function pageNavListener(pageData) {
    const classResults = classificationsPN[pageData.pageId];
    if (classResults == null ||
        !("pol-page-classifier" in classResults) ||
        !("cov-page-classifier" in classResults)) {
        setTimeout(storePageNavResult, 5000, pageData);
    } else {
        storePageNavResult(pageData);
    }
}

async function storePageNavResult(pageData) {
    pageData.url = WebScience.Utilities.Matching.normalizeUrl(pageData.url);
    pageData.type = "pageVisit";
    pageData.classResults = classificationsPN[pageData.pageId];
    delete classificationsPN[pageData.pageId];
    await storagePN.set(pageData, "pageVisits");
    /* Note: we don't call addEvent here because it gets called from pageVisitStartListener instead.
     * Consider the following scenario:
     * - user browses to a news article
     * - user opens Facebook another tab and pastes the article url in to share
     * - without ever closing the article, user completes the share
     * - if we hadn't logged the article visit when it started, we'd miss that it had happened in the share
     */
    //await addEvent("visit", pageData.url, pageData.pageVisitStartTime);
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

function saveClassificationResultCov(result) {
    saveClassificationResult({
        className: "covid-page-classifier",
        classification: result.predicted_class,
        pageId: result.pageId,
        url: result.url});
}
