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
                        "Message Content", // label
                        "uxmockup", // value
                        "", // image
                        notificationBox.PRIORITY_INFO_HIGH, // priority
                        // buttons
                        [
                          {
                            label: "Button 1",
                            isDefault: true,
                            callback: function () { }
                          },
                          {
                            label: "Button 2",
                            callback: function () { }
                          },
                        ]
                    );
                    */
                    
                    // PopupNotifications API
                    currentWindow.PopupNotifications.show(
                        currentWindow.gBrowser.selectedBrowser, // browser
                        "uxmockup-popup", // id
                        "Message Content", // message
                        null, // anchor id
                        { // main action
                            label: "Button 1",
                            accessKey: "1",
                            callback: function() { }
                        },
                        [ // secondary actions
                            {
                                label: "Button 2",
                                accessKey: "2",
                                callback: function() { }
                            }
                        ]
                    );
                    
                }
            }
        }
    }
  }