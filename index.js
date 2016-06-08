var create = require('./create')
var path = require('path')
var Inject = require('./inject')
var Set = require('./set')

exports.manifest = {
  get: 'source',
  add: 'sink',
  ls: 'source',
  has: 'async',
  size: 'async',
  meta: 'async',
  want: 'async',
  changes: 'source',
  createWants: 'source'
}

exports.name = 'blobs'

exports.version = require('./package.json').version

exports.permissions = {
    anonymous: {allow: ['has', 'get', 'changes', 'createWants']},
}

exports.init = function (sbot, config) {
  var blobs = Inject(
    create(path.join(config.path, 'blobs')),
    Set(level(path.join(config.path, 'blobs_push'), {valueEncoding: 'json'}))),
    sbot.id
  )

  sbot.on('rpc:connect', function (rpc) {
    blobs._onConnect(rpc, rpc.id)
  })
  return blobs
}



