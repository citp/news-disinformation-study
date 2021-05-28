/**
 * Manages registering and communicating with workers for running NLP classifiers
 * on page content for pages from specific domains.
 */

import * as webScience from "./webScience.js";
import Readability from '@mozilla/readability';

const registeredWorkers = {};

/**
 * @callback classificationCallback
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

/**
 * Send a network request for a page's contents, then run the classifier on them.
 * Results are sent to the listener previously registered for the worker.
 * @param {string} url - The page to fetch and classify.
 * @param {string} workerName - The name of the classifier to run on the page.
 */
export function fetchClassificationResult(url, workerName) {
    if (!(workerName in registeredWorkers)) return {};
    const worker = registeredWorkers[workerName];
    fetch(url).then((response) => {
        response.text().then((resp) => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(resp, 'text/html');
            const pageContent = new Readability.Readability(doc).parse();
            const toSend = {
                url : url,
                title: pageContent.title,
                textContent : pageContent.textContent,
                pageId: null,
                context : {
                    timestamp : Date.now(),
                    referrer : ""
                }
            }
            worker.postMessage({
                eventName: "webScience.pageText.onTextParsed",
                listenerArguments: [toSend]
            });
        });
    });
}

