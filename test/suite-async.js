const interleavings = require('interleavings')

const Blobs = require('../inject')
const MockStore = require('./mock/blobs')
const MockSet = require('./mock/set')

const testCreate = (name, async) => Blobs(
  MockStore(name, async),
  MockSet(async),
  name
)

require('./suite/simple')(testCreate, interleavings.test)
require('./suite/integration')(testCreate, interleavings.test)
require('./suite/legacy')(testCreate, interleavings.test)
require('./suite/push')(testCreate, interleavings.test)
