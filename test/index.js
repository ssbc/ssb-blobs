var Notify = require('pull-notify')
var crypto = require('crypto')
var tape = require('tape')
var Blobs = require('../')
var pull = require('pull-stream')

var MockBlobStore = require('./mock')

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


tape('simple', function (t) {
  var blobs = Blobs(MockBlobStore())

  var b = Fake('hello', 256), h = hash(b)
  pull(pull.once(b), blobs.add())

  var req = {}
  req[h] = 0
  var res = {}
  res[h] = 256

  pull(
    pull.once(req),
    blobs.createWantStream(),
    pull.find(null, function (err, _res) {
      if(err) throw err
      //requests 
      t.deepEqual(_res, res)
      t.end()
    })
  )
})

tape('want', function (t) {
  var blobs = Blobs(MockBlobStore())
  var h = hash(Fake('foobar', 64))
  var res = {}
  res[h] = -1

  pull(
    blobs.createWantStream(),
    pull.find(null, function (err, _res) {
      if(err) throw err
      //requests 
      t.deepEqual(_res, res)
      t.end()
    })
  )

  blobs.want(h)
})

function log (name) {
  return pull.through(function (e) {
    console.log(name, e)
  })
}

function peers (nameA, a, nameB, b) {
  var as = a.createWantStream.call({id: nameB, blobs: b})
  var bs = b.createWantStream.call({id: nameA, blobs: a})
  var na = nameA[0].toUpperCase(), nb = nameB[0].toUpperCase()
  pull(as, log(na+nb), bs, log(nb+na), as)
}

tape('want - has', function (t) {
  var alice = Blobs(MockBlobStore())
  var bob   = Blobs(MockBlobStore())
  var blob = Fake('foobar', 64)
  var h = hash(blob)

  peers('alice', alice, 'bob', bob)

  alice.want(h, function (err) {
    t.end()
  })

  pull(pull.once(blob), bob.add())
})

tape('want - want -has', function (t) {
  var alice = Blobs(MockBlobStore())
  var bob   = Blobs(MockBlobStore())
  var carol = Blobs(MockBlobStore())

  var blob = Fake('baz', 64)
  var h = hash(blob)

  peers('alice', alice, 'bob', bob)
  peers('bob', bob, 'carol', carol)

  alice.want(h, function (err) {
    t.end()
  })

  pull(pull.once(blob), carol.add())
})



