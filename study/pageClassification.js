/**
 */
import * as webScience from "./webScience.js"
import polClassifierData from "./weights/pol-linearsvc_data.js"
import covidClassifierData from "./weights/covid-linearsvc_data.js"
import polWorkerString from "../dist/polClassifier.js"

export function registerWorkers(matchPatterns) {
    console.log("reg running");
    console.log(matchPatterns);
    const workerBlob = new Blob([polWorkerString]);
    console.log(workerBlob);
    const workerUrl = URL.createObjectURL(workerBlob);
    const worker = new Worker(workerUrl);
//    const worker = new Worker("/study/polClassifier.js");
    console.log(worker);
    worker.postMessage({
        type: "init",
        name: "pol-page-classifier",
        args: polClassifierData
    });

    worker.onmessage = event => {
        console.log(event.data.predicted_class);
    };

    webScience.pageText.onTextParsed.addListener(
        webScience.workers.createEventListener(worker),
        {
            matchPatterns: matchPatterns
        });
}
