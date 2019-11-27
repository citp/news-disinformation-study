// Function encapsulation to maintain unique variable scope for each content script
(function() {

// Save the time the page initially completed loading
var initialLoadTime = Date.now();

// Save whether the page was initially visible
// Note that the Page Visibility API only handles if a tab is active in its window,
// we have to separately check in the content script whether the window is active
var initialVisibility = document.visibilityState == "visible";
const ytcategory = "CategoryNews&Politics";
const ytmatcher = /(?:https?:\/\/)?(?:www\.)?youtu\.?be(?:\.com)?\/?.*(?:watch|embed)?(?:.*v=|v\/|\/)([\w-_]+)/gmi;
const ytrawstring = "News \\\\u0026 Politics";
var match = false;

// check if the location of page matches regular expression
var isMatched = ytmatcher.exec(location.href) != null;
if(isMatched) {

  // check in the metadata
  elements = document.getElementsByClassName("style-scope ytd-metadata-row-container-renderer");
  // check if any of the elements have a non empty textContent
  for(i=0; i < elements.length; i++) {
      if(elements[i].textContent.length > 0) {
        // strip string of spaces
        str = elements[1].textContent.replace(/^\s+|\s+$/g, '').replace(/\n/g, "").replace(/\s{1,}/g,"");
        if(str == ytcategory) {
          match = true;
          break;
        }
      }
  }

  // check for news and politics in the entire html
  if (!match) {
    if (document.documentElement.innerHTML.indexOf(ytrawstring) > -1) {
      match = true;
    }
  }
}


if(match) {
  var title = document.querySelectorAll("h1.title.style-scope.ytd-video-primary-info-renderer");
  browser.runtime.sendMessage({
    type: "WebScience.SocialMediaNewsExposure",
    content: {
      loadTime: initialLoadTime,
      visible: initialVisibility,
      url: document.location.href,
      referrer: document.referrer,
      links: location.href
    }
  });
}

})();
