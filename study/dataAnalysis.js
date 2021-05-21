/**
 * This module periodically runs analysis scripts (in a separate thread) and
 * reports the results.
 */

import * as webScience from "./webScience.js"
import * as indexedStorage from "./indexedStorage.js"

let storage;

/**
 * Whether the module has completed setup.
 * @private
 * @type {boolean}
 */
let initialized = false;

let paramsToSend = null;

let storageInstances = null;

/**
 * The end of the time range that the last aggregation run considered.
 * @private
 */
let lastAnalysisRangeEndTime;

let analysisWorker;

/**
 * Setup for the module. Runs only once.
 * @private
 */
async function initialize() {
    if(initialized)
        return;
    initialized = true;
    storage = webScience.storage.createKeyValueStorage("analysisStore");
    lastAnalysisRangeEndTime = await storage.get("lastAnalysisRangeEndTime");
    if (lastAnalysisRangeEndTime == null) {
        lastAnalysisRangeEndTime = roundTimeUp(Date.now());
        await storage.set("lastAnalysisRangeEndTime", lastAnalysisRangeEndTime);
    }
}

function roundTimeUp(timeStamp) {
    const timeStampObj = new Date(timeStamp);
    const endHour = Math.ceil(timeStampObj.getUTCHours() / 4) * 4;
    return Date.UTC(timeStampObj.getUTCFullYear(), timeStampObj.getUTCMonth(),
                    timeStampObj.getUTCDay(), endHour) - 1;
}

function roundTimeDown(timeStamp) {
    const timeStampObj = new Date(timeStamp);
    const endHour = Math.floor(timeStampObj.getUTCHours() / 4) * 4;
    return Date.UTC(timeStampObj.getUTCFullYear(), timeStampObj.getUTCMonth(),
                    timeStampObj.getUTCDay(), endHour);
}

/**
 * Registers analysis scripts and associated listener functions.
 * For each analysis name (identified by object keys), the function expects a
 * script and listener for the result. The analysis script is scheduled to
 * execute in a worker thread during browser idle time. The results from
 * analysis script are forwarded to the listener function.
 *
 * @param {Object} scripts
 * @param {Object.any.path} path - path for analysis script
 * @param {Object.any.resultListener} path - Listener function for processing
 * the result from analysis script
 */


async function runAnalysis() {
    const currentTime = Date.now();
    let startTime = lastAnalysisRangeEndTime;
    let endTime = roundTimeDown(currentTime)
    if (lastAnalysisRangeEndTime < endTime) {
        lastAnalysisRangeEndTime = endTime;
        await storage.set("lastAnalysisRangeEndTime", lastAnalysisRangeEndTime);
        //await triggerAnalysisScripts(analysisStartTime, analysisEndTime);
    } else if (__ENABLE_DEVELOPER_MODE__){
        console.log("I would have pulled analysis results in this range",
            startTime, endTime);
        startTime = currentTime - 86400 * 1000;
        endTime = currentTime;
    } else return;
    const storageObjs = await indexedStorage.getEventsByRange(startTime, endTime, storageInstances);
    const toSend = paramsToSend;
    toSend.fromStorage = storageObjs;

    analysisWorker.postMessage(toSend);
}


export function registerAnalysisScript(scriptPath, listener, storageNames, params=null) {
    initialize();
    analysisWorker = new Worker(scriptPath);
    analysisWorker.onmessage = listener;
    analysisWorker.onerror = event => {
        console.error("Error from analysis script:", event.data);
    }
    storageInstances = storageNames;
    paramsToSend = params;

    webScience.scheduling.onIdleDaily.addListener(runAnalysis);
    if (__ENABLE_DEVELOPER_MODE__) {
        webScience.idle.onStateChanged.addListener(runAnalysis,
            {detectionInterval: 15}
        );
    }

}
