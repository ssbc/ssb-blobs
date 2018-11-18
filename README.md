# ssb-blobs

Protocol for gossiping "blobs", in no particular order.

## Protocol

When two peers connect, they request the blobs they "want" from each other.
They do this by sending a JSON object that is a map of
`{<blob_id>: -hop_count}` (note, the hop count is negative) to the peer.
If they have a blob wanted by the peer, they respond with the size they have
for that blob: `{<blob_id>: size}` (note, size is positive - this is how sizes
and blobs are distinguished).

Peers can only request blobs they know about. In the legacy
[scuttlebot/plugins/blobs](https://github.com/ssbc/scuttlebot/tree/99fad7c5f6e436cbd670346b4da20c57222a1419/plugins/blobs)
peers would request blobs that where mentioned in an
[ssb-feed](https://github.com/ssbc/ssb-feed) but this approach
means they cannot know about (encrypted) blobs shared in private
messages, or about blobs recursively linked from other blobs.

This protocol addresses that by implementing _sympathetic wants_.
If a peer requests a blob that you do not have, you start to want it too.
To prevent these requests from flooding the entire network, you signal how much
you want a blob with a hop count.
If you want it for yourself, you use a `hop_count` of -1.
If you want it for a friend, you use a `hop_count` of -2 (and so on..)

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


## Configuration

By changing `.ssb/config`, you can control how generous
ssb-blobs will be. These are the default values:

``` js
"blobs": {
  "stingy": false,
  "sympathy": 3,
  "pushy": 3,
  "legacy": true,
  "max": 5000000,
}
```

### `stingy` (default `false`)

Enabling `stingy` mode will make your pub pretend it does not have blobs
unless it _wants_ to push those blobs to the network. (because you have uploaded that file)

### `sympathy` (default `3`)

When a peer asks for a blob, if you do not have it, then out of sympathy you'll
ask for it from your other peers.
The value for `sympathy` determines how many hops away from you that peer may be.
Note that this depends on hops on the current network topology, not the follow
graph: `ssb-blobs` is actually completely independent of the ssb logs.

Set this to 0 to never request a blob that someone else has asked for, unless _you_ want it too.

### `pushy (default `3`)

When you publish a blob, tell everyone about it, until at least this many peers have taken it.
Of course for this they will need a setting for `sympathy` > 0.


### `legacy` (default `true`)

Whether you support the legacy style blob replication or not.
It's probably safe to disable this now since most pubs will have updated by now.

### `max` (default `5MB`)

Maximum size of blobs to replicate.
Note that if you set this too low, blobs will simply fail to be retrieved.

## License

MIT



