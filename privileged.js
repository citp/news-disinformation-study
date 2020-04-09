ChromeUtils.import("resource://gre/modules/Console.jsm");
ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");
ChromeUtils.import("resource://gre/modules/ExtensionCommon.jsm");
ChromeUtils.import("resource://gre/modules/ExtensionUtils.jsm");

var {Services} = ChromeUtils.import("resource://gre/modules/Services.jsm");
// load utilityOverlay module for openLinkIn
Services.scriptloader.loadSubScript("chrome://browser/content/utilityOverlay.js", this);

XPCOMUtils.defineLazyModuleGetter(
    this,
    "BrowserWindowTracker",
    "resource:///modules/BrowserWindowTracker.jsm",
);

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
                                features += "centerscreen,dependent,dialog=no";
                                currentWindow.openDialog(url, "", features);
                            //var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                            //.getService(Components.interfaces.nsIWindowMediator);
                            //currentWindow.alert(wm.getMostRecentWindow("navigator:browser"));
                            //var recentWindow = wm.getMostRecentWindow("navigator:browser");
                            //var newTabBrowser = currentWindow.gBrowser.getBrowserForTab(currentWindow.gBrowser.addTab("http://www.google.com/"));
                            //currentWindow.alert(currentWindow.gBrowser.loadOneTab);
                            //let uriObj = Services.io.newURI(url, null, null);
                            //currentWindow.alert(currentWindow.gBrowser.currentURI.spec);
                            //var features = "chrome,";
                            //features += "centerscreen,dependent,dialog=no";
                        
                            //currentWindow.openDialog("chrome://browser/content/aboutDialog.xhtml",
                            //"", features);
                            //currentWindow.openDialog("chrome://browser/content/aboutDialog.xhtml", url, features);
                            //currentWindow.alert(openAboutDialog);
                            //currentWindow.gBrowser.loadOneTab(url);
                            //openLinkIn(url, "tabshifted");
                            //currentWindow.gBrowser.removeCurrentTab();
                            //currentWindow.alert(recentWindow.gBrowser.addTab("http://www.google.com/"));
                                        //currentWindow.gBrowser.removeCurrentTab();
                                        // Create new tab, but don't load the content.
                                //var url = "https://developer.mozilla.org";
                                //var tab = currentWindow.gBrowser.addTab(null, {relatedToCurrent: true});
                                /*gSessionStore.setTabState(tab, JSON.stringify({
                                entries: [
                                    { title: url }
                                ],
                                userTypedValue: url,
                                userTypedClear: 2,
                                lastAccessed: tab.lastAccessed,
                                index: 1,
                                hidden: false,
                                attributes: {},
                                image: null
                                }));*/
                                //currentWindow.gBrowser.tabContainer.advanceSelectedTab(1, true);
                                /*
                                NOTE :
                                https://developer.mozilla.org/en-US/docs/Archive/Mozilla/XUL/tabbrowser
                                
                                Note: Starting in Firefox 3 (XULRunner/Gecko
                                1.9), this is only used in the main Firefox
                                window
                                and cannot be used in other XUL windows by third-party applications or extensions.
                                */

                                //currentWindow.alert(url);
                                //currentWindow.maximize();
                                //currentWindow.alert(url);
                                //let uriObj = ios.newURI(url, null, null);
                                //currentWindow.alert(uriObj);
                                //var WindowMediator = Components
                                //.classes['@mozilla.org/appshell/window-mediator;1']
                                //.getService(Components.interfaces.nsIWindowMediator);
                                //var browser = WindowMediator.getMostRecentWindow(null);
                                //currentWindow.gBrowser._tabs[0].update({url: "https://developer.mozilla.org"});
                                //browser.gBrowser.reloadTab();
                                //browser.gBrowser.addTab("https://google.com");
                                //currentWindow.alert(context.innerWindowId);
                                //currentWindow.alert(browser.gBrowser.currentURI);
                                //currentWindow.gBrowser.loadURI('http://www.gihyo.co.jp/magazines/SD', referrer);
                                //obj.create("https://google.com");
                                //currentWindow.alert(referrer);
                                //currentWindow.gBrowser.addTab("http://www.google.com/");
                                //currentWindow.alert(currentWindow.gBrowser.constructor);
                             }
                        },
                        [ // secondary actions
                            {
                                label: "No thanks",
                                accessKey: "N",
                                callback: function () { 
                                    currentWindow.alert("No thanks");
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

                }
            }
        }
    }
  }