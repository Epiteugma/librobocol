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
        let encodedNumbers = new Map<Uint8Array, Uint8Array>();

        let payloadLength = encodedTag.length + 9;

        for (let [key, value] of this.dataStrings) {
            let encodedKey = encoder.encode(key);
            let encodedValue = encoder.encode(value);

            encodedStrings.set(encodedKey, encodedValue);
            payloadLength += encodedKey.length + encodedValue.length + 4;
        }

        for (let [key, value] of this.dataNumbers) {
            let encodedKey = encoder.encode(key);
            let encodedValue = new Uint8Array(4);

            writeFloat(encodedValue, 0, value, Packet.BYTE_ORDER);
            encodedNumbers.set(encodedKey, encodedValue);

            payloadLength += encodedKey.length + 6;
        }

        let buf = this.withHeader(payloadLength);

        writeLong(buf, 5, this.timestamp, Packet.BYTE_ORDER);

        buf[13] = this.isSorted ? 1 : 0;
        buf[14] = this.robotState;
        buf[15] = encodedTag.length;

        for (let i = 0; i < encodedTag.length; i++) {
            buf[16 + i] = encodedTag[i];
        }

        buf[16 + encodedTag.length] = encodedStrings.size;
        let offset = 17 + encodedTag.length;

        for (let [key, value] of encodedStrings) {
            writeShort(buf, offset, key.length, Packet.BYTE_ORDER);
            
            for (let i = 0; i < key.length; i++) {
                buf[offset + 2 + i] = key[i];
            }

            offset += key.length + 2;
            writeShort(buf, offset, value.length, Packet.BYTE_ORDER);

            for (let i = 0; i < value.length; i++) {
                buf[offset + 2 + i] = value[i];
            }

            offset += value.length + 2;
        }

        buf[offset] = encodedNumbers.size;
        offset++;

        for (let [key, value] of encodedNumbers) {
            writeShort(buf, offset, key.length, Packet.BYTE_ORDER);

            for (let i = 0; i < key.length; i++) {
                buf[offset + 2 + i] = key[i];
            }

            offset += key.length + 2;

            for (let i = 0; i < value.length; i++) {
                buf[offset + i] = value[i];
            }

            offset += value.length; // should always be 4
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
        this.tag = decoder.decode(buf.slice(16, 16 + tagLength));

        let stringCount = buf[16 + tagLength];
        let offset = 17 + tagLength;

        for (let i = 0; i < stringCount; i++) {
            let keyLength = readShort(buf, offset, Packet.BYTE_ORDER);
            let key = decoder.decode(buf.slice(offset + 2, offset + 2 + keyLength));

            offset += keyLength + 2;

            let valLength = readShort(buf, offset, Packet.BYTE_ORDER);
            let value = decoder.decode(buf.slice(offset + 2, offset + 2 + valLength));

            this.dataStrings.set(key, value);
            offset += valLength + 2;
        }

        let numberCount = buf[offset];
        offset++;

        for (let i = 0; i < numberCount; i++) {
            let keyLength = readShort(buf, offset, Packet.BYTE_ORDER);
            let key = decoder.decode(buf.slice(offset + 2, offset + 2 + keyLength));

            offset += keyLength + 2;

            let value = readFloat(buf, offset, Packet.BYTE_ORDER);
            this.dataNumbers.set(key, value);

            offset += 4;
        }

        return this;
    }
}