class PromiseStream {
  _arr = []
  _then = []
  _pipe = []

  count = 0
  succeeded = 0
  failed = 0

  constructor () {
    this._arr.push = ele => {
      Array.prototype.push.call(this._arr, ele);
      if(this._arr.length === this.count && this._then.length) {
        this._then.forEach(f => void f(this._arr));
        this._then = [];
      }
      return void 0;
    }
  } // https://chromium.googlesource.com/v8/v8/+/3.29.45/src/promise.js?autodive=0/#293

  push (promise) {
    this.count++;
    promise.then(value => {
              this.succeeded++;
              this._arr.push(
                this._pipe.reduce(
                  (pipe_in, pipe_to) => pipe_to(pipe_in), { status: 'fulfilled', value: value }
                )
              );
            })
           .catch(reason => {
              this.failed++;
              this._arr.push(
                  this._pipe.reduce(
                    (pipe_in, pipe_to) => pipe_to(pipe_in), { status: 'rejected', reason: reason }
                  )
                );
            })
    return void 0;
  }

  then (func) {
    if(this.count !== 0 && this._arr.length === this.count)
      func(this._arr);
    else this._then.push(func);

    return this;
  }

  pipe (func) {
    this._pipe.push(func);
    return this;
  }
}

export default PromiseStream