import { studyDomains } from "/study/newsDomains.js"
import { youtubeChannels } from "/study/newsYouTubeChannels.js";
import { facebookAccounts } from "/study/newsFacebookAccounts.js";
import { twitterHandles } from "/study/newsTwitterHandles.js";
import * as WebScience from "./WebScience.js"

WebScience.Utilities.Debugging.enableDebugging();
const debugLog = WebScience.Utilities.Debugging.getDebuggingLog("study");

/* These will be called depending on the consent setting for this study,
 *  in response to study events (e.g. stating the necessity of consent)
 *  and user actions (e.g. giving or revoking consent).
 */
WebScience.Utilities.Lifecycle.registerStudyStartedListener(runStudy);
WebScience.Utilities.Lifecycle.registerStudyEndedListener(stopStudy);

/* Will get consent, if necessary, and start the study when ready.
 */
WebScience.Utilities.Lifecycle.requestBegin();

function stopStudy() {
    // TODO -- send Telemetry message to delete remote data, and uninstall
    debugLog("Ending study");
}

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
    WebScience.Measurements.SocialMediaAccountExposure.runStudy({
        fbaccounts: facebookAccounts,
        ytchannels: youtubeChannels,
        twitterHandles : twitterHandles,
        privateWindows : false,
    });

    // Configure social media news exposure study
    WebScience.Measurements.SocialMediaNewsExposure.runStudy({
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
    
    // Configure data analysis
    WebScience.Utilities.DataAnalysis.runStudy({
        analysisTemplate : {
            path : "/WebScience/Measurements/AggregateStatistics.js",
            resultListener : (result) => {
                //debugLog("Listener received result = " + JSON.stringify(result));
                console.log("listener received result", result);

            }
        }
    });
    // Configure surveys (pending choices)
    
    WebScience.Utilities.UserSurvey.runStudy({
        surveyURLBase: "https://google.com/?query=",
        surveyTimeAfterInitialRun: 5000
    });
    
}
