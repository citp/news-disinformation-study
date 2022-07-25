import { timing } from "@mozilla/web-science";
/**
 * This content script calculates a measure of user attention that mimics what a website
 * developer might use. Unlike the WebScience measure of attention, it does not consider
 * idle time. Website developers don't have access to the same APIs that extension developers
 * do, and methods of approximating idleness are heuristics that we don't try to implement
 * here. We track the time that the page is focused (as opposed ot blurred) and where its
 * visibilityState is "visible" (as opposed to "hidden"). When both are true, we consider the
 * page to have attention. We send a "newsAndDisinfo.simpleAttention.pageData" message
 * to the background script when a page visit ends, using the WebScience pageId to allow
 * these measurements to be synced to others.
 */

/**
 * This will run once pageManager loads (close to `document_start`).
 */
const simpleAttention = function () {
    /**
     * Get the pageManager object so we can grab the pageId, and subscribe to events.
     * @private
     */
    const pageManager = window.webScience.pageManager;

    /**
     * How long the page has had the user's attention.
     * @type {number}
     */
    let simpleAttentionDuration = 0;

    /**
     * When the page attention state was last updated.
     * @type {number}
     */
    let lastSimpleAttentionUpdateTime = 0;

    /**
     * The first time the page had attention or 0 if the page has never had attention.
     * @type {number}
     */
    let firstSimpleAttentionTime = 0;

    /**
     * Whether the page currently has attention.
     * @type {bool}
     */
    let pageHasSimpleAttention = false;

    /**
     * Initializes values for a new page visit.
     * @param {number} timeStamp - the time of the start of the visit, as a WebScience
     * standardized clock value.
     */
    function pageVisitStart (timeStamp) {
        // For simple attention, just use the focus and visibility state.
        pageHasSimpleAttention = document.hasFocus() && document.visibilityState === "visible";
        simpleAttentionDuration = 0;
        lastSimpleAttentionUpdateTime = timeStamp;
        firstSimpleAttentionTime = pageHasSimpleAttention ? timeStamp : 0;

        // in a history change, these are already registered.
        if (!pageManager.isHistoryChange) {
            // listen for the blur and focus events
            addEventListener('blur', event => {
                checkSimpleAttention(event);
            });
            addEventListener('focus', event => {
                checkSimpleAttention(event);
            });

            // listen for changes in the visibility state
            addEventListener('visibilitychange', event => {
                checkSimpleAttention(event);
            });
        }
    }

    // Detect page visit starts. See below for why we use this instead of relying on
    // pageManager. It should always be the case that this content script loads before
    // the readyState is "complete", but we check both to be safe.
    if (document.readyState === "complete") {
        pageVisitStart(timing.now());
    } else {
        document.addEventListener('readystatechange', event => {
            if (document.readyState === "complete") {
                pageVisitStart(timing.fromMonotonicClock(event.timeStamp, true));
            }
        });
    }

    /**
     * Listener for the pageVisitStart event from pageManager.
     * We only use this event when it's firing because of a history change. See below
     * for more.
     * @param {Object} details
     * @param {number} details.timeStamp - the time of the start of the page visit
     */
    function pageManagerPageVisitStart(details) {
        if (pageManager.isHistoryChange) {
            pageVisitStart(details.timeStamp);
        }
    }

    // We use pageManager from WebScience to catch page visit ends, but not their starts.
    // The goal of this module is to mimic what a developer would do to measure attention.
    // Using pageManager could result in measurements that don't match what a website
    // developer would measure. pageManager uses the load time of its content script as the
    // visit start time, and the script is set to load at `document_start`, early in the
    // loading process. It makes sense to have pageManager loaded as soon as possible,
    // but this isn't necessarily when a website developer would register that the page
    // visit had started. I expect that developers would use the `load` event, which corresponds
    // to a readyState of "complete", to mark the beginning of the visit, so that's what
    // I've used here.
    //
    // For the end of the visit, pageManager uses `pagehide`. Just as documentation
    // pushes developers to use `load` for visit starts, it pushes them to use `pagehide`
    // for visit ends, so we let pageManager handle this for us.
    //
    // The exception is for page visits that begin and end via updates to the History API
    // (see the pageManager documentation for more). We don't get readyState changes for these.
    // Here, we can assume that a developer whose site used History navigations would be aware
    // of this, and adjust any attention timing code to compensate. Therefore, we use pageManager's
    // measurement of these page start and stop times without modification.
    if (pageManager.pageVisitStarted) {
        pageManagerPageVisitStart({ timeStamp: pageManager.pageVisitStartTime });
    }
    pageManager.onPageVisitStart.addListener(pageManagerPageVisitStart);

    pageManager.onPageVisitStop.addListener(({ timeStamp }) => {
        if (pageHasSimpleAttention)
            simpleAttentionDuration += timeStamp - lastSimpleAttentionUpdateTime;

        // Send page engagement data to the background script
        pageManager.sendMessage({
            type: "newsAndDisinfo.simpleAttention.pageData",
            pageId: pageManager.pageId,
            simpleAttentionDuration,
        });
    });

    /**
     * Updates the counters for attention duration and last update time upon a change
     * in attention.
     * @param {number} timeStamp - the time of the last attention change, on the WS
     * standardized clock.
     */
    function simpleAttentionUpdate(timeStamp) {
        if (pageHasSimpleAttention) {
            if (firstSimpleAttentionTime < pageManager.pageVisitStartTime) {
                firstSimpleAttentionTime = timeStamp;
            }
        }
        if (!pageHasSimpleAttention) {
            simpleAttentionDuration += timeStamp - lastSimpleAttentionUpdateTime;
        }
        lastSimpleAttentionUpdateTime = timeStamp;
    }

    /**
     * The function for judging simple attention, which fires whenever the simple
     * attention state might have changed. The function checks both the blur/focus
     * state and the visibilityState, and considers the page to have simple attention
     * when both APIs indicate the page is focused/visible. Updates the
     * pageHasSimpleAttention status when necessary.
     * @param {Event} event - The blur/focus or visibilitychange event. It doesn't
     *  matter which one we have, since we only need the timeStamp property, which
     *  both include.
     */
    function checkSimpleAttention(event) {
        // the page has simple attention when it has visibility AND is focused
        if (document.visibilityState === "visible" &&
            document.hasFocus() &&
            !pageHasSimpleAttention) {

            pageHasSimpleAttention = true;
            const timeStamp = timing.fromMonotonicClock(event.timeStamp, true);
            simpleAttentionUpdate(timeStamp);
        }

        // the page doesn't have simple attention if it's missing either visibility or focus
        if (!(document.visibilityState === "visible" &&
              document.hasFocus()) &&
            pageHasSimpleAttention) {

            pageHasSimpleAttention = false;
            const timeStamp = timing.fromMonotonicClock(event.timeStamp, true);
            simpleAttentionUpdate(timeStamp);
        }
    }


};

// Wait for pageManager load, then run the main function.
if (("webScience" in window) && ("pageManager" in window.webScience)) {
    simpleAttention();
}
else {
    if(!("pageManagerHasLoaded" in window)) {
        window.pageManagerHasLoaded = [];
    }
    window.pageManagerHasLoaded.push(simpleAttention);
}
