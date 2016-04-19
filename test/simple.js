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

function log (name) {
  if(LOGGING)
    return pull.through(function (e) {
      console.log(name, e)
    })
  else
    return pull.through()
}


module.exports = function (createBlobStore, createAsync) {

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
          pull.find(null, function (err, _res) {
            if(err) throw err
            //requests 
            assert.deepEqual(_res, res)
            async.done()
          })
        )
      }))
    }, function (err, results) {
      if(err) throw err
      t.end()
    })
  })

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
        log('out'),
        async.through(),
        pull.drain(function (_res) {
          if(c++) throw new Error('called twice')
          //requests 
          assert.deepEqual(_res, res)
          async.done()
        })
      )

    }, function (err, results) {
      if(err) throw err
      t.end()
    })
  })


//
  tape('want', function (t) {
    createAsync(function (async) {
      var blobs = Blobs(createBlobStore('want', async))
      var h = hash(Fake('foobar', 64))
      var res = {}
      res[h] = -1

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

      blobs.want(h)
    }, function (err, results) {
      if(err) throw err
      //t.deepEqual(_res, res)
      t.end()
    })
  })
}

if(!module.parent)
    module.exports(require('./mock'), require('./sync'))













