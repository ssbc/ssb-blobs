var rimraf = require('rimraf')
var osenv  = require('osenv')
var path   = require('path')
var mkdirp = require('mkdirp')
var level  = require('level')

var Blobs  = require('../inject')
var create = require('../create')

function test_create(name, async) {
  var dir = path.join(
    osenv.tmpdir(),
    'test-blobstore_'+Date.now()+'_'+name
  )
  rimraf.sync(dir)
  mkdirp.sync(dir)
  return Blobs(
    create(dir),
    require('../set')(level(dir, {valueEncoding: 'json'})),
    name
  )
}

//since we are using the real FS this time,
//we don't need to apply fake async.
var sync = require('./util').sync
require('./suite/simple')(test_create, sync)
require('./suite/integration')(test_create, sync)
require('./suite/legacy')(test_create, sync)
require('./suite/push')(test_create, sync)
