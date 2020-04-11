/**
 * @file Implementation for privileged API.
 * 
 * It provides definitions for the functions and events
 * defined in the schema.
 * @module WebScience.Experiments.privileged
 */

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

/**
 * Message to show when presenting consent popup
 * @constant
 * @type {string}
 * @private
 */
const CONSENT_MSG = "Firefox has partnered with researchers from Princeton University to study the health of the web. Learn how you can opt in to participating.";

/**
 * Message to show when presenting survey
 * @constant
 * @type {string}
 * @private
 */
const STUDY_MSG = "A survey is available for the study you joined.";

/**
 * Object for storing event listeners registered to the API.
 * API functions use these listeners to call registered callbacks
 * 
 * @type {Object}
 * @property {Set} onSurveyPopupListeners - listeners registered to survey popup
 * @property {Set} onConsentPopupListeners - listeners registered to consent popup
 * @private
 */
let listenerManager = {
    onSurveyPopupListeners: new Set(),
    onConsentPopupListeners: new Set(),
};

/**
 * Generates a RFC4122 compliant ID
 * https://www.ietf.org/rfc/rfc4122.txt based on given seed.
 * 
 * A compliant UUID is of the form
 * xxxxxxxx-xxxx-Mxxx-Nxxx-xxxxxxxxxxxx; where 1 <= M <= 5
 * In this implementation M = 4.
 * 
 * @param  {number} seed - seed. Example UTC milliseconds
 * @returns {string} - UUID
 */
function generateUUID(seed) {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16;
        r = (seed + r) % 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

/**
 * @description Using experiments_api feature to define new APIs linked to 
 * the extension. privileged is exposed under the global browser object and 
 * is accessible from background scripts.
 */
this.privileged = class extends ExtensionAPI {
    getAPI(context) {
        return {
            privileged: {
                /**
                 * Creates a consent popup with given icon and fires events
                 * based on the user action
                 * @param {string} iconURL - mozextension path to the icon image
                 */
                createConsentPopup(iconURL) {
                    var currentWindow = BrowserWindowTracker.getTopWindow({
                        private: false,
                        allowPopups: false,
                    });

                    /**
                     * @summary Displays a popup and fires listeners based on
                     * the user action.
                     * 0 : If user clicked on Learn more
                     * 1 : If user clicked on Accept/Agree
                     * -1 : If user clicked on Disagree
                     */
                    currentWindow.PopupNotifications.show(
                        currentWindow.gBrowser.selectedBrowser, // browser
                        "uxmockup-popup", // id
                        CONSENT_MSG, // Message to display
                        null, // anchor id
                        { // main action
                            label: "Learn more",
                            accessKey: "L",
                            callback: function () {
                                // Fire all event listeners with a value 0
                                listenerManager.onConsentPopupListeners.forEach((listener) => {
                                    listener(0);
                                });
                            }
                        },
                        [ // secondary actions
                            {
                                label: "Yes, I agree",
                                accessKey: "1",
                                callback: function () {
                                    // Fire all event listeners with a value 1
                                    listenerManager.onConsentPopupListeners.forEach((listener) => {
                                        listener(1);
                                    });
                                }
                            },
                            {
                                label: "No, I disagree",
                                accessKey: "2",
                                callback: function () {
                                    // Fire all event listeners with a value -1
                                    listenerManager.onConsentPopupListeners.forEach((listener) => {
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
                            "popupIconURL": iconURL
                        }
                    );

                },
                /**
                 * Creates a survey popup with given icon and fires events
                 * based on the user action. 
                 * Generates a UUID for a new survey, appends it to the base
                 * survey url and fires listeners when user clicks on open
                 * 
                 * @function
                 * @param {string} surveyURLBase - base url for survey
                 * @param {integer} surveyTime - UTC time when the survey is
                 * invoked
                 * @param {string} iconURL - mozextension path to the icon image
                 */
                createSurveyPopup(surveyURLBase, surveyTime, iconURL) {
                    var currentWindow = BrowserWindowTracker.getTopWindow({
                        private: false,
                        allowPopups: false,
                    });

                    // PopupNotifications API
                    currentWindow.PopupNotifications.show(
                        currentWindow.gBrowser.selectedBrowser, // browser
                        "uxmockup-popup", // id
                        STUDY_MSG,
                        null, // anchor id
                        { // main action
                            label: "Open survey",
                            accessKey: "O",
                            /**
                             * Main action callback. Generates a UUID and
                             * appends it to base survey url
                             * @callback 
                             */
                            callback: function () {
                                let surveyId = generateUUID(surveyTime);
                                listenerManager.onSurveyPopupListeners.forEach((listener) => {
                                    listener(surveyURLBase + surveyId);
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
                            "popupIconURL": iconURL
                        }
                    );

                },
                /**
                 * An event manager object for survey popup
                 * It has methods to support adding and removing callbacks
                 * @type {Object}
                 */
                onSurveyPopup: new ExtensionCommon.EventManager({
                    context: context,
                    name: "privileged.onSurveyPopup",
                    register: (fire) => {
                        let listener = (id, data) => {
                            fire.async(id, data);
                        };
                        listenerManager.onSurveyPopupListeners.add(listener);
                        return () => {
                            listenerManager.onSurveyPopupListeners.delete(listener);
                        };
                    }
                }).api(),
                /**
                 * An event manager object for consent popup
                 * It has methods to support adding and removing callbacks
                 * @type {Object}
                 */
                onConsentPopup: new ExtensionCommon.EventManager({
                    context: context,
                    name: "privileged.onConsentPopup",
                    register: (fire) => {
                        let listener = (id, data) => {
                            fire.async(id, data);
                        };
                        listenerManager.onConsentPopupListeners.add(listener);
                        return () => {
                            listenerManager.onConsentPopupListeners.delete(listener);
                        };
                    }
                }).api()
            }
        }
    }
}