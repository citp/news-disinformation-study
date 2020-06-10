/**
 * Content script for collecting page engagement measurements where
 * the page is recognized as an article.
 * @module WebScience.Utilities.content-scripts.pageEngagement-article
 */

(function () {
    var documentClone = document.cloneNode(true);
    var article = new Readability(documentClone).parse();
    browser.runtime.sendMessage({
        type: "WebScience.Utilities.PageEngagement.MeasurementUpdate",
        url: window.location.href,
        referrer: document.referrer,
        articleCharacterCount: article.length
    });
}
)();