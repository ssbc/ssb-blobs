const rimraf = require('rimraf')
const osenv = require('osenv')
const path = require('path')
const mkdirp = require('mkdirp')
const level = require('level')

const Blobs = require('../inject')
const create = require('../create')

function test_create (name, async) {
  const dir = path.join(
    osenv.tmpdir(),
    'test-blobstore_' + Date.now() + '_' + name
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
const sync = require('./util').sync
require('./suite/simple')(test_create, sync)
require('./suite/integration')(test_create, sync)
require('./suite/legacy')(test_create, sync)
require('./suite/push')(test_create, sync)
