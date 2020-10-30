function listenForClicks() {
    document.addEventListener("click", async (e) => {
        if (e.target.id && e.target.id == "disagree") {
            await browser.runtime.sendMessage({ type: "WebScience.Utilities.Consent.disagree" });
            var tabInfo = await browser.tabs.getCurrent();
            browser.tabs.remove(tabInfo.id);
        } else if (e.target.id && e.target.id == "agree") {
            await browser.runtime.sendMessage({ type: "WebScience.Utilities.Consent.agree" });
            var tabInfo = await browser.tabs.getCurrent();
            browser.tabs.remove(tabInfo.id);
        }
    });
}
listenForClicks();
