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

##

connect want-stream.

send all your "wants".
this is an object with blobids as keys, and hops as negative
values.

`{<blobId>:<hops>}` Send a blob with -1 as hops if you want it.
send -2 if a friend wants it, send -3 if a friend of a friend wants it,
etc.

If you receive a `want` and you have that blob, send a _have_ so they
know they can request it from you. When you receive a blob, send
a _have_ to your peers, so they can request it if necessary.

To support the network, peers should request things that their friends want,
when your friend sends you a want, you may rebroadcast that want.
peers should increase the hop count (remember hops are represented as -ve,
so -1 becomes -2, etc) This way your friends in turn know that you are
requesting it for someone else, and not for yourself.

Peers should pick some hop limit, and not bother to retransmit
wants after that limit is reached.

There may be situations where a peer decrements the hop counter,
although it's generally not recommended. A peer may also increment
the hop counter by more than one - for example, if they are connected
to a peer they are not "friends" with, they may increment by 2 instead of 1,
etc.




## License

MIT
