var pull = require('pull-stream')
var crypto = require('crypto')

var log = exports.log = function log (name) {
  if(process.env.DEBUG)
    return pull.through(function (e) {
      console.log(name, e)
    })
  else
    return pull.through()
}

function bindAll(obj, context) {
  var o = {}
  for(var k in obj)
    o[k] = obj[k].bind(context)
  return o
}

exports.peers = function (nameA, a, nameB, b, async) {
  var na = nameA[0].toUpperCase(), nb = nameB[0].toUpperCase()
  //this is just a hack to fake RPC. over rpc each method is called
  //with the remote id in the current this context.
  a._onConnect({id: nameB, blobs: bindAll(b, {id: nameA})}, nb+na)
  b._onConnect({id: nameA, blobs: bindAll(a, {id: nameB})}, na+nb)
}


exports.hash = function (buf) {
  buf = 'string' == typeof buf ? new Buffer(buf) : buf
  return '&'+crypto.createHash('sha256')
            .update(buf).digest('base64')+'.sha256'
}

exports.fake = function (string, length) {
  var b = new Buffer(length)
  var n = Buffer.byteLength(string)
  for(var i = 0; i < length; i += n)
    b.write(string, i)
  return b
}


exports.sync = function noAsync (test, done) {
  function async(fn) {
    return fn
  }
  async.through = function () { return pull.through() }
  async.done = done
  test(async)
}

exports.tests = function (tests) {
  tests(function (name, async) {
    return require('../inject')(
      require('./mock/blobs')(name, async),
      require('./mock/set')(async),
      name
    )
  }, exports.sync)
}
