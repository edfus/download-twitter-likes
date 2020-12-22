//TODO: remove dependencies fetch and ProxyAgent
import fetch from 'node-fetch';
import fs    from 'fs'
import split2    from 'split2'
import ProxyAgent from 'proxy-agent';
import Throttle from "./helpers.mjs"
import PromiseStream from "./promise_stream.mjs"

const proxyAgent = new ProxyAgent(process.env.http_proxy || 'http://127.0.0.1:7890');
const fsp = fs.promises;

// config

const path = process.argv[2] || "./likes/";

const throttleLimit = 20;
const throttleSeconds = 10;

const customizeDateFormat = date_obj => {
  return date_obj
          .toLocaleDateString()
          .replace(/(.*?)\/(20\d{2})/, "$2-$1")
          .replace(/-(\d+)/g, 
              (match, p1) => p1.length > 1 ? match : "-0".concat(p1)
            );
};

const url_filter = url => {
  return true;
}

const pathname_filter = pathname => {
  return !fs.existsSync(pathname);
}

const log_path = "./log.txt";
const logFiltered = false;
const logSuccessful = false;

// main
const promises = new PromiseStream();
const log = fs.createWriteStream(log_path);

console.info(`\nA complete log of this run can be found in ${log_path}`);

(async () => {
  if(!fs.existsSync(path) || !(await fsp.stat(path)).isDirectory()) {
    fs.mkdirSync(path)
  }

  fs.createReadStream("favs.ndjson")
    .pipe(split2(JSON.parse))
    .on('data', async fav => {
      const details = replaceReservedChars (
          [
            customizeDateFormat(new Date(fav.created_at)),
            fav.user.name.concat("@").concat(fav.user.screen_name),
            fav.id_str // using id_str for JS's IEEE floating point math precision concern
          ]
            .join("_")
            .concat(fav.retweeted ? "--retweeted" : "")
        );
        
      if(!fav.extended_entities || !fav.extended_entities.media.length)
          return ;

      switch (fav.extended_entities.media.length) {
        case 0: return ;
        case 1:
          return promises.push (
            fetchMedia (
              fav.extended_entities.media[0],
              details,
              path
            )
          )
        default:
          const dir = path.concat(details);
          if(!fs.existsSync(dir) || !(await fsp.stat(dir)).isDirectory())
            fs.mkdirSync(dir)
          return promises.push (
            Promise.all(fav.extended_entities.media.map((media, index) => 
              fetchMedia (
                media,
                String(index),
                dir.concat("/")
              )
            )).catch(async err => { // delete the empty folder if failed
              if(!(await fsp.readdir(dir)).length) // if empty
                return new Promise((resolve, reject) => {
                  try { // in case rmdir_err rejects first and resulting in overwriting err
                    fsp.rmdir(dir);
                  } catch(rmdir_err) {
                    console.error(rmdir_err);
                  } finally {
                    reject(err); // still passing the error
                  }
                })
              else throw err; // still passing the error
            })
          )
      }
    })
    .on("end", () => 
        promises.then(results => {
          throttle.end();
          log.end("Done.", () => {
            console.info("Done.");
            process.exit(0);
          });
        })
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
async function fetchMedia (source, name, path) {
  switch (source.type) {
    case "photo": return _fetch(source.media_url, name.concat(extractFileFormat(source.media_url)), path)
    case "animated_gif": // fall through
    case "video":
      const url = source.video_info.variants.reduce((max, current) => 
        current.bitrate >= max.bitrate ? current : max
      , {bitrate: 0}).url;

      return _fetch(url, name.concat(extractFileFormat(url)), path);
  }
}

const throttle = new Throttle(throttleLimit, throttleSeconds);

let printed = false;

throttle.afterReset(() => printed = false);

async function _fetch (url, name, path = "./") {
  if(!url_filter(url) || !pathname_filter(path + name))
    return {
      name: "Filtered",
      message: {
        url: url,
        pathname: path + name
      }
    };

  if(throttle.reached >= throttle.limit) {
    if(!printed) {
      printed = true;
      console.info(`Finished ${promises.succeeded + promises.failed}/${promises.count}. ${promises.succeeded} succeeded, ${promises.failed} failed.`)
    }
    return new Promise(resolve => setTimeout(() => resolve(_fetch (url, name, path)), throttle.seconds * 1088))
  }
  
  throttle.reached++;

  return fetch(url, {
            agent: proxyAgent //NOTE: delete this line if not using a proxy
          })
          .then(response => {
            if(response.status === 200) {
              return new Promise((resolve, reject) => {
                response.body.pipe(fs.createWriteStream(path + name))
                             .on("finish", () => resolve({
                                  name: 'Successful',
                                  message: {
                                    url: url,
                                    pathname: path + name
                                  }
                                })
                              )
                              .on("error", err => reject(err))
              })
            } else {
              return Promise.reject({
                name: `${response.status} ${response.statusText}`,
                message: {
                  url: url,
                  pathname: path + name
                }
              });
            }
          })
}

function extractFileFormat (url) {
  const lastDot_i = url.lastIndexOf(".");
  const lastQM_i = url.lastIndexOf("?");
  return url.substring(lastDot_i, lastQM_i === -1 ? url.length : lastQM_i);
}

function replaceReservedChars (filename) {
  return filename.replace(/<|>|:|"|\/|\\|\||\?|\*/g, "-");
}

function write (toWrite) {
  log.write(`${toWrite.name}:\n`);
  log.write(
    typeof toWrite.message === "object"
    ? Object.entries(toWrite.message)
      .map(([key, value]) => `\t${key}: ${value}`)
      .join("\n")
    : "\t".concat(toWrite.message.toString())
    );
  log.write("\n\n")
}