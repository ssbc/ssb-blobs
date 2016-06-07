var tape = require('tape')
var Blobs = require('../inject')
var pull = require('pull-stream')
var assert = require('assert')

var u = require('./util')
var Fake = u.fake
var hash = u.hash

module.exports = function (createBlobStore, createAsync) {

  //if a peer is recieves a WANT for a blob they have,
  //it responds with a HAS
  tape('simple', function (t) {
    createAsync(function (async) {
      var blobs = Blobs(createBlobStore('simple', async))

      var b = Fake('hello', 256), h = hash(b)
      pull(pull.once(b), async.through(), blobs.add(h, function (err, _h) {
        if(err) throw err
        console.log('added', _h)
        t.equal(_h, h)

        var req = {}
        req[h] = 0
        var res = {}
        res[h] = 256

        pull(
          pull.once(req),
          async.through(),
          blobs._wantSink({id: 'test'})
        )

        pull(
          blobs.createWants.call({id: 'test'}),
          async.through(),
          pull.take(2),
          pull.collect(function (err, _res) {
            if(err) throw err
            console.log("_RES", _res)
            assert.deepEqual(_res, [{}, res])
            async.done()
          })
        )
      }))
    }, function (err, results) {
      if(err) throw err
      t.end()
    })
  })

  //if you receive a want, sympathetically want that too.
  //but only once.
  tape('simple wants', function (t) {
    createAsync(function (async) {
      var blobs = Blobs(createBlobStore('simple', async))

      var b = Fake('hello', 256), h = hash(b)

      var req = {}
      req[h] = -1
      var res = {}
      res[h] = -2

      pull(
        //also send {<hash>: -1} which simulates a cycle.
        pull.values([req, res]),
        async.through(),
        blobs._wantSink({id: 'test'})
      )

      var c = 0

      pull(
        blobs.createWants.call({id: 'test'}),
        async.through(),
        pull.take(2),
        pull.collect(function (err, _res) {
  //        c++
          console.log(c, _res)
          assert.deepEqual(_res, [{}, res])
          async.done()
//          throw new Error('called thrice')
        })
      )

    }, function (err, results) {
      if(err) throw err
      t.end()
    })
  })

  //if you want something, tell your peer.
  tape('want', function (t) {
    createAsync(function (async) {
      var blobs = Blobs(createBlobStore('want', async))
      var h = hash(Fake('foobar', 64))
      var res = {}
      res[h] = -1

      pull(
        blobs.createWants.call({id: 'test'}),
        async.through(),
        pull.take(2),
        pull.collect(function (err, _res) {
          if(err) throw err
          //requests 
          assert.deepEqual(_res, [{}, res])
          async.done()
        })
      )

      blobs.want(h)

    }, function (err, results) {
      if(err) throw err
      //t.deepEqual(_res, res)
      t.end()
    })
  })

  //if you want something, tell your peer.
  tape('already wanted, before connection', function (t) {
    createAsync(function (async) {
      var blobs = Blobs(createBlobStore('want', async))
      var h = hash(Fake('foobar', 64))
      var res = {}
      res[h] = -1

      blobs.want(h)

      pull(
        blobs.createWants.call({id: 'test'}),
        async.through(),
        pull.find(null, function (err, _res) {
          if(err) throw err
          //requests 
          assert.deepEqual(_res, res)
          async.done()
        })
      )

    }, function (err, results) {
      if(err) throw err
      //t.deepEqual(_res, res)
      t.end()
    })
  })

}


if(!module.parent)
  module.exports(require('./mock'), require('./util').sync)


