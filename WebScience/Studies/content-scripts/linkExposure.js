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
    // configure the intersection observer instance
    var intersectionObserverOptions = {
      root: null,
      rootMargin: '0px',
      threshold: 1.0
    };
    var observer = new IntersectionObserver(onIntersection, intersectionObserverOptions);
    function onIntersection(entries){
      entries.forEach(entry => {
        entry.target.classList.toggle('visible', entry.intersectionRatio > 0);
        // Are we in viewport?
        if (entry.intersectionRatio > 0) {
          // check if the target is short url
          if(testForMatch(shortURLMatcher, entry.target.href)) {
              sendMessageToBackground("WebScience.shortLinks", [{href: entry.target.href}]);
          }
          // check for domain matching
          if(testForMatch(urlMatcher, entry.target.href)) {
              sendMessageToBackground("WebScience.linkExposureInitial", [{href: entry.target.href, size: getElementSize(entry.target)}]);
          }
          // Stop watching the target
          observer.unobserve(entry.target);
        }
      });
    }

  // Save the time the page initially completed loading
  let initialLoadTime = Date.now();
  let initialVisibility = document.visibilityState == "visible";

  /**
   * function to test if a visiable DOM element matches the given reg exp
   * @param {RegExp} matcher regular expression matcher
   * @param {string} link url
   * @param {Element} element DOM element
   */
  function testForMatch(matcher, link) {
    // if element is not null check if its in the viewport
    return matcher.test(link);
  }

    /**
     * Helper function to get size of element
     * @param {Element} el element
     */
    function getElementSize(el) {
      let rect = el.getBoundingClientRect();
      return {
        width: rect.right - rect.left,
        height: rect.bottom - rect.top,
        rect: rect
      };
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
     * @param {string} link url on the page
     */
    function getLinkSize(link) {
      // create an object with key = init and value is resolved url
      let query = "a[href='"+link+"']";
      let elements = document.body.querySelectorAll(query);
      return (elements.length > 0 ? getElementSize(elements[0]) : null);
    }

    /**
     * Function to look for new <a> elements in the viewport, tests for matches to study domains and short domains.
     * The matched urls are sent to background script
     */
  function matchLinks() {
    /*
    Filter for elements that haven't been visited previously and observe them with intersection observer
    Use isVisited attribute to track elements that have been visited
    */
   let aElements = Array.from(document.body.querySelectorAll("a[href")).filter(link => link.isVisited == null).map(
     element => {
       observer.observe(element);
       element.isVisited = true;
       return element;
     }
   );
  }

  // call update every 2 seconds
  setInterval(matchLinks, updateInterval);
    browser.runtime.onMessage.addListener((data, sender) => {
      let dest = data.dest;
      let source = data.source;
      if(testForMatch(urlMatcher, dest)) {
        // get source size
        let sz = getLinkSize(source);
        let data = [{href: dest, size: sz}];
        sendMessageToBackground("WebScience.linkExposureInitial", data);
      }
      return Promise.resolve({ response: "received messages" });
    });
  }
}
)();