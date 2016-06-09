var SecretStack = require('secret-stack')
var crypto      = require('crypto')
var tape        = require('tape')
var path        = require('path')
var osenv       = require('osenv')
var mkdirp      = require('mkdirp')
var pull        = require('pull-stream')

//deterministic keys make testing easy.
function hash (s) {
  return crypto.createHash('sha256').update(s).digest()
}

var appkey = hash('TESTBLOBS')

var create = SecretStack({ appKey: appkey }).use(require('../'))

function tmp (name) {
  var dir = path.join(osenv.tmpdir(), 'testblobs-'+Date.now()+'-'+name)
  mkdirp.sync(dir)
  return dir
}

var alice = create({ seed: hash('ALICE'), path: tmp('alice') })
var bob = create({ seed: hash('BOB'), path: tmp('bob') })

tape('alice pushes to bob', function (t) {

  alice.connect(bob.address(), function (err, rpc) {
    if(err) throw err
  })

  var hello = new Buffer('Hello World'), _hash

  pull(
    bob.blobs.ls({live: true, long: true}),
    pull.take(1),
    pull.collect(function (err, ary) {
      t.equal(ary[0].id, _hash)
      t.end()
      alice.close()
      bob.close()
    })
  )

  pull(
    pull.values([hello]),
    alice.blobs.add(function (err, hash) {
      _hash = hash
      alice.blobs.push(hash)
    })
  )
})

