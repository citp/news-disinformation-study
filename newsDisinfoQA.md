## Testing
In developer mode, the aggregation code will run after 15 seconds of inactivity and output to the console.
View this (and other) output by going to `about:debugging`, then "This Firefox", then "Inspect" on the study, then the "Console" tab.

### PageNavigation
- Search Google for a site listed in `study/data/destinationDomainMatchPatterns.js`, and follow a search result to the site.
- Follow a link to a different page on the same domain.
- Close the tab
- Wait for an aggregation run (15 seconds of inactivity) and check that both visits appear in the output for
PageNavigation, each with the appropriate referrer.
- Here's an example of the output for Googling "nytimes", clicking the link to the homepage, then clicking the
first article, then closing the tab:
  ```json
  "WebScience.Measurements.PageNavigation": {
    "trackedVisitsByDomain": [
      {
        "domain": "www.nytimes.com",
        "visitsByReferrer": [
          {
            "referrerDomain": "www.google.com",
            "dayOfWeek": 6,
            "timeOfDay": 4,
            "classifierResults": {
              "covid-page-classifier": 2,
              "pol-page-classifier": 0
            },
            "numVisits": 1,
            "totalAttention": 4376,
            "totalScroll": 50,
            "prevExposedCount": 0,
            "laterSharedCount": 0
          },
          {
            "referrerDomain": "www.nytimes.com",
            "dayOfWeek": 6,
            "timeOfDay": 4,
            "classifierResults": {
              "covid-page-classifier": 0,
              "pol-page-classifier": 2
            },
            "numVisits": 1,
            "totalAttention": 4744,
            "totalScroll": 16,
            "prevExposedCount": 0,
            "laterSharedCount": 0
          }
        ]
      }
    ],
    "numUntrackedVisits": 2
  }
  ```
  - Note that there are two objects in `visitsByReferrer`: one with a referrer of google, and one from nytimes
- The rest of the values can also be sanity-checked:
  - The time of an event is reported as the beginning of a four-hour period in which the page visit began. The first
  time period is midnight UTC, then 4am UTC, and so on.
  - `dayOfWeek` ranges from 0 (Sunday) to 6 (Saturday).
  - `timeOfDay` is the beginning of the enclosing four-hour period, as noted above.
    - For example, these visits were made at about 1 am on a Saturday in US Eastern time, which is 5am UTC. 5am is in the 4am-7:59am time period, so
    the `timeOfDay` reported is 4, and `dayOfWeek` is 6 for Saturday.
  - `classifierResults` reports the results of the two page classifiers run on the page. They should usually both be
  present, with values ranging from 0 to 2, but occasional absences don't necessarily indicate a major issue -- sometimes we're unable to
  run the classifier on a page because the visit is too short to grab the content, or some other transient issue.
  - `numVisits` reports the number of visits in this category, where a category is defined by `referrerDomain`, `timeOfDay`,
  `dayOfWeek`, and `classifierResults`.
  - `totalAttention` is the sum of the milliseconds of attention for all the pages in this category.
  - Similarly, `totalScroll` is the sum of the relative scroll depths for all the pages in this category.
  - `prevExposedCount` and `laterSharedCount` are not currently used.

### LinkExposure
- Go to a page that contains links to one of the study domains, but isn't that exact domain (we ignore link exposures
that link to the same domain they're on).
  - Wikipedia can be good for getting links to news sites.
  - [Text-only NPR](https://text.npr.org/) is also useful, since it links to other news sites and its simplicity means it's easy
  to know exactly what links are visible.
- Stay on the page, with the links visible, for at least five seconds, then wait for an aggregation run.
- Check that the "edges" (source domain is the site you visited, destination is where the links went) are in the aggregation output.
- Here's an example:
```json
  "WebScience.Measurements.LinkExposure": {
    "untrackedLinkExposures": {
      "5": 3
    },
    "linkExposures": [
      {
        "sourceDomain": "text.npr.org",
        "destinationDomain": "www.npr.org",
        "dayOfWeek": 6,
        "timeOfDay": 4,
        "numExposures": 1,
        "laterVisitedCount": 0,
        "laterSharedCount": 0
      },
      {
        "sourceDomain": "text.npr.org",
        "destinationDomain": "covid19vaccine.health.ny.gov",
        "dayOfWeek": 6,
        "timeOfDay": 4,
        "numExposures": 1,
        "laterVisitedCount": 0,
        "laterSharedCount": 0
      },
      {
        "sourceDomain": "text.npr.org",
        "destinationDomain": "forward.ny.gov",
        "dayOfWeek": 6,
        "timeOfDay": 4,
        "numExposures": 1,
        "laterVisitedCount": 0,
        "laterSharedCount": 0
      },
      {
        "sourceDomain": "text.npr.org",
        "destinationDomain": "www.governor.ny.gov",
        "dayOfWeek": 6,
        "timeOfDay": 4,
        "numExposures": 1,
        "laterVisitedCount": 0,
        "laterSharedCount": 0
      },
      {
        "sourceDomain": "text.npr.org",
        "destinationDomain": "www.wsj.com",
        "dayOfWeek": 6,
        "timeOfDay": 4,
        "numExposures": 1,
        "laterVisitedCount": 0,
        "laterSharedCount": 0
      }
    ]
  }
  ```
  - I generated this by going to an article on `text.npr.org` and waiting five seconds
- Again, each field should be checked:
  - `sourceDomain` is the domain of the page you visited.
  - `destinationDomain` is the domain of the page each link pointed to, for all the links that went to tracked sites.
  - `dayOfWeek` and `timeOfDay` are the same as for PageNavigation.
  - `numExposures` is like `numVisits` for PageNavigation -- the total number of exposures in this category, defined
  by the source and destination domains, and the day and time.
  - Again, `laterVisitedCount` and `laterSharedCount` are not currently used.
- There should be one object in `linkExposures` for each external domain linked to.

### SocialMediaLinkSharing
This is the trickiest module to test. First, you need an account on the platform that you can use to make test
posts. We'll take them one at a time.

#### Reddit
Reddit is relatively easy -- they let you create a throwaway account without much hassle. Then, you need somewhere to post.
Most posts on Reddit go in "subreddits": communities around a shared interest. You'll annoy people and get yourself flagged
if you make test posts in a normal subreddit. There are some semi-automated ones where you might be able to post (e.g.
[https://www.reddit.com/r/ShadowBan/](https://www.reddit.com/r/ShadowBan/)), but the easiest solution I've found is to make
posts on your own account's page. Nobody will look at these, and you can easily delete them as you test. You can do that
by going to [https://www.reddit.com/submit](https://www.reddit.com/submit) and selecting `u/yourusernamehere` under "Your Profile"
in the "Choose a community" dropdown.

#### Twitter
Creating a fake Twitter account is a bit trickier. They often require a phone number for verification, and are aware
of most of the online SMS services. You may have to use your own phone number to make the account. Another option is to
use a real Twitter account, and just undo (delete, un-favorite, un-retweet, etc) any testing activity.

#### Facebook
Facebook is the hardest. I was never able to create and maintain a fake account -- Facebook's "real name" rules, and
photo requirement, along with phone verification and a sprinkle of who-knows-how-they-did-it detection, caught all
my attempts. Facebook does have "test accounts" available if you register as a developer of a Facebook app with them,
but unfortunately the test accounts are extremely limited in their abilities, and don't allow for all the testing
necessary. So, I use my own real account for all my Facebook testing. When I test making posts, I set the audience to
"only me", or to a custom audience with a friend who I've told ahead of time about what I'm doing. When I test
sharing posts, I do so primarily from large news accounts, and I delete the shares shortly after making them.

#### Testing
On whatever platform you're testing, you should create a post that contains a link to a domain in the study domains list.
We also track favorites on Twitter. Here's the full list of tracked actions:
- Facebook: post, reshare
- Twitter: tweet, retweet, favorite
- Reddit: post

Note that we don't track quote tweets where the quote-tweeted tweet contains a link. In these situations,
no link preview is shown to viewers of the quote tweet. Quote tweets are also frequently used to
disagree with the original tweet, so quote-tweeting a tweet with a link is not necessarily
a sharing action.

If you're testing re{sharing, tweeting} or favoriting, choose a post that has a tracked link.
Make the share and then wait for the aggregation run. Note that logging shares can take a while (especially
to run the classifiers on the shared page), so you may want to remain active for 5-10 seconds, then wait
the 15 seconds of inactivity to trigger aggregation. In the end, the `SocialMediaLinkSharing` section should look something like this:
```json
  "WebScience.Measurements.SocialMediaLinkSharing": {
    "linkSharesByPlatform": [
      {
        "platform": "facebook",
        "numUntrackedShares": 0,
        "trackedShares": []
      },
      {
        "platform": "twitter",
        "numUntrackedShares": 0,
        "trackedShares": []
      },
      {
        "platform": "reddit",
        "numUntrackedShares": 0,
        "trackedShares": [
          {
            "domain": "text.npr.org",
            "classifierResults": {
              "pol-page-classifier": 1,
              "covid-page-classifier": 0
            },
            "audience": "unknown",
            "source": "",
            "visitReferrer": "text.npr.org/",
            "prevExposed": 0,
            "dayOfWeek": 6,
            "timeOfDay": 4,
            "numShares": 1
          }
        ]
      }
    ]
  },
```
- This is the record of a share on Reddit, so both the Facebook and Twitter sections are empty.
- Here's how to check each field:
  - `domain` is the domain of the shared link (again, needs to be on the tracked domains list).
  - `classifierResults` is the same as for PageNavigation.
  - `audience` is "unknown", "restricted", or "public".
    - On Twitter, this reflects the status of the account -- private accounts get "restricted" for everything, and non-private
    ones get "public" for everything.
  - `source` is only relevant for reshares on Facebook, where it indicates whether the post was reshared from a page or a person.
  - `visitReferrer` is set when the page that was shared was seen by PageNavigation. If it was, this field is the referrer domain of the visit.
  - `prevExposed` is not currently used.
  - `dayOfWeek` and `timeOfDay` are the same as for PageNavigation and LinkExposure.
  - `numShares` is like `numVisits` and `numExposures`: the count of shares in this category, defined by `domain`, `classifierResults`,
  `audience`, `source`, `visitReferrer`, `dayOfWeek`, and `timeOfDay`.
