function listenForClicks() {
    document.addEventListener("click", async (e) => {
        if (e.target.name && e.target.name == "disagree") {
            await browser.runtime.sendMessage({ type: "WebScience.Utilities.Consent.disagree" });
            var tabInfo = await browser.tabs.getCurrent();
            browser.tabs.remove(tabInfo.id);
        } else if (e.target.name && e.target.name == "agree") {
            await browser.runtime.sendMessage({ type: "WebScience.Utilities.Consent.agree" });
            var tabInfo = await browser.tabs.getCurrent();
            browser.tabs.remove(tabInfo.id);
        }
    });
}
listenForClicks();
