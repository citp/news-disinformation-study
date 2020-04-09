ChromeUtils.import("resource://gre/modules/Console.jsm");
ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");
ChromeUtils.import("resource://gre/modules/ExtensionCommon.jsm");
ChromeUtils.import("resource://gre/modules/ExtensionUtils.jsm");

var ww = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
                   .getService(Components.interfaces.nsIWindowWatcher);
/* eslint-disable no-undef */
const { EventManager } = ExtensionCommon;
const EventEmitter =
  ExtensionCommon.EventEmitter || ExtensionUtils.EventEmitter;

var {Services} = ChromeUtils.import("resource://gre/modules/Services.jsm");
// load utilityOverlay module for openLinkIn
Services.scriptloader.loadSubScript("chrome://browser/content/utilityOverlay.js", this);

XPCOMUtils.defineLazyModuleGetter(
    this,
    "BrowserWindowTracker",
    "resource:///modules/BrowserWindowTracker.jsm",
);

class PrivilegedEventEmitter extends EventEmitter {
    emitSurveyConsentAccept() {
      this.emit("survey-consent-accept");
    }
  }

this.privileged = class extends ExtensionAPI {
    getAPI(context) {
        const privilegedEventEmitter = new PrivilegedEventEmitter();
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
                            callback: function() { }
                        },
                        [ // secondary actions
                            {
                                label: "No thanks",
                                accessKey: "N",
                                callback: function() { }
                            }
                        ],
                        // temporary options
                        {
                            "persistence": 10,
                            "persistWhileVisible": true,
                            "dismissed": false,
                            // if we go with something like this, we'll need to use the right (light or dark) version
                            //"popupIconURL": //couldn't get a relative path to work, used absolute for screenshots "file:///pathtohere/icons/princeton_university_shield_light.png"
                        }
                    );

                },
                createSurveyPopup(url) {
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
                                var features = "chrome,";
                                features += "centerscreen,dependent,resizeable,location=1,scrollbars=1,status=1";
                                //privilegedEventEmitter.emitSurveyConsentAccept();
                                let window = currentWindow.open(url, "", features);
                                //let newlocation = "chrome://browser/content/aboutDialog.xhtml";
                                //let newlocation2 = "https://google.com";
                                window.location.assign(newlocation);
                                //currentWindow.alert(ww.openWindow);
                                //var win = ww.openWindow(null, "chrome://browser/content/aboutDialog.xhtml",
                                //"aboutMyExtension", "chrome,centerscreen", null);
                                //currentWindow.gBrowser.selectedBrowser.loadOneTab(url, {inBackground: false});
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
                        // temporary options
                        {
                            "persistence": 10,
                            "persistWhileVisible": true,
                            "dismissed": false,
                            // if we go with something like this, we'll need to use the right (light or dark) version
                            "popupIconURL": "chrome://popupnotifications/skin/mozlogo.png"
                        }
                    );

                },
                onSurveyConsentAccept: new EventManager({
                    context,
                    name: "privileged.onSurveyConsentAccept",
                    register: fire => {

                    const callback = () => {
                        fire.async();
                    };
                    RegisterSomeInternalCallback(callback);
                    return () => {
                        UnregisterInternalCallback(callback);
                    };
                    }
                }).api()
            }
        }
    }
  }