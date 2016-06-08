var tape = require('tape')
var Blobs = require('../inject')
var pull = require('pull-stream')
var assert = require('assert')
var cont = require('cont')
var u = require('./util')
var Fake = u.fake
var hash = u.hash

module.exports = function (createBlobs, createAsync) {
  /*
    push
      tell peers about a blob that you have,
    that you want other peers to want.

    stores pushed blobs in a durable log (eg: leveldb)
    so that after a restart, push will still happen.
    (incase you write a message offline, then restart)

  */

  tape('push 3', function (t) {
    createAsync(function (async) {
      var n = 0
      var alice = createBlobs('alice', async)
      var bob   = createBlobs('bob', async)
      var carol = createBlobs('carol', async)
      var dan   = createBlobs('dan', async)

      var blob = Fake('baz', 64)
      var h = hash(blob)

      u.peers('alice', alice, 'bob', bob)
      u.peers('alice', alice, 'carol', carol)
      u.peers('alice', alice, 'dan', dan)

      pull(alice.pushed(), pull.drain(function (data) {
        assert.deepEqual(data, {key: h, peers: {bob: 64, carol: 64, dan: 64}})
        console.log("PUSHED", data)
        cont.para([bob, carol, dan].map(function (p) {
          return cont(p.has)(h)
        }))
          (function (err, ary) {
            console.log('HAS', err, ary)
            if(err) throw err
            assert.deepEqual(ary, [true, true, true])
            async.done()
          })
      }))

      pull(pull.once(blob), alice.add())
      alice.push(h)

    }, function (err) {
      if(err) throw err
      t.end()
    })
  })

}

if(!module.parent) u.tests(module.exports)



