import { readFloat, readLong, readShort, writeFloat, writeLong, writeShort } from '../bufferUtils';
import { RobotState } from '../types';
import Packet from './packet';

export default class Telemetry extends Packet {
    uid = 5;
    seqNum = 0;

    dataStrings = new Map<string, string>();
    dataNumbers = new Map<string, number /* float */>();

    timestamp = 0n;

    isSorted = false;
    robotState: RobotState;

    tag: string;

    serialize() {
        let encoder = new TextEncoder();

        let encodedTag = encoder.encode(this.tag);
        let encodedStrings = new Map<Uint8Array, Uint8Array>();
        let encodedNumbers = new Map<Uint8Array, number>();

        let payloadLength = encodedTag.length + 9;

        for (let [key, value] of this.dataStrings) {
            let encodedKey = encoder.encode(key);
            let encodedValue = encoder.encode(value);

            encodedStrings.set(encodedKey, encodedValue);
            payloadLength += encodedKey.length + encodedValue.length + 4;
        }

        for (let [key, value] of this.dataNumbers) {
            let encodedKey = encoder.encode(key);
            encodedNumbers.set(encodedKey, value);

            payloadLength += encodedKey.length + 6;
        }

        let buf = this.withHeader(payloadLength);

        writeLong(buf, 5, this.timestamp, Packet.BYTE_ORDER);

        buf[13] = this.isSorted ? 1 : 0;
        buf[14] = this.robotState;
        buf[15] = encodedTag.length;

        let offset = 16;

        for (let i = 0; i < encodedTag.length; i++) {
            buf[offset++] = encodedTag[i];
        }
        
        buf[offset++] = encodedStrings.size;

        for (let [key, value] of encodedStrings) {
            writeShort(buf, offset, key.length, Packet.BYTE_ORDER);
            offset += 2;

            for (let i = 0; i < key.length; i++) buf[offset++] = key[i];
            
            writeShort(buf, offset, value.length, Packet.BYTE_ORDER);
            offset += 2;

            for (let i = 0; i < value.length; i++) buf[offset++] = value[i];
        }

        buf[offset++] = encodedNumbers.size;

        for (let [key, value] of encodedNumbers) {
            writeShort(buf, offset, key.length, Packet.BYTE_ORDER);
            offset += 2;

            for (let i = 0; i < key.length; i++) buf[offset++] = key[i];

            writeFloat(buf, offset, value, Packet.BYTE_ORDER);
            offset += 4;
        }

        return buf;
    }

    deserialize(buf: Uint8Array) {
        if (buf.length < 17) return;

        this.dataStrings.clear();
        this.dataNumbers.clear();

        this.seqNum = readShort(buf, 3, Packet.BYTE_ORDER);
        this.timestamp = readLong(buf, 5, Packet.BYTE_ORDER);
        this.isSorted = !!buf[13];

        this.robotState = buf[14];

        let decoder = new TextDecoder();
        let tagLength = buf[15];
        let offset = 16;

        this.tag = decoder.decode(buf.slice(offset, offset + tagLength));
        offset += tagLength;

        let stringCount = buf[offset++];

        for (let i = 0; i < stringCount; i++) {
            let keyLength = readShort(buf, offset, Packet.BYTE_ORDER);
            offset += 2;

            let key = decoder.decode(buf.slice(offset, offset + keyLength));
            offset += keyLength;

            let valueLength = readShort(buf, offset, Packet.BYTE_ORDER);
            offset += 2;

            let value = decoder.decode(buf.slice(offset, offset + valueLength));
            offset += valueLength;

            this.dataStrings.set(key, value);
        }

        let numberCount = buf[offset++];

        for (let i = 0; i < numberCount; i++) {
            let keyLength = readShort(buf, offset, Packet.BYTE_ORDER);
            offset += 2;

            let key = decoder.decode(buf.slice(offset, offset + keyLength));
            offset += keyLength;

            let value = readFloat(buf, offset, Packet.BYTE_ORDER);
            offset += 4;

            this.dataNumbers.set(key, value);
        }

        return this;
    }
}