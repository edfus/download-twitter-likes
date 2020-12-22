import { ok as assert } from "assert"
import { exec } from "child_process"
import { promises as fsp, readdirSync, existsSync } from "fs"

const path = "./test/likes/";

describe("download", () => {
  it("downloading tweets with multiple images", async () => 
    download("./test/favs.images.ndjson")
  ).timeout(5000);

  it("downloading tweets with video/animated gif", async () => 
    download("./test/favs.gif.ndjson")
  ).timeout(5000);
})

async function download(ndjson_file) {
  existsSync(path) && await fsp.rename(path, path.replace(/^(\.\/?)?test\/(.*)/, `$1test\/_${Math.random().toFixed(5)}.$2`));
  return new Promise((resolve, reject) => {
    exec(`npm run d -- --path=${path} --ndjson=${ndjson_file}`, async (err, stdout) => {
      if(err) reject(err)
      else {
        assert(existsSync(path));
        resolve(await dirAll(path, name => console.log("\t".concat(name))));
      }
    })
  })
}

async function dirAll(path, callback) {
  return Promise.all(readdirSync(path).map(async file => 
    (await fsp.stat(path + file)).isDirectory()
          ? dirAll(path + file + "/", callback) 
          : callback(path + file)
  ))
}

// if a Tweet's owner's username or screen_name had changed, duplication will be downloaded.