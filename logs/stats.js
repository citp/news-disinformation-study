'use strict';

const _MS_PER_DAY = 1000 * 60 * 60 * 24;
const fs = require('fs');
const _MAX_DATE = 8640000000000000;

let rawdata = fs.readFileSync('./logs/linkexposure.json');
let linkexposureobj = JSON.parse(rawdata);

// a and b are javascript Date objects
function utcDateDiffInDays(utc1, utc2) {
    return Math.floor((utc2 - utc1) / _MS_PER_DAY);
}

function getHostName(url) {
    var match = url.match(/:\/\/(www[0-9]?\.)?(.[^/:]+)/i);
    if (match != null && match.length > 2 && typeof match[2] === 'string' && match[2].length > 0) {
        return match[2];
    }
    else {
        return null;
    }
}
function getDomain(url) {
    var hostName = getHostName(url);
    var domain = hostName;

    if (hostName != null) {
        var parts = hostName.split('.').reverse();

        if (parts != null && parts.length > 1) {
            domain = parts[1] + '.' + parts[0];
        }
    }

    return domain;
}


function Counter(array) {
    array.forEach(val => this[val] = (this[val] || 0) + 1);
}

function defaultDict(createValue = () => {return 0}) {
    return new Proxy(Object.create(null), {
        get : (obj, property) => (property in obj) ? obj[property] : createValue()
    });
}


function processCounts(counter, itemFunction = (key, val) => {console.log({key, val})}){
    Object.keys(counter).forEach(key => {
        itemFunction(key, counter[key]);
    })

}
function linkexposurestats(obj) {
    let stats = {};
    stats.source_domains = defaultDict();
    stats.source_domains_category = defaultDict();
    stats.source_urls = defaultDict();
    stats.exposed_domains = defaultDict();
    stats.exposed_urls = defaultDict();
    stats.source_first_seen = defaultDict(() => { return new Date(_MAX_DATE); });
    Object.keys(obj).forEach(key => {
        let val = obj[key];
        if ('metadata' in val) {
            if ('location' in val.metadata) {
                let source_domain = getDomain(val.metadata.location);
                stats.source_domains[source_domain] += 1;
                stats.source_urls[val.metadata.location] += 1;
            }
            if ('domainCategory' in val.metadata) {
                stats.source_domains_category[val.metadata.domainCategory] += 1;
            }
            if ('loadTime' in val.metadata) {
                stats.source_first_seen[val.metadata.location] = Math.min(stats.source_first_seen[val.metadata.location], new Date(val.metadata.loadTime));
            }
        }
        let exposedURL = val.resolvedUrl ? 'resolvedUrl' in val : val.originalUrl;
        let exposedDomain = getDomain(exposedURL);
        stats.exposed_domains[exposedDomain] += 1;
        stats.exposed_urls[exposedURL] += 1;
    });
    Object.entries(stats).forEach(entry => {
        console.log("-------------" + entry[0]);
        processCounts(entry[1]);
    })
    //stats.map((x) => processCounts(x));
    // filter entries within the last 7 days
    /*let current = new Date(Date.now());
    Object.keys(obj).forEach(key => {
        let val = obj[key];
        console.log(val);
    })
    let exposedDomains = Object.keys(obj).filter(
        function(key) {
            let val = obj[key];
            let firstSeen = new Date(val.firstSeen);
            return dateDiffInDays(firstSeen, current) < 7;
        }
    ).map(function(key) {
        return getDomain(obj[key].originalUrl);
    });
    let exposureCounts = new Counter(exposedDomains);
    console.log(exposureCounts);*/
}

linkexposurestats(linkexposureobj);