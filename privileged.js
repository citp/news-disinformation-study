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

                    // XUL appendNotification API
                    var notificationBox = currentWindow.gHighPriorityNotificationBox;

                    var notice = notificationBox.appendNotification(
                        "Firefox has partnered with researchers from Princeton University to study the health of the web. Learn how you can opt in to participating.", // label
                        "uxmockup", // value
                        null, //couldn't get a relative path to work, used absolute for screenshots "file:///pathtohereicons/princeton_university_shield.svg", // image
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
                    
                    /*
                    // PopupNotifications API
                    currentWindow.PopupNotifications.show(
                        currentWindow.gBrowser.selectedBrowser, // browser
                        "uxmockup-popup", // id
                        "Firefox has partnered with researchers from Princeton University to study the health of the web. Learn how you can opt in to participating.", // message
                        null, // anchor id
                        { // main action
                            label: "Learn more", // add a \t at the end here...
                            accessKey: "L",      // ...and a \t replacing the L here to have no underlined character
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
                            "dismissed": true,
                            // if we go with something like this, we'll need to use the right (light or dark) version
                            //"popupIconURL": //couldn't get a relative path to work, used absolute for screenshots "file:///pathtohere/icons/princeton_university_shield_light.png"
                        }
                    );
                    */

                }
            }
        }
    }
  }