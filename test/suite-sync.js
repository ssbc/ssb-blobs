const Blobs = require('../inject')
const MockStore = require('./mock/blobs')
const MockSet = require('./mock/set')
const { sync } = require('./util')

const createBlobs = (name, _async) => Blobs(
  MockStore(name, _async),
  MockSet(_async),
  name
)

require('./suite/integration')(createBlobs, sync)
require('./suite/simple')(createBlobs, sync)
require('./suite/push')(createBlobs, sync)
require('./suite/legacy')(createBlobs, sync)
