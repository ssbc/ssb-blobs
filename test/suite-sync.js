const Blobs = require('../inject')
const MockStore = require('./mock/blob-store')
const MockPush = require('./mock/blob-push')
const { sync } = require('./util')

const createBlobs = (name, _async) => Blobs(
  MockStore(name, _async),
  MockPush(_async),
  name
)

require('./suite/integration')(createBlobs, sync)
require('./suite/simple')(createBlobs, sync)
require('./suite/push')(createBlobs, sync)
require('./suite/legacy')(createBlobs, sync)
