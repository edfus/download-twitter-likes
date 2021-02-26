import { request as request_http } from "http";
import { request as request_https } from "https";

const http_connect = request_http;

async function fetch(proxy, url) {
  const uriObject = url instanceof URL ? url : new URL(url);

  if (uriObject.protocol === "https:") {
    return new Promise((resolve, reject) => {
      const connectErrored = err => {
        reject(`connecting to proxy ${proxy} failed with ${err.stack || err}`);
      }

      http_connect(
        proxy,
        {
          method: "CONNECT",
          path: constructHost(uriObject),
          headers: {
            "Proxy-Authorization": `Basic ${Buffer.from(`${"username"}":"${"password"}`).toString("base64")}`
          },
        }
      )
        .once("connect", (response, socket) => {
          if (response.statusCode === 200) {
            // connected to proxy server
            request_https(
              uriObject,
              {
                method: "GET",
                socket: socket,
                agent: false
              }
            )
              .once("response", resolve)
              .once("error", err => {
                socket.destroy();
                return reject(err);
              })
              .end();
          } else {
            socket.destroy();
            return connectErrored(`${response.statusCode} ${response.statusMessage}`)
          }
        })
        .once("error", connectErrored)
        .end();
    })
  } else {
    return new Promise((resolve, reject) => {
      request_http(
        proxy,
        {
          // ...urlToHttpOptions(new URL(proxy)),
          path: uriObject.href,
          headers: {
            host: constructHost(uriObject)
          }
        }
      )
        .once("response", resolve)
        .once("error", reject)
        .end();
    })
  }
}

function constructHost(uriObject) {
  let port = uriObject.port;

  if (!port) {
    if (uriObject.protocol === "https:") {
      port = "443"
    } else {
      port = "80"
    }
  }

  return `${uriObject.hostname}:${port}`;
}

export { fetch };