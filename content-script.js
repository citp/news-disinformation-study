browser.runtime.onMessage.addListener((message) => {
    console.debug(`Race Condition Test: Content script received message for URL ${message.url} at URL ${window.location.href}`);
});

if(window.location.origin != "https://www.mozilla.org")
    window.location.href = "https://www.mozilla.org/";