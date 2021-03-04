import { Agent, request as request_http } from "http";
import { request as request_https, Agent as AgentHTTPS } from "https";
import { connect as tlsConnect } from "tls";

const http_connect = request_http;

const debug = {
  enable: true,
  id: {
    "http": {
      req: 0,
      tcp: 0
    },
    "https": {
      req: 0,
      tcp: 0
    }
  },
  socketsMap: new WeakMap()
};

class ProxyTunnel {
  constructor(proxy, proxyHeaders = {}, defaultHeaders = {}) {
    this.proxy = new URL(proxy);
    this.proxyHeaders = proxyHeaders;
    this.defaultHeaders = {
      "User-Agent": `node ${process.version}`,
      "Accept": "*/*",
      ...defaultHeaders
    };

    this.httpAgent = new Agent({
      keepAlive: true,
      maxSockets: 5
    });
    this.httpsAgent = new AgentHTTPS({
      keepAlive: true
    });
    this.httpsAgent.createConnection = this.createSecureConnection.bind(this);
  }

  createSecureConnection({ host: hostname, port }, cb) {
    http_connect(
      this.proxy,
      {
        method: "CONNECT",
        agent: this.httpAgent,
        path: `${hostname}:${port}`,
        headers: {
          "Host": `${hostname}:${port}`,
          ...this.proxyHeaders
        }
      }
    )
      .once("connect", (response, socket) => {
        if (response.statusCode === 200) {
          return cb(null, tlsConnect({
            host: hostname,
            servername: hostname,
            port: port,
            socket: socket
          }));
        } else {
          socket.destroy();
          return cb(connectErrored(`${response.statusCode} ${response.statusMessage}`));
        }
      })
      .once("error", err => cb(connectErrored(err)))
      .end();
  }

  destroy() {
    this.httpsAgent.destroy();
    this.httpAgent.destroy();
  }

  async fetch(url) {
    const uriObject = url instanceof URL ? url : new URL(url);

    const request = (
      uriObject.protocol === "https:"
        ? request_https(
          uriObject,
          {
            agent: this.httpsAgent,
            headers: {
              // "Persist": uriObject.hostname,
              // "Connection": "keep-alive, persist",
              ...this.defaultHeaders
            }
          }
        )
        : request_http(
          this.proxy,
          {
            path: uriObject.toString(),
            agent: this.httpAgent,
            headers: {
              ...this.defaultHeaders,
              Host: constructHost(uriObject),
              ...this.proxyHeaders
            },
            setHost: false
          }
        )
    );

    return new Promise((resolve, reject) => {
      request
        .once("response", resolve)
        .once("error", err => {
          if (request.reusedSocket && err.code === 'ECONNRESET') {
            request.removeListener("response", resolve);
            this.fetch.apply(this, arguments).then(resolve, reject);
          } else {
            return reject(err);
          }
        })
        .end()
      ;

      if (debug.enable) {
        const protocol = request.protocol.replace(/(?<=https?):/, "");
        const id = debug.id[protocol];
        const socketName = ["socket", "tlsSocket"][Number(protocol === "https")];
        
        request
          .once("socket", socket => {
            id.req++;
            if (debug.socketsMap.has(socket)) {
              console.info(
                "\x1b[36m%s\x1b[0m", // cyan
                `✓  ${protocol} request ${id.req} reusing ${socketName} ${debug.socketsMap.get(socket)}`
              );
            } else {
              id.tcp++;
              debug.socketsMap.set(socket, id.tcp);
              console.info(`-  ${protocol} request ${id.req} using new ${socketName} ${id.tcp}`);
              
              socket.once("close", errored => {
                const log = [];
                if(request.reusedSocket) {
                  log.push("\x1b[33m%s\x1b[0m"); // yellow
                  log.push("Reused");
                } else {
                  log.push("✕  ");
                }

                log.push(`${socketName} ${id.tcp} for ${protocol} request ${id.req} closed`);

                if(errored) {
                  log.push("\x1b[31mWITH ERROR\x1b[0m"); // red
                }
                console.info.apply(void 0, log);
              });
            }
          })
          .once("close", () => console.info(`☓  ${protocol} request ${id.req} closed connection`));
      }
    });
  }
}

export default ProxyTunnel;

function connectErrored(err) {
  return `connecting to proxy failed with ${err.stack || err}`;
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