# Dowload-twitter-likes

**A lightweight Node.js package to fetch all media of your Twitter favorites**

*(Tweets sources in .ndjson required)*

---

## Features

- Zero denpendency.
- Built-in proxy support.
- Proper network error handling & logging.
- Reusing tcp connection with keep-alive agents.
- Mechanisms for adjusting and extending the functionalities easily.
- Each request and its result is isolated and promisified, thus easy to control.

## Intallation

##### 1. download

Using git:

```bash
git clone --depth 1 https://github.com/edfus/download-twitter-likes
cd  download-twitter-likes
```

...or download manually via <https://github.com/edfus/download-twitter-likes/archive/master.zip>

##### 2. install

Make sure you have [Node.js](https://nodejs.org/en/) & npm installed on your machine before proceeding.

```bash
# in download-twitter-likes folder
npm install --only=production
```

Node.js version equal to or higher than 13 supported. (experimental ES6 import)

##### 3. put favs.ndjson in the directory

You can get the `favs.ndjson` file using my [get-twitter-likes](https://github.com/edfus/get-twitter-likes) script, or reaching to other Twitter api scraper like [this python package](https://github.com/tekumara/twitter-likes) if you would prefer.

## Execute

```bash
npm run download

`
  command line arguments:
  --proxy=http://YOURPROXY:PORT
  --path="./PREFERED_WORKING_DIRECTORY" - default to "./" (pwd)
      set the default path for CRUD following files:
      - likes/                          - default output folder
        set "--output-folder=PATH/YOU/PREFER" to specify the exact path for storing media other than ${path}/likes/
      - favs.ndjson                     - default source
        set "--ndjson-path=PATH/NDJSON.ndjson" to retrieve sources from a preferred ndjson file
      - media.log.txt                   - log file
      - media.db.csv                    - database

  --log-filtered
    set --log-filtered flag will log all entries filtered either by url_filter or pathname_filter out.
  --log-succeeded
    turn log-succeeded on will lead to succeeded downloads being logged too.
`

```

Remember to skim through the log file first if any problem was encountered.

## Personalize

### Default behaviors

- Making 10 requests per seconds.
- Add all successfully downloaded media's url to database.
- If a media's url already exists in database, that media got filtered.
- If files having the same name exist in output folder, according download got filtered.
- If a Tweet has multiple media, group them in a folder.
- Delete the empty folder if failed for multi-media Tweets.
- For animated_gif/video, download the variant with maximum bitrate.
- For photos, fetch them over HTTP to be faster.

- Initializer: await database loaded.
- Log details when faileds, will not log filtered/succeeded.

- Filename:

In index.mjs, navigate to the main section - download favs, and scroll down a little, then you can see the naming logic, which looks like the snippet below.

```js
const details = replaceReservedChars (
          [
            customizeDateFormat(new Date(fav.created_at)),
            fav.user.name.concat("@").concat(fav.user.screen_name),
            fav.id_str 
          ]
            .join("_")
            .concat(fav.retweeted ? "--retweeted" : "")
        );
```

That will produce names like `2020-12-22_暦@koyomiyoko_o_1341064343962587136`.

Notably, the `2020-12-22` was a product of the function customizeDateFormat in config section above, converting en-us time format `12/22/2020` to `2020-12-22`. It may not work properly on your machine under a different time format.

Take a look at [Twitter's official guidance](https://developer.twitter.com/en/docs/twitter-api/v1/data-dictionary/object-model/extended-entities) or [favs-example.ndjson](https://github.com/edfus/download-twitter-likes/blob/master/favs-example.ndjson) for reference about things you can access for DIY file naming.

## Interacting with get-twitter-likes

```bash
#! /bin/bash

# Absolute path this script is in
__dirname=$(dirname "$(readlink -f "$0")")

readonly path=/y/scripts-node/_internal
readonly proxy="--proxy=http://127.0.0.1:7890"

cd ${path}/get-twitter-likes
npm run g -- --smart-exit --output=${__dirname}/ ${proxy}

cd ${path}/download-twitter-likes
npm run d -- --path=${__dirname}/ --output-folder=${__dirname}/Raw/ ${proxy}

read -p $'\n'
```