/**
 * Content script for binding the background script request ID to the
 * content script environment.
 * @module WebScience.Utilities.content-scripts.pageEvents
 */

(function () {
    // Try to extract the request ID from a cookie and expire the cookie
    var cookieTokens = document.cookie.split(";");
    for(var cookieToken of cookieTokens) {
        if(cookieToken.indexOf("webScienceRequestId=") == 0) {
            window.requestId = cookieToken.substring("webScienceRequestId=".length).repeat(1);
            // TODO: add path to expiry
            document.cookie = `webScienceRequestId=${window.requestId}; expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
            return;
        }
    }
}
)();