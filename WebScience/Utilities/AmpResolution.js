// Utility to resolve amp urls
const cacheDomains = ["cdn.ampproject.org", "amp.cloudflare.com", "bing-amp.com", "guardian.com"];
const domRegex = /.*?\/{1,2}(.*?)(\.).*/gm;

/**
 * Get the encoded domain (part of url between the last / and the first .)
 * @param {string} url 
 */
function getDomainPrefix(url) {
    let match = domRegex.exec(url);
    if (match != null) {
        return match[1];
    }
    return null;
}
/**
 * Function to get publisher domain and actual url from a amp link
 * @param {string} url amp url
 */
function resolveAmpUrl(url) {
    // 1. check if url contains any of the cacheDomains
    for (let i = 0; i < cacheDomains.length; i++) {
        let domain = cacheDomains[i];
        // Does the url contain domain
        if (url.includes(domain)) {
            // extract the domain prefix by removing protocol and cache domain suffix
            let domainPrefix = getDomainPrefix(url);
            if (domainPrefix != null) {
                // replace - with . and -- with a -
                let domain = domainPrefix.replace("-", ".");
                domain = domain.replace("--", "-");
                return domain;
            }
        }
    }
    return null;
}