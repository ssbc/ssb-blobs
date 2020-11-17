const rimraf = require('rimraf')
const osenv = require('osenv')
const path = require('path')
const mkdirp = require('mkdirp')
const level = require('level')

const Blobs = require('../inject')
const create = require('../create')
const { sync } = require('./util')

function testCreate (name, async) {
  const dir = path.join(
    osenv.tmpdir(),
    'test-blobstore_' + name + '_' + Date.now() + Math.random()
  )
  rimraf.sync(dir)
  mkdirp.sync(dir)
  return Blobs(
    create(dir),
    require('../set')(level(dir, { valueEncoding: 'json' })),
    name
  )
}

// since we are using the real FS this time,
// we don't need to apply fake async.
require('./suite/simple')(testCreate, sync)
require('./suite/integration')(testCreate, sync)
require('./suite/legacy')(testCreate, sync)
require('./suite/push')(testCreate, sync)
