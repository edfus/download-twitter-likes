class Throttle {
  reached = 0

  constructor (limit, seconds) {
    this.limit = limit;
    this.seconds = seconds;
    this.start();
  }

  start () {
    this.end()
    this._intervalID = setInterval(() => {
      this.reached = 0;
      this._intervalFuncArr.forEach(f => f());
    }, this.seconds * 1000);
  }

  end () {
    clearInterval(this._intervalID);
    this._intervalFuncArr = [];
  }

  afterReset (func) {
    this._intervalFuncArr.push(func);
  }
}


export default Throttle