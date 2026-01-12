| * | SSB | ActivityPub | ANProto | ATProto | Nostr | Farcaster |
| -------- | --- | ----------- | ------- | ------- | ----- | --------- |
| Created  | 2015 (2012 as scuttlebutt) | 2016 (2012 as pump.io)        | 2019 (as bog v1)    | 2019 (as smor-serve)   | 2020  | 2020      |
| #1 App | Patchbay | Mastodon | Wiredove | Bluesky | Primal | Base | 
| Creators | Dominic Tarr + Paul Frazee | Evan Prodromou + Christine Lemmer-Webber | Everett Bogue | Jay Graber + Paul Frazee | Fiatjaf | Dan Romero + Varun Srinivasan |
| Jack Dorsey? | False | False | False | Funded then quit | Funded | False |
| Keys     | ed25519 | none | ed25519 | secp256k1 | secp256k1 | ed25519 |
| Identity | self-id | server | self-id | did:plc + dns handle | self-id | eth-id |
| Data model | append-only | json-ld | hashchain* | repo | flat | flat |
| Message security | userkeys | none | userkeys | serverkeys | userkeys | userkeys |
| Strategy | pubs | federation | any | firehose + appview | relays | hubs |
| Replication | p2p | server <-> server | any | pds -> firehose -> appview | client -> relays | client -> hubs |
