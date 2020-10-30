# Data Collection Schemas
At a high level, we plan to have one schema for each measurement module.
There are some pieces of data that require coordinating across data from
multiple modules, so we'll integrate those into the schema for one of the
modules or make separate schemas for them.

We're considering at least two options for the pageNavigation schema, and we'll
carry the design choice to the other schemas as well.
1. `pageNavigation-list`: here, the data for each domain is stored as many instances of
the same object. This is easy to read, but results in lots of duplication.
2. `pageNavigation-nested`: here, the data is deeply nested to avoid duplication, but this
makes it harder to read and modify.

## Testing
It's easy to test with a command line JSON validator like [AJV](https://github.com/jessedc/ajv-cli).
```
npm install -g ajv-cli
ajv validate -s pageNavigation-list.json -d test-pageNavigation-list.json
```

# Data Documentation
This part of the document describes the data being collected by this study.
This study will send a [`pioneer-study` ping](https://firefox-source-docs.mozilla.org/toolkit/components/telemetry/data/pioneer-study.html) using the Ion platform, through Firefox, once per day.

The encrypted part of the payload follows the [`measurement` schema](measurements.1.schema.json) (here is a [conforming example](measurements.1.sample.pass.json)), with the following salient sections.

## `WebScience.Measurements.PageNavigation`
This section of the ping contains a list of websites known to be sources of authoritative or misleading information about health and politics, browsed by the user who joined the study.

```json
  "WebScience.Measurements.PageNavigation": {
    "numUntrackedVisits": 500,
    "trackedVisitsByDomain": [
      {
        "domain": "somedomain.org",
        "numSessions": 3,
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
            "laterSharedCount": 1
          }
        ]
      }
    ]
  }
```

- `numUntrackedVisits`: the number of browsed URLs that do not match the study domains.
- `trackedVisitsByDomain`: an array of objects, each representing a study domain visited by the user.
   * `domain`: the visited domain.
   * `numSessions`: the number of times the domain was visited.
   * `visitsByReferrer`: an array of objects, each representing informations about a referrer to the domain.
       * `referrerDomain`: the domain of the referrer.
       * `dayOfWeek`: an integer representing the day of the week the domain was referred.
       * `timeOfDay`: an integer representing the time of the day the domain was referred.
       * `pageCategory`: an integer representing the category of the page, as reported by the page classifier.
       * `numVisits`: the number of visits contributed by this referrer.
       * `totalAttention`: the length of the attention span on the page, as documented in the [WebScience code](../WebScience/Utilities/PageEvents.js).
       * `totalScroll`: the total amount of pixels the page was scrolled for.
       * `prevExposedCount`: the number of time user was previously exposed to the URL.
       * `laterSharedCount`: the number of time user has shared the URL.

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
            "classification": "other",
            "audience": "public",
            "numShares": 2,
            "dayOfWeek": 2,
            "timeOfDay": 20
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
        * `classification`: a string representing the categorical classification of the page.
        * `audience`: the target audience of the share on the social media platform.
        * `numShares`: the number of times the content was shared.
        * `dayOfWeek`: an integer representing the day of the week the domain was referred.
        * `timeOfDay`: an integer representing the time of the day the domain was referred.
        * `prevExposed`: the number of shared links which the user had previously seen online.
        * `source`: for a reshared link on Facebook, whether the reshared post came from a page or a person.

## `WebScience.Measurements.LinkExposure`
This section of the ping contains a list of platforms study links were shared on.

```json
  "WebScience.Measurements.LinkExposure": {
    "untrackedLinkExposures": {
      "1000": 10,
      "3000": 4,
      "5000": 4,
      "10000": 2
    },
    "linkExposures": [
      {
        "sourceDomain": "google.com",
        "destinationDomain": "nytimes.com",
        "dayOfWeek": 1,
        "timeOfDay": 4,
        "numExposures": 10,
        "laterSharedCount": 3,
        "laterVisitedCount": 4
      }
    ]
  }
```

- `untrackedLinkExposures`: an histogram-like object representing the links the user was exposed to that weren't part of the study domains.
- `linkExposures`: an array of objects, each representing a link user was exposed to.
    * `sourceDomain`: the domain exposing the link.
    * `destinationDomain`: the domain of the link.
    * `dayOfWeek`: an integer representing the day of the week user was exposed to the link.
    * `timeOfDay`: an integer representing the time of the day user was exposed to the link.
    * `visThreshold`: the amount of time the exposed link was visible, as a histogram bucket.
    * `numExposures`: the number of times user was exposed to the link.
    * `laterSharedCount`: the number of times user shared the link.
    * `laterVisitedCount`: the number of times user visited the link.
