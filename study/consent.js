function ready(fn) {
    if (document.readyState != 'loading'){
      fn();
    } else {
      document.addEventListener('DOMContentLoaded', fn);
    }
  }

async function closeTab() {
    console.info("closing tab");
    const tabInfo = await browser.tabs.getCurrent();
    browser.tabs.remove(tabInfo.id);
}

async function disagree() {
    await browser.runtime.sendMessage({ type: "WebScience.Utilities.Consent.disagree" });
    await closeTab();
}

ready(() => {

    // Disagree buttons all do the same thing, run the disagree function.
    const disagreeSelectors = ['#princeton-disagree'];
    disagreeSelectors.forEach((selector) => {
        const button = document.querySelector(selector);
        button.addEventListener('click', disagree);
    });

    const princetonAgreeButton = document.querySelector('#princeton-agree');
    princetonAgreeButton.addEventListener('click', async () => {
        console.log("Agreed to Princeton Notice!");
        await browser.runtime.sendMessage({ type: "WebScience.Utilities.Consent.agree" });
    });
});
