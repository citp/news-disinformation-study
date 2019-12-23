// Function encapsulation to maintain unique variable scope for each content script
(
  function() {
    /**
     * updateInterval (number of milliseconds) is the interval at which we look for new links that users
     * are exposed to in known domains
     */
    let updateInterval = 2000;
    linkExposure();

    const isThresholdValid = threshold =>
      Number(threshold) === threshold && threshold >= 0 && threshold <= 1;

    /**
     * Function to observe intersection of dom elements with viewport
     * @param {DOMElement} targetElement element to observe for intersection with viewport
     * @param {*} threshold intersection ratio
     * 
     * @returns promise that resolves to element when it intersects with viewport
     */
    function observeElement(targetElement, threshold) {
      new Promise((resolve, reject) => {
        const observerOptions = {
          root: null, // Document viewport
          rootMargin: "0px",
          threshold // Visible amount of item shown in relation to root. 1.0 dictates that every pixel of element is visible.
        };
        const observer = new IntersectionObserver((entries, observer) => {
          /**
           * When the IntersectionObserver is instantiated the callback is ran once
           * as a detection for whether the element is in view or not
           * and if its intersection ratio exceeds the given threshold.
           */
          targetElement.isObserved = true;
          if (
            !entries[0].isIntersecting// ||
            //entries[0].intersectionRatio < threshold
          ) {
            return;
          }
          observer.disconnect();
          return resolve(entries[0]);
        }, observerOptions);

        observer.observe(targetElement);
      });

    }

  function linkExposure() {

    // Save the time the page initially completed loading
    let initialLoadTime = Date.now();
    let initialVisibility = document.visibilityState == "visible";

    /**
     * Convert relative url to abs url
     * @param {string} url 
     * 
     * @returns {string} absolute url
     */
    function rel_to_abs(url) {
      /* Only accept commonly trusted protocols:
       * Only data-image URLs are accepted, Exotic flavours (escaped slash,
       * html-entitied characters) are not supported to keep the function fast */
      if (/^(https?|file|ftps?|mailto|javascript|data:image\/[^;]{2,9};):/i.test(url))
        return url; //Url is already absolute

      var base_url = location.href.match(/^(.+)\/?(?:#.+)?$/)[0] + "/";
      if (url.substring(0, 2) == "//")
        return location.protocol + url;
      else if (url.charAt(0) == "/")
        return location.protocol + "//" + location.host + url;
      else if (url.substring(0, 2) == "./")
        url = "." + url;
      else if (/^\s*$/.test(url))
        return ""; //Empty = Return nothing
      else url = "../" + url;

      url = base_url + url;
      var i = 0;
      while (/\/\.\.\//.test(url = url.replace(/[^\/]+\/+\.\.\//g, "")));

      /* Escape certain characters to prevent XSS */
      url = url.replace(/\.$/, "").replace(/\/\./g, "").replace(/"/g, "%22")
        .replace(/'/g, "%27").replace(/</g, "%3C").replace(/>/g, "%3E");
      return url;
    }

    /**
     * Helper function to get size of element
     * @param {Element} el element
     * 
     * @returns Object with width and height of element
     */
    function getElementSize(el) {
      let rect = el.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height
      };
    }


    /**
     * Get link size
     * 
     * @param {string} link url on the page
     * 
     * @returns element size
     */
    function getLinkSize(link) {
      // create an object with key = init and value is resolved url
      let query = "a[href='"+link+"']";
      let elements = document.body.querySelectorAll(query);
      return (elements.length > 0 ? getElementSize(elements[0]) : null);
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
    * Helper function to test if DOM element is in viewport
    * @param {Element} el element
    */
    function isElementInViewport(el) {
      let rect = el.getBoundingClientRect();
      return (
        //el.style.display != "none" &&
        rect.top >= 0 && // should this be strictly greater ? With >= invisible links have 0,0,0,0 in bounding rect
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
      );
    }

    /**
     * Function takes an <a> element, test it for matches with link shorteners or domains of interest and
     * sends it to background script for resolution/storage
     * @param {DOMElement} element element to match for short links or domains of interest
     */
    function matchElement(element) {
      element.isObserved = true;
      let url = rel_to_abs(element.href);
      if (shortURLMatcher.test(url)) {
        sendMessageToBackground("WebScience.shortLinks", [{ href: url }]);
      }
      // check for domain matching
      if (urlMatcher.test(url)) {
        sendMessageToBackground("WebScience.linkExposureInitial", [{ href: url, size: getElementSize(element) }]);
      }
    }

    /**
     * Function to look for new <a> elements that are in viewport
     */
    function observeChanges() {
      // Filter for elements that haven't been visited previously and observe them with intersection observer
      let count = 0;
      Array.from(document.body.querySelectorAll("a[href]")).filter(link => link.isObserved == null).forEach(element => {
        //observeElement(element, 0.0).then(matchElement);
        let inView = isElementInViewport(element);
        if(inView) {
          matchElement(element);
          count++;
        }
      });
      return count;
    }

    let handleUpdates = function () {
      let nlinks = [];
      let nrecords = 10;
      let timer = setTimeout(function run() {
        let nchanges = observeChanges();
        if (nlinks.length >= nrecords) {
          nlinks.shift();
        }
        nlinks.push(nchanges);
        timer = setTimeout(run, updateInterval);
      }, updateInterval);
    };
    handleUpdates();

    browser.runtime.onMessage.addListener((data, sender) => {
      let dest = data.dest;
      let source = data.source;
      /*if(shortURLMatcher.test(dest)) {
        sendMessageToBackground("WebScience.shortLinks", [{ href: dest }]);
      }*/
      if (urlMatcher.test(dest)) {
        // get source size
        let sz = getLinkSize(source);
        let data = [{ href: dest, size: sz }];
        sendMessageToBackground("WebScience.linkExposureInitial", data);
      }
      return Promise.resolve({ response: "received messages" });
    });
  } // End of link exposure function
} // end of anon function
)(); // encapsulate and invoke