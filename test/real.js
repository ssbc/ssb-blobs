
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

require('./index')(test_create)

