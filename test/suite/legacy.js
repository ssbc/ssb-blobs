const debug = require('debug')('ssb-blobs')
const tape = require('tape')
const pull = require('pull-stream')
const assert = require('assert')

const u = require('../util')
const Fake = u.fake
const hash = u.hash

module.exports = function (createBlobs, createAsync, groupName = '?') {
  // client is legacy. call has on a peer, should emit want({<id>: -2})

  tape(groupName + '/legacy - calls modern', function (t) {
    createAsync(function (async) {
      // legacy tests

      let n = 0

      const modern = createBlobs('modern', async)

      const blob = Fake('foo', 100)
      const h = hash(blob)

      const expected = [
        {},
        { [h]: -2 },
        { [h]: blob.length }
      ]

      // the most important thing is that a modern blobs
      // plugin emits 2nd hand hops when someone calls has(hash)

      pull(
        modern.createWants(),
        pull.drain(req => {
          n++
          t.deepEqual(req, expected.shift(), `createWants emits ${JSON.stringify(req)}`)
          //if (n === 3) async.done()
        })
      )

      pull(
        modern.changes(),
        pull.drain(hash => {
          t.equal(hash, h, 'change stream emits hash')

          pull(
            modern.get(hash),
            pull.collect((err, ary) => {
              if (err) throw err
              assert.deepEqual(Buffer.concat(ary), blob)
            })
          )
        })
      )

      modern.has.call({ id: 'other' }, h, function (err, value) {
        if (err) throw err
        assert.equal(value, false)
        pull(
          pull.once(blob),
          modern.add((err, hash) => {
            if (err) throw err
            t.equal(hash, h, 'add blob, confirm has same hash')
          })
        )
      })
    }, function (err) {
      if (err) throw err
      t.end()
    })
  })

  tape(groupName + '/modern - calls legacy', function (t) {
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
