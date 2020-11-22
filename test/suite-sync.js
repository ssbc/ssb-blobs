const Blobs = require('../inject')
const MockStore = require('./mock/blobs')
const MockPush = require('./mock/set')
const { sync } = require('./util')

const createBlobs = (name, _async) => Blobs(
  MockStore(name, _async),
  MockPush(_async),
  name
)

const name = 'SYNC'
require('./suite/integration')(createBlobs, sync, name)
require('./suite/simple')(createBlobs, sync, name)
require('./suite/push')(createBlobs, sync, name)
require('./suite/legacy')(createBlobs, sync, name)
