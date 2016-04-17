var pull = require('pull-stream')
module.exports = function noAsync (test, done) {
  function async(fn) {
    return fn
  }
  async.through = function () { return pull.through() }
  async.done = done
  test(async)
}


