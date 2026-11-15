import { readLong, readShort, writeLong } from '../bufferUtils';
import { RobotState } from '../types';
import Packet from './packet';

export default class Heartbeat extends Packet {
    uid = 1;
    seqNum = 0;

    timestamp = 0n;
    robotState: RobotState;

    t0 = 0n; t1 = 0n; t2 = 0n;
    timezoneId: string;

    serialize() {
        let timezoneIdBytes = new TextEncoder().encode(this.timezoneId);
        let buf = this.withHeader(8 + 1 + 8 * 3 + 1 + timezoneIdBytes.length);

        buf[13] = this.robotState;
        buf[38] = timezoneIdBytes.length;

        writeLong(buf, 5, this.timestamp, Packet.BYTE_ORDER);
        writeLong(buf, 14, this.t0, Packet.BYTE_ORDER);
        writeLong(buf, 22, this.t1, Packet.BYTE_ORDER);
        writeLong(buf, 30, this.t2, Packet.BYTE_ORDER);

        for (let i = 0; i < timezoneIdBytes.length; i++) {
            buf[39 + i] = timezoneIdBytes[i];
        }

        return buf;
    }

    deserialize(buf: Uint8Array) {
        if (buf.length < 5 + 8 + 1 + 8 * 3 + 1) return;

        this.seqNum = readShort(buf, 3, Packet.BYTE_ORDER);
        this.timestamp = readLong(buf, 5, Packet.BYTE_ORDER);
        this.robotState = buf[13];

        this.t0 = readLong(buf, 14, Packet.BYTE_ORDER);
        this.t1 = readLong(buf, 22, Packet.BYTE_ORDER);
        this.t2 = readLong(buf, 30, Packet.BYTE_ORDER);

        this.timezoneId = new TextDecoder().decode(buf.slice(39, 39 + buf[38]));
        return this;
    }
}