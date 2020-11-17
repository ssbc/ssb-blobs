const debug = require('debug')('ssb-blobs')
const tape = require('tape')
const pull = require('pull-stream')
const assert = require('assert')
const cont = require('cont')
const u = require('../util')
const Fake = u.fake
const hash = u.hash

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
      const alice = createBlobs('alice', async)
      const bob = createBlobs('bob', async)
      const carol = createBlobs('carol', async)
      const dan = createBlobs('dan', async)

      const blob = Fake('baz', 64)
      const h = hash(blob)

      u.peers('alice', alice, 'bob', bob)
      u.peers('alice', alice, 'carol', carol)
      u.peers('alice', alice, 'dan', dan)

      pull(
        alice.pushed(),
        pull.drain((data) => {
          assert.deepEqual(data, { key: h, peers: { bob: 64, carol: 64, dan: 64 } })
          debug('PUSHED', data)
          cont.para([bob, carol, dan].map(p => cont(p.has)(h)))((err, ary) => {
            if (err) throw err
            debug('HAS', err, ary)
            if (err) throw err
            assert.deepEqual(ary, [true, true, true])
            async.done()
          })
        })
      )

      pull(pull.once(blob), alice.add())
      alice.push(h)
    }, function (err) {
      if (err) throw err
      t.end()
    })
  })
}

if (!module.parent) u.tests(module.exports)
