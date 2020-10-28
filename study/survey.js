function listenForClicks() {
    document.addEventListener("click", async (e) => {
        if (e.target.textContent.includes("Ok")) {
            await browser.runtime.sendMessage({ type: "WebScience.Utilities.UserSurvey.openSurveyTab" });
        } else if (e.target.textContent.includes("Never")) {
            await browser.runtime.sendMessage({ type: "WebScience.Utilities.UserSurvey.cancelSurveyRequest" });
        }
        window.close();
    });
}
listenForClicks();
