browser.contentScripts.register({
    matches: [ "http://*/*", "https://*/*" ],
    js: [ { file: "/content-script.js" } ],
    runAt: "document_start"
});

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if("url" in changeInfo) {
        var busyWaitStart = Date.now();
        while(Date.now() < busyWaitStart + 100)
            true;
        browser.tabs.sendMessage(tabId, { url: changeInfo.url });
    }
}, {
    urls: [ "http://*/*", "https://*/*" ]
})