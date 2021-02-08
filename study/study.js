import "webextension-polyfill";
import * as WebScience from "./WebScience.js"
import Rally from "@mozilla/rally";

const version = "1.2"; // sync with manifest
WebScience.Utilities.Debugging.enableDebugging();
const debugLog = WebScience.Utilities.Debugging.getDebuggingLog("study");

async function runStudy() {
    debugLog("Beginning study");

    var studyPaths = WebScience.Utilities.Matching.getStudyPaths();

    // Configure navigation collection
    WebScience.Measurements.PageNavigation.runStudy({
        domains: studyPaths.destinationPaths,
        trackUserAttention: true
      });

    // Configure link exposure collection
    WebScience.Utilities.LinkResolution.initialize();
    WebScience.Measurements.LinkExposure.runStudy({
        domains: studyPaths.destinationPaths,
        privateWindows : false,
    });

    // Configure social media sharing collection
    WebScience.Measurements.SocialMediaLinkSharing.runStudy({
        domains: studyPaths.destinationPaths,
        facebook: true,
        twitter: true,
        reddit: true,
        privateWindows: false
    });

    WebScience.Measurements.PageDepth.runStudy({
        domains: studyPaths.destinationPaths,
    });
    

    // Configure data analysis
    const options = { schemaName: "measurements", schemaVersion: 1 };
    WebScience.Utilities.DataAnalysis.runStudy({

        analysisTemplate : {
            path : "/WebScience/Measurements/AggregateStatistics.js",
            resultListener : async (result) => {
                var data = {};
                var pageNav = result["WebScience.Measurements.PageNavigation"];
                var linkExp = result["WebScience.Measurements.LinkExposure"];
                var linkSharing = result["WebScience.Measurements.SocialMediaLinkSharing"];
                data["WebScience.Measurements.PageNavigation"] = pageNav ? pageNav : {};
                data["WebScience.Measurements.LinkExposure"] = linkExp ? linkExp : {};
                data["WebScience.Measurements.SocialMediaLinkSharing"] = linkSharing ? linkSharing : {};
                data["WebScience.SurveyId"] = await WebScience.Utilities.UserSurvey.getSurveyId();
                data["WebScience.version"] = version;
                debugLog("Submitting results to Telemetry = " + JSON.stringify(data));
                browser.telemetry.submitEncryptedPing(data, options);
            }
        }
    }, studyPaths);

    // Configure surveys (pending choices)
    WebScience.Utilities.UserSurvey.runStudy({
        surveyUrl: "https://citpsurveys.cs.princeton.edu/polInfoSurvey"
    });
    
}

const rally = new Rally();
rally.initialize(
  "citp-news-disinfo",
  {
    "crv": "P-256",
    "kty": "EC",
    "x": "LDByX3lSRSU624OfR9EMO3So_0uRt2sNCVzPdQUKbrY",
    "y": "4Qu2FsVM8834l0GJG2ZA0JyJlX5Oe83jV54PZNyCSCA"
  },
  // The following constant is automatically provided by
  // the build system.
  __ENABLE_DEVELOPER_MODE__,
).then(resolve => {
  WebScience.Utilities.Consent.runStudy(runStudy);
}, reject =>{
  // Do not start the study in this case. Something
  // went wrong.
});
