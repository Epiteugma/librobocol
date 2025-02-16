import { readShort, writeShort } from '../buffer_utils';
import Packet from './packet';

export default class KeepAlive extends Packet {
    uid = 6;
    seq_num = 0;

    id: number;

    serialize() {
        let buf = this.with_header(1);
        buf[5] = this.id;

        return buf;
    }

    deserialize(buf: Uint8Array) {
        if (buf.length < 5 + 1) return;

        this.seq_num = readShort(buf, 3, Packet.BYTE_ORDER);
        this.id = buf[5];

        return this;
    }
}