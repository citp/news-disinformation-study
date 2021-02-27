/**
 * This module tests the match pattern implementation in the
 * WebScience.Utilities.Matching module. Adapted from the Firefox
 * match pattern tests.
 * @see {@link https://searchfox.org/mozilla-central/source/toolkit/components/extensions/test/xpcshell/test_MatchPattern.js}
 */

import * as Matching from "../WebScience/Utilities/Matching.js"

export function runTest() {
    function ok(test, failMessage) {
        let value = false;
        try {
            value = test();
        }
        catch(error) {
            console.debug(`Matching test failed (error thrown): ${failMessage} ${error}`);
        }
        if(!value)
            console.debug(`Matching test failed: ${failMessage}`);
    }

    function testMatchPatternSet(url, patterns) {
        const matchPatternSet = new Matching.MatchPatternSet(patterns);
        return matchPatternSet.matches(url);
    }

    function testRegExp(url, patterns) {
        const matchPatternRegExp = Matching.matchPatternsToRegExp(patterns);
        return matchPatternRegExp.test(url);
    }

    function pass({ url, patterns }) {
        ok(
            () => { return testMatchPatternSet(url, patterns); },
            `Expected MatchPatternSet match: ${JSON.stringify(patterns)}, ${url}`
        );
        ok(
            () => { return testRegExp(url, patterns); },
            `Expected match pattern RegExp match: ${JSON.stringify(patterns)}, ${url}`
        );
    }

    function fail({ url, patterns }) {
        ok(
            () => { return !testMatchPatternSet(url, patterns); },
            `Expected no MatchPatternSet match: ${JSON.stringify(patterns)}, ${url}`
        );
        ok(
            () => { return !testRegExp(url, patterns); },
            `Expected no match pattern RegExp match: ${JSON.stringify(patterns)}, ${url}`
        );
    }

    function invalid({ patterns }) {
        let errorThrownForMatchPatternSet = false;
        try {
            new Matching.MatchPatternSet(patterns);
        }
        catch(error) {
            errorThrownForMatchPatternSet = true;
        }
        ok(
            () => {return errorThrownForMatchPatternSet; },
            `Invalid pattern '${patterns}' should throw in MatchPatternSet creation`
        );
        let errorThrownForRegExp = false;
        try {
            Matching.matchPatternsToRegExp(patterns);
        }
        catch(error) {
            errorThrownForRegExp = true;
        }
        ok(
            () => { return errorThrownForRegExp; },
            `Invalid pattern '${patterns}' should throw in match pattern RegExp creation`
        );
    }

    // Invalid pattern.
    invalid({ patterns: [ "" ] });

    // Pattern must include trailing slash.
    invalid({ patterns: [ "http://mozilla.org" ] });

    // Protocol not allowed.
    invalid({ patterns: [ "gopher://wuarchive.wustl.edu/" ] });

    pass({ url: "http://mozilla.org", patterns: [ "http://mozilla.org/" ]});
    pass({ url: "http://mozilla.org/", patterns: [ "http://mozilla.org/" ]});

    pass({ url: "http://mozilla.org/", patterns: [ "*://mozilla.org/" ] });
    pass({ url: "https://mozilla.org/", patterns: [ "*://mozilla.org/" ] });
    fail({ url: "file://mozilla.org/", patterns: [ "*://mozilla.org/" ] });
    fail({ url: "ftp://mozilla.org/", patterns: [ "*://mozilla.org/" ] });

    // Disabled because these aren't valid match patterns
    //fail({ url: "http://mozilla.com", patterns: [ "http://*mozilla.com*/" ] });
    //fail({ url: "http://mozilla.com", patterns: [ "http://mozilla.*/" ] });
    invalid({ patterns: [ "http:/mozilla.com/" ] });

    pass({ url: "http://google.com", patterns: [ "http://*.google.com/" ] });
    pass({ url: "http://docs.google.com", patterns: [ "http://*.google.com/" ] });

    pass({ url: "http://mozilla.org:8080", patterns: [ "http://mozilla.org/" ] });
    pass({ url: "http://mozilla.org:8080", patterns: [ "*://mozilla.org/" ] });
    // Disabled because, while the Firefox implementation ignores an invalid match pattern
    // with a port specified we throw an error
    //fail({ url: "http://mozilla.org:8080", patterns: [ "http://mozilla.org:8080/" ] });

    // Now try with * in the path.
    pass({ url: "http://mozilla.org", patterns: [ "http://mozilla.org/*" ] });
    pass({ url: "http://mozilla.org/", patterns: [ "http://mozilla.org/*" ] });

    pass({ url: "http://mozilla.org/", patterns: [ "*://mozilla.org/*" ] });
    pass({ url: "https://mozilla.org/", patterns: [ "*://mozilla.org/*" ] });
    fail({ url: "file://mozilla.org/", patterns: [ "*://mozilla.org/*" ] });
    // Disabled because this is not a valid match pattern
    //fail({ url: "http://mozilla.com", patterns: [ "http://mozilla.*/*" ] });

    pass({ url: "http://google.com", patterns: [ "http://*.google.com/*" ] });
    pass({ url: "http://docs.google.com", patterns: [ "http://*.google.com/*" ] });

    // Check path stuff.
    fail({ url: "http://mozilla.com/abc/def", patterns: [ "http://mozilla.com/" ] });
    pass({ url: "http://mozilla.com/abc/def", patterns: [ "http://mozilla.com/*" ] });
    pass({
        url: "http://mozilla.com/abc/def",
        patterns: [ "http://mozilla.com/a*f" ],
    });
    pass({ url: "http://mozilla.com/abc/def", patterns: [ "http://mozilla.com/a*" ] });
    pass({ url: "http://mozilla.com/abc/def", patterns: [ "http://mozilla.com/*f" ] });
    fail({ url: "http://mozilla.com/abc/def", patterns: [ "http://mozilla.com/*e" ] });
    fail({ url: "http://mozilla.com/abc/def", patterns: [ "http://mozilla.com/*c" ] });

    invalid({ patterns: [ "http:///a.html" ] });
    pass({ url: "file:///foo", patterns: [ "file:///foo*" ] });
    pass({ url: "file:///foo/bar.html", patterns: [ "file:///foo*" ] });

    pass({ url: "http://mozilla.org/a", patterns: [ "<all_urls>" ] });
    pass({ url: "https://mozilla.org/a", patterns: [ "<all_urls>" ] });
    pass({ url: "ftp://mozilla.org/a", patterns: [ "<all_urls>" ] });
    pass({ url: "file:///a", patterns: [ "<all_urls>" ] });
    fail({ url: "gopher://wuarchive.wustl.edu/a", patterns: [ "<all_urls>" ] });

    // Multiple patterns.
    pass({ url: "http://mozilla.org", patterns: ["http://mozilla.org/"] });
    pass({
        url: "http://mozilla.org",
        patterns: ["http://mozilla.org/", "http://mozilla.com/"],
    });
    pass({
        url: "http://mozilla.com",
        patterns: ["http://mozilla.org/", "http://mozilla.com/"],
    });
    fail({
        url: "http://mozilla.biz",
        patterns: ["http://mozilla.org/", "http://mozilla.com/"],
    });

    // Match url with fragments.
    pass({
        url: "http://mozilla.org/base#some-fragment",
        patterns: [ "http://mozilla.org/base" ],
    });

    // Match data:-URLs.
    pass({ url: "data:text/plain,foo", patterns: ["data:text/plain,foo"] });
    pass({ url: "data:text/plain,foo", patterns: ["data:text/plain,*"] });
    pass({
        url: "data:text/plain;charset=utf-8,foo",
        patterns: ["data:text/plain;charset=utf-8,foo"],
    });
    fail({
        url: "data:text/plain,foo",
        patterns: ["data:text/plain;charset=utf-8,foo"],
    });
    fail({
        url: "data:text/plain;charset=utf-8,foo",
        patterns: ["data:text/plain,foo"],
    });

    // Matchers for schemes without host should ignore ignorePath.
    pass({ url: "data:,", patterns: ["data:,*"], options: { ignorePath: true } });

    // Matchers for schems without host should still match even if the explicit (host) flag is set.
    pass({ url: "data:,explicit", patterns: ["data:,explicit"], explicit: true });
    pass({ url: "data:,explicit", patterns: ["data:,*"], explicit: true });

    // Matchers without "//" separator in the pattern.
    pass({ url: "data:text/plain;charset=utf-8,foo", patterns: ["data:*"] });
    invalid({ patterns: [ "http:*" ] });

    // Matchers for unrecognized schemes.
    invalid({ patterns: [ "unknown-scheme:*" ] });

    // Matchers for IPv6
    pass({ url: "http://[::1]/", patterns: ["http://[::1]/"] });
    pass({
        url: "http://[2a03:4000:6:310e:216:3eff:fe53:99b]/",
        patterns: ["http://[2a03:4000:6:310e:216:3eff:fe53:99b]/"],
    });
    fail({
        url: "http://[2:4:6:3:2:3:f:b]/",
        patterns: ["http://[2a03:4000:6:310e:216:3eff:fe53:99b]/"],
    });
}
