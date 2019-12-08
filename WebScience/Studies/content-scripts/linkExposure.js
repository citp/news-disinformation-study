// Function encapsulation to maintain unique variable scope for each content script
(
  function() {
    /**
     * updateInterval (number of milliseconds) is the interval at which we look for new links that users
     * are exposed to in known domains
     */
    let updateInterval = 2000;
    linkExposure();
    /**
     *main function that looks for exposure to known domains. For known short urls, it uses LinkResolution 
     *utility to get the actual url and checks for the presence of a known domain
    */
  function linkExposure() {
  // Save the time the page initially completed loading
  let initialLoadTime = Date.now();
  let initialVisibility = document.visibilityState == "visible";

  /**
   * function to test if a visiable DOM element matches the given reg exp
   * @param {RegExp} matcher regular expression matcher
   * @param {string} link url
   * @param {Element} element DOM element
   */
  function testForMatch(matcher, link, element=null) {
    // if element is not null check if its in the viewport
    return (element == null || isElementInViewport(element)) && matcher.test(link);
  }

    /**
     * Helper function to test if DOM element is in viewport
     * @param {Element} el element
     */
  function isElementInViewport (el) {
    let rect = el.getBoundingClientRect();
    return (
        rect.top > 0 && // should this be strictly greater ? With >= invisible links have 0,0,0,0 in bounding rect
        rect.left > 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }

    /**
     * Helper function to get size of element
     * @param {Element} el element
     */
    function getElementSize(el) {
      let rect = el.getBoundingClientRect();
      return {
        width: rect.right - rect.left,
        height: rect.bottom - rect.top
      };
    }

    /**
     * function to get links to known short url domains
     * @param {NodeList} aElements NodeList of <a> elements
     */
    function getShortLinks(aElements) {
      return Array.filter(Array.from(aElements), (ele) => { return testForMatch(shortURLMatcher, ele.href, ele); }).map((x) => { return { href: x.href } });
    }

    /**
     * function to get links to domains of interest (domains in the study)
     * @param {NodeList} aElements NodeList of <a> elements
     */
    function getDomainMatches(aElements) {
      return Array.filter(Array.from(aElements), (ele) => { return testForMatch(urlMatcher, ele.href, ele); }).map((x) => { return { href: x.href, size: getElementSize(x) } });
    }

    /**
     * Helper function to send data to background script
     * @param {string} type message type
     * @param {Object} data data to send
     */
    function sendMessageToBackground(type, data) {
      if(data.length > 0) {
        browser.runtime.sendMessage({
          type: type,
          content: {
            loadTime: initialLoadTime,
            visible: initialVisibility,
            url: document.location.href,
            referrer: document.referrer,
            links: data,
          }
        });
      }
    }

    /**
     * Get link size
     * 
     * For short urls that are resolved to domains of interest, get the link size.
     * @param {Array} links array of resolved urls
     * @param {string} links[].init short url
     * @param {string} links[].href resolved url
     */
    function getLinkSize(links) {
      // create an object with key = init and value is resolved url
      let resolvedUrlsByPageUrls = {};
      links.forEach((key, i) => resolvedUrlsByPageUrls[key.init] = key.href);
      let query = links.map(x => { return ["a[href='", x.init, "']"].join("");}).join(",");
      let elements = document.body.querySelectorAll(query);
      let data = Array.from(elements).map(x => {
        return {href: resolvedUrlsByPageUrls[x.href], size: getElementSize(x)}
      });
      return data;
    }

    /**
     * Function to look for new <a> elements in the viewport, tests for matches to study domains and short domains.
     * The matched urls are sent to background script
     */
  function matchLinks() {
    /*
    Filter for elements that haven't been visited previously and that are currently in viewport
    Use isVisited attribute to track elements that have been visited
    */
    let aElements = Array.filter(document.body.querySelectorAll("a[href]"), (x) => x.isVisited == null && isElementInViewport(x)).map((x) => {
      x.isVisited = true;
      return x;
    })
    let matchingLinks = getDomainMatches(aElements);
    let shortLinks = getShortLinks(aElements);

    // send matched short links to background script for resolution
    sendMessageToBackground("WebScience.shortLinks", shortLinks);
    // send exposed links to background script for storage
    sendMessageToBackground("WebScience.linkExposureInitial", matchingLinks);
  }

  // call update every 2 seconds
  setInterval(matchLinks, updateInterval);

    browser.runtime.onMessage.addListener((data, sender) => {
      console.log("Message from the background script:");
      console.log(data.links);
      // get domain matching links from texpanded links
      let newlinks = Array.from(data.links).map(x => { return { href: x.v[x.v.length - 1], init: x.v[0] } }).filter(link => testForMatch(urlMatcher, link.href));
      // send the new filtered links to background script for storage
      sendMessageToBackground("WebScience.linkExposureInitial", getLinkSize(newlinks));
      return Promise.resolve({ response: "received messages" });
    });
  }
}
)();