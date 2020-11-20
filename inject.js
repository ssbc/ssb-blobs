'use strict'
const pullDefer = require('pull-defer')
function isEmpty (o) {
  for (const k in o) if (k) return false
  return true
}

const Notify = require('pull-notify')
const pull = require('pull-stream')
const isBlobId = require('ssb-ref').isBlob

// var MB = 1024 * 1024
// var MAX_SIZE = 5 * MB

function clone (obj) {
  const o = {}
  for (const k in obj) { o[k] = obj[k] }
  return o
}

function onAbort (abortCb) {
  return function (read) {
    return function (abort, cb) {
      if (abort) abortCb(abort, cb)
      else read(null, cb)
    }
  }
}

function toBlobId (id) {
  if (Array.isArray(id)) return id// .map(toBlobId)
  return isBlobId(id) ? id : isBlobId(id && id.id) ? id.id : null
}

function wrap (fn) {
  return function (id, cb) {
    if (!toBlobId(id)) {
      cb = id
      return fn.call(this, cb)
    }
    return fn.call(this, toBlobId(id), cb)
  }
}

module.exports = function inject (blobStore, blobPush, name, opts) {
  opts = opts || {}
  // sympathy controls whether you'll replicate
  const sympathy = opts.sympathy == null ? 3 : opts.sympathy | 0
  const stingy = opts.stingy === true
  const legacy = opts.legacy !== false
  const pushy = opts.pushy || 3
  const max = opts.max || 5 * 1024 * 1024

  const notify = Notify()
  const pushed = Notify()

  const peers = {}
  const want = {}
  const waiting = {}
  const getting = {}
  const available = {}
  const streams = {}
  const push = {}
  let send = {}

  blobPush.state(state => {
    Object.keys(state).forEach(blobId => {
      push[blobId] = push[blobId] || {}
    })
  })

  function queue (id, hops) {
    if (hops < 0) want[id] = hops
    else delete want[id]

    send[id] = hops
    const _send = send
    send = {}
    notify(_send)
  }

  function isAvailable (id) {
    for (const peer in peers) {
      if (available[peer] && available[peer][id] < max && peers[peer]) { return peer }
    }
  }

  function get (peer, id) {
    if (getting[id] || !peers[peer]) return

    getting[id] = peer
    const source = peers[peer].blobs.get({ key: id, max: max })
    pull(source, blobStore.add(id, function (err, _id) {
      delete getting[id]
      if (err) {
        if (available[peer]) delete available[peer][id]
        // check if another peer has this.
        // if so get it from them.
        peer = isAvailable(id)
        if (peer) get(peer, id)
      }
    }))
  }

  function wants (peer, id, hops) {
    if (Math.abs(hops) > sympathy) return // sorry!
    if (!want[id] || want[id] < hops) {
      want[id] = hops
      queue(id, hops)
      peer = isAvailable(id)
      if (peer) get(peer, id)
    }
  }

  pull(
    blobStore.ls({ old: false, meta: true }),
    pull.drain(function (data) {
      queue(data.id, data.size)
      delete want[data.id]
      if (waiting[data.id]) {
        while (waiting[data.id].length) { waiting[data.id].shift()(null, true) }
      }
    })
  )

  function has (peerId, id, size) {
    if (typeof peerId !== 'string') throw new Error('peer must be string id')
    available[peerId] = available[peerId] || {}
    available[peerId][id] = size
    // if we are broadcasting this blob,
    // mark this peer has it.
    // if N peers have it, we can stop broadcasting.
    if (push[id]) {
      push[id][peerId] = size
      if (Object.keys(push[id]).length >= pushy) {
        const data = { key: id, peers: push[id] }
        blobPush.remove(id)
        delete push[id]; pushed(data)
      }
    }
    if (want[id] && !getting[id] && size < max) get(peerId, id)
  }

  function process (data, peer, cb) {
    let n = 0; const res = {}
    for (const id in data) {
      (function (id) {
        if (isBlobId(id) && Number.isInteger(data[id])) {
          if (data[id] < 0 && (opts.stingy !== true || push[id])) { // interpret as "WANT"
            n++
            // check whether we already *HAVE* this file.
            // respond with it's size, if we do.
            blobStore.size(id, function (err, size) { // XXX
              if (err) return cb(err)

              if (size) res[id] = size
              else wants(peer, id, data[id] - 1)
              next()
            })
          } else if (data[id] > 0) { // interpret as "HAS"
            has(peer, id, data[id])
          }
        }
      }(id))
    }

    function next () {
      if (--n) return
      cb(null, res)
    }
  }

  function dead (peerId) {
    delete peers[peerId]
    delete available[peerId]
    delete streams[peerId]
  }

  function createWantStream (id) {
    if (!streams[id]) {
      streams[id] = notify.listen()

      // merge in ids we are pushing.
      const w = clone(want)
      for (const k in push) w[k] = -1
      streams[id].push(w)
    }
    return pull(streams[id], onAbort(function (err, cb) {
      streams[id] = false
      cb(err)
    }))
  }

  function wantSink (peer) {
    createWantStream(peer.id) // set streams[peer.id]

    let modern = false
    return pull.drain(
      function (data) {
        modern = true
        // respond with list of blobs you already have,
        process(data, peer.id, function (err, hasData) {
          if (err) console.error(err) // ):
          // (if you have any)
          if (!isEmpty(hasData) && streams[peer.id]) streams[peer.id].push(hasData)
        })
      },
      function (err) {
        if (err && !modern) {
          streams[peer.id] = false
          if (legacy) legacySync(peer)
          return
        }
        // if can handle unpeer another way,
        // then can refactor legacy handling out of sight.

        // handle error and fallback to legacy mode, if enabled.
        if (peers[peer.id] === peer) { dead(peer.id) }
      }
    )
  }
  // LEGACY LEGACY LEGACY
  function legacySync (peer) {
    if (!legacy) return

    let drain // eslint-disable-line
    // we need to keep a reference to drain so we can abort it when we get an error.
    function hasLegacy (hashes) {
      const ary = Object.keys(hashes).filter(function (k) {
        return hashes[k] < 0
      })
      if (ary.length) {
        peer.blobs.has(ary, function (err, haves) {
          if (err) drain.abort(err) // ERROR: abort this stream.
          else {
            haves.forEach(function (have, i) {
              if (have) has(peer.id, ary[i], have)
            })
          }
        })
      }
    }

    function notPeer (err) {
      if (err) dead(peer.id)
    }

    drain = pull.drain(function (hash) {
      has(peer.id, hash, true)
    }, notPeer)

    pull(peer.blobs.changes(), drain)

    hasLegacy(want)

    // a stream of hashes
    pull(notify.listen(), pull.drain(hasLegacy, notPeer))
  }
  // LEGACY LEGACY LEGACY


  const self = {
    // id: name,
    has: function (id, cb) {
      id = toBlobId(id)

      if (Array.isArray(id)) {
        for (let i = 0; i < id.length; i++) {
          if (!isBlobId(id[i])) { return cb(new Error('invalid id:' + id[i])) }
        }
      } else if (!isBlobId(id)) { return cb(new Error('invalid id:' + id)) }

      if (legacy !== true) {
        blobStore.has.call(this, id, cb)
        return
      }

      console.log('LEGACY!')
      // LEGACY LEGACY LEGACY
      if (this === self || !this || this === global) { // a local call
        return blobStore.has.call(this, id, cb)
      }
      // ELSE, interpret remote calls to has as a WANT request.
      // handling this by calling process (which calls size())
      // avoids a race condition in the tests.
      // (and avoids doubling the number of calls)
      const a = Array.isArray(id) ? id : [id]
      const o = {}
      a.forEach(function (h) { o[h] = -1 })
      // since this is always "has" process will never use the second arg.
      process(o, null, function (err, res) {
        if (err) return cb(err)
        const a = []; for (const k in o) a.push(res[k] > 0)
        cb(null, Array.isArray(id) ? a : a[0])
      })
      // LEGACY LEGACY LEGACY
    },
    size: wrap(blobStore.size),
    get: blobStore.get,
    getSlice: blobStore.getSlice,
    add: wrap(blobStore.add),
    rm: wrap(blobStore.rm),
    ls: blobStore.ls,
    changes: function () {
      // XXX for bandwidth sensitive peers, don't tell them about blobs we arn't trying to push.
      return pull(
        blobStore.ls({ old: false, meta: false }),
        pull.filter(function (id) {
          return !stingy || push[id]
        })
      )
    },
    want: function (id, cb) {
      id = toBlobId(id)
      if (!isBlobId(id)) { return cb(new Error('invalid id:' + id)) }
      // always broadcast wants immediately, because of race condition
      // between has and adding a blob (needed to pass test/async.js)
      if (blobStore.isEmptyHash(id)) return cb(null, true)

      const peerId = isAvailable(id)

      if (waiting[id]) { waiting[id].push(cb) } else {
        waiting[id] = [cb]
        blobStore.size(id, function (err, size) {
          if (err) return cb(err)
          if (size != null) {
            while (waiting[id].length) { waiting[id].shift()(null, true) }
            delete waiting[id]
          }
        })
      }

      if (!peerId && waiting[id]) queue(id, -1)

      if (peerId) return get(peerId, id)
    },
    push: function (id, cb) {
      id = toBlobId(id)
      // also store the id to push.
      if (!isBlobId(id)) { return cb(new Error('invalid hash:' + id)) }
      queue(id, -1)
      blobPush.add(id, cb) // leads to update of push
    },
    pushed: function () {
      return pushed.listen()
    },
    createWants: function () {
      const source = pullDefer.source()
      blobPush.onReady(() => {
        source.resolve(createWantStream(this.id))
      })
      return source
    },
    // private api. used for testing. not exposed over rpc.
    _wantSink: wantSink,
    _onConnect: function (other, name) {
      peers[other.id] = other
      // sending of your wants starts when we know they are not legacy style.
      // process is called when wantSync doesn't immediately get an error.
      // blobPush.onReady(() => {
        pull(
          other.blobs.createWants(),
          // pull.through(m => console.log(name, m)),
          wantSink(other)
        )
      // })
      // not sure why onReady is needed here but required for tests to pass
    },
    help: function () {
      return require('./help')
    }
  }

  return self
}
