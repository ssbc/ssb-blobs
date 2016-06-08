var interleavings = require('interleavings')

var Mock = require('./mock/blobs')
var MockSet = require('./mock/set')
var Blobs = require('../inject')

function create(name, async) {
  return Blobs(Mock(name, async), MockSet(async), name)
}


require('./simple')(create, interleavings.test)
require('./integration')(create, interleavings.test)
require('./legacy')(create, interleavings.test)
require('./push')(create, interleavings.test)



