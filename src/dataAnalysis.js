/**
 * This module periodically runs analysis scripts (in a separate thread) and
 * reports the results.
 */

import * as webScience from "@mozilla/web-science"

let storage;

/**
 * Whether the module has completed setup.
 * @private
 * @type {boolean}
 */
let initialized = false;

/**
 * The end of the time range that the last aggregation run considered.
 * @private
 * @type {number}
 */
let lastAnalysisRangeEndTime;

/**
 * Object for the registered worker.
 * @private
 * @type {Object}
 */
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
        lastAnalysisRangeEndTime = roundTimeUp(webScience.timing.now());
        await storage.set("lastAnalysisRangeEndTime", lastAnalysisRangeEndTime);
    }
}

/**
 * Round a timestamp to the future time that ends a four-hour reporting block.
 * @param {number} timeStamp - The time to round.
 * @return {number} - The last timestamp that is part of the four-hour reporting
 *   block of the input timestamp.
 */
function roundTimeUp(timeStamp) {
    const timeStampObj = new Date(timeStamp);
    const endHour = Math.ceil(timeStampObj.getUTCHours() / 4) * 4;
    return Date.UTC(timeStampObj.getUTCFullYear(), timeStampObj.getUTCMonth(),
                    timeStampObj.getUTCDay(), endHour) - 1;
}

/**
 * Round a timestamp to the past time that begins a four-hour reporting block.
 * @param {number} timeStamp - The time to round.
 * @return {number} - The first timestamp that is part of the four-hour reporting
 *   block of the input timestamp.
 */
function roundTimeDown(timeStamp) {
    const timeStampObj = new Date(timeStamp);
    const endHour = Math.floor(timeStampObj.getUTCHours() / 4) * 4;
    return Date.UTC(timeStampObj.getUTCFullYear(), timeStampObj.getUTCMonth(),
                    timeStampObj.getUTCDay(), endHour);
}

/**
 * Calculate starting and ending times for this analysis period, then run the
 * analysis script.
 */
async function runAnalysis() {
    const currentTime = webScience.timing.now();
    let startTime = lastAnalysisRangeEndTime;
    let endTime = roundTimeDown(currentTime)
    if (lastAnalysisRangeEndTime < endTime) {
        lastAnalysisRangeEndTime = endTime;
        await storage.set("lastAnalysisRangeEndTime", lastAnalysisRangeEndTime);
    } else if (__ENABLE_DEVELOPER_MODE__){
        // Normally we don't run aggregation if we don't have at least one full
        //  four-hour aggregation block since the last aggregation run. However,
        //  when testing, we always want to run aggregation. Log the values
        //  that would've been used in non-developer mode, then aggregate on the
        //  last day of events anyway.
        console.log("I would have pulled analysis results in this range",
            startTime, endTime);
        startTime = currentTime - 86400 * 1000;
        endTime = currentTime;
    } else return;
    const toSend = {};
    toSend.type = "aggregate";
    toSend.startTime = startTime;
    toSend.endTime = endTime;

    analysisWorker.postMessage(toSend);
}

/**
 * Register an analysis script to run approximately every 24 hours.
 * @param {string} scriptPath - Location of the worker script to run.
 * @param {callback} listener - The callback function to receive the worker's results.
 * @param {Object} params - Additional parameters to pass to the worker on initialization.
 */
export async function registerAnalysisScript(scriptPath, listener, params=null) {
    await initialize();
    analysisWorker = new Worker(scriptPath);
    analysisWorker.onmessage = listener;
    analysisWorker.onerror = event => {
        console.error("Error from analysis script:", event.data);
    }

    analysisWorker.postMessage({
        type: "init",
        ...params
    });

    webScience.scheduling.onIdleDaily.addListener(runAnalysis);
    if (__ENABLE_DEVELOPER_MODE__) {
        // When testing, we want to be able to test aggregation easily. This triggers
        //  it to run after 15 seconds of inactivity when the extension is in development mode.
        webScience.idle.onStateChanged.addListener(runAnalysis,
            {detectionInterval: 15}
        );
    }
}
