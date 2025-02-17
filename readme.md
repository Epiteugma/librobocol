# librobocol

A TypeScript implementation of the *FIRST* Tech Challenge "robocol" protocol, used for communication between the Driver Station and Robot Contoller.

This implementation is independent of the JavaScript runtime and can be embedded not only into NodeJS/Bun projects, but also the browser.

## Basic Usage (NodeJS/Bun)

```ts
import { createSocket } from 'dgram';
import PeerDiscovery from './packets/peer_discovery';
import Heartbeat from './packets/heartbeat';
import { deserialize, type DeserializeResult } from './packets/packet';

const robocol_port = 20884;

// basic state
let connected = 0;
let seq_num = 0;
let last_recv: number;

const socket = createSocket('udp4');
socket.bind(robocol_port);

socket.on('message', (data, r_info) => {
    let u8 = new Uint8Array(data);
    let packet = deserialize(u8);

    if (packet) handle_packet(packet, r_info);
});

const discovery_packet = new PeerDiscovery().serialize();
let interval_tick = 0;

setInterval(() => {
    if (Date.now() - last_recv > 2000 && connected) connected = 0;

    if (!connected && interval_tick == 0) {
        // Discovery packet broadcast
        socket.send(discovery_packet, robocol_port, '192.168.43.1'); // Control Hub
        socket.send(discovery_packet, robocol_port, '192.168.49.1'); // Phone

        // Reset seq_num
        seq_num = 0;
    } else {
        send_heartbeat();
    }

    interval_tick = (interval_tick + 1) % 10;
}, 100);

function send_heartbeat() {
    const heartbeat_packet = new Heartbeat();
    heartbeat_packet.seq_num = seq_num;
    heartbeat_packet.timestamp = BigInt(Date.now()) * 1e6n; // nanoseconds
    heartbeat_packet.t0 = BigInt(Date.now());
    heartbeat_packet.timezone_id = 'GMT';

    seq_num++;

    socket.send(
        heartbeat_packet.serialize(), robocol_port,
        connected == 1 ? '192.168.43.1' : '192.168.49.1'
    );
}

function handle_packet(packet: DeserializeResult, r_info: any) {
    if (packet instanceof PeerDiscovery && !connected) {
        connected = r_info.address == '192.168.43.1' ? 1 : 2;
        seq_num = 1;

        // Complete handshake
        // TODO: verify that this is 100% correct

        send_heartbeat();
    } else if (connected) {
        last_recv = Date.now();

        // TODO: handle other packets
    }
}
```