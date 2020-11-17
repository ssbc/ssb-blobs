var tape = require('tape')
var pull = require('pull-stream')
const { hash, Server } = require('./util')

// deterministic keys make testing easy.
const caps = {
  shs: hash('TESTBLOBS')
}

tape('alice pushes to bob', function (t) {
  var alice = Server({ seed: hash('ALICE'), caps })
  var bob = Server({ seed: hash('BOB'), caps })

  // Avoid race because of async server creation, introduced secret-stack@6.
  //
  // This `once()` function must be run before the event is emit, which is why
  // `Server()` must be run directly above. If `once()` is called much later
  // than `Server()` then the event is emit before the listener is created.
  bob.once('multiserver:listening', function () {
    alice.connect(bob.address(), function (err, rpc) {
      if (err) throw err
    })

    var hello = Buffer.from('Hello World')
    var _hash

    pull(
      bob.blobs.ls({ live: true, long: true }),
      pull.filter((msg) => !msg.sync),
      pull.take(1),
      pull.collect(function (err, ary) {
        if (err) throw err

        t.equal(ary[0].id, _hash)
        t.end()
        alice.close()
        bob.close()
      })
    )

    pull(
      pull.values([hello]),
      alice.blobs.add(function (err, hash) {
        if (err) throw err
        _hash = hash
        alice.blobs.push(hash)
      })
    )
  })
})

tape('close', t => {
  var alice = Server({ seed: hash('ALICE') })

  alice.close((err) => {
    t.error(err)

    var alice = Server({ seed: hash('ALICE'), startUnclean: true })
    alice.close(t.end)
  })
})
