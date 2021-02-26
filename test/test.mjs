import { ok as assert, strictEqual } from "assert"
import { exec } from "child_process"
import { promises as fsp, readdirSync, existsSync } from "fs"
import { dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const path = __dirname.concat("/likes/");

xdescribe("download", () => {
  it("downloading tweets with multiple images", async () => 
    download(__dirname.concat("/favs.images.ndjson"))
  ).timeout(5000);

  it("downloading tweets with video/animated gif", async () => 
    download(__dirname.concat("/favs.gif.ndjson"))
  ).timeout(5000);
});

import { fetch } from "../proxy-tunnel.mjs";

describe("proxy", () => {
  it("https", async () => {
    await Promise.all([
      fetch("http://127.0.0.1:7890", "https://www.google.com")
        .then(response => strictEqual(response.statusCode, 200))
    ])
  }).timeout(5000);;

  it("http", async () => {
    await Promise.all([
      fetch("http://127.0.0.1:7890", "http://www.google.com")
        .then(response => strictEqual(response.statusCode, 200))
    ])
  }).timeout(10000);;
});

async function download(ndjson_file) {
  return new Promise((resolve, reject) => {
    const outputDir = renameTo(ndjson_file);
    exec(`npm run d -- --path="${outputDir}" --ndjson="${ndjson_file}"`, async (err, stdout) => {
      if(err) reject(err)
      else {
        assert(existsSync(outputDir) && (await fsp.readdir(outputDir)).length);
        resolve(await dirAll(outputDir, name => console.log("\t".concat(name))));
      }
    })
  })
}

async function dirAll(path, callback) {
  return Promise.all(readdirSync(path).map(async file => 
    (await fsp.stat(path + file)).isDirectory()
          ? dirAll(path + file + "/", callback) 
          : callback(file)
  ))
}

function renameTo (ndjson_file) {
  return path.concat(basename(ndjson_file, ".ndjson")).concat("/");
}

// if a Tweet's owner's username or screen_name had changed, duplication will be downloaded.