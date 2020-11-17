const debug = require('debug')('ssb-blobs')
const tape = require('tape')
const pull = require('pull-stream')
const bitflipper = require('pull-bitflipper')
const assert = require('assert')

const u = require('../util')
const Fake = u.fake
const hash = u.hash

module.exports = function (createBlobs, createAsync) {
  // function log (name) {
  //   if(LOGGING)
  //     return pull.through(function (e) {
  //       debug(name, e)
  //     })
  //   else
  //     return pull.through()
  // }

  tape('want - has', function (t) {
    createAsync(function (async) {
      const alice = createBlobs('alice', async)
      const bob = createBlobs('bob', async)
      const blob = Fake('foobar', 64)
      const h = hash(blob)

      u.peers('alice', alice, 'bob', bob)//, async)

      alice.want(h, function (err, has) {
        if (err) throw err
        debug('ALICE has?', h, has)
        alice.has(h, function (err, has) {
          debug('ALICE has!', h, has)
          if (err) throw err
          assert.ok(has)
          async.done()
        })
      })

      pull(pull.once(blob), bob.add())
    }, function (err) {
      if (err) throw err
      t.end()
    })
  })

  tape('want - has 2', function (t) {
    createAsync(function (async) {
      const alice = createBlobs('alice', async)
      const bob = createBlobs('bob', async)
      const blob = Fake('foobar', 64)
      const h = hash(blob)

      u.peers('bob', bob, 'alice', alice)
      pull(pull.once(blob), bob.add())

      alice.want(h, function (err, has) {
        if (err) throw err
        alice.has(h, function (err, has) {
          if (err) throw err
          assert.ok(has)
          async.done()
        })
      })
    }, function (err) {
      if (err) throw err
      t.end()
    })
  })

  tape('want - want -has', function (t) {
    createAsync(function (async) {
      const alice = createBlobs('alice', async)
      const bob = createBlobs('bob', async)
      const carol = createBlobs('carol', async)

      const blob = Fake('baz', 64)
      const h = hash(blob)

      u.peers('alice', alice, 'bob', bob)
      u.peers('bob', bob, 'carol', carol)

      alice.want(h, function (err, has) {
        if (err) throw err
        alice.has(h, function (err, has) {
          if (err) throw err
          assert.ok(has)
          async.done()
        })
      })

      pull(pull.once(blob), carol.add())
    }, function (err) {
      if (err) throw err
      t.end()
    })
  })

  tape('peers want what you have', function (t) {
    createAsync(function (async) {
      if (Array.isArray(process._events.exit)) { debug(process._events.exit.reverse()) }
      const alice = createBlobs('alice', async)
      const bob = createBlobs('bob', async)
      const carol = createBlobs('carol', async)

      const blob = Fake('baz', 64)
      const h = hash(blob)

      u.peers('alice', alice, 'bob', bob)
      u.peers('bob', bob, 'carol', carol)

      pull(
        carol.changes(),
        pull.drain(function (_h) {
          assert.equal(_h, h)
          async.done()
        })
      )

      alice.want(h, function () {})
      pull(pull.once(blob), alice.add())
    }, function (err) {
      if (err) throw err
      t.end()
    })
  })

  tape('triangle', function (t) {
    createAsync(function (async) {
      const alice = createBlobs('alice', async)
      const bob = createBlobs('bob', async)
      const carol = createBlobs('carol', async)

      const blob = Fake('baz', 64)
      const h = hash(blob)

      u.peers('alice', alice, 'bob', bob)
      u.peers('bob', bob, 'carol', carol)

      pull(
        bob.changes(),
        pull.drain(function (_h) {
          assert.equal(_h, h)
          async.done()
        })
      )

      pull(pull.once(blob), alice.add())
      pull(pull.once(blob), carol.add())

      bob.want(h, function () {})
    }, function (err) {
      if (err) throw err
      t.end()
    })
  })

  tape('corrupt', function (t) {
    createAsync(function (async) {
      const alice = createBlobs('alice', async)
      const bob = createBlobs('bob', async)
      const carol = createBlobs('carol', async)

      // everything that comes from bob is corrupt
      const get = alice.get
      alice.get = function (id) {
        return pull(get(id), bitflipper(1))
      }

      const blob = Fake('baz', 64)
      const h = hash(blob)

      u.peers('alice', alice, 'bob', bob)
      u.peers('bob', bob, 'carol', carol)

      pull(
        bob.changes(),
        pull.drain(function (_h) {
          debug('HAS', _h)
          assert.equal(_h, h)
          async.done()
        })
      )

      bob.want(h, function () {})
      pull(pull.once(blob), alice.add())
      pull(pull.once(blob), carol.add())
    }, function (err) {
      if (err) throw err
      t.end()
    })
  })

  tape('cycle', function (t) {
    createAsync(function (async) {
      const alice = createBlobs('alice', async)
      const bob = createBlobs('bob', async)
      const carol = createBlobs('carol', async)
      const dan = createBlobs('dan', async)
      u.peers('alice', alice, 'bob', bob)
      u.peers('bob', bob, 'carol', carol)
      u.peers('carol', carol, 'dan', dan)
      u.peers('dan', dan, 'alice', alice)

      const blob = Fake('gurg', 64)
      const h = hash(blob)
      alice.want(h, function (err, has) {
        if (err) throw err
        async.done()
      })

      pull(pull.once(blob), dan.add(h))
    }, function (err) {
      if (err) throw err
      t.end()
    })
  })
}

if (!module.parent) { u.tests(module.exports) }
