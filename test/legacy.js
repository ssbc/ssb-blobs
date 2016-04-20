var tape = require('tape')
var Blobs = require('../')
var pull = require('pull-stream')
var bitflipper = require('pull-bitflipper')
var assert = require('assert')

var u = require('./util')
var Fake = u.fake
var hash = u.hash

module.exports = function (createBlobStore, createAsync) {

  //client is legacy. call has on a peer, should emit want({<id>: -2})

  tape('legacy calls modern', function (t) {
    createAsync(function (async) {
      //legacy tests

      var n = 0

      var modern = Blobs(createBlobStore('legacy', async), 'modern')

      var blob = Fake('foo', 100)
      var h = hash(blob)

      var first = {}
      first[h] = -2
      var second = {}
      second[h] = blob.length
      var expected = [first, second]

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
        console.log('changes', hash)
        assert.equal(hash, h)
        pull(modern.get(hash), pull.collect(function (err, ary) {
          assert.deepEqual(Buffer.concat(ary), blob)
          assert.equal(n, 2)
          async.done()
        }))
      }))

      modern.has.call({id: 'other'}, h, function (err, value) {
        if(err) throw err
        t.equal(value, false)
        console.log('has', err, value)
        pull(pull.once(blob), modern.add(function (err, hash) {
          if(err) throw err
          console.log('ADDED', hash)
        }))
      })

    }, function (err) {
      if(err) throw err
      t.end()
    })

  })

}

if(!module.parent)
    module.exports(require('./mock'), require('./sync'))


