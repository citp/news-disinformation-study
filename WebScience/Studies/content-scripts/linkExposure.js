// Function encapsulation to maintain unique variable scope for each content script
(
  function() {
    /**
     * updateInterval (number of milliseconds) is the interval at which we look for new links that users
     * are exposed to in known domains
     */
    let updateInterval = 2000;
    linkExposure();

  function linkExposure() {

    // Save the time the page initially completed loading
    let initialLoadTime = Date.now();
    const isDocVisible = () => document.visibilityState === "visible";
    let initialVisibility = document.visibilityState == "visible";
    
    // Elements that we've checked for link exposure
    let checkedElements = new Set();

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
     * Function takes an <a> element, test it for matches with link shorteners or domains of interest and
     * sends it to background script for resolution/storage
     * @param {DOMElement} element element to match for short links or domains of interest
     */
    function matchElement(element) {
      let url = rel_to_abs(element.href);
      url = removeShim(url);
      let res = resolveAmpUrl(url);
      if(res.length > 0) {
        url = rel_to_abs(res[1]);
      }
      if (shortURLMatcher.test(url)) {
        sendMessageToBackground("WebScience.shortLinks", [{ href: url }]);
      }
      // check for domain matching
      if (urlMatcher.test(url)) {
        sendMessageToBackground("WebScience.linkExposure", [{ href: url, size: getElementSize(element) }]);
      }
    }

    /**
     * Function to look for new <a> elements that are in viewport
     */
    function observeChanges() {
      // check the visibility state of document
      if(!isDocVisible()) {
        return;
      }
      // Filter for elements that haven't been visited previously and observe them with intersection observer
      let count = 0;
      Array.from(document.body.querySelectorAll("a[href]")).filter(link => !checkedElements.has(link)).forEach(element => {
        //observeElement(element, 0.0).then(matchElement);
        let inView = isElementInViewport(element);
        if(inView) {
          checkedElements.add(element);
          matchElement(element);
          count++;
        }
      });
      return count;
    }

    /**
     * UpdateHandler class to observe the document for changes in specified time
     * intervals. It also stores the number of changes in the last ncalls.
     * 
     */
    class UpdateHandler {
      /**
       * 
       * @param {int} updateInterval number of milliseconds between updates
       * @param {int} numUpdates maximum number of updates. ** Negative number implies function doesn't stop
       * @param {int} nrecords maximum number of results stored
       */
      constructor(updateInterval, numUpdates, nrecords=10) {
        this.updateInterval = updateInterval;
        this.numUpdates = numUpdates;
        this.count = 0;
        this.nlinks = [];
        this.nrecords = nrecords;
      }
      start() {
        this.timer = setInterval(() => this.run(), this.updateInterval);
      }
      stop() {
        if(this.timer) clearInterval(this.timer);
      }
      /**
       * run function stops timer if it reached max number of updates
       * Otherwise, we look for changes in the document by invoking
       * observeChanges function
       */
      run() {
        if(this.numUpdates > 0 && this.count >= this.numUpdates) {
          this.stop();
        }
        let nchanges = observeChanges();
        if (this.nlinks.length >= this.nrecords) {
          this.nlinks.shift();
        }
        this.nlinks.push(nchanges);
        this.count++;
      }
    }
    
    let handler = new UpdateHandler(updateInterval, -1);
    handler.start();

    browser.runtime.onMessage.addListener((data, sender) => {
      let dest = data.dest;
      let source = data.source;
      if (urlMatcher.test(dest)) {
        // get source size
        let sz = getLinkSize(source);
        let data = [{ href: dest, size: sz }];
        sendMessageToBackground("WebScience.linkExposure", data);
      }
      return Promise.resolve({ response: "cs received messages" });
    });
  } // End of link exposure function
} // end of anon function
)(); // encapsulate and invoke