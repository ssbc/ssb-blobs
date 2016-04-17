var pull = require('pull-stream')
var crypto = require('crypto')

function hash(buf) {
  buf = 'string' == typeof buf ? new Buffer(buf) : buf
  return '&'+crypto.createHash('sha256')
            .update(buf).digest('base64')+'.sha256'
}

module.exports = function MockBlobStore (name, async) {

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
      console.log('GET', !!store[blobId], blobId)
      if(!store[blobId])
        return pull(pull.error(new Error('no blob:'+blobId)), async.through('get-error'))
      return pull(pull.values([store[blobId]]), async.through('get'))
    },
    has: async(function (blobId, cb) {
      console.log('**** HAS', name, blobId)
      async(cb, 'has-cb')(null, store[blobId] ? true : false)
    }, 'has'),
    size: async(function (blobId, cb) {
      console.log('**** SIZE', name, blobId)
      async(cb, 'size-cb')(null, store[blobId] ? store[blobId].length : null)
    }, 'size'),
    add: function (_hash, cb) {
      if('function' == typeof _hash)
        cb = _hash, _hash = null
      return pull(async.through('add'), pull.collect(async(function (err, data) {
        if(err) return cb(err)
        var h = add(Buffer.concat(data), _hash)
        if(!h) cb(new Error('wrong hash'))
        else cb(null, h)
      }, 'add-cb')))
    }
  }
}


