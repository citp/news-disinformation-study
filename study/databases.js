import * as indexedStorage from "./indexedStorage.js"

export const storageClassifications = new indexedStorage.indexedStorage(
    "newsAndDisinfo.Classification", {classResults: "++,url,pageId"});

export const storagePN = new indexedStorage.indexedStorage(
    "newsAndDisinfo.pageNavigation", {
        pageVisits: "++, pageId, url, pageVisitStartTime",
    });
storagePN.setTimeKey("pageVisitStartTime");

export const storageSMLS = new indexedStorage.indexedStorage(
    "newsAndDisinfo.socialMediaLinkSharing", {
        linkShares:"shareId++, url, shareTime",
    });
storageSMLS.setTimeKey("shareTime");

export const storageLE = new indexedStorage.indexedStorage(
    "newsAndDisinfo.linkExposure", {
        linkExposures: "exposureId++, url, firstSeen",
    });
storageLE.setTimeKey("firstSeen");

export const storageTransitions = new indexedStorage.indexedStorage(
    "newsAndDisinfo.pageTransitions", {
        transitions: "++, pageId",
    });
