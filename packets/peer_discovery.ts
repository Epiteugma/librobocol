import { readShort, writeShort } from '../buffer_utils';
import Packet from './packet';

export enum PeerType {
    Unset,
    Peer,
    GroupOwner,
    NotConnectedDueToPreexistingConnection
}

export default class PeerDiscovery extends Packet {
    uid = 3;
    seq_num = 0;

    robocol_version = 124;
    peer_type = PeerType.Peer;
    
    sdk_build_month = 0;
    sdk_build_year = 0;

    sdk_major_version = 0;
    sdk_minor_version = 0;

    serialize() {
        let buf = new Uint8Array(13);

        buf[0] = this.uid;
        writeShort(buf, 1, 10, Packet.BYTE_ORDER);

        buf[3] = this.robocol_version;
        buf[4] = PeerType.Peer;

        writeShort(buf, 5, this.seq_num, Packet.BYTE_ORDER);

        buf[7] = this.sdk_build_month;
        writeShort(buf, 8, this.sdk_build_year, Packet.BYTE_ORDER);

        buf[10] = this.sdk_major_version;
        buf[11] = this.sdk_minor_version;

        return buf;
    }

    deserialize(buf: Uint8Array) {
        if (buf.length < 13) return;

        this.robocol_version = buf[3];
        this.peer_type = buf[4];

        this.seq_num = readShort(buf, 5, Packet.BYTE_ORDER);

        this.sdk_build_month = buf[7];
        this.sdk_build_year = readShort(buf, 8, Packet.BYTE_ORDER);

        this.sdk_major_version = buf[10];
        this.sdk_minor_version = buf[11];

        return this;
    }
}