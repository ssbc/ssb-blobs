const debug = require('debug')('ssb-blobs')
const tape = require('tape')
const pull = require('pull-stream')
const assert = require('assert')

const u = require('../util')
const Fake = u.fake
const hash = u.hash

module.exports = function (createBlobs, createAsync, groupName = '?') {
  // if a peer is recieves a WANT for a blob they have,
  // it responds with a HAS
  tape(groupName + '/simple want', function (t) {
    createAsync(function (async) {
      const blobs = createBlobs('simple', async)
      debug(blobs)
      const b = Fake('hello', 256); const h = hash(b)
      pull(pull.once(b), async.through(), blobs.add(h, function (err, _h) {
        if (err) throw err
        debug('added', _h)
        assert.equal(_h, h)

        const req = {}
        req[h] = -1
        const res = {}
        res[h] = 256

        pull(
          pull.once(req),
          async.through(),
          blobs._wantSink({ id: 'test' })
        )

        pull(
          blobs.createWants.call({ id: 'test' }),
          async.through(),
          pull.take(2),
          pull.collect(function (err, _res) {
            if (err) throw err
            debug('_RES', _res)
            assert.deepEqual(_res, [{}, res])
            async.done()
          })
        )
      }))
    }, function (err, results) {
      if (err) throw err
      t.end()
    })
  })

  // if you receive a want, sympathetically want that too.
  // but only once.
  tape(groupName + '/simple wants - sympathetic want', function (t) {
    createAsync(function (async) {
      const blobs = createBlobs('simple', async)

      const b = Fake('hello', 256); const h = hash(b)

      const req = {}
      req[h] = -1
      const res = {}
      res[h] = -2

      pull(
        // also send {<hash>: -1} which simulates a cycle.
        pull.values([req, res]),
        async.through(),
        blobs._wantSink({ id: 'test' })
      )

      const c = 0

      pull(
        blobs.createWants.call({ id: 'test' }),
        async.through(),
        pull.take(2),
        pull.collect(function (err, _res) {
          if (err) throw err
          //        c++
          debug('END', c, _res)
          assert.deepEqual(_res, [{}, res])
          async.done()
          //          throw new Error('called thrice')
        })
      )
    }, function (err, results) {
      debug(err)
      if (err) throw err
      t.end()
    })
  })

  // if you want something, tell your peer.
  tape(groupName + '/simple want - tell a peer', function (t) {
    createAsync(function (async) {
      const blobs = createBlobs('want', async)
      const h = hash(Fake('foobar', 64))
      const res = { [h]: -1 }

      pull(
        blobs.createWants.call({ id: 'test' }),
        async.through(),
        pull.take(2),
        pull.collect(function (err, _res) {
          if (err) throw err
          // requests
          assert.deepEqual(_res, [{}, res])
          async.done()
        })
      )

      blobs.want(h)
    }, function (err, results) {
      if (err) throw err
      // assert.deepEqual(_res, res)
      t.end()
    })
  })

  // if you want something, tell your peer.
  tape(groupName + '/simple want - already wanted, before connection', function (t) {
    createAsync(function (async) {
      const blobs = createBlobs('want', async)
      const h = hash(Fake('foobar', 64))
      const res = {}
      res[h] = -1

      blobs.want(h)

      pull(
        blobs.createWants.call({ id: 'test' }),
        async.through(),
        pull.find(null, function (err, _res) {
          if (err) throw err
          // requests
          assert.deepEqual(_res, res)
          async.done()
        })
      )
    }, function (err, results) {
      if (err) throw err
      // assert.deepEqual()
      t.end()
    })
  })

  // if you want something, tell your peer.
  //  tape(groupName + '/simple - empty hash, not requested over the wire', function (t) {
  //    createAsync(function (async) {
  //      var blobs = createBlobs('want', async)
  //      var empty = hash(new Buffer(0))
  //      blobs.want(empty, function () {})
  //
  //      pull(
  //        blobs.createWants.call({id: 'test'}),
  //        async.through(),
  //        pull.find(null, function (err, _res) {
  //          if(err) throw err
  //          //requests
  //          debug(_res)
  //          t.fail('should not have sent any message')
  //          async.done()
  //        })
  //      )
  //
  //    }, function (err, results) {
  //      if(err) throw err
  //      //assert.deepEqual()
  //      t.end()
  //    })
  //  })
}
