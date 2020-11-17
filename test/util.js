const debug = require('debug')('ssb-blobs')
const pull = require('pull-stream')
const crypto = require('crypto')

exports.log = function log (name) {
  if (!process.env.DEBUG) return pull.through()

  return pull.through(function (e) {
    debug(name, e)
  })
}

function bindAll (obj, context) {
  const o = {}
  for (const k in obj) {
    if (obj[k]) o[k] = obj[k].bind(context)
  }
  return o
}

exports.peers = function (nameA, a, nameB, b, async) {
  const na = nameA[0].toUpperCase()
  const nb = nameB[0].toUpperCase()
  // this is just a hack to fake rpc. over rpc each method is called
  // with the remote id in the current this context.
  a._onConnect({ id: nameB, blobs: bindAll(b, { id: nameA }) }, nb + na)
  b._onConnect({ id: nameA, blobs: bindAll(a, { id: nameB }) }, na + nb)
}

exports.hash = function (buf) {
  buf = typeof buf === 'string' ? Buffer.from(buf) : buf
  return '&' + crypto.createHash('sha256')
    .update(buf).digest('base64') + '.sha256'
}

exports.fake = function (string, length) {
  const b = Buffer.alloc(length)
  const n = Buffer.byteLength(string)
  for (let i = 0; i < length; i += n) b.write(string, i)
  return b
}

exports.sync = function noAsync (test, done) {
  function async (fn) {
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

exports.Server = function Server (opts = {}) {
  const stack = require('scuttle-testbot')
    .use(require('..'))

  return stack(opts)
}
