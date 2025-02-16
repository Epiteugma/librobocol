import { readLong, readShort, writeLong } from '../buffer_utils';
import { RobotState } from '../types';
import Packet from './packet';

export default class Heartbeat extends Packet {
    uid = 1;
    seq_num = 0;

    timestamp: bigint;
    robot_state: RobotState;

    t0: bigint; t1: bigint; t2: bigint;
    timezone_id: string;

    serialize() {
        let timezone_id_bytes = new TextEncoder().encode(this.timezone_id);
        let buf = this.with_header(8 + 1 + 8 * 3 + 1 + timezone_id_bytes.length);

        buf[13] = this.robot_state;
        buf[38] = timezone_id_bytes.length;

        writeLong(buf, 5, this.timestamp, Packet.BYTE_ORDER);
        writeLong(buf, 21, this.t0, Packet.BYTE_ORDER);
        writeLong(buf, 29, this.t1, Packet.BYTE_ORDER);
        writeLong(buf, 37, this.t2, Packet.BYTE_ORDER);

        for (let i = 0; i < timezone_id_bytes.length; i++) {
            buf[39 + i] = timezone_id_bytes[i];
        }

        return buf;
    }

    deserialize(buf: Uint8Array) {
        if (buf.length < 5 + 8 + 1 + 8 * 3 + 1) return;

        this.seq_num = readShort(buf, 3, Packet.BYTE_ORDER);
        this.timestamp = readLong(buf, 5, Packet.BYTE_ORDER);
        this.robot_state = buf[13];

        this.t0 = readLong(buf, 21, Packet.BYTE_ORDER);
        this.t1 = readLong(buf, 29, Packet.BYTE_ORDER);
        this.t2 = readLong(buf, 37, Packet.BYTE_ORDER);

        this.timezone_id = new TextDecoder().decode(buf.slice(39, 39 + buf[38]));
        return this;
    }
}