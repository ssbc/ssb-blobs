# ssb-blobs

current protocol:

client calls `has([id,...], cb)` and then
server calls back array `[boolean: has,...]`

if the server reports they have a given blob,
then the client requests that blob.

## want-stream

Client creates want stream.

Client & server emit their wants {hash: hops} tuples.
if a peer has a hash, they respond: {hash: size}

if that size is under the max, request the blob from that peer.
delete the blob from the want list.

## License

MIT
