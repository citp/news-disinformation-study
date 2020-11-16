import * as WebScience from "./WebScience.js"

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
                console.log(data);
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
WebScience.Utilities.Consent.runStudy(runStudy);
