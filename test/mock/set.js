module.exports = function (async) {
  console.log(async)
  var set = {}
  return {
    set: set,
    add: async(function (key, cb) {
      set[key] = true
      cb && async(cb)()
    }),
    remove: async(function (key, cb) {
      delete set[key]
      cb && async(cb)()
    })
  }
}





