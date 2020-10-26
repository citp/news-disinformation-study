import { studyDomains } from "/study/newsDomains.js"
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

    // Configure social media account exposure study
    /*
    WebScience.Measurements.SocialMediaAccountExposure.runStudy({
        fbaccounts: facebookAccounts,
        ytchannels: youtubeChannels,
        twitterHandles : twitterHandles,
        privateWindows : false,
    });
    */

    // Configure social media news exposure study
    /*
    WebScience.Measurements.SocialMediaNewsExposure.runStudy({
        privateWindows : false,
    });
    */

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
    WebScience.Utilities.DataAnalysis.runStudy({
        analysisTemplate : {
            path : "/WebScience/Measurements/AggregateStatistics.js",
            resultListener : (result) => {
                browser.telemetry.submitEncryptedPing(result.data);
                debugLog("Listener received result = " + JSON.stringify(result));
            }
        }
    });
    // Configure surveys (pending choices)
    
    WebScience.Utilities.UserSurvey.runStudy({
        surveyURLBase: "https://google.com/?query=",
        surveyTimeAfterInitialRun: 5000
    });
    
}
runStudy();
