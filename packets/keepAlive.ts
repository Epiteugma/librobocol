import { readShort, writeShort } from '../bufferUtils';
import Packet from './packet';

export default class KeepAlive extends Packet {
    uid = 6;
    seqNum = 0;

    id: number;

    serialize() {
        let buf = this.withHeader(1);
        buf[5] = this.id;

        return buf;
    }

    deserialize(buf: Uint8Array) {
        if (buf.length < 5 + 1) return;

        this.seqNum = readShort(buf, 3, Packet.BYTE_ORDER);
        this.id = buf[5];

        return this;
    }
}