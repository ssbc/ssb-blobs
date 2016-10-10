'use strict'
function isEmpty (o) {
  for(var k in o) return false
  return true
}

function isInteger (i) {
  return Number.isInteger(i)
}

var isArray = Array.isArray

var Notify = require('pull-notify')
var pull = require('pull-stream')
var isBlobId = require('ssb-ref').isBlob

var MB = 1024*1024
var MAX_SIZE = 5*MB
var MIN_PUSH_PEERS = 3
function noop () {}

function clone (obj) {
  var o = {}
  for(var k in obj)
    o[k] = obj[k]
  return o
}

module.exports = function inject (blobs, set, name) {
  var notify = Notify()
  var pushed = Notify()

  var peers = {}
  var want = {}, push = {}, waiting = {}, getting = {}
  var available = {}, streams = {}
  var send = {}, timer

  function queue (hash, hops) {
    if(hops < 0)
      want[hash] = hops
    else
      delete want[hash]

    send[hash] = hops
    var _send = send;
    send = {}
    notify(_send)
  }

  function isAvailable(id) {
    for(var peer in peers)
      if(available[peer] && available[peer][id] && peers[peer])
        return peer
  }

  function get (peer, id, name) {
    if(getting[id] || !peers[peer]) return

    getting[id] = peer
    //XXX REINSTATE MAXIMUM SIZE BLOBS!
//    var source = peers[peer].blobs.get({id: id, max: 5*1024*1024})
    var source = peers[peer].blobs.get(id)
    pull(source, blobs.add(id, function (err, _id) {
      delete getting[id]
      if(err) {
        if(available[peer]) delete available[peer][id]
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

  function has(peer_id, id, size) {
    if('string' !== typeof peer_id) throw new Error('peer must be string id')
    available[peer_id] = available[peer_id] || {}
    available[peer_id][id] = size
    //if we are broadcasting this blob,
    //mark this peer has it.
    //if N peers have it, we can stop broadcasting.
    if(push[id]) {
      push[id][peer_id] = size
      if(Object.keys(push[id]).length >= MIN_PUSH_PEERS) {
        var data = {key: id, peers: push[id]}
        set.remove(id)
        delete push[id]; pushed(data)
      }
    }
    if(want[id] && !getting[id] && size < MAX_SIZE) get(peer_id, id)
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

  //LEGACY LEGACY LEGACY

  function legacySync (peer) {
    var drain //we need to keep a reference to drain
              //so we can abort it when we get an error.
    function hasLegacy (hashes) {
      var ary = Object.keys(hashes).filter(function (k) {
        return hashes[k] < 0
      })
      if(ary.length)
        peer.blobs.has(ary, function (err, haves) {
          if(err) drain.abort(err) //ERROR: abort this stream.
          else haves.forEach(function (have, i) {
            if(have) has(peer.id, ary[i], have)
          })
        })
    }

    function notPeer (err) {
      if(err) dead(peer.id)
    }

    drain = pull.drain(function (hash) {
      has(peer.id, hash, true)
    }, notPeer)


    pull(peer.blobs.changes(), drain)

    hasLegacy(want)

    //a stream of hashes
    pull(notify.listen(), pull.drain(hasLegacy, notPeer))
  }
  //LEGACY LEGACY LEGACY

  function createWantStream (id) {
    if(!streams[id]) {
      streams[id] = notify.listen()

      //merge in ids we are pushing.
      var w = clone(want)
      for(var k in push) w[k] = -1
      streams[id].push(w)

      return streams[id]
    }
    return streams[id]
  }

  function wantSink (peer) {
    createWantStream(peer.id) //set streams[peer.id]

    var modern = false
    return pull.drain(function (data) {
        modern = true
        //respond with list of blobs you already have,
        process(data, peer.id, function (err, has_data) {
          //(if you have any)
          if(!isEmpty(has_data) && streams[peer.id]) streams[peer.id].push(has_data)
        })
      }, function (err) {
        if(err && !modern) {
          streams[peer.id] = false
          legacySync(peer)
        }
        //if can handle unpeer another way,
        //then can refactor legacy handling out of sight.

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
    //id: name,
    has: function (hash, cb) {
      if(isArray(hash)) {
        for(var i = 0; i < hash.length; i++)
          if(!isBlobId(hash[i]))
            return cb(new Error('invalid hash:'+hash[i]))
      }
      else if(!isBlobId(hash))
        return cb(new Error('invalid hash:'+hash))

      if(this === self || !this || this === global) { // a local call
        return blobs.has.call(this, hash, cb)
      }
      //LEGACY LEGACY LEGACY

        //ELSE, interpret remote calls to has as a WANT request.
        //handling this by calling process (which calls size())
        //avoids a race condition in the tests.
        //(and avoids doubling the number of calls)
        var a = Array.isArray(hash) ? hash : [hash]
        var o = {}
        a.forEach(function (h) { o[h] = -1 })
        //since this is always "has" process will never use the second arg.
        process(o, null, function (err, res) {
          var a = []; for(var k in o) a.push(res[k] > 0)
          cb(null, Array.isArray(hash) ? a : a[0])
        })

      //LEGACY LEGACY LEGACY

    },
    size: blobs.size,
    get: blobs.get,
    add: blobs.add,
    ls: blobs.ls,
    changes: function () {
      return blobs.ls({old: false, meta: false})
    },
    want: function (hash, cb) {
      if(!isBlobId(hash)) 
        return cb(new Error('invalid hash:'+hash))
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
    push: function (id, cb) {
      //also store the id to push.
      if(!isBlobId(id)) 
        return cb(new Error('invalid hash:'+id))

      push[id] = push[id] || {}
      queue(id, -1)
      set.add(id, cb)
    },
    pushed: function () {
      return pushed.listen()
    },
    createWants: function () {
      return createWantStream(this.id)
    },
    //private api. used for testing. not exposed over rpc.
    _wantSink: wantSink,
    _onConnect: function (other, name) {
      peers[other.id] = other
      //sending of your wants starts when you we know
      //that they are not legacy style.
      //process is called when wantSync
      //doesn't immediately get an error.
      pull(other.blobs.createWants(), wantSink(other))
    }
  }
}








