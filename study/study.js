import "webextension-polyfill";
import * as WebScience from "./WebScience.js"
import Rally from "@mozilla/rally";
import * as EventHandling from "./EventHandling.js"

WebScience.Utilities.Debugging.enableDebugging();
const debugLog = WebScience.Utilities.Debugging.getDebuggingLog("study");

/*
(async function test() {
    const storage = new WebScience.Utilities.Storage.KeyValueStorage("3test storage");
    console.log(storage);
    await storage.set("testkey2", 3);
    console.log(await storage.get("testkey2"));
    const mystorage = new WebScience.Utilities.Storage.KeyValueStorage("3new test storage", ["mystore"]);
    await mystorage.set("testkey", 42);
    console.log(await mystorage.get("testkey"));
    await mystorage.set("testkeu2", 53, "mystore");
    console.log(await mystorage.get("testkeu2"));

    const mystorage5 = new WebScience.Utilities.Storage.KeyValueStorage("3new new test storage", ["mystore3", "mystore4", "mystore5"]);
    await mystorage5.set("key3", "value3", "mystore3");
    await mystorage5.set("key4", "value4", "mystore4");
    await mystorage5.set("key5", "value5", "mystore5");
    await mystorage5.set("key6", "value6");
    console.log(
        await mystorage5.get("key3", "mystore3"),
        await mystorage5.get("key4", "mystore4"),
        await mystorage5.get("key5", "mystore5"),
        await mystorage5.get("key6"));
    console.log(await mystorage5.getContentsAsObject());

    const dbstore = new WebScience.Utilities.Storage.IndexedStorage("2test1", {"test1def": "a"});
    await dbstore.set({"a": 1, "b": 2});
    console.log(await dbstore.get({"a": 1}, "test1def"));

})();
*/

async function runStudy() {
    debugLog("Beginning study");

    await EventHandling.startStudy();

    // Configure navigation collection
    /*
    EventHandling.startPageNavigationMeasurement({
        matchPatterns: destinationMatchPatterns,
        trackUserAttention: true
    });
    */

    // Configure link exposure collection
    //WebScience.Utilities.LinkResolution.initialize();
    /*
    EventHandling.startLinkExposureMeasurement({
        matchPatterns: destinationMatchPatterns,
        privateWindows : false,
    });
    */

    // Configure social media sharing collection
    /*
    EventHandling.startSMLSMeasurement({
        domains: studyPaths.destinationPaths,
        facebook: true,
        twitter: true,
        reddit: true
    });
    */

    // Configure data analysis
    //const options = { schemaName: "measurements", schemaVersion: 1 };
    /*
    WebScience.Utilities.DataAnalysis.runStudy({

        analysisTemplate : {
            path : "/WebScience/Measurements/AggregateStatistics.js",
            resultListener : async (result) => {
                const data = {};
                const pageNav = result["NewsAndDisinfo.Measurements.PageNavigation"];
                const linkExp = result["NewsAndDisinfo.Measurements.LinkExposure"];
                const linkSharing = result["NewsAndDisinfo.Measurements.SocialMediaLinkSharing"];
                data["WebScience.Measurements.PageNavigation"] = pageNav ? pageNav : {};
                data["WebScience.Measurements.LinkExposure"] = linkExp ? linkExp : {};
                data["WebScience.Measurements.SocialMediaLinkSharing"] = linkSharing ? linkSharing : {};
                data["WebScience.SurveyId"] = await WebScience.Utilities.UserSurvey.getSurveyId();
                data["WebScience.version"] = WebScience.Utilities.Debugging.getExtensionVersion();
                debugLog("Submitting results to Telemetry = " + JSON.stringify(data));
                browser.telemetry.submitEncryptedPing(data, options);
            }
        }
    }, studyPaths);
    */

    WebScience.Utilities.UserSurvey.runStudy({
        surveyUrl: "https://citpsurveys.cs.princeton.edu/rallyPolInfoSurvey"
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
