
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

module.exports = function (blobs) {

  var notify = Notify()
  var changes = Notify()

  var want = {}, waiting = {}

  var send = {}, timer

  function queue (hash, hops) {
    console.log('Queue', hash, hops, send)
    if(hops < 0)
      want[hash] = hops
    else
      delete want[hash]

    send[hash] = hops
  //  clearTimeout(timer)
//    timer = setTimeout(function () {
      var _send = send
      send = {}
      notify(_send)
    //}, 10)
  }

  var peers = {}

  function add(id, cb) {
    cb = cb || noop
    return blobs.add(id, function (err, id) {
      if(err) cb(err)
      else cb(null, changes(id))
    })
  }

  function get (peer, id) {
    pull(
      peers[peer].blobs.get(id),
      add(id, function (err, h) {
        console.log('GOT', h)
      })
    )
  }

  function wants (peer, id, hops) {
    if(!want[id] || want[id] < hops) {
      want[id] = hops
      queue(id, hops)
    }
  }

  pull(
    changes.listen(),
    pull.drain(function (id) {
      blobs.size(id, function (err, size) {
        if(size) queue(id, size)
      })
      delete want[id]
      if(waiting[id])
        while(waiting[id].length)
          waiting[id].shift()(null, true)
    })
  )

  function has(peer, id, size) {
    console.log('HAS-GET?', want, peer, size)
    //TODO: test do not get from more than one peer at a time.
    if(want[id] && size < MAX_SIZE) get(peer, id)
  }

  function process (data, peer, cb) {
    var n = 0, res = {}
    for(var id in data) {
      if(isBlobId(id) && isInteger(data[id])) {
        if(data[id] <= 0) { //interpret as "WANT"
          n++
          //check whether we already *HAVE* this file.
          //respond with it's size, if we do.
          blobs.size(id, function (err, size) {
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

  return {
    get: blobs.get,
    add: add,
    changes: function () {
      return changes.listen()
    },
    want: function (hash, cb) {
      console.log('WANT', hash)
      if(waiting[hash])
        waiting[hash].push(cb)
      else {
        waiting[hash] = [cb]
        blobs.has(hash, function (err, has) {
          if(has) {
            while(waiting[hash].length)
              waiting[hash].shift()(null, true)
            delete waiting[hash]
          }
          else
            queue(hash, -1)
        })
      }
    },
    createWantStream: function () {
      var source = notify.listen()
      var peer = this
      peers[peer.id] = this
      //queue current want list...
      return {
        source: source,
        sink: pull.drain(function (data) {
          //respond with list of blobs you already have,
          process(data, peer.id, function (err, has_data) {
            //(if you have any)
            if(!isEmpty(has_data)) source.push(has_data)
          })
        }, function (_) {
          if(peers[peer.id] == peer)
            delete peers[peer.id]
        })
      }
    }
  }
}

