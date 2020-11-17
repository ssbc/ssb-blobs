const pull = require('pull-stream')
const pl = require('pull-level')

module.exports = function (db) {
  const set = {}

  pull(
    pl.read(db, { live: true }),
    pull.drain(function (e) {
      if (!e.sync) {}
      if (e.type === 'del') delete set[e.key]
      else set[e.key] = e.value
    })
  )

  return {
    set: set,
    add: function (key, cb) {
      db.put(key, -1, cb)
    },
    remove: function (key, cb) {
      db.del(key, cb)
    }
  }
}
