import { studyDomains } from "/study/newsDomains.js"
import { referrerDomains } from "/study/referrerDomains.js"
import { youtubeChannels } from "/study/newsYouTubeChannels.js";
import { facebookAccounts } from "/study/newsFacebookAccounts.js";
import { twitterHandles } from "/study/newsTwitterHandles.js";
import * as WebScience from "./WebScience.js"

WebScience.Utilities.Debugging.enableDebugging();
const debugLog = WebScience.Utilities.Debugging.getDebuggingLog("study");

async function runStudy() {
    debugLog("Beginning study");
    // Configure navigation collection
    WebScience.Measurements.PageNavigation.runStudy({
        domains: studyDomains,
        trackUserAttention: true
      });

    // Configure link exposure collection
    WebScience.Utilities.LinkResolution.initialize();
    WebScience.Measurements.LinkExposure.runStudy({
        domains: studyDomains,
        privateWindows : false,
    });

    // Configure social media sharing collection
    WebScience.Measurements.SocialMediaLinkSharing.runStudy({
        domains: studyDomains,
        facebook: true,
        twitter: true,
        reddit: true,
        privateWindows: false
    });

    WebScience.Measurements.PageDepth.runStudy({
        domains: studyDomains
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
                debugLog("Submitting results to Telemetry = " + JSON.stringify(data));
                browser.telemetry.submitEncryptedPing(data, options);
            }
        }
    });
    // Configure surveys (pending choices)
    
    WebScience.Utilities.UserSurvey.runStudy({
        surveyUrl: "https://qfreeaccountssjc1.az1.qualtrics.com/jfe/form/SV_0rnei0ZdDL45zZH"
    });
    
}
runStudy();
