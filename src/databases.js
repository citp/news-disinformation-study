/**
 * Provides indexedStorage objects for the data stored by the study.
 * Listing these in an external file allows them to be shared by the
 * background page and the analysis script/
 */

import * as indexedStorage from "./indexedStorage.js"

export const storageClassifications = new indexedStorage.indexedStorage(
    "newsAndDisinfo.classifications", {classResults: "++,url,pageId"});

export const storagePN = new indexedStorage.indexedStorage(
    "newsAndDisinfo.pageNavigation", {
        pageVisits: "++, url, pageVisitStopTime",
    });
storagePN.setTimeKey("pageVisitStopTime");

export const storageSMLS = new indexedStorage.indexedStorage(
    "newsAndDisinfo.socialMediaLinkSharing", {
        linkShares:"shareId++, shareTime",
    });
storageSMLS.setTimeKey("shareTime");

export const storageLE = new indexedStorage.indexedStorage(
    "newsAndDisinfo.linkExposure", {
        linkExposures: "exposureId++, firstSeen",
    });
storageLE.setTimeKey("firstSeen");

export const storageTransitions = new indexedStorage.indexedStorage(
    "newsAndDisinfo.pageTransitions", {
        transitions: "++, pageId",
    });

export const storageMethodology = new indexedStorage.indexedStorage(
    "newsAndDisinfo.methodology", {
        pageRecords: "++, pageId",
    });
storageMethodology.setTimeKey("pageVisitStopTime");
