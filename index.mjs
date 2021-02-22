import { get } from "http";
import { pipeline, Transform, Writable } from 'stream';
import { createReadStream, createWriteStream, existsSync, promises as fsp } from 'fs';

import Throttle from "./helpers.mjs";
import PromiseStream from "./promise_stream.mjs";

// proxy
const useProxy = false;

const fetch = (url, cb) => {
  if (useProxy) {
    return (
      get({
        host: "127.0.0.1",
        path: url,
        port: 7890,
        protocol: "http:",
        headers: {
          host: url
        }
      }, cb)
    );
  } else {
    return get(url, cb);
  }
}

// config
const path = extractArg(/-{1,2}path=/i) || "./likes/";
const ndjson_path = extractArg(/-{1,2}ndjson(_?path)?=/i) || "favs.ndjson";

const throttleLimit = 20;
const throttleSeconds = 10;

const log_path = extractArg(/-{1,2}log(_?path)?=/i) || "./log.txt";
const logFiltered = true;
const logSuccessful = true;

import SetDB from "./set-db.mjs";
const dbPathname = "./media.db.csv";
const db = new SetDB(dbPathname);

(async function customInitializer () {
  await db.loaded;
})()

const url_filter = (url, messagePtr) => {
  if(!db.has(url)) {
    db.add(url);
    return true; // for creating db from ndjson files, just return false
  } else {
    messagePtr.reason = `Already exists in db (${dbPathname})`;;
    return false;
  }
}

const pathname_filter = pathname => {
  return !existsSync(pathname);
}

const customizeDateFormat = date_obj => {
  return date_obj
    .toLocaleDateString()
    .replace(/(.*?)\/(20\d{2})/, "$2-$1") // Move 202x to the front (for en-us)
    .replace(/-(\d+)/g, // replace 2020-1-1 to 2020-01-01 for win's sequences method.
      (match, p1) => p1.length > 1 ? match : "-0".concat(p1)
    );
};

// main
const promises = new PromiseStream();
const log = createWriteStream(log_path);

console.info(`\nA complete log of this run can be found in ${log_path}`);

(async () => {
  if (!existsSync(path)) {
    await fsp.mkdir(path);
  }

  const kSource = Symbol("source");

  pipeline(
    createReadStream(ndjson_path),
    new class extends Transform { // parse ndjson
      constructor() {
        super({ readableObjectMode: true });
        this.separator = /\r?\n/
        this.process = JSON.parse.bind(JSON);
        this.decoder = new TextDecoder("utf8");
        this[kSource] = '';
      }

      _transform(texts, encoding, cb) {
        if (encoding === "buffer") {
          texts = this.decoder.decode(texts, { stream: true });
        }

        const parts = texts.split(this.separator);

        if (parts.length === 1)
          return cb();

        // length > 1
        parts[0] = this[kSource].concat(parts[0])

        for (let i = 1; i < parts.length - 1; i++) {
          this.push(this.process(parts[i]))
        }

        this[kSource] = parts[parts.length - 1];
        return cb();
      }
      _flush(cb) {
        const lastPart = this[kSource].concat(this.decoder.decode());
        if(lastPart.length)
          this.push(this.process(lastPart));
        return cb();
      }
    },
    new Writable({
      objectMode: true,
      async write(fav, meaningless, next) {
        const details = replaceReservedChars(
          [
            customizeDateFormat(new Date(fav.created_at)),
            fav.user.name.concat("@").concat(fav.user.screen_name),
            fav.id_str // using id_str for JS's IEEE floating point math precision concern
          ]
            .join("_")
            .concat(fav.retweeted ? "--retweeted" : "")
        );

        if (!fav.extended_entities || !fav.extended_entities.media.length)
          return next();

        switch (fav.extended_entities.media.length) {
          case 0: return next();
          case 1:
            promises.push(
              fetchMedia(
                fav.extended_entities.media[0],
                details,
                path
              )
            );
            return next();
          default:
            const dir = path.concat(details);
            if (!existsSync(dir))
              await fsp.mkdir(dir);
            return promises.push(
              Promise.all(
                fav.extended_entities.media.map(
                  (media, index) =>
                    fetchMedia(
                      media,
                      String(index),
                      dir.concat("/")
                    )
                )
              ).catch(async error => { // delete the empty folder if failed
                if (!(await fsp.readdir(dir)).length) {// if empty
                  try { // in case rmdir_err rejects first and resulting in overwriting err
                    fsp.rmdir(dir);
                  } catch (rmdir_err) {
                    console.error(rmdir_err);
                  } finally {
                    throw error; // still passing the error
                  }
                } else throw error; // still passing the error
              })
                .catch(error => next(error))
                .then(message => {
                  next();
                  return message;
                })
            )
        }
      }
    }),
    error => {
      if (error)
        throw error;
      promises.then(results => {
        throttle.end();
        log.end("Done.", () => {
          console.info("Done.");
          process.exit(0);
        });
      });
    }
  )

  promises.pipe(result => {
    if (result.status === "fulfilled") {
      switch (result.value.name) {
        case 'Filtered': logFiltered && write(result.value);
          break;
        case 'Successful': logSuccessful && write(result.value);
          break;
      }
    } else write(result.reason); // rejected

    return void 0; // hijacked! just drain it.
  })
})()

// https://developer.twitter.com/en/docs/twitter-api/v1/data-dictionary/object-model/extended-entities
async function fetchMedia(source, name, path) {
  switch (source.type) {
    case "photo": return _fetch(source.media_url, name.concat(extractFileFormat(source.media_url)), path)
    case "animated_gif": // fall through
    case "video":
      const url = (
        source.video_info.variants.reduce(
          (max, current) =>
            current.bitrate >= max.bitrate ? current : max,
          { bitrate: 0 }
        ).url
      );

      return _fetch(url, name.concat(extractFileFormat(url)), path);
  }
}

const throttle = new Throttle(throttleLimit, throttleSeconds);

let printed = false;

throttle.afterReset(() => printed = false); // resets every ${throttleSeconds}

async function _fetch(url, name, path = "./") {
  const messageTemp = {};
  if (!url_filter(url, messageTemp) || !pathname_filter(path + name, messageTemp))
    return {
      name: "Filtered",
      message: {
        url: url,
        pathname: path + name,
        ...messageTemp
      }
    };

  if (throttle.reached >= throttle.limit) {
    if (!printed) {
      printed = true;
      console.info(`Finished ${promises.succeeded + promises.failed}/${promises.count}. ${promises.succeeded} succeeded, ${promises.failed} failed.`)
    }
    return new Promise(resolve => setTimeout(() => resolve(_fetch.apply(this, arguments)), throttle.seconds * 1088))
  } // throttled

  throttle.reached++;

  return new Promise((resolve, reject) =>
    fetch(
      url,
      response =>
        response.statusCode === 200
          ? pipeline(
            response,
            createWriteStream(path + name),
            err => err ? reject(err) : resolve({
              name: 'Successful',
              message: {
                url: url,
                pathname: path + name
              }
            })
          )
          : reject({
            name: `${response.statusCode} ${response.statusMessage}`,
            message: {
              url: url,
              pathname: path + name
            }
          }) || response.resume()
      // Consume response data to free up memory
      // https://nodejs.org/api/http.html#http_http_get_url_options_callback
    )
  );
}

function extractFileFormat(url) {
  const lastDot_i = url.lastIndexOf(".");
  const lastQM_i = url.lastIndexOf("?"); // question mark, in case urls like abc.jpg?10
  return url.substring(lastDot_i, lastQM_i === -1 ? url.length : lastQM_i);
}

function replaceReservedChars(filename) {
  return filename.replace(/<|>|:|"|\/|\\|\||\?|\*/g, "-");
} // above are reserved characters in **windows**

function write(toWrite) {
  if(toWrite.stack) {
    log.write(toWrite.stack)
  } else {
    log.write(`${toWrite.name}:\n`);
    log.write(
      typeof toWrite.message === "object"
        ? Object.entries(toWrite.message)
          .map(([key, value]) => `\t${key}: ${value}`)
          .join("\n")
        : "\t".concat(toWrite.message.toString())
    );
  }
  
  log.write("\n\n")
}

function extractArg(matchPattern) {
  for (let i = 2; i < process.argv.length; i++) {
    if (matchPattern.test(process.argv[i])) {
      const split = process.argv[i].split(matchPattern)
      return split[split.length - 1];
    }
  }
  return false;
}