/**
 * Content script for collecting page engagement measurements.
 * @module WebScience.Utilities.content-scripts.pageEngagement-main
 */

(function () {

    // How often to measure user engagement with the page
    var measurementInterval = 1000;

    var maxPageHeight = -1;
    var maxScrollDepth = -1;

    // On each timer tick, remeasure the page height and the scroll depth
    setInterval(() => {
        var priorMaxPageHeight = maxPageHeight;
        var priorMaxScrollDepth = maxScrollDepth;
        maxPageHeight = Math.max(maxPageHeight, document.documentElement.scrollHeight);
        maxScrollDepth = Math.max(maxScrollDepth, document.documentElement.scrollTop + document.documentElement.clientHeight);
        
        // If either the page height or scroll depth has increased, send an update to the background page
        if((maxPageHeight != priorMaxPageHeight) || (maxScrollDepth != priorMaxScrollDepth)) {
            browser.runtime.sendMessage({
                type: "WebScience.Utilities.PageEngagement.MeasurementUpdate",
                url: window.location.href,
                referrer: document.referrer,
                pageHeight: maxPageHeight,
                scrollDepth: maxScrollDepth
            });
        }
    }, measurementInterval);
}
)();