import { ByteOrder, writeShort } from '../bufferUtils';

export default abstract class Packet {
    static readonly BYTE_ORDER = ByteOrder.BE;

    abstract readonly uid: number;
    abstract seqNum: number;

    abstract serialize(): Uint8Array;
    abstract deserialize(buf: Uint8Array): this | undefined;

    protected withHeader(payloadLength: number) {
        let buf = new Uint8Array(5 + payloadLength);

        buf[0] = this.uid;

        writeShort(buf, 1, payloadLength);
        writeShort(buf, 3, this.seqNum);

        return buf;
    };
}
