const tape = require('tape')
const pull = require('pull-stream')
const { hash, Server } = require('./util')
const { generate } = require('ssb-keys')

// deterministic keys make testing easy.
const caps = {
  shs: hash('TESTBLOBS')
}

tape('secret-stack - alice pushes to bob', function (t) {
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
        t.end()
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

tape('secret-stack - push persistence', function (t) {
  const name = 'alice-restart'
  let alice = Server({ name, caps })
  const bob = Server({ caps })

  let _hash
  const hello = Buffer.from('Hello World')

  pull(
    pull.once(hello),
    alice.blobs.add(function (err, hash) {
      t.error(err, 'alice adds blob')
      _hash = hash
      alice.blobs.push(hash)

      alice.close(err => {
        t.error(err, 'alice restarts')
        alice = Server({ name, caps, startUnclean: true })

        const finish = () => {
          t.end()
          alice.close()
          bob.close()
        }
        const timeout = setTimeout(
          () => {
            t.fail('bob receives blob')
            finish()
          },
          2000
        )

        pull(
          bob.blobs.ls({ live: true, long: true }),
          pull.filter((msg) => !msg.sync),
          pull.take(1),
          pull.collect(function (err, ary) {
            clearTimeout(timeout)
            if (err) throw err

            t.equal(ary[0].id, _hash, 'bob receives blob')
            finish()
          })
        )

        alice.connect(bob.address(), function (err, rpc) {
          t.error(err, 'alice connects to bob')
        })
      })
    })
  )
})

tape('secret-stack - close', t => {
  const keys = generate()
  const alice = Server({ name: 'alice', keys })

  alice.close((err) => {
    t.error(err)

    const alice = Server({ name: 'alice', keys, startUnclean: true })
    alice.close(t.end)
  })
})
