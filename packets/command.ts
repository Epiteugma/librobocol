import { readLong, readShort, writeLong, writeShort } from '../bufferUtils';
import Packet from './packet';

export default class Command extends Packet {
    uid = 4;
    seqNum = 0;

    timestamp = 0n;
    acknowledged = false;

    name: string;
    extra: any; // usually JSON data

    serialize(): Uint8Array {
        let encoder = new TextEncoder();

        let nameBytes = encoder.encode(this.name);
        let extraBytes = typeof this.extra === 'string' ? encoder.encode(this.extra) : encoder.encode(JSON.stringify(this.extra));

        let buf = this.withHeader(13 + nameBytes.length + extraBytes.length);

        writeLong(buf, 5, this.timestamp, Packet.BYTE_ORDER);
        buf[13] = this.acknowledged ? 1 : 0;
        writeShort(buf, 14, nameBytes.length, Packet.BYTE_ORDER);

        for (let i = 0; i < nameBytes.length; i++) {
            buf[16 + i] = nameBytes[i];
        }

        if (!this.acknowledged) {
            writeShort(buf, 16 + nameBytes.length, extraBytes.length, Packet.BYTE_ORDER);

            for (let i = 0; i < extraBytes.length; i++) {
                buf[18 + nameBytes.length + i] = extraBytes[i];
            }
        }

        return buf;
    }

    deserialize(buf: Uint8Array) {
        // truncated datagram: ignore it instead of throwing (lengths are unsigned shorts, like the SDK reads them)
        if (buf.length < 16) return undefined;

        this.seqNum = readShort(buf, 3, Packet.BYTE_ORDER);
        this.timestamp = readLong(buf, 5, Packet.BYTE_ORDER);
        this.acknowledged = !!buf[13];

        let decoder = new TextDecoder();
        let nameLen = readShort(buf, 14, Packet.BYTE_ORDER) & 0xffff;
        if (buf.length < 16 + nameLen) return undefined;

        this.name = decoder.decode(buf.slice(16, 16 + nameLen));

        if (!this.acknowledged) {
            if (buf.length < 18 + nameLen) return undefined;

            let extraLen = readShort(buf, 16 + nameLen, Packet.BYTE_ORDER) & 0xffff;
            if (buf.length < 18 + nameLen + extraLen) return undefined;

            let extraStr = decoder.decode(buf.slice(18 + nameLen, 18 + nameLen + extraLen));
            
            try {
                this.extra = JSON.parse(extraStr);
            } catch {
                this.extra = extraStr;
            }
        }

        return this;
    }
}