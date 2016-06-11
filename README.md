# ssb-blobs

protocol for gossiping "blobs", in no particular order.

## protocol

when two peers connect, they request the blobs the other peer "wants"
they do this by sending a JSON object that is a map of
`{<blob_id>: -hop_count}` (note, the hop count is negative)
if they have a blob wanted by the peer, they respond
with the size they have for that blob: `{<blob_id>: size}` (note,
size is positive - this is how sizes and blobs are distinguished)

Peers can only request blobs they know about. In the legacy
[scuttlebot/plugins/blobs](https://github.com/ssbc/scuttlebot/tree/99fad7c5f6e436cbd670346b4da20c57222a1419/plugins/blobs)
peers would request blobs that where mentioned in an
[ssb-feed](https://github.com/ssbc/ssb-feed) but this approach
means they cannot know about (encrypted) blobs shared in private
messages, or about blobs recursively linked from other blobs.

This protocol addresses that by implementing _sympathetic wants_,
if a peer requests a blob that you do not have, you start to want it too.
so that wants to not flood the entire network, you signal how much
you want it with a hop count. If you want it for your self,
you use a `hop_count` of -1, if you want it for a friend,
you use a `hop_count` of -2 (and so on..)

This allows you to publish a secret blob, without creating
a permanent cryptographic record of that blob.

However, this alone would mean that to upload a blob,
someone else needs to request it from you, which requries
both peers to be online at the same time.

To address this, we have a `push` method. "pushing" a blob,
just makes a peer "pretend" that they want a blob,
triggering sympathetic wants from intermediate nodes,
ensuring that there are at least some peers that will have the blob.
(currently, your peer will continue to pretend they want the
blob until at least 3 peers report having it)


## License

MIT










