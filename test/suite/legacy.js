const debug = require('debug')('ssb-blobs')
const tape = require('tape')
const pull = require('pull-stream')
const assert = require('assert')

const u = require('../util')
const Fake = u.fake
const hash = u.hash

module.exports = function (createBlobs, createAsync) {
  // client is legacy. call has on a peer, should emit want({<id>: -2})

  tape('legacy calls modern', function (t) {
    createAsync(function (async) {
      // legacy tests

      let n = 0

      const modern = createBlobs('modern', async)

      const blob = Fake('foo', 100)
      const h = hash(blob)

      const first = {}
      first[h] = -2
      const second = {}
      second[h] = blob.length
      const expected = [{}, first, second]

      // the most important thing is that a modern blobs
      // plugin emits 2nd hand hops when someone calls has(hash)

      pull(
        modern.createWants(),
        pull.drain(function (req) {
          n++
          assert.deepEqual(req, expected.shift())
        })
      )

      pull(modern.changes(), pull.drain(function (hash) {
        assert.equal(hash, h)
        pull(modern.get(hash), pull.collect(function (err, ary) {
          if (err) throw err
          assert.deepEqual(Buffer.concat(ary), blob)
          assert.equal(n, 3)
          async.done()
        }))
      }))

      modern.has.call({ id: 'other' }, h, function (err, value) {
        if (err) throw err
        t.equal(value, false)
        pull(pull.once(blob), modern.add(function (err, hash) {
          if (err) throw err
        }))
      })
    }, function (err) {
      if (err) throw err
      t.end()
    })
  })

  tape('modern calls legacy', function (t) {
    createAsync(function (async) {
      const modern = createBlobs('modern', async)
      const legacy = createBlobs('legacy', async)

      const size = legacy.size
      legacy.size = function (hashes, cb) {
        debug('CALLED_SIZE', hashes)
        size.call(this, hashes, function (err, value) {
          debug('SIZES', err, value)
          cb(err, value)
        })
      }

      legacy.createWants = function () {
        const err = new Error('cannot call apply of null')
        err.name = 'TypeError'
        return pull.error(err)
      }

      u.peers('modern', modern, 'legacy', legacy)

      const blob = Fake('bar', 101)
      const h = hash(blob)

      modern.want(h, function (err, has) {
        if (err) throw err
        async.done()
      })

      pull(pull.once(blob), legacy.add(function (err, _h) {
        if (err) throw err
        assert.equal(_h, h)
        debug('ADDED', _h)
      }))
    }, function (err) {
      debug(err)
      if (err) throw err
      t.end()
    })
  })
}

if (!module.parent) u.tests(module.exports)
