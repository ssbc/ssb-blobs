var pull = require('pull-stream')
var crypto = require('crypto')
var cont = require('cont')
var Notify = require('pull-notify')
var assert = require('assert')

function hash(buf) {
  buf = 'string' == typeof buf ? new Buffer(buf) : buf
  return '&'+crypto.createHash('sha256')
            .update(buf).digest('base64')+'.sha256'
}

function single (fn) {
  var waiting = {}
  return function (value, cb) {
    if(!waiting[value]) {
      waiting[value] = [cb]
      fn(value, function done (err, result) {
        var cbs = waiting[value]
        delete waiting[value]
        while(cbs.length) cbs.shift()(err, result)
      })
    }
    else
      waiting[value].push(cb)
  }
}

module.exports = function MockBlobStore (name, async) {

  var notify = Notify()

  var store = {}
  function add (buf, _h) {
    var h = hash(buf)
    if(_h && _h != h) return false
    store[h] = buf
    return h
  }

  function all(fn) {
    return function (value) {
      return Array.isArray(value) ? cont.para(value.map(function (e) { return fn(e) })) : fn(value)
    }
  }

  function toAsync (fn, name) {
    return async(function (value, cb) {
      fn(value)(function (err, value) {
        async(cb, name+'-cb')(err, value)
      })
    }, name)
  }

  return {
    store: store,
    get: function (blobId) {
      if(!store[blobId])
        return pull(pull.error(new Error('no blob:'+blobId)), async.through('get-error'))
      return pull(pull.values([store[blobId]]), async.through('get'))
    },
    has: single(toAsync(all(cont(function (blobId, cb) {
      cb(null, store[blobId] ? true : false)
    })), 'has')),
    size: single(toAsync(all(cont(function (blobId, cb) {
      cb(null, store[blobId] ? store[blobId].length : null)
    })), 'size')),
    ls: function (opts) {
      //don't implement all the options, just the ones needed by ssb-blobs
      assert.equal(opts.old, false, 'must have old')
      if(opts.meta) //used internally.
        return notify.listen()
      else //used as blobs.changes (legacy api)
        return pull(notify.listen(), pull.map(function (e) { return e.id }))
    },
    add: function (_hash, cb) {
      if('function' == typeof _hash)
        cb = _hash, _hash = null
      if(!cb) cb = function (err) {
        if(err) throw err
      }
      return pull(async.through('add'), pull.collect(async(function (err, data) {
        if(err) return cb(err)
        data = Buffer.concat(data)
        var h = add(data, _hash)
        console.log('..ADDED', name, h)
        if(!h) cb(new Error('wrong hash'))
        else {
          notify({id: h, size: data.length, ts: Date.now()})
          cb(null, h)
        }
      }, 'add-cb')))
    }
  }
}



