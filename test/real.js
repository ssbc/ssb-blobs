
var rimraf = require('rimraf')
var osenv  = require('osenv')
var path   = require('path')
var ref    = require('ssb-ref')
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
require('./simple')(test_create, sync)
require('./integration')(test_create, sync)
require('./legacy')(test_create, sync)
require('./push')(test_create, sync)




