var util = require('multiblob/util')
var isBlob = require('ssb-ref').isBlob
var MultiBlob = require('multiblob')

function desigil (hash) {
  return isBlob(hash) ? hash.substring(1) : hash
}

function resigil (hash) {
  return isBlob(hash) ? hash : '&'+hash
}

module.exports = function (dir) {
  return MultiBlob({
    dir: dir,
    alg: 'sha256',
    encode: function (buf, alg) {
      return resigil(util.encode(buf, alg))
    },
    decode: function (str) {
      return util.decode(desigil(str))
    },
    isHash: isBlob
  })
}


