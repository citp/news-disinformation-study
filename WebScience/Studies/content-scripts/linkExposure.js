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
     * Convert relative url to abs url
     * @param {string} url 
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

    function listen(element) {
      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.isObserved = true;
            let url = rel_to_abs(entry.target.href);
            if (shortURLMatcher.test(url)) {
              sendMessageToBackground("WebScience.shortLinks", [{ href: url }]);
            }
            // check for domain matching
            if (urlMatcher.test(url)) {
              sendMessageToBackground("WebScience.linkExposureInitial", [{ href: url, size: getElementSize(entry.target) }]);
            }
            observer.unobserve(entry = entry.target);
          }
        });
      });
      observer.observe(element);
    }


    /**
     * Function to look for new <a> elements and create an intersection obs listener
     */
    function matchLinks() {
      /*
      Filter for elements that haven't been visited previously and observe them with intersection observer
      */
      Array.from(document.body.querySelectorAll("a[href]")).filter(link => link.isObserved == null).forEach(element => {
        listen(element);
      });
    }

  // call update every 2 seconds
  setInterval(matchLinks, updateInterval);

    browser.runtime.onMessage.addListener((data, sender) => {
      let dest = data.dest;
      let source = data.source;
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