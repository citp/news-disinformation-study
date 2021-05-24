/**
 */

import * as webScience from "./webScience.js";
import Readability from '@mozilla/readability';

const registeredWorkers = {};

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

