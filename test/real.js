
var rimraf = require('rimraf')
var osenv = require('osenv')
var path = require('path')
var ref = require('ssb-ref')

var create = require('../create')

function test_create(name) {
  var dir = path.join(osenv.tmpdir(), 'test-blobstore_'+name)
  rimraf.sync(dir)
  return create(dir)
}

require('./async')(test_create, function (test, done) {
  function async(fn) {
    return fn
  }
  async.through = function () {}
  async.done = done
  test(async)
})

