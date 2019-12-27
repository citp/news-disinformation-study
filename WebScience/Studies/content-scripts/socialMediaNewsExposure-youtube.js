(
    function () {

        // Save the time the page initially completed loading
        let initialLoadTime = Date.now();

        let initialVisibility = document.visibilityState == "visible";
        // ytcategory is the news category string for youtube videos
        const ytcategory = "CategoryNews&Politics";
        // regex for youtube url match
        const ytmatcher = /(?:https?:\/\/)?(?:www\.)?youtu\.?be(?:\.com)?\/?.*(?:watch|embed)?(?:.*v=|v\/|\/)([\w-_]+)/gmi;
        // raw category string
        const ytrawstring = "News \\\\u0026 Politics";
        // wait before checking for show more
        let waitMs = 2000;
        // listener for new videos loaded; youtube doesn't reload page. It uses history api.
        document.body.addEventListener("yt-navigate-finish", function(event) {
            setTimeout(checkNews, waitMs);
        });

        // wait before checking for news
        setTimeout(checkNews, waitMs);
        /**
         * checkNews function checks if the current webpage has youtube watch/embed url
         * for valid youtube videos, it checks if the video category is News & Politics
         * NOTE : if the inner html doesn't contain News & Politics, then the function
         * clicks on Show More and then checks DOM for video category
         */
        function checkNews() {
            let isNewsVideo = false;
            if(!isYoutube()) {
                return;
            }
            isNewsVideo = checkForNewsCategoryFromText();
            if(!isNewsVideo) {
                document.querySelector(".more-button").click();
                setTimeout(function() {
                    isNewsVideo = checkForNewsCategoryFromClick();
                }, waitMs);
            }
            if(isNewsVideo) {
                sendMessage();
            }
        }
        /**
         * isYoutube returns true if the current location is youtube watch url
         */
        function isYoutube() {
            return ytmatcher.exec(location.href) != null;
        }
        /**
         * checkForNewsCategoryFromText checks if inner html has News & Politics string
         */
        function checkForNewsCategoryFromText() {
            let arr = [...document.documentElement.innerHTML.matchAll("News \\\\u0026 Politics")];
            return arr.length > 0;
        }
        /**
         * check for category from DOM 
         */
        function checkForNewsCategoryFromClick() {
            elements = document.getElementsByClassName("style-scope ytd-metadata-row-container-renderer");
            for (i = 0; i < elements.length; i++) {
                if (elements[i].textContent.length > 0) {
                    str = elements[i].textContent.replace(/^\s+|\s+$/g, '').replace(/\n/g, "").replace(/\s{1,}/g, "");
                    if (str == ytcategory) {
                        return true;
                    }
                }
            }
            return false;
        }
        /**
         * sendMessage function sends video title to background script
         */
        function sendMessage() {
            let videoTitle = document.querySelector("h1.title.style-scope.ytd-video-primary-info-renderer").textContent;
            browser.runtime.sendMessage({
                type: "WebScience.SocialMediaNewsExposure",
                content: {
                    loadTime: initialLoadTime,
                    visible: initialVisibility,
                    url: document.location.href,
                    referrer: document.referrer,
                    data: { title: videoTitle }
                }
            });
        }
    }
)();