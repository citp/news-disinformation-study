# Data Collection Schemas
The schema for validating reported data is available [here](https://github.com/mozilla-services/mozilla-pipeline-schemas/blob/main/schemas/pioneer-citp-news-disinfo/rallymeasurements/rallymeasurements.1.schema.json).

The schema is separated into sections for each of the main measurement modules as well as
a section for miscellaneous other data, such as the study version.

## Testing
It's easy to test with a command line JSON validator like [AJV](https://github.com/jessedc/ajv-cli).
Run the extension and copy the generated aggregate data into a file, then run:
```
ajv validate -s pathToSchema.json -d savedSampleDataFromStudy.json
```

# Data Documentation
This part of the document describes the data being collected by this study.
This study will send a ping using the Rally platform, through Firefox, approximately once per day.

The encrypted part of the payload follows the [`rallymeasurement` schema](https://github.com/mozilla-services/mozilla-pipeline-schemas/blob/main/templates/pioneer-citp-news-disinfo/rallymeasurements/rallymeasurements.1.schema.json) (here is a [conforming example](https://github.com/mozilla-services/mozilla-pipeline-schemas/blob/main/validation/pioneer-citp-news-disinfo/rallymeasurements.1.sample.pass.json)), with the following salient sections.

## `newsAndDisinfo.pageNavigation`
This section of the ping contains a list of websites known to be sources of authoritative or misleading information about health and politics, browsed by the user who joined the study.

```json
  "newsAndDisinfo.pageNavigation": {
    "untrackedVisitsCount": 500,
    "untrackedAttention": 431241,
    "trackedVisitsByCategory": [
      {
        "visitTrimmedUrl": "somedomain.org",
        "sourceTrimmedUrlFromReferrer": "referrer.com",
        "sourceTrimmedUrlFromTransitions": "referrer.com",
        "dayOfWeek": 1,
        "timeOfDay": 8,
        "classifierResults": {
          "covid-page-classifier": 1,
          "pol-news-classifier": 0
        },
        "categoryVisitsCount": 10,
        "categoryAttention": 500,
        "categoryScroll": 400
      }
    ]
  }
```

- `untrackedVisitsCount`: the number of browsed URLs that do not match the study domains.
- `untrackedAttention`: the total amount of time spent paying attention to pages that do not match
the study domains.
- `trackedVisitsByCategory`: an array of objects, each representing a study domain visited by the user.
   * `visitTrimmedUrl`: the visited domain.
   * `sourceTrimmedUrlFromReferrer`: the domain of the referrer.
   * `sourceTrimmedUrlFromTransitions`: the domain of the previous page in the tab, or the opener tab.
   * `dayOfWeek`: an integer representing the day of the week the domain was referred.
   * `timeOfDay`: an integer representing the time of the day the domain was referred.
   * `classifierResults`: an object with properties for each of the page classifiers used in this study.
      * `covid-page-classifier`: an integer representing the result of the classifier that looks for COVID-related articles.
      * `pol-page-classifier`: an integer representing the result of the classifier that looks for political news-related articles.
   * `categoryVisitsCount`: the number of visits in this category (as defined by referrer, day, time, and classification).
   * `categoryAttention`: the sum of the lengths of the attention spans on the pages in this category, as documented in the [WebScience code](https://github.com/mozilla-rally/web-science/blob/main/src/pageManager.js).
   * `categoryScroll`: the sum of the relative scroll depths for visits to pages in this category.

## `newsAndDisinfo.socialMediaLinkSharing`
This section of the ping contains a list of platforms study links were shared on.

```json
  "newsAndDisinfo.socialMediaLinkSharing": {
    "linkSharesByPlatform": [
      {
        "platform": "someSocialNetwork",
        "untrackedSharesCount": 10,
        "trackedSharesByCategory": [
          {
            "sharedTrimmedUrl": "somedomain.com",
            "visitSourceFromTransitions": "somereferrer.com",
            "facebookReshareSource": "page",
            "dayOfWeek": 2,
            "timeOfDay": 20,
            "classifierResults": {
              "covid-page-classifier": 1,
              "pol-news-classifier": 0
            },
            "shareAudience": "public",
            "categorySharesCount": 2,
            "categoryVisitAttention": 34291,
            "categoryVisitsInPageNavigationCount" : 1,
            "categoryVisitsInHistoryCount" : 1
          }
        ]
      }
    ]
  }
```

- `linkSharesByPlatform`: an array of objects, each representing a platform links were shared on.
    * `platform`: the name of the social network platform links were shared on.
    * `untrackedSharesCount`: the number of URLs shared on the social media platform not tracked for this study.
    * `trackedSharesByCategory`: an array of objects, each containing information about the domain of the shared URL.
        * `sharedTrimmedUrl`: the domain of the shared URL.
        * `visitPresentInPageNavigation`: whether the study recorded a visit to the shared page.
        * `visitSourceFromTransitions`: referrer for the page visit, as determined by the previous page in the tab.
        * `facebookReshareSource`: for Facebook reshares, whether the original post came from a person or page.
        * `dayOfWeek`: an integer representing the day of the week the link was shared.
        * `timeOfDay`: an integer representing the time of the day the link was shared.
        * `classifierResults`: an object with properties for each of the page classifiers used in this study.
           * `covid-page-classifier`: an integer representing the result of the classifier that looks for COVID-related articles.
           * `pol-page-classifier`: an integer representing the result of the classifier that looks for political news-related articles.
        * `shareAudience`: the target audience of the share on the social media platform.
        * `categorySharesCount`: the number of shares of content in this category was shared.
        * `"categoryVisitAttention"`: for shared links that were also visited, the sum of time spent on the page during the visit.
        * `"categoryVisitsInPageNavigationCount"` : the number of shared links that were also visited.
        * `"categoryVisitsInHistoryCount"` : the number of shared links that appeared in the browsing history.

## `newsAndDisinfo.linkExposure`
This section of the ping contains a list links seen by the user, only including links to domains known to be sources of news or health information.

```json
  "newsAndDisinfo.linkExposure": {
    "trackedExposuresByCategory": [
      {
        "exposureSourceTrimmedUrl": "google.com",
        "exposureDestinationTrimedUrl": "nytimes.com",
        "dayOfWeek": 1,
        "timeOfDay": 4,
        "categoryExposuresCount": 10
      }
    ]
  }
```

- `trackedExposuresByCategory`: an array of objects, each representing a link user was exposed to.
    * `exposureSourceTrimmedUrl`: the domain exposing the link.
    * `exposureDestinationTrimedUrl`: the domain of the link.
    * `dayOfWeek`: an integer representing the day of the week user was exposed to the link.
    * `timeOfDay`: an integer representing the time of the day user was exposed to the link.
    * `categoryExposuresCount`: the number of exposures to links in this category.



## `newsAndDisinfo.methodology`
This section of the ping contains a record of each page visited by the user, with
the user's attention and path to visited the page measured via several different
methods.

```json
  "newsAndDisinfo.methodology": {
    "measuredPageVisits": [
      {
        "visitTrimmedUrl": "somedomain.com",
        "attentionDwellTime": 21079,
        "attentionDwellTimePlus": 15234,
        "attentionTimeToNextLoad": 35000,
        "attentionWebScience": 15123,
        "parentHistory": "referrer.com",
        "parentLoadTime": "other.com",
        "parentWebScience": "referrer.com",
        "parentReferrer": "referrer.com",
        "isHistoryChange": false,
        "parentReferrerPathPresent": false,
        "parentWebSciencePathPresent": true,
        "parentLoadTimeToHistory": true,
        "parentReferrerToHistory": true,
        "parentReferrerToLoadTime": false,
        "parentWebScienceToHistory": true,
        "parentWebScienceToLoadTime": false,
        "parentWebScienceToReferrer": true,
        "prevTTNL": 2312,
        "timeOfDayStart": 12,
        "dayOfMonthStart": 24,
        "monthOfYearStart": 6,
        "yearStart": 2022
      }
    ]
  }
```

- `measuredPageVisits`: an array of objects, each representing a page visit.
    * `visitTrimmedUrl`: the visited domain, or "other" if the visit was to an untracked domain.
    * `attentionDwellTime`: the amount of time between the page loading in the browser and unloading.
    * `attentionDwellTimePlus`: the amount of time the page was visible to the user and focused.
    * `attentionWebScience`: the amount of time the user was paying attention to the page, as documented in the [WebScience code](https://github.com/mozilla-rally/web-science/blob/main/src/pageManager.js).
    * `parentHistory`: the domain of the parent page as reported by the History API.
    * `parentLoadTime`: the domain of the page that loaded chronologically before this one.
    * `parentWebScience`: the domain of the page that WebScience judged to be the parent of this one.
    * `parentReferrer`: the domain of the page listed as the `document.referrer`.
    * `isHistoryChange`: whether this page visit started via a change through the History API instead of a regular navigation.
    * `parentReferrerPathPresent`: whether the page listed as the `parentReferrer` had a path. Note that the path itself is removed before reporting -- this value states whether it was *ever* present.
    * `parentWebSciencePathPresent`: same as the above, for the `parentWebScience`.
    * `parentLoadtimeToHistory`: whether the pages listed as `parentLoadTime` and `parentHistory` were the same (before removing the path for reporting).
    * `parentReferrerToHistory`: whether the pages listed as `parentReferrer` and `parentHistory` were the same (before removing the path for reporting).
    * `parentReferrerToLoadTime`: whether the pages listed as `parentReferrer` and `parentLoadTime` were the same (before removing the path for reporting).
    * `parentWebScienceToHistory`: whether the pages listed as `parentWebScience` and `parentHistory` were the same (before removing the path for reporting).
    * `parentWebScienceToLoadTime`: whether the pages listed as `parentWebScience` and `parentLoadTime` were the same (before removing the path for reporting).
    * `parentWebScienceToReferrer`: whether the pages listed as `parentWebScience` and `parentReferrer` were the same (before removing the path for reporting).
    * `prevTTNL`: the amount of time between the loading of the page chronologically before and the loading of this page (for estimating boundaries of browsing sessions).
    * `timeOfDayStart`: the time of day the page visit started, represented as the start of a four-hour span.
    * `dayOfMonthStart`: the day of the month the page visit started.
    * `monthOfYearStart`: the month of the year the page visit started (note that months are 0-indexed).
    * `yearStart`: the year the page visit started.


## Miscellaneous Fields
There are two remaining relevant fields in the ping:
- `newsAndDisinfo.surveyId`: a unique, randomly-generated identifier that links survey responses to data collected through Rally.
- `newsAndDisinfo.version`: the version of the study that generated this ping.
