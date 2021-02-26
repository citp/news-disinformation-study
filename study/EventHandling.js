import * as WebScience from "./WebScience.js"
import { destinationDomainMatchPatterns } from "./paths/destinationDomainMatchPatterns.js"
import { referrerOnlyMatchPatterns } from "./paths/referrerOnlyMatchPatterns.js"
import { facebookPageMatchPatterns } from "./paths/facebookPageMatchPatterns.js"
import { twitterPageMatchPatterns } from "./paths/twitterPageMatchPatterns.js"
import { youtubePageMatchPatterns } from "./paths/youtubePageMatchPatterns.js"
import polClassifierData from "./weights/pol-linearsvc_data.js"
import covidClassifierData from "./weights/covid-linearsvc_data.js"

const onLinkExposure = WebScience.Measurements.LinkExposure.onLinkExposure;
const onPageData = WebScience.Measurements.PageNavigation.onPageData;
const onShare = WebScience.Measurements.SocialMediaLinkSharing.onShare;
const onClassificationResult = WebScience.Utilities.PageClassification.onClassificationResult;
const onPageVisitStart = WebScience.Utilities.PageManager.onPageVisitStart;

let integrationStorage;

let storagePN;
let storageLE;
let storageSMLS;
let numUntrackedShares;
let numUntrackedVisits;
let storageClassifications;
let destinationMatcher;
let referrerMatcher;
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
    referrerMatcher = new WebScience.Utilities.Matching.MatchPatternSet(allReferrerMatchPatterns);

    await onClassificationResult.addListener(saveClassificationResultPol,
        {
            workerId: "pol-page-classifier",
            filePath: "/study/PolClassifier.js",
            matchPatterns: ["https://*.nytimes.com/*"],
            initArgs: polClassifierData
        });
    await onClassificationResult.addListener(saveClassificationResultCov,
        {
            workerId: "covid-page-classifier",
            filePath: "/study/CovidClassifier.js",
            matchPatterns: ["https://*.nytimes.com/*", "https://*.npr.org/*"],
            initArgs: covidClassifierData
        });

    integrationStorage = new WebScience.Utilities.Storage.IndexedStorage(
        "NewsAndDisinfo.Integration", {integration: "url"});
    storageClassifications = new WebScience.Utilities.Storage.IndexedStorage(
        "NewsAndDisinfo.classification", {classResults: "++,url,pageId"});

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

    numUntrackedVisits = await (new WebScience.Utilities.Storage.Counter(
        "NewsAndDisinfo.untrackedVisits")).initialize();
    numUntrackedShares = {
        facebook: await (new WebScience.Utilities.Storage.Counter(
            "NewsAndDisinfo.untrackedShares.facebook")).initialize(),
        twitter: await (new WebScience.Utilities.Storage.Counter(
            "NewsAndDisinfo.untrackedShares.twitter")).initialize(),
        reddit: await (new WebScience.Utilities.Storage.Counter(
            "NewsAndDisinfo.untrackedShares.reddit")).initialize()
    };


    onPageVisitStart.addListener(countUntrackedPageVisits);

    WebScience.Utilities.DataAnalysis.runStudy({

        analysisTemplate : {
            path : "/WebScience/Measurements/AggregateStatistics.js",
            resultListener : async (result) => {
                const data = {};
                const pageNav = result["NewsAndDisinfo.Measurements.PageNavigation"];
                const linkExp = result["NewsAndDisinfo.Measurements.LinkExposure"];
                const linkSharing = result["NewsAndDisinfo.Measurements.SocialMediaLinkSharing"];
                data["WebScience.Measurements.PageNavigation"] = pageNav ? pageNav : {};
                data["WebScience.Measurements.LinkExposure"] = linkExp ? linkExp : {};
                data["WebScience.Measurements.SocialMediaLinkSharing"] = linkSharing ? linkSharing : {};
                data["WebScience.SurveyId"] = await WebScience.Utilities.UserSurvey.getSurveyId();
                data["WebScience.version"] = WebScience.Utilities.Debugging.getExtensionVersion();
                data["WebScience.Measurements.PageNavigation"]["numUntrackedVisits"] = numUntrackedVisits.get();
                data["WebScience.Measurements.SocialMediaLinkSharing"]["linkSharesByPlatform"].
                    forEach((platform) => {
                    platform.numUntrackedVisits = numUntrackedShares[platform.platform].get();
                }
                );
                console.log(data);
                /*
                debugLog("Submitting results to Telemetry = " + JSON.stringify(data));
                browser.telemetry.submitEncryptedPing(data, options);
                */
            }
        }
    }, {
        destinationMatcher: WebScience.Utilities.Matching.matchPatternsToRegExp(
            allDestinationMatchPatterns),
        referrerMatcher: WebScience.Utilities.Matching.matchPatternsToRegExp(allReferrerMatchPatterns),
        fbMatcher: WebScience.Utilities.Matching.matchPatternsToRegExp(facebookPageMatchPatterns),
        ytMatcher: WebScience.Utilities.Matching.matchPatternsToRegExp(youtubePageMatchPatterns),
        twMatcher: WebScience.Utilities.Matching.matchPatternsToRegExp(twitterPageMatchPatterns)
        /*
        destinationDomains: WebScience.Utilities.Matching.domainsToRegExpString(destinationMatchPatterns),
        referrerOnlyDomains: referrerDomains
        */
    }, [
        {storage: storagePN, store: "pageVisits", timeKey: "pageVisitStartTime"},
        {storage: storageLE, store: "linkExposures", timeKey: "firstSeen"},
        {storage: storageSMLS, store: "linkShares", timeKey: "shareTime"},
        {storage: storageSMLS, store: "untrackedShares", timeKey: "timeStamp"}
    ]);
}

function countUntrackedPageVisits(pageData) {
    if (destinationMatcher.matches(pageData)) return;
    numUntrackedVisits.increment();
}

async function startPageNavigationMeasurement(options) {
    storagePN = new WebScience.Utilities.Storage.IndexedStorage(
        "NewsAndDisinfo.Measurements.PageNavigation",
        {pageVisits: "pageId, url, pageVisitStartTime"});

    onPageData.addListener(pageNavListener, options);
}

async function startSMLSMeasurement(options) {
    storageSMLS = new WebScience.Utilities.Storage.IndexedStorage(
        "NewsAndDisinfo.Measurements.SocialMediaLinkSharing", {
            linkShares:"shareId++, url, shareTime",
            untrackedShares: "platform, timeStamp"
        });
    onShare.addListener(linkShareListener, options);
}

async function startLinkExposureMeasurement(options) {
    storageLE = new WebScience.Utilities.Storage.IndexedStorage(
        "NewsAndDisinfo.Measurements.LinkExposure",
        {linkExposures: "exposureId++, url, firstSeen"});
    onLinkExposure.addListener(linkExposureListener, options);
}

async function linkShareListener(shareData) {
    const storage = storageSMLS;
    const currentTime = Date.now();
    if (shareData.type == "share") {
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
        numUntrackedShares.twitter.incrementBy(shareData.value);
        /*
        await storage.set( {
            platform: "twitter",
            "count": shareData.value,
            timeStamp: currentTime
        },
            "untrackedShares");
            */
    } else if (shareData.type == "untrackedFacebook") {
        numUntrackedShares.facebook.incrementBy(shareData.value);
        /*
        await storage.set( {
            platform: "facebook",
            "count": shareData.value,
            timeStamp: currentTime
        },
            "untrackedShares");
            */
    } else if (shareData.type == "untrackedReddit") {
        numUntrackedShares.reddit.incrementBy(shareData.value);
        /*
        await storage.set( {
            platform: "reddit",
            "count": shareData.value,
            timeStamp: currentTime
        },
            "untrackedShares");
            */
    }

}

async function storeLinkShare(shareData, classResults = null) {
    const storage = storageSMLS;

    if (classResults == null) classResults = classificationsSMLS[shareData.value.url];

    shareData = shareData.value;
    shareData.classifierResults = classResults;
    shareData.url = WebScience.Utilities.Matching.normalizeUrl(shareData.url);

    await addEvent("share", shareData.url, shareData.shareTime);

    const urlEvents = await integrationStorage.get(shareData.url);
    shareData.previouslyExposed = urlEvents["exposure"].length > 0;
    shareData.previouslyVisited = urlEvents["visit"].length > 0;

    await storage.set(shareData);
}

async function linkExposureListener(exposureData) {
    const storage = storageLE;
    exposureData.url = WebScience.Utilities.Matching.normalizeUrl(exposureData.url);
    const exposedUrl = exposureData.url;
    await storage.set(exposureData);
    await addEvent("exposure", exposedUrl, exposureData.firstSeen);
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
    const storage = storagePN;

    pageData.url = WebScience.Utilities.Matching.normalizeUrl(pageData.url);
    pageData.type = "pageVisit";

    pageData.classResults = classificationsPN[pageData.pageId];
    delete classificationsPN[pageData.pageId];
    await storage.set(pageData);
    await addEvent("visit", pageData.url, pageData.pageVisitStartTime);
}

async function addEvent(typeOfEvent, url, timestamp) {
    let urlEvents = await integrationStorage.get(url);
    if (!urlEvents) urlEvents = {
        url: url,
        exposure: [],
        visit: [],
        share: []
    };
    urlEvents[typeOfEvent].push(timestamp);
    await integrationStorage.set(urlEvents);
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
