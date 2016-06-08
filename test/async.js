var interleavings = require('interleavings')

var Mock = require('./mock')
var Blobs = require('../inject')

function create(name, async) {
  return Blobs(Mock(name, async), name)
}


require('./simple')(create, interleavings.test)
require('./integration')(create, interleavings.test)
require('./legacy')(create, interleavings.test)










