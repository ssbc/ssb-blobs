const pull = require('pull-stream')
const pl = require('pull-level')

module.exports = function (db) {
  const state = {
    isSync: false,
    set: {}
  }

  pull(
    pl.read(db, { live: true, old: true }),
    pull.drain(function (e) {
      if (e.sync === true) {
        state.isSync = true
        return
      }

      if (e.type === 'del') delete state.set[e.key]
      else state.set[e.key] = e.value
    })
  )

  return {
    state,
    add: function (key, cb) {
      db.put(key, -1, cb)
    },
    remove: function (key, cb) {
      db.del(key, cb)
    }
  }
}
