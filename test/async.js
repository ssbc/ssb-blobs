var interleavings = require('interleavings')
require('./simple')(require('./mock'), interleavings.test)
require('./integration')(require('./mock'), interleavings.test)

