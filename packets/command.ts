import { readLong, readShort, writeLong, writeShort } from '../buffer_utils';
import Packet from './packet';

export default class Command extends Packet {
    uid = 4;
    seq_num = 0;

    timestamp: bigint;
    acknowledged = false;

    name: string;
    extra: any; // usually JSON data

    serialize(): Uint8Array {
        let encoder = new TextEncoder();

        let name_bytes = encoder.encode(this.name);
        let extra_bytes = typeof this.extra === 'string' ? encoder.encode(this.extra) : encoder.encode(JSON.stringify(this.extra));

        let buf = this.with_header(13 + name_bytes.length + extra_bytes.length);

        writeLong(buf, 5, this.timestamp, Packet.BYTE_ORDER);
        buf[13] = this.acknowledged ? 1 : 0;
        writeShort(buf, 14, name_bytes.length, Packet.BYTE_ORDER);

        for (let i = 0; i < name_bytes.length; i++) {
            buf[16 + i] = name_bytes[i];
        }

        writeShort(buf, 16 + name_bytes.length, extra_bytes.length, Packet.BYTE_ORDER);

        for (let i = 0; i < extra_bytes.length; i++) {
            buf[18 + name_bytes.length + i] = extra_bytes[i];
        }

        return buf;
    }

    deserialize(buf: Uint8Array) {
        this.seq_num = readShort(buf, 3, Packet.BYTE_ORDER);
        this.timestamp = readLong(buf, 5, Packet.BYTE_ORDER);
        this.acknowledged = !!buf[13];

        let decoder = new TextDecoder();
        let name_len = readShort(buf, 14, Packet.BYTE_ORDER);

        this.name = decoder.decode(buf.slice(16, 16 + name_len));

        if (!this.acknowledged) {
            let extra_len = readShort(buf, 16 + name_len, Packet.BYTE_ORDER);
            let extra_str = decoder.decode(buf.slice(18 + name_len, 18 + name_len + extra_len));
            
            try {
                this.extra = JSON.parse(extra_str);
            } catch {
                this.extra = extra_str;
            }
        }

        return this;
    }
}