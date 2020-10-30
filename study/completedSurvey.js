function listenForClicks() {
    document.addEventListener("click", async (e) => {
        if (e.target.id == "notice") {
            await browser.runtime.sendMessage({ type: "WebScience.Utilities.Consent.openNotice" });
        }
    });
}
listenForClicks();
