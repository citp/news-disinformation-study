import * as WebScience from "./WebScience.js"

const onPageData = WebScience.Measurements.PageNavigation.onPageData;
const onShare = WebScience.Measurements.SocialMediaLinkSharing.onShare;
const onLinkExposure = WebScience.Measurements.LinkExposure.onLinkExposure;

export async function startPageNavigationMeasurement(options) {
    const storage = await (new WebScience.Utilities.Storage.KeyValueStorage("WebScience.Measurements.PageNavigation")).initialize();

    onPageData.addListener(pageNavListener.bind(null, storage), options);
}

export async function startSMLSMeasurement(options) {
    onShare.addListener(basicListener, options);
}

export async function startLinkExposureMeasurement(options) {
    onLinkExposure.addListener(basicListener, options);
}

function basicListener(eventData) {
    console.log(eventData);
}

function pageNavListener(storage, pageData) {
    storage.set(pageData.url + " " + pageData.pageId, pageData);
}

