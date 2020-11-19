const interleavings = require('interleavings')

const Blobs = require('../inject')
const MockStore = require('./mock/blob-store')
const MockPush = require('./mock/blob-push')

const testCreate = (name, async) => Blobs(
  MockStore(name, async),
  MockPush(async),
  name
)

require('./suite/simple')(testCreate, interleavings.test)
require('./suite/integration')(testCreate, interleavings.test)
require('./suite/legacy')(testCreate, interleavings.test)
require('./suite/push')(testCreate, interleavings.test)
