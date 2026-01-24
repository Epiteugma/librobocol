import { readShort, writeShort } from '../bufferUtils';
import Packet from './packet';

export enum PeerType {
    Unset,
    Peer,
    GroupOwner,
    NotConnectedDueToPreexistingConnection
}

export default class PeerDiscovery extends Packet {
    uid = 3;
    seqNum = 0;

    robocolVersion = 124;
    peerType = PeerType.Peer;
    
    sdkBuildMonth = 8;
    sdkBuildYear = 2025;

    sdkMajorVersion = 11;
    sdkMinorVersion = 0;

    serialize() {
        let buf = new Uint8Array(13);

        buf[0] = this.uid;
        writeShort(buf, 1, 10, Packet.BYTE_ORDER);

        buf[3] = this.robocolVersion;
        buf[4] = PeerType.Peer;

        writeShort(buf, 5, this.seqNum, Packet.BYTE_ORDER);

        buf[7] = this.sdkBuildMonth;
        writeShort(buf, 8, this.sdkBuildYear, Packet.BYTE_ORDER);

        buf[10] = this.sdkMajorVersion;
        buf[11] = this.sdkMinorVersion;

        return buf;
    }

    deserialize(buf: Uint8Array) {
        if (buf.length < 13) return;

        this.robocolVersion = buf[3];
        this.peerType = buf[4];

        this.seqNum = readShort(buf, 5, Packet.BYTE_ORDER);

        this.sdkBuildMonth = buf[7];
        this.sdkBuildYear = readShort(buf, 8, Packet.BYTE_ORDER);

        this.sdkMajorVersion = buf[10];
        this.sdkMinorVersion = buf[11];

        return this;
    }
}