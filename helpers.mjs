class Throttle {
  _queue = [];
  constructor (limit, seconds) {
    this._timer = setInterval(() => {
      if(this._queue.length) {
        const { resolve, reject, asyncFunc } = this._queue.shift();
        asyncFunc().then(resolve, reject);
      } else {
        this._timer.unref();
      }
    }, seconds * 1000 / limit);
  }

  async exec (asyncFunc) {
    return new Promise((resolve, reject) => {
      this._queue.push({
        resolve,
        reject,
        asyncFunc
      });

      this._timer && this._timer.ref();
    });
  }
}


export default Throttle