function ready(fn) {
    if (document.readyState != 'loading'){
      fn();
    } else {
      document.addEventListener('DOMContentLoaded', fn);
    }
  }

async function closeTab() {
    console.info("closing tab");
    let tabInfo = await browser.tabs.getCurrent();
    browser.tabs.remove(tabInfo.id);
}

async function disagree() {
    await browser.runtime.sendMessage({ type: "WebScience.Utilities.Consent.disagree" });
    await closeTab();
}

ready(() => {
    // set some default values
    let mozillaAgreement = false;
    let princetonAgreement = false;

    // Disagree buttons all do the same thing, run the disagree function.
    let disagreeSelectors = ['#mozilla-disagree', '#princeton-disagree'];
    disagreeSelectors.forEach((selector) => {
        let button = document.querySelector(selector);
        button.addEventListener('click', disagree);
    });

    // Mozilla agree button is step 1.
    let mozillaAgreeButton      = document.querySelector('#mozilla-agree');
    let agreeToMozillaNotice = async () => {
        mozillaAgreement = true;
        console.log("Agreed to Mozilla Notice!");
        let mozillaNotice = document.querySelector('#mozilla-notice');
        let princetonNotice = document.querySelector('#princeton-notice');
        let main = document.querySelector('main');

        // hide mozilla notice.
        mozillaNotice.style.display = 'none';
        // show princeton notice.
        princetonNotice.style.display = 'block';
        window.scrollTo(0, 0);

    };
    mozillaAgreeButton.addEventListener('click', agreeToMozillaNotice);

    // Princeton agree button is step 2, and completion.
    let princetonAgreeButton    = document.querySelector('#princeton-agree');
    princetonAgreeButton.addEventListener('click', async () => {
        console.log("Agreed to Princeton Notice!");
        await browser.runtime.sendMessage({ type: "WebScience.Utilities.Consent.agree" });
    });
});
