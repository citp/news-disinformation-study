ChromeUtils.import("resource://gre/modules/Console.jsm");
ChromeUtils.import("resource://gre/modules/Services.jsm");
ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");
ChromeUtils.import("resource://gre/modules/ExtensionCommon.jsm");
ChromeUtils.import("resource://gre/modules/ExtensionUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(
    this,
    "BrowserWindowTracker",
    "resource:///modules/BrowserWindowTracker.jsm",
);

this.privileged = class extends ExtensionAPI {
    getAPI(context) {
        return {
            privileged: {
                run() {
                    var currentWindow = BrowserWindowTracker.getTopWindow({
                        private: false,
                        allowPopups: false,
                    });

                    /*
                    // XUL appendNotification API
                    var notificationBox = currentWindow.gHighPriorityNotificationBox;

                    var notice = notificationBox.appendNotification(
                        "Firefox has partnered with researchers from Princeton University to study the health of the web. Learn how you can opt-in to participating.", // label
                        "uxmockup", // value
                        "", // image
                        notificationBox.PRIORITY_INFO_HIGH, // priority
                        // buttons
                        [
                          {
                            label: "Learn more",
                            isDefault: true,
                            callback: function () { }
                          },

                          {
                            label: "No thanks",
                            callback: function () { }
                          },
                        ]
                    );
                    */
                    
                    // PopupNotifications API
                    currentWindow.PopupNotifications.show(
                        currentWindow.gBrowser.selectedBrowser, // browser
                        "uxmockup-popup", // id
                        "Firefox has partnered with researchers from Princeton University to study the health of the web. Learn how you can opt-in to participating.", // message
                        null, // anchor id
                        { // main action
                            label: "Learn more",
                            accessKey: "1",
                            callback: function() { }
                        },

                        [ // secondary actions
                            {
                                label: "No thanks",
                                accessKey: "2",
                                callback: function() { }
                            }
                        ],
                        // temporary options
                        {
                            "persistence": 10,
                            "persistWhileVisible": true,
                            "dismissed": true
                        }
                    );
                    
                }
            }
        }
    }
  }