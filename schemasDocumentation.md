# Data Collection Schemas
The schema for validating reported data is available [here (TODO update link)](#).

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

The encrypted part of the payload follows the [`measurement` schema (TODO update link)](#) (here is a [conforming example (TODO update link)](#)), with the following salient sections.

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
            "visitPresentInPageNavigation": true,
            "visitSourceFromTransitions": "somereferrer.com",
            "facebookReshareSource": "page",
            "dayOfWeek": 2,
            "timeOfDay": 20,
            "classifierResults": {
              "covid-page-classifier": 1,
              "pol-news-classifier": 0
            },
            "shareAudience": "public",
            "categorySharesCount": 2
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

## `newsAndDisinfo.linkExposure`
This section of the ping contains a list links seen by the user, only including links to domains known to be sources of news or health information.

```json
  "newsAndDisinfo.linkExposure": {
    "untrackedExposuresCount": 40,
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

- `untrackedExposuresCount`: the number of links to domains outside the study domains that the user was exposed to.
- `trackedExposuresByCategory`: an array of objects, each representing a link user was exposed to.
    * `exposureSourceTrimmedUrl`: the domain exposing the link.
    * `exposureDestinationTrimedUrl`: the domain of the link.
    * `dayOfWeek`: an integer representing the day of the week user was exposed to the link.
    * `timeOfDay`: an integer representing the time of the day user was exposed to the link.
    * `categoryExposuresCount`: the number of exposures to links in this category.
