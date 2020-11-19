const debug = require('debug')('ssb-blobs')

module.exports = function (async) {
  debug(async)

  const state = {
    set: {},
    isSync: true
  }
  return {
    state,
    add: async(function (key, cb) {
      state.set[key] = true
      cb && async(cb)()
    }),
    remove: async(function (key, cb) {
      delete state.set[key]
      cb && async(cb)()
    })
  }
}
