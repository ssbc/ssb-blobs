var interleavings = require('interleavings')

var Mock = require('./mock/blobs')
var MockSet = require('./mock/set')
var Blobs = require('../inject')

function create (name, async) {
  return Blobs(Mock(name, async), MockSet(async), name)
}

require('./suite/simple')(create, interleavings.test)
require('./suite/integration')(create, interleavings.test)
require('./suite/legacy')(create, interleavings.test)
require('./suite/push')(create, interleavings.test)
