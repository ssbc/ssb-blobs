var tape = require('tape')
var pull = require('pull-stream')

var u = require('./util')

function run (createBlobs, createAsync) {
  tape('createWants does not error after abort', function (t) {
    createAsync(function (async) {
      var blobs = createBlobs('simple', async)
      var wants = blobs.createWants.call({ id: 'test' })
      // abort the want stream, and then make another one
      wants(new Error('abort'), function (err) {
        t.ok(err, 'wants aborted')
        pull(
          blobs.createWants.call({ id: 'test' }),
          async.through(),
          pull.take(1),
          pull.collect(function (err, res) {
            t.error(err, 'wants')
            t.deepEquals(res, [{}], 'empty wants')
            t.end()
          })
        )
      })
    })
  })
}

u.tests(run)
