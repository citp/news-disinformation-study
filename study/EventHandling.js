import * as WebScience from "./WebScience.js"
import { destinationMatchPatterns } from "./paths/destinationDomainsOfInterest.js"
import { referrerDomains } from "./paths/referrerDomains.js"
import { fbPages } from "./paths/pages-fb.js"
import { twPages } from "./paths/pages-tw.js"
import { ytPages } from "./paths/pages-yt.js"

const onLinkExposure = WebScience.Measurements.LinkExposure.onLinkExposure;
let LECounter;
const onPageData = WebScience.Measurements.PageNavigation.onPageData;
const onShare = WebScience.Measurements.SocialMediaLinkSharing.onShare;
let SMLSCounter;
let integrationStorage;
const allDestinationPaths = [...destinationMatchPatterns, ...fbPages, ...twPages, ...ytPages];
const allDestinationPatterns = WebScience.Utilities.Matching.createUrlMatchPatternArray(allDestinationPaths);
const allReferrerPatterns = WebScience.Utilities.Matching.createUrlMatchPatternArray([...allDestinationPaths, ...referrerDomains]);

export async function startStudy() {

    WebScience.Utilities.LinkResolution.initialize();

    //const studyPaths = WebScience.Utilities.Matching.getStudyPaths();

    integrationStorage = await (new WebScience.Utilities.Storage.KeyValueStorage(
        "NewsAndDisinfo.Integration")).initialize();

    LECounter = await (new WebScience.Utilities.Storage.Counter(
        "NewsAndDisinfo.nextLinkExposureID")).initialize();
    await startLinkExposureMeasurement({
        linkMatchPatterns: allDestinationPatterns,
        pageMatchPatterns: allReferrerPatterns,
        domains: allDestinationPaths,
        privateWindows : false,
    });

    await startPageNavigationMeasurement({
        matchPatterns: allDestinationPatterns,
        trackUserAttention: true});

    SMLSCounter = await (new WebScience.Utilities.Storage.Counter(
        "NewsAndDisinfo.nextShareId")).initialize();
    await startSMLSMeasurement({
        domains: allDestinationPaths,//studyPaths.destinationPaths,
        facebook: true,
        twitter: true,
        reddit: true
    });
}

async function startPageNavigationMeasurement(options) {
    const storage = await (new WebScience.Utilities.Storage.KeyValueStorage(
        "NewsAndDisinfo.Measurements.PageNavigation")).initialize();

    onPageData.addListener(pageNavListener.bind(null, storage), options);
}

async function startSMLSMeasurement(options) {
    const storage = await (new WebScience.Utilities.Storage.KeyValueStorage(
        "NewsAndDisinfo.Measurements.SocialMediaLinkSharing")).initialize();
    onShare.addListener(linkShareListener.bind(null, storage), options);
}

async function startLinkExposureMeasurement(options) {
    const storage = await (new WebScience.Utilities.Storage.KeyValueStorage(
        "NewsAndDisinfo.Measurements.LinkExposure")).initialize();
    onLinkExposure.addListener(linkExposureListener.bind(null, storage), options);
}

async function linkShareListener(storage, shareData) {
    if (shareData.type == "share") {
        shareData = shareData.value;
        shareData.url = WebScience.Utilities.Matching.normalizeUrl(shareData.url);
        await addEvent("share", shareData.url, shareData.shareTime);
        const urlEvents = await integrationStorage.get(shareData.url);
        shareData.previouslyExposed = urlEvents["exposure"].length > 0;
        shareData.previouslyVisited = urlEvents["visit"].length > 0;
        await storage.set((await SMLSCounter.getAndIncrement()).toString(), shareData);
    } else if (shareData.type == "untrackedTwitter") {
        await storage.set("numUntrackedSharesTwitter", 
            {"type": "numUntrackedSharesTwitter", "twitter": shareData.value});
    } else if (shareData.type == "untrackedFacebook") {
        await storage.set("numUntrackedSharesFacebook",
            {"type": "numUntrackedSharesFacebook", "facebook": shareData.value});
    } else if (shareData.type == "untrackedReddit") {
        await storage.set("numUntrackedSharesReddit",
            {"type": "numUntrackedSharesReddit", "reddit": shareData.value});
    }

}

async function linkExposureListener(storage, exposureData) {
    exposureData.url = WebScience.Utilities.Matching.normalizeUrl(exposureData.url);
    const exposedUrl = exposureData.url;
    await storage.set((await LECounter.getAndIncrement()).toString(), exposureData);
    await addEvent("exposure", exposedUrl, exposureData.pageVisitStartTime);
}

async function pageNavListener(storage, pageData) {
    pageData.url = WebScience.Utilities.Matching.normalizeUrl(pageData.url);
    await storage.set(pageData.url + " " + pageData.pageId, pageData);
    await addEvent("visit", pageData.url, pageData.pageVisitStartTime);
}

async function addEvent(typeOfEvent, url, timestamp) {
    let urlEvents = await integrationStorage.get(url);
    if (!urlEvents) urlEvents = {"exposure": [], "visit": [], "share": []};
    urlEvents[typeOfEvent].push(timestamp);
    await integrationStorage.set(url, urlEvents);
}
