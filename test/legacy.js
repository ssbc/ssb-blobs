var tape = require('tape')
var Blobs = require('../inject')
var pull = require('pull-stream')
var bitflipper = require('pull-bitflipper')
var assert = require('assert')

var u = require('./util')
var Fake = u.fake
var hash = u.hash

module.exports = function (createBlobs, createAsync) {

  //client is legacy. call has on a peer, should emit want({<id>: -2})

  tape('legacy calls modern', function (t) {
    createAsync(function (async) {
      //legacy tests

      var n = 0

      var modern = createBlobs('modern', async)

      var blob = Fake('foo', 100)
      var h = hash(blob)

      var first = {}
      first[h] = -2
      var second = {}
      second[h] = blob.length
      var expected = [{}, first, second]

      //the most important thing is that a modern blobs
      //plugin emits 2nd hand hops when someone calls has(hash)

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
          assert.deepEqual(Buffer.concat(ary), blob)
          assert.equal(n, 3)
          async.done()
        }))
      }))

      modern.has.call({id: 'other'}, h, function (err, value) {
        if(err) throw err
        t.equal(value, false)
        pull(pull.once(blob), modern.add(function (err, hash) {
          if(err) throw err
        }))
      })

    }, function (err) {
      if(err) throw err
      t.end()
    })

  })

  tape('modern calls legacy', function (t) {
    createAsync(function (async) {

      var modern = createBlobs('modern', async)
      var legacy = createBlobs('legacy', async)

      var size = legacy.size
      legacy.size = function (hashes, cb) {
        console.log("CALLED_SIZE", hashes)
        size.call(this, hashes, function (err, value) {
          console.log('SIZES', err, value)
          cb(err, value)
        })
      }

      legacy.createWants = function () {
        var err = new Error('cannot call apply of null')
        err.name = 'TypeError'
        return pull.error(err)
      }

      u.peers('modern', modern, 'legacy', legacy)

      var blob = Fake('bar', 101)
      var h = hash(blob)

      modern.want(h, function (err, has) {
        async.done()
      })

      pull(pull.once(blob), legacy.add(function (err, _h) {
        assert.equal(_h, h)
        console.log('ADDED', _h)
      }))

    }, function (err) {
      console.log(err)
      if(err) throw err
      t.end()
    })
  })

}

if(!module.parent) u.tests(module.exports)


