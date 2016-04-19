var Notify = require('pull-notify')
var crypto = require('crypto')
var tape = require('tape')
var Blobs = require('../')
var pull = require('pull-stream')
var bitflipper = require('pull-bitflipper')
var assert = require('assert')

var LOGGING = process.env.DEBUG

function createHash () {
  var args = [].slice.call(arguments)
  var o = {}
  for(var i = 0; i < args.length; i+=2) o[args[i]] = args[i+1]
  return o
}

//create random value that looks like a blob id.
function rand() {
  return '&'+crypto.randomBytes(32).toString('base64')+'.sha256'
}

function Fake(string, length) {
  var b = new Buffer(length)
  var n = Buffer.byteLength(string)
  for(var i = 0; i < length; i += n)
    b.write(string, i)
  return b
}

function hash(buf) {
  buf = 'string' == typeof buf ? new Buffer(buf) : buf
  return '&'+crypto.createHash('sha256')
            .update(buf).digest('base64')+'.sha256'
}

module.exports = function (createBlobStore, createAsync) {


  function log (name) {
    if(LOGGING)
      return pull.through(function (e) {
        console.log(name, e)
      })
    else
      return pull.through()
  }

  function peers (nameA, a, nameB, b, async) {
    var na = nameA[0].toUpperCase(), nb = nameB[0].toUpperCase()
    //this is just a hack to fake RPC. over rpc each method is called
    //with the remote id in the current this context.
    a._onConnect({
      id: nameB, blobs:
        {get:b.get, createWants: b.createWants.bind({id: nameA})}
    }, nb+na)
    b._onConnect({
      id: nameA, blobs:
        {get:a.get, createWants: a.createWants.bind({id: nameB})}
    }, na+nb)
  }

  tape('want - has', function (t) {
    createAsync(function (async) {
      var alice = Blobs(createBlobStore('wh-alice', async))
      var bob   = Blobs(createBlobStore('wh-bob', async))
      var blob = Fake('foobar', 64)
      var h = hash(blob)

      peers('alice', alice, 'bob', bob)//, async)

      alice.want(h, function (err, has) {
        if(err) throw err
        console.log('ALICE has', h)
        alice.has(h, function (err, has) {
          if(err) throw err
          assert.ok(has)
          async.done()
        })
      })

      pull(pull.once(blob), bob.add())
    }, function (err) {
      if(err) throw err
      t.end()
    })
  })

  return
  tape('want - has 2', function (t) {
    createAsync(function (async) {
      var alice = Blobs(createBlobStore('wh2-alice', async))
      var bob   = Blobs(createBlobStore('wh2-bob', async))
      var blob = Fake('foobar', 64)
      var h = hash(blob)

      peers('bob', bob, 'alice', alice)
      pull(pull.once(blob), bob.add())

      alice.want(h, function (err, has) {
        if(err) throw err
        alice.has(h, function (err, has) {
          if(err) throw err
          assert.ok(has)
          async.done()
        })
      })
    }, function (err) {
      if(err) throw err
      t.end()
    })
  })


  tape('want - want -has', function (t) {
    createAsync(function (async) {
      var alice = Blobs(createBlobStore('wwh-alice', async))
      var bob   = Blobs(createBlobStore('wwh-bob', async))
      var carol = Blobs(createBlobStore('wwh-carol', async))

      var blob = Fake('baz', 64)
      var h = hash(blob)

      peers('alice', alice, 'bob', bob)
      peers('bob', bob, 'carol', carol)

      alice.want(h, function (err, has) {
        if(err) throw err
        alice.has(h, function (err, has) {
          if(err) throw err
          assert.ok(has)
          async.done()
        })
      })

      pull(pull.once(blob), carol.add())
    }, function (err) {
      if(err) throw err
      t.end()
    })
  })


  tape('peers want what you have', function (t) {
    createAsync(function (async) {
      if(Array.isArray(process._events['exit']))
        console.log(process._events['exit'].reverse())
      var alice = Blobs(createBlobStore('peer-alice', async), 'alice')
      var bob   = Blobs(createBlobStore('peer-bob', async), 'bob')
      var carol = Blobs(createBlobStore('peer-carol', async), 'carol')

      var blob = Fake('baz', 64)
      var h = hash(blob)

      peers('alice', alice, 'bob', bob)
      peers('bob', bob, 'carol', carol)

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
      if(err) throw err
      t.end()
    })
  })


  tape('triangle', function (t) {
    createAsync(function (async) {
      var n = 0
      var alice = Blobs(createBlobStore('triangle-alice', async), 'alice')
      var bob   = Blobs(createBlobStore('triangle-bob', async), 'bob')
      var carol = Blobs(createBlobStore('triangle-carol', async), 'carol')

      var blob = Fake('baz', 64)
      var h = hash(blob)

      peers('alice', alice, 'bob', bob)
      peers('bob', bob, 'carol', carol)

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
      if(err) throw err
      t.end()
    })
  })

  tape('corrupt', function (t) {
    createAsync(function (async) {
      var n = 0
      var alice = Blobs(createBlobStore('corrupt-alice', async), 'alice')
      var bob   = Blobs(createBlobStore('corrupt-bob', async), 'bob')
      var carol = Blobs(createBlobStore('corrupt-carol', async), 'carol')

      //everything that comes from bob is corrupt
      var get = alice.get
      alice.get = function (id) {
        return pull(get(id), bitflipper(1))
      }

      var blob = Fake('baz', 64)
      var h = hash(blob)

      peers('alice', alice, 'bob', bob)
      peers('bob', bob, 'carol', carol)

      pull(
        bob.changes(),
        pull.drain(function (_h) {
          console.log('HAS', _h)
          assert.equal(_h, h)
          async.done()
        })
      )

      bob.want(h, function () {})
      pull(pull.once(blob), alice.add())
      pull(pull.once(blob), carol.add())
    }, function (err) {
      if(err) throw err
      t.end()
    })
  })

  tape('cycle', function (t) {
    createAsync(function (async) {
      var n = 0
      var alice = Blobs(createBlobStore('cycle-alice', async), 'alice')
      var bob   = Blobs(createBlobStore('cycle-bob', async), 'bob')
      var carol = Blobs(createBlobStore('cycle-carol', async), 'carol')
      var dan   = Blobs(createBlobStore('cycle-dan', async), 'dan')
      peers('alice', alice, 'bob', bob)
      peers('bob', bob, 'carol', carol)
      peers('carol', carol, 'dan', dan)
      peers('dan', dan, 'alice', alice)

      var blob = Fake('gurg', 64)
      var h = hash(blob)
      alice.want(h, function (err, has) {
        t.end()
      })

      pull(pull.once(blob), dan.add(h))
    }, function (err) {
      if(err) throw err
      t.end()
    })

  })


  tape('legacy', function (t) {
    createAsync(function (async) {
      //if a peer is using legacy mode
      //then it won't use createWantStream
      //instead it will just call has(blobIds)
      //interpret that like receiving a want stream message {<id>: -1}
      //also, if a peer doesn't have createWantStream
      //call peer.has instead.

      //okay... so currently, the client creates a duplex stream
      //but then how does the server know that the client is legacy?
      //(which would mean it doesn't call that method... just waiting
      //for it not to call is a timeout, which is bad, non deterministic tests)

      //SOLUTION: split the duplex into two source streams that hook up!
      //each side calls the remote source, and returns the sink they have
      //prepared!

      async.done()
    }, function (err) {
      if(err) throw err
      t.end()
    })

  })

}

if(!module.parent)
    module.exports(require('./mock'), require('./sync'))













