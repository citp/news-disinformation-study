/**
 * Manages registering and communicating with workers for running NLP classifiers
 * on page content for pages from specific domains.
 */

import * as webScience from "@mozilla/web-science";

const registeredWorkers = {};

/**
 * @callback classificationCallback
 * @param {string} workerId - ID of the classifier.
 * @param {number} data - Prediction of the classifier.
 * @param {string} url - URL of the page that was classified.
 * @param {string} pageId - WebScience pageId assigned to the classified page.
 */

/**
 * Registers a worker to run on specified pages and report results back.
 * @param {string} path - Path to file containing the worker to run.
 * @param {MatchPatternSet} matchPatterns - Match patterns for pages on which the worker
 *   should run.
 * @param {string} name - A name for the worker, which can be used to identify which
 *   worker has sent results.
 * @param {Object} initData - Any initialization data that should be sent to the
 *   worker immediately after it starts, before any page content is sent.
 * @param {classificationCallback} listener - Callback to receive classification result.
 */
export function registerWorker(path, matchPatterns, name, initData, listener) {
    const worker = new Worker(path);
    worker.postMessage({
        type: "init",
        name: name,
        args: initData
    });

    worker.onmessage = event => {
        listener(event.data);
    };

    webScience.pageText.onTextParsed.addListener(
        webScience.workers.createEventListener(worker),
        {
            matchPatterns: matchPatterns
        }
    );

    registeredWorkers[name] = worker;
}
