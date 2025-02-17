import { ByteOrder, writeShort } from '../buffer_utils';
import Heartbeat from './heartbeat';
import Gamepad from './gamepad';
import PeerDiscovery from './peer_discovery';
import Command from './command';
import Telemetry from './telemetry';
import KeepAlive from './keep_alive';

export default abstract class Packet {
    static readonly BYTE_ORDER = ByteOrder.BE;

    abstract readonly uid: number;
    abstract seq_num: number;

    abstract serialize(): Uint8Array;
    abstract deserialize(buf: Uint8Array): this | undefined;

    protected with_header(payload_length: number) {
        let buf = new Uint8Array(5 + payload_length);

        buf[0] = this.uid;

        writeShort(buf, 1, buf.length);
        writeShort(buf, 3, this.seq_num);

        return buf;
    };
}

export type DeserializeResult = Heartbeat | Gamepad | PeerDiscovery | Command | Telemetry | KeepAlive | undefined;

export function deserialize(buf: Uint8Array): DeserializeResult {
    let packet: DeserializeResult;

    switch (buf[0]) {
        case (packet = new Heartbeat()).uid:
        case (packet = new Gamepad()).uid:
        case (packet = new PeerDiscovery()).uid:
        case (packet = new Command()).uid:
        case (packet = new Telemetry()).uid:
        case (packet = new KeepAlive()).uid:
            break;
    }

    return packet?.deserialize(buf);
}