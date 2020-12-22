# Dowload-twitter-likes

**A lightweight Node.js package to fetch all media of your Twitter favorites**

*(Tweets sources in .ndjson required)*

---

## Features

- mechanisms to easily adjust and extend the functionalities.
- each request and its result is isolated and promisified, thus easy to control.
- with throttle.

## Intallation

###### 1. download

Using git:

```bash
git clone https://github.com/edfus/download-twitter-likes
cd  download-twitter-likes
```

...or download manually via <https://github.com/edfus/download-twitter-likes/archive/master.zip>

###### 2. install

Make sure you have [Node.js](https://nodejs.org/en/) & npm installed on your machine before proceeding.

```bash
# in download-twitter-likes folder
npm install --only=prod
```

Node.js version equal to or higher than 10.3.0 supported. (unconfirmed tho)

###### 3. put favs.ndjson in the folder directory

You can get the `favs.ndjson` file using my [get-twitter-likes](https://github.com/edfus/get-twitter-likes) package, or reaching to other Twitter api crawler service like [this python package](https://github.com/tekumara/twitter-likes) if you would prefer.

###### 3. run

```bash
npm run d

# passing command line arguments:
npm run d -- --path=./likes/ --ndjson_path=./favs.ndjson
```

## Personalize

#### in `index.mjs`:

##### config section

###### 1. path

```js
const path = extractArg(/-{1,2}path=/i) || "./likes/";
const ndjson_path = extractArg(/-{1,2}ndjson(_?path)?=/i) || "favs.ndjson";
```

`path` is for where to store the media downloaded, while `ndjson_path` is for the source.

Change the part wrapped in `""` that following `||` if you prefer somewhere else,

though using the command line arguments is a better choice:

```bash
npm run d -- --path=somewhere --ndjson_path=itsname.ndjson
```

###### 2. throttle

```js
const throttleLimit = 20; 
const throttleSeconds = 10;
```

download speed is throttled to throttleLimit per throttleSeconds.

###### 3. filter

return `false` to discard things you don't want.

```js
const url_filter = url => {
  return true; // default to accept all urls.
}

const pathname_filter = pathname => {
  return !fs.existsSync(pathname); // checking if already downloaded
}
```

###### 4. log

```js
const log_path = "./log.txt";
const logFiltered = false;
const logSuccessful = false;
```

`log_path` is where the log file to be dumped.

Turn `logFiltered` to true will log all entries filtered either by url_filter or pathname_filter out, and set `logSuccessful` to true will lead to successful downloads being logged too.

Remember to skim through the log file first if any problem was encountered.

#### main section

###### 5. filename

navigate to the main section, and scroll down a little, then you can see the naming logic, which looks like the snippet below.

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

Notably, the `2020-12-22` was a product of the function customizeDateFormat in config section above, converting en-us time format `12/22/2020` to `2020-12-22`. It may not work properly on your machine if you are using a different time format.

Take a look at [Twitter's official guidance](https://developer.twitter.com/en/docs/twitter-api/v1/data-dictionary/object-model/extended-entities) or [favs-example.ndjson](https://github.com/edfus/download-twitter-likes/blob/master/favs-example.ndjson) for reference about things you can access for DIY file naming.

## If proxy required

run `npm install proxy-agent`,

— and de-annotate below two lines in `index.mjs`

- `import ProxyAgent from 'proxy-agent';`
- `agent: new ProxyAgent('http://127.0.0.1:7890')`

Don't forget to modify the `http://127.0.0.1:7890` part to meet your proxy configuration!