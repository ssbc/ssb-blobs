const Obz = require('obz')
const debug = require('debug')('ssb-blobs')

module.exports = function (async) {
  debug(async)

  const isReady = Obz()
  const state = Obz()
  state.set({})
  setTimeout(() => isReady.set(true), 300)

  return {
    state,
    onReady (fn) {
      if (isReady.value === true) return fn()

      isReady.once(fn)
    },
    add: async(function (key, cb) {
      state.value[key] = true
      state.set(state.value)
      cb && async(cb)()
    }),
    remove: async(function (key, cb) {
      delete state.value[key]
      state.set(state.value)
      cb && async(cb)()
    })
  }
}
