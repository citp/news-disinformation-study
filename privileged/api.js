ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");
ChromeUtils.import("resource://gre/modules/ExtensionCommon.jsm");
ChromeUtils.import("resource://gre/modules/ExtensionUtils.jsm");

const { EventManager } = ExtensionCommon;
const EventEmitter =
  ExtensionCommon.EventEmitter || ExtensionUtils.EventEmitter;

XPCOMUtils.defineLazyModuleGetter(
    this,
    "BrowserWindowTracker",
    "resource:///modules/BrowserWindowTracker.jsm",
);

let gManager = {
    onSurveyPopupListeners: new Set(),
    onConsentPopupListeners: new Set(),
};

function generateUUID(base) { // Public Domain/MIT
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16;//random number between 0 and 16
        r = (base + r) % 16 | 0;
        //d = Math.floor(d/16);
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

this.privileged = class extends ExtensionAPI {
    getAPI(context) {
        return {
            privileged: {
                createConsentPopup() {
                    var currentWindow = BrowserWindowTracker.getTopWindow({
                        private: false,
                        allowPopups: false,
                    });

                    // PopupNotifications API
                    currentWindow.PopupNotifications.show(
                        currentWindow.gBrowser.selectedBrowser, // browser
                        "uxmockup-popup", // id
                        "Firefox has partnered with researchers from Princeton University to study the health of the web. Learn how you can opt in to participating.", // message
                        null, // anchor id
                        { // main action
                            label: "Learn more",
                            accessKey: "L",
                            callback: function () {
                                gManager.onConsentPopupListeners.forEach((listener) => {
                                    listener(0);
                                });
                            }
                        },
                        [ // secondary actions
                            {
                                label: "Yes, I agree",
                                accessKey: "1",
                                callback: function () {
                                    gManager.onConsentPopupListeners.forEach((listener) => {
                                        listener(1);
                                    });
                                }
                            },
                            {
                                label: "No, I disagree",
                                accessKey: "2",
                                callback: function () {
                                    gManager.onConsentPopupListeners.forEach((listener) => {
                                        listener(-1);
                                    });
                                }
                            }
                        ],
                        // temporary options
                        {
                            "persistence": 10,
                            "persistWhileVisible": true,
                            "dismissed": false,
                            "popupIconURL": "chrome://browser/content/logos/tracking-protection.svg"
                        }
                    );

                },
                createSurveyPopup(url, surveyTime) {
                    var currentWindow = BrowserWindowTracker.getTopWindow({
                        private: false,
                        allowPopups: false,
                    });

                    // PopupNotifications API
                    currentWindow.PopupNotifications.show(
                        currentWindow.gBrowser.selectedBrowser, // browser
                        "uxmockup-popup", // id
                        "A survey is available for the study you joined.", // message
                        null, // anchor id
                        { // main action
                            label: "Open survey",
                            accessKey: "O",
                            callback: function () {
                                let surveyId = generateUUID(surveyTime);
                                gManager.onSurveyPopupListeners.forEach((listener) => {
                                    listener(url + surveyId);
                                });
                                /*
                                Methods which didn't work :
                                1. open a window with default location and
                                   assign new url
                                   --> This works only for pages in
                                   chrome://browser/content
                                //var features = "chrome,";
                                //features += "centerscreen,dependent,resizeable,location=1,scrollbars=1,status=1";
                                //let window = currentWindow.open(DEFAULT_WINDOW_LOCATION, "", features);
                                //window.location.assign(url);
                                2. Use window watcher component, open a new windom
                                //var win = ww.openWindow(null, "chrome://browser/content/aboutDialog.xhtml",
                                   //"aboutMyExtension", "chrome,centerscreen",
                                   null);
                                3. use methods on selected browsers
                                   //currentWindow.gBrowser.selectedBrowser.loadOneTab(url,
                                   {inBackground: false});
                                4. Send browser/browser.tabs function as an
                                   argument from the background script. These
                                   objects cannot be pickled.
                                */
                            }
                        },
                        [ // secondary actions
                            {
                                label: "No thanks",
                                accessKey: "N",
                                callback: function () {
                                }
                            }
                        ],
                        {
                            "persistence": 10,
                            "persistWhileVisible": true,
                            "dismissed": false,
                            "popupIconURL": "chrome://browser/content/logos/tracking-protection.svg"
                        }
                    );

                },
                onSurveyPopup: new ExtensionCommon.EventManager({
                    context: context,
                    name: "privileged.onSurveyPopup",
                    register: (fire) => {
                        let listener = (id, data) => {
                            fire.async(id, data);
                        };
                        gManager.onSurveyPopupListeners.add(listener);
                        return () => {
                            gManager.onSurveyPopupListeners.delete(listener);
                        };
                    }
                }).api(),
                onConsentPopup: new ExtensionCommon.EventManager({
                    context: context,
                    name: "privileged.onConsentPopup",
                    register: (fire) => {
                        let listener = (id, data) => {
                            fire.async(id, data);
                        };
                        gManager.onConsentPopupListeners.add(listener);
                        return () => {
                            gManager.onConsentPopupListeners.delete(listener);
                        };
                    }
                }).api()
            }
        }
    }
}