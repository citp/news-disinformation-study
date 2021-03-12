# Data Collection Schemas
The schema for validating reported data is available [here](https://github.com/mozilla-services/mozilla-pipeline-schemas/blob/master/schemas/pioneer-citp-news-disinfo/measurements/measurements.1.schema.json).

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
This study will send a [`pioneer-study` ping](https://firefox-source-docs.mozilla.org/toolkit/components/telemetry/data/pioneer-study.html) using the Rally platform, through Firefox, approximately once per day.

The encrypted part of the payload follows the [`measurement` schema](https://github.com/mozilla-services/mozilla-pipeline-schemas/blob/master/schemas/pioneer-citp-news-disinfo/measurements/measurements.1.schema.json) (here is a [conforming example](https://github.com/mozilla-services/mozilla-pipeline-schemas/blob/master/validation/pioneer-citp-news-disinfo/measurements.1.sample.pass.json)), with the following salient sections.

## `WebScience.Measurements.PageNavigation`
This section of the ping contains a list of websites known to be sources of authoritative or misleading information about health and politics, browsed by the user who joined the study.

```json
  "WebScience.Measurements.PageNavigation": {
    "numUntrackedVisits": 500,
    "trackedVisitsByDomain": [
      {
        "domain": "somedomain.org",
        "numSessions": 0,
        "visitsByReferrer": [
          {
            "referrerDomain": "referrer.com",
            "dayOfWeek": 1,
            "timeOfDay": 8,
            "pageCategory": 1,
            "numVisits": 10,
            "totalAttention": 500,
            "totalScroll": 400,
            "prevExposedCount": 3,
            "laterSharedCount": 1,
            "classifierResults": {
              "covid-page-classifier": 1,
              "pol-news-classifier": 0
            }
          }
        ]
      }
    ]
  }
```

- `numUntrackedVisits`: the number of browsed URLs that do not match the study domains.
- `trackedVisitsByDomain`: an array of objects, each representing a study domain visited by the user.
   * `domain`: the visited domain.
   * `numSessions`: not used.
   * `visitsByReferrer`: an array of objects, each representing informations about a referrer to the domain.
       * `referrerDomain`: the domain of the referrer.
       * `dayOfWeek`: an integer representing the day of the week the domain was referred.
       * `timeOfDay`: an integer representing the time of the day the domain was referred.
       * `classifierResults`: an object with properties for each of the page classifiers used in this study.
          * `covid-page-classifier`: an integer representing the result of the classifier that looks for COVID-related articles.
          * `pol-page-classifier`: an integer representing the result of the classifier that looks for political news-related articles.
       * `numVisits`: the number of visits in this category (as defined by referrer, day, time, and classification).
       * `totalAttention`: the sum of the lengths of the attention spans on the pages in this category, as documented in the [WebScience code](../WebScience/Utilities/PageManager.js).
       * `totalScroll`: the sum of the relative scroll depths for visits to pages in this category.
       * `pageCategory`: not used.
       * `prevExposedCount`: not used.
       * `laterSharedCount`: not used.

## `WebScience.Measurements.SocialMediaLinkSharing`
This section of the ping contains a list of platforms study links were shared on.

```json
  "WebScience.Measurements.SocialMediaLinkSharing": {
    "linkSharesByPlatform": [
      {
        "platform": "someSocialNetwork",
        "numUntrackedShares": 10,
        "trackedShares": [
          {
            "domain": "somedomain.com",
            "classifierResults": {
              "covid-page-classifier": 1,
              "pol-news-classifier": 0
            },
            "audience": "public",
            "numShares": 2,
            "dayOfWeek": 2,
            "timeOfDay": 20,
            "visitReferrer": "someotherdomain.com"
          }
        ]
      }
    ]
  }
```

- `linkSharesByPlatform`: an array of objects, each representing a platform links were shared on.
    * `platform`: the name of the social network platform links were shared on.
    * `numUntrackedShares`: the number of URLs shared on the social media platform not tracked for this study.
    * `trackedShares`: an array of objects, each containing information about the domain of the shared URL.
        * `domain`: the domain of the shared URL.
        * `classifierResults`: an object with properties for each of the page classifiers used in this study.
           * `covid-page-classifier`: an integer representing the result of the classifier that looks for COVID-related articles.
           * `pol-page-classifier`: an integer representing the result of the classifier that looks for political news-related articles.
        * `audience`: the target audience of the share on the social media platform.
        * `numShares`: the number of shares of content in this category was shared.
        * `dayOfWeek`: an integer representing the day of the week the link was shared.
        * `timeOfDay`: an integer representing the time of the day the link was shared.
        * `visitReferrer`: the domain where the user clicked a link to the URL shared.
        * `source`: for a reshared link on Facebook, whether the reshared post came from a page or a person.
        * `classification`: not used.
        * `pageClassification`: not used.
        * `prevExposed`: not used.

## `WebScience.Measurements.LinkExposure`
This section of the ping contains a list links seen by the user, only including links to domains known to be sources of news or health information.

```json
  "WebScience.Measurements.LinkExposure": {
    "untrackedLinkExposures": {
      "5000": 4
    },
    "linkExposures": [
      {
        "sourceDomain": "google.com",
        "destinationDomain": "nytimes.com",
        "dayOfWeek": 1,
        "timeOfDay": 4,
        "numExposures": 10
      }
    ]
  }
```

- `untrackedLinkExposures`: the number of links to domains outside the study domains that the user was exposed to.
- `linkExposures`: an array of objects, each representing a link user was exposed to.
    * `sourceDomain`: the domain exposing the link.
    * `destinationDomain`: the domain of the link.
    * `dayOfWeek`: an integer representing the day of the week user was exposed to the link.
    * `timeOfDay`: an integer representing the time of the day user was exposed to the link.
    * `numExposures`: the number of exposures to links in this category.
    * `visThreshold`: not used.
    * `laterSharedCount`: not used.
    * `laterVisitedCount`: not used.
