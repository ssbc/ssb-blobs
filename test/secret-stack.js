const tape = require('tape')
const pull = require('pull-stream')
const { generate } = require('ssb-keys')
const { hash, Server } = require('./util')

// deterministic keys make testing easy.
const caps = {
  shs: hash('TESTBLOBS')
}

tape('secret-stack - alice pushes to bob', function (t) {
  t.plan(1)
  const alice = Server({ caps })
  const bob = Server({ caps })

  // Avoid race because of async server creation, introduced secret-stack@6.
  //
  // This `once()` function must be run before the event is emit, which is why
  // `Server()` must be run directly above. If `once()` is called much later
  // than `Server()` then the event is emit before the listener is created.
  bob.once('multiserver:listening', function () {
    alice.connect(bob.address(), function (err, rpc) {
      if (err) throw err
    })

    const hello = Buffer.from('Hello World')
    let _hash

    pull(
      bob.blobs.ls({ live: true, long: true }),
      pull.filter((msg) => !msg.sync),
      pull.take(1),
      pull.collect(function (err, ary) {
        if (err) throw err

        t.equal(ary[0].id, _hash)
        alice.close()
        bob.close()
      })
    )

    pull(
      pull.once(hello),
      alice.blobs.add(function (err, hash) {
        if (err) throw err
        _hash = hash
        alice.blobs.push(hash)
      })
    )
  })
})

tape('secret-stack - close', t => {
  t.plan(1)
  const keys = generate()
  const alice = Server({ name: 'alice', keys })

  alice.close((err) => {
    t.error(err)

    const alice = Server({ name: 'alice', keys, startUnclean: true })
    alice.close()
  })
})
