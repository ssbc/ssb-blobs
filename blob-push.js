const pull = require('pull-stream')
const pl = require('pull-level')
const Obz = require('obz')

module.exports = function BlobPush (db) {
  const isReady = Obz()
  const state = Obz()
  state.set({})

  pull(
    pl.read(db, { live: true, old: true }),
    pull.drain(function (e) {
      if (e.sync === true) {
        isReady.set(true)
        return
      }

      if (e.type === 'del') delete state.value[e.key]
      else state.value[e.key] = e.value
      state.set(state.value)
      // HACK which means we only have one state value to mutate
      // but can also trigger observable listeners
    })
  )

  return {
    onReady (fn) {
      if (isReady.value === true) return fn()

      isReady.once(fn)
    },
    state,
    add (key, cb) {
      db.put(key, -1, cb)
      // why was this set to -1?
      // was this meaning to say "I want this", or track how many we've pushed to?
    },
    remove (key, cb) {
      db.del(key, cb)
    }
  }
}
