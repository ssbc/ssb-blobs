var pull = require('pull-stream')
var crypto = require('crypto')

function hash(buf) {
  buf = 'string' == typeof buf ? new Buffer(buf) : buf
  return '&'+crypto.createHash('sha256')
            .update(buf).digest('base64')+'.sha256'
}

module.exports = function MockBlobStore () {
  var store = {}
  function add (buf, _h) {
    var h = hash(buf)
    if(_h && _h != h) return false
    store[h] = buf
    return h
  }

  return {
    store: store,
    get: function (blobId) {
      if(!store[blobId])
        return pull.error(new Error('no blob:'+blobId))
      return pull.values([store[blobId]])
    },
    has: function (blobId, cb) {
      cb(null, store[blobId] ? true : false)
    },
    size: function (blobId, cb) {
      cb(null, store[blobId] ? store[blobId].length : null)
    },
    add: function (_hash, cb) {
      if('function' == typeof _hash)
        cb = _hash, _hash = null
      return pull.collect(function (err, data) {
        if(err) return cb(err)
        var h = add(Buffer.concat(data), _hash)
        if(!h) cb(new Error('wrong hash'))
        else cb(null, h)
      })
    }
  }
}


