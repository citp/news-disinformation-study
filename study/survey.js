function listenForClicks() {
    document.addEventListener("click", async (e) => {
        if (e.target.name == "agree") {
            await browser.runtime.sendMessage({ type: "WebScience.Utilities.UserSurvey.openSurveyTab" });
        } else if (e.target.name == "later") {
            window.close();
        } else if (e.target.name == "never") {
            await browser.runtime.sendMessage({ type: "WebScience.Utilities.UserSurvey.cancelSurveyRequest" });
            window.close();
        }
    });
}
listenForClicks();
