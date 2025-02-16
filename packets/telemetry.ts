import { readFloat, readLong, readShort, writeFloat, writeLong } from '../buffer_utils';
import { RobotState } from '../types';
import Packet from './packet';

export default class Telemetry extends Packet {
    uid = 5;
    seq_num = 0;

    data_strings = new Map<string, string>();
    data_numbers = new Map<string, number /* float */>();

    timestamp: bigint;

    is_sorted = false;
    robot_state: RobotState;

    tag: string;

    serialize() {
        let encoder = new TextEncoder();

        let encoded_tag = encoder.encode(this.tag);
        let encoded_strings = new Map<Uint8Array, Uint8Array>();
        let encoded_numbers = new Map<Uint8Array, Uint8Array>();

        let payload_length = encoded_tag.length + 9;

        for (let [key, value] of this.data_strings) {
            let encoded_key = encoder.encode(key);
            let encoded_value = encoder.encode(value);

            encoded_strings.set(encoded_key, encoded_value);
            payload_length += encoded_key.length + encoded_value.length + 2;
        }

        for (let [key, value] of this.data_numbers) {
            let encoded_key = encoder.encode(key);
            let encoded_value = new Uint8Array(4);

            writeFloat(encoded_value, 0, value, Packet.BYTE_ORDER);
            encoded_numbers.set(encoded_key, encoded_value);

            payload_length += encoded_key.length + 5;
        }

        let buf = this.with_header(payload_length);

        writeLong(buf, 5, this.timestamp, Packet.BYTE_ORDER);

        buf[13] = this.is_sorted ? 1 : 0;
        buf[14] = this.robot_state;
        buf[15] = encoded_tag.length;

        for (let i = 0; i < encoded_tag.length; i++) {
            buf[16 + i] = encoded_tag[i];
        }

        buf[16 + encoded_tag.length] = encoded_strings.size;
        let offset = 17 + encoded_tag.length;

        for (let [key, value] of encoded_strings) {
            buf[offset] = key.length;
            
            for (let i = 0; i < key.length; i++) {
                buf[offset + 1 + i] = key[i];
            }

            offset += key.length + 1;
            buf[offset] = value.length;

            for (let i = 0; i < value.length; i++) {
                buf[offset + 1 + i] = value[i];
            }

            offset += value.length + 1;
        }

        buf[offset] = encoded_numbers.size;
        offset++;

        for (let [key, value] of encoded_numbers) {
            buf[offset] = key.length;

            for (let i = 0; i < key.length; i++) {
                buf[offset + 1 + i] = key[i];
            }

            offset += key.length + 1;

            for (let i = 0; i < value.length; i++) {
                buf[offset + 1 + i] = value[i];
            }

            offset += value.length; // should always be 4
        }

        return buf;
    }

    deserialize(buf: Uint8Array) {
        if (buf.length < 17) return;

        this.data_strings.clear();
        this.data_numbers.clear();

        this.seq_num = readShort(buf, 3, Packet.BYTE_ORDER);
        this.timestamp = readLong(buf, 5, Packet.BYTE_ORDER);
        this.is_sorted = !!buf[13];

        this.robot_state = buf[14];

        let decoder = new TextDecoder();
        let tag_length = buf[15];
        this.tag = decoder.decode(buf.slice(16, 16 + tag_length));

        let string_count = buf[16 + tag_length];
        let offset = 17 + tag_length;

        for (let i = 0; i < string_count; i++) {
            let key_length = buf[offset];
            let key = decoder.decode(buf.slice(offset + 1, offset + 1 + key_length));

            offset += key_length + 1;

            let val_length = buf[offset];
            let value = decoder.decode(buf.slice(offset + 1, offset + 1 + val_length));

            this.data_strings.set(key, value);
            offset += val_length + 1;
        }

        let number_count = buf[offset];
        offset++;

        for (let i = 0; i < number_count; i++) {
            let key_length = buf[offset];
            let key = decoder.decode(buf.slice(offset + 1, offset + 1 + key_length));

            offset += key_length + 1;

            let value = readFloat(buf, offset, Packet.BYTE_ORDER);
            this.data_numbers.set(key, value);

            offset += 4;
        }

        return this;
    }
}