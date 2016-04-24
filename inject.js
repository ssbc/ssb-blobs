'use strict'
function isEmpty (o) {
  for(var k in o) return false
  return true
}

function isInteger (i) {
  return Number.isInteger(i)
}

var Notify = require('pull-notify')
var pull = require('pull-stream')
var isBlobId = require('ssb-ref').isBlob

var MB = 1024*1024
var MAX_SIZE = 5*MB

function noop () {}

module.exports = function inject (blobs, name) {

  var notify = Notify()

  var peers = {}
  var want = {}, waiting = {}, getting = {}, available = {}, streams = {}
  var send = {}, timer

  function queue (hash, hops) {
    if(hops < 0)
      want[hash] = hops
    else
      delete want[hash]

    send[hash] = hops
    //setImmediate(function () {
      var _send = send
      send = {}
      notify(_send)
    //})
  }

  function isAvailable(id) {
    for(var peer in peers)
      if(available[peer] && available[peer][id])
        return peer
  }

  function get (peer, id, name) {
    if(getting[id]) return
    getting[id] = peer
//    var source = peers[peer].blobs.get({id: id, max: 5*1024*1024})
    var source = peers[peer].blobs.get(id)
    pull(source, blobs.add(id, function (err, _id) {
      delete getting[id]
      if(err) {
        delete available[peer][id]
        //check if another peer has this.
        //if so get it from them.
        if(peer = isAvailable(id)) get(peer, id, name)
      }
    }))
  }

  function wants (peer, id, hops) {
    if(!want[id] || want[id] < hops) {
      want[id] = hops
      queue(id, hops)
      if(peer = isAvailable(id)) {
        get(peer, id)
      }
    }
  }

  pull(
    blobs.ls({old: false, meta: true}),
    pull.drain(function (data) {
      queue(data.id, data.size)
      delete want[data.id]
      if(waiting[data.id])
        while(waiting[data.id].length)
          waiting[data.id].shift()(null, true)
    })
  )

  function has(peer, id, size) {
    available[peer] = available[peer] || {}
    available[peer][id] = size
    if(want[id] && !getting[id] && size < MAX_SIZE) get(peer, id)
  }

  function process (data, peer, cb) {
    var n = 0, res = {}
    for(var id in data) {
      if(isBlobId(id) && isInteger(data[id])) {
        if(data[id] <= 0) { //interpret as "WANT"
          n++
          //check whether we already *HAVE* this file.
          //respond with it's size, if we do.
          blobs.size(id, function (err, size) { //XXX
            if(size) res[id] = size
            else wants(peer, id, data[id] - 1)
            next()
          })
        }
        else if(data[id] > 0) { //interpret as "HAS"
          has(peer, id, data[id])
        }
      }
    }

    function next () {
      if(--n) return
      cb(null, res)
    }
  }

  function dead (peer_id) {
    delete peers[peer_id]
    delete available[peer_id]
    delete streams[peer_id]
  }

  function legacySync (peer) {
    var drain
    function hasLegacy (hashes) {
      var ary = Object.keys(hashes).filter(function (k) {
        return hashes[k] < 0
      })
      if(ary.length)
        peer.blobs.size(ary, function (err, sizes) {
          if(err) drain.abort(err) //abort this stream.
          else sizes.forEach(function (size, i) {
            if(size) has(peer, ary[i], size)
          })
        })
    }

    function notPeer (err) {
      if(err) dead(peer.id)
    }

    drain = pull.drain(hasLegacy, notPeer)
    pull(peer.blobs.changes(), pull.drain(function (hash) {
      has(peer.id, hash, true)
    }, notPeer))
    hasLegacy(want)

    //a stream of hashes
    pull(notify.listen(), drain)
  }

  function wantSink (peer) {
    if(!streams[peer.id])
      streams[peer.id] = notify.listen()
    var modern = false
    return pull.drain(function (data) {
        modern = true
        //respond with list of blobs you already have,
        process(data, peer.id, function (err, has_data) {
          //(if you have any)
          if(!isEmpty(has_data)) streams[peer.id].push(has_data)
        })
      }, function (err) {
        if(err && err.name === 'TypeError' && !modern) {
          streams[peer.id] = false
          legacySync(peer)
        }
        //handle error and fallback to legacy mode.
        else if(peers[peer.id] == peer) {
          delete peers[peer.id]
          delete available[peer.id]
          delete streams[peer.id]
        }
      })
  }

  var self
  return self = {
    has: function (hash, cb) {
      var a = Array.isArray(hash) ? hash : [hash]
      var o = {}
      a.forEach(function (h) { o[h] = -1 })
      //since this is always "has" process will never use the second arg.
      process(o, null, function () {})
      return blobs.has.call(this, hash, cb)
    },
    size: blobs.size,
    get: blobs.get,
    add: blobs.add,
    changes: function () {
      return blobs.ls({old: false, meta: false})
    },
    want: function (hash, cb) {
      //always broadcast wants immediately, because of race condition
      //between has and adding a blob (needed to pass test/async.js)
      var id = isAvailable(hash)
      if(!id) queue(hash, -1)

      if(waiting[hash])
        waiting[hash].push(cb)
      else {
        waiting[hash] = [cb]
        blobs.size(hash, function (err, has) {
          if(has) {
            while(waiting[hash].length)
              waiting[hash].shift()(null, true)
            delete waiting[hash]
          }
        })
      }
      if(id) return get(id, hash)
    },
    createWants: function () {
      return streams[this.id] || (streams[this.id] = notify.listen())
    },
    //private api. used for testing. not exposed over rpc.
    _wantSink: wantSink,
    _onConnect: function (other, name) {
      peers[other.id] = other
      pull(other.blobs.createWants(), wantSink(other))
    }
  }
}

