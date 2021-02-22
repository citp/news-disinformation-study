import * as WebScience from "./WebScience.js"
import { destinationMatchPatterns } from "./paths/destinationDomainsOfInterest.js"
import { referrerDomains } from "./paths/referrerDomains.js"
import { fbPages } from "./paths/pages-fb.js"
import { twPages } from "./paths/pages-tw.js"
import { ytPages } from "./paths/pages-yt.js"
import polClassifierData from "./weights/pol-linearsvc_data.js"
import covidClassifierData from "./weights/covid-linearsvc_data.js"

const onLinkExposure = WebScience.Measurements.LinkExposure.onLinkExposure;
const onPageData = WebScience.Measurements.PageNavigation.onPageData;
const onShare = WebScience.Measurements.SocialMediaLinkSharing.onShare;
const onClassificationResult = WebScience.Utilities.PageClassification.onClassificationResult;

let integrationStorage;

let storagePN;
let storageLE;
let storageSMLS;

const allDestinationPaths = [...destinationMatchPatterns, ...fbPages, ...twPages, ...ytPages];
const allDestinationPatterns = WebScience.Utilities.Matching.createUrlMatchPatternArray(allDestinationPaths);
const allReferrerPatterns = WebScience.Utilities.Matching.createUrlMatchPatternArray([...allDestinationPaths, ...referrerDomains]);

export async function startStudy() {

    WebScience.Utilities.LinkResolution.initialize();

    //const studyPaths = WebScience.Utilities.Matching.getStudyPaths();

    // TODO: use new regexp functions for the urls here
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

    await startLinkExposureMeasurement({
        linkMatchPatterns: allDestinationPatterns,
        pageMatchPatterns: allReferrerPatterns,
        domains: allDestinationPaths,
        privateWindows : false,
    });

    await startPageNavigationMeasurement({
        matchPatterns: allDestinationPatterns,
        trackUserAttention: true});

    await startSMLSMeasurement({
        domains: allDestinationPaths,//studyPaths.destinationPaths,
        facebook: true,
        twitter: true,
        reddit: true
    });

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
                /*
                debugLog("Submitting results to Telemetry = " + JSON.stringify(data));
                browser.telemetry.submitEncryptedPing(data, options);
                */
            }
        }
    }, {
        destinationDomains: WebScience.Utilities.Matching.domainsToRegExpString(destinationMatchPatterns),
        fbPages: WebScience.Utilities.Matching.domainsToRegExpString(fbPages),
        ytPages: WebScience.Utilities.Matching.domainsToRegExpString(ytPages),
        twPages: WebScience.Utilities.Matching.domainsToRegExpString(twPages),
        referrerOnlyDomains: referrerDomains
    }, [
        {storage: storagePN, store: "pageVisits", timeKey: "pageVisitStartTime"},
        {storage: storageLE, store: "linkExposures", timeKey: "firstSeen"},
        {storage: storageSMLS, store: "linkShares", timeKey: "shareTime"}
    ]);
}

async function startPageNavigationMeasurement(options) {
    storagePN = new WebScience.Utilities.Storage.IndexedStorage(
        "NewsAndDisinfo.Measurements.PageNavigation",
        {pageVisits: "pageId, url, pageVisitStartTime"});

    onPageData.addListener(pageNavListener, options);
}

async function startSMLSMeasurement(options) {
    storageSMLS = new WebScience.Utilities.Storage.IndexedStorage(
        "NewsAndDisinfo.Measurements.SocialMediaLinkSharing",
        {linkShares:"shareId++, url, shareTime",
         untrackedCounts: "platform"});
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
    if (shareData.type == "share") {
        shareData = shareData.value;
        shareData.url = WebScience.Utilities.Matching.normalizeUrl(shareData.url);
        await addEvent("share", shareData.url, shareData.shareTime);
        const urlEvents = await integrationStorage.get(shareData.url);
        shareData.previouslyExposed = urlEvents["exposure"].length > 0;
        shareData.previouslyVisited = urlEvents["visit"].length > 0;
        await storage.set(shareData);
    } else if (shareData.type == "untrackedTwitter") {
        await storage.set(
            {platform: "twitter", "count": shareData.value},
            "untrackedCounts");
    } else if (shareData.type == "untrackedFacebook") {
        await storage.set(
            {platform: "facebook", "count": shareData.value},
            "untrackedCounts");
    } else if (shareData.type == "untrackedReddit") {
        await storage.set(
            {platform: "reddit", "count": shareData.value},
            "untrackedCounts");
    }

}

async function linkExposureListener(exposureData) {
    const storage = storageLE;
    exposureData.url = WebScience.Utilities.Matching.normalizeUrl(exposureData.url);
    const exposedUrl = exposureData.url;
    await storage.set(exposureData);
    await addEvent("exposure", exposedUrl, exposureData.firstSeen);
}

async function pageNavListener(pageData) {
    const storage = storagePN;
    pageData.url = WebScience.Utilities.Matching.normalizeUrl(pageData.url);
    pageData.type = "pageVisit";
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
    console.log(urlEvents);
    await integrationStorage.set(urlEvents);
}

function saveClassificationResultPol(result) {
    console.log(result);
}

function saveClassificationResultCov(result) {
    console.log(result);
}
