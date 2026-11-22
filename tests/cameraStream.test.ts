import { describe, expect, test } from 'bun:test';
import fixture from './fixtures/sdk12-camera-stream.json';

import { deserialize } from '../serialization';
import Command from '../packets/command';
import {
    CHUNK_SIZE, CMD_RECEIVE_FRAME_BEGIN, CMD_RECEIVE_FRAME_CHUNK, CMD_REQUEST_FRAME, CMD_STREAM_CHANGE,
    FrameAssembler, ReceiveFrameBegin, ReceiveFrameChunk, StreamChange,
    createRequestFrameCommand, decodeBase64, encodeBase64Android, isJpeg,
} from '../commands/cameraStream';

const fromHex = (hex: string) => new Uint8Array(hex.match(/../g)!.map(h => parseInt(h, 16)));
const toHex = (buf: Uint8Array) => Array.from(buf, b => b.toString(16).padStart(2, '0')).join('');
const jpeg = decodeBase64(fixture.jpegBase64)!;

function sdkCommand(hex: string) {
    let packet = deserialize(fromHex(hex));
    expect(packet).toBeInstanceOf(Command);
    return packet as Command;
}

function chunksOf(data: Uint8Array, frameNum: number) {
    let chunks: ReceiveFrameChunk[] = [];
    for (let i = 0; i * CHUNK_SIZE < data.length; i++) chunks.push(new ReceiveFrameChunk(frameNum, i, data.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)));
    return chunks;
}

function encodeLike(extra: string, name: string, timestampOffset: number, seqNum: number) {
    let command = new Command();
    command.name = name;
    command.extra = extra;
    command.timestamp = BigInt(fixture.timestamp) + BigInt(timestampOffset);
    command.seqNum = seqNum;
    return toHex(command.serialize());
}

describe('SDK 12.0.0 wire format (payloads produced by RobotCore 12.0.0)', () => {
    test('fixture is a multi-chunk JPEG with a smaller last chunk', () => {
        expect(fixture.chunkSize).toBe(CHUNK_SIZE);
        expect(jpeg.length).toBe(fixture.length);
        expect(isJpeg(jpeg)).toBe(true);
        expect(fixture.chunks.length).toBe(3);
        expect(fixture.length % CHUNK_SIZE).toBeGreaterThan(0);
    });

    test('CMD_STREAM_CHANGE extra is a plain "true"/"false" string', () => {
        expect(fixture.streamChangeTrue.extra).toBe('true');
        expect(fixture.streamChangeFalse.extra).toBe('false');

        let on = sdkCommand(fixture.streamChangeTrue.packet);
        let off = sdkCommand(fixture.streamChangeFalse.packet);

        expect(on.name).toBe(CMD_STREAM_CHANGE);
        expect(StreamChange.deserialize(on.extra).streamAvailable).toBe(true);
        expect(StreamChange.deserialize(off.extra).streamAvailable).toBe(false);
    });

    test('CMD_REQUEST_FRAME has an empty extra and matches the SDK datagram', () => {
        expect(fixture.requestFrame.extra).toBe('');

        let command = createRequestFrameCommand();
        command.timestamp = BigInt(fixture.timestamp) + 2n;
        command.seqNum = fixture.firstSeq + 2;

        expect(toHex(command.serialize())).toBe(fixture.requestFrame.packet);
        expect(sdkCommand(fixture.requestFrame.packet).name).toBe(CMD_REQUEST_FRAME);
    });

    test('CMD_RECEIVE_FRAME_BEGIN is Gson {"frameNum","length"}', () => {
        expect(fixture.begin.extra).toBe(`{"frameNum":${fixture.frameNum},"length":${fixture.length}}`);

        let command = sdkCommand(fixture.begin.packet);
        let begin = ReceiveFrameBegin.deserialize(command.extra)!;

        expect(command.name).toBe(CMD_RECEIVE_FRAME_BEGIN);
        expect(begin.frameNum).toBe(fixture.frameNum);
        expect(begin.length).toBe(fixture.length);
        expect(begin.chunkCount).toBe(3);
    });

    test('CMD_RECEIVE_FRAME_CHUNK is Gson {"frameNum","chunkNum","encodedData"} with Android base64', () => {
        let first = fixture.chunks[0].extra;

        expect(first.startsWith(`{"frameNum":${fixture.frameNum},"chunkNum":0,"encodedData":"/9j/`)).toBe(true);
        // android.util.Base64.DEFAULT wraps at 76 chars and ends with a newline; Gson escapes "\n" and "=" (\u003d)
        let encoded = JSON.parse(first).encodedData as string;
        expect(encoded.split('\n')[0].length).toBe(76);
        expect(encoded.endsWith('\n')).toBe(true);
        expect(first).toContain('\\u003d\\u003d\\n"}'); // 4096 % 3 == 1 -> two padding characters

        fixture.chunks.forEach((c, i) => {
            let command = sdkCommand(c.packet);
            let chunk = ReceiveFrameChunk.deserialize(command.extra)!;

            expect(command.name).toBe(CMD_RECEIVE_FRAME_CHUNK);
            expect(chunk.frameNum).toBe(fixture.frameNum);
            expect(chunk.chunkNum).toBe(i);
            expect(chunk.offset).toBe(i * CHUNK_SIZE);
            expect(Array.from(chunk.data)).toEqual(Array.from(jpeg.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)));
        });
    });

    test('our encoders produce byte-identical extras and datagrams', () => {
        expect(new StreamChange(true).serialize()).toBe(fixture.streamChangeTrue.extra);
        expect(new StreamChange(false).serialize()).toBe(fixture.streamChangeFalse.extra);
        expect(new ReceiveFrameBegin(fixture.frameNum, fixture.length).serialize()).toBe(fixture.begin.extra);

        chunksOf(jpeg, fixture.frameNum).forEach((chunk, i) => {
            expect(chunk.serialize()).toBe(fixture.chunks[i].extra);
            expect(encodeLike(chunk.serialize(), CMD_RECEIVE_FRAME_CHUNK, 4 + i, fixture.firstSeq + 4 + i)).toBe(fixture.chunks[i].packet);
        });

        expect(encodeLike('true', CMD_STREAM_CHANGE, 0, fixture.firstSeq)).toBe(fixture.streamChangeTrue.packet);
        expect(encodeLike(fixture.begin.extra, CMD_RECEIVE_FRAME_BEGIN, 3, fixture.firstSeq + 3)).toBe(fixture.begin.packet);
    });

    test('a whole SDK frame reassembles to the original JPEG', () => {
        let assembler = new FrameAssembler();

        expect(assembler.begin(ReceiveFrameBegin.deserialize(sdkCommand(fixture.begin.packet).extra)).status).toBe('started');

        let results = fixture.chunks.map(c => assembler.chunk(ReceiveFrameChunk.deserialize(sdkCommand(c.packet).extra)));
        let last = results.at(-1)!;

        expect(results.slice(0, -1).map(r => r.status)).toEqual(['progress', 'progress']);
        expect(last.status).toBe('complete');
        if (last.status === 'complete') expect(toHex(last.data)).toBe(toHex(jpeg));
    });
});

describe('roundtrips', () => {
    test('StreamChange', () => {
        for (let v of [true, false]) expect(StreamChange.deserialize(new StreamChange(v).serialize()).streamAvailable).toBe(v);
    });

    test('ReceiveFrameBegin', () => {
        let begin = ReceiveFrameBegin.deserialize(new ReceiveFrameBegin(42, 123456).serialize())!;
        expect([begin.frameNum, begin.length]).toEqual([42, 123456]);
    });

    test('ReceiveFrameChunk (all sizes 0..4096 boundary cases)', () => {
        for (let size of [0, 1, 2, 3, 56, 57, 58, 4095, 4096]) {
            let data = new Uint8Array(size).map((_, i) => (i * 31 + size) & 0xff);
            let chunk = ReceiveFrameChunk.deserialize(new ReceiveFrameChunk(3, 9, data).serialize())!;
            expect([chunk.frameNum, chunk.chunkNum]).toEqual([3, 9]);
            expect(Array.from(chunk.data)).toEqual(Array.from(data));
        }
    });

    test('through a full Command packet', () => {
        let command = new Command();
        command.name = CMD_RECEIVE_FRAME_CHUNK;
        command.extra = new ReceiveFrameChunk(1, 0, jpeg.slice(0, CHUNK_SIZE)).serialize();
        command.timestamp = 99n;

        let parsed = deserialize(command.serialize()) as Command;
        expect(Array.from(ReceiveFrameChunk.deserialize(parsed.extra)!.data)).toEqual(Array.from(jpeg.slice(0, CHUNK_SIZE)));
    });

    test('base64 helpers', () => {
        let data = new Uint8Array(200).map((_, i) => 255 - i);
        expect(Array.from(decodeBase64(encodeBase64Android(data))!)).toEqual(Array.from(data));
        expect(encodeBase64Android(new Uint8Array(0))).toBe('');
    });
});

describe('malformed payloads never throw', () => {
    const junk: unknown[] = ['', '{', '[]', 'null', 'true', '{"frameNum":"1","length":"2"}', '{"frameNum":1.5,"length":2}',
        '{"frameNum":-1,"length":10}', '{"frameNum":1,"length":-10}', '{"frameNum":1}', '{"frameNum":1,"length":3000000000}', null, undefined, 5, [], {}];

    test('StreamChange follows Boolean.parseBoolean', () => {
        expect(StreamChange.deserialize('TRUE').streamAvailable).toBe(true);
        expect(StreamChange.deserialize(true).streamAvailable).toBe(true);
        for (let j of ['', 'yes', '1', 'false', null, undefined, 1, {}]) expect(StreamChange.deserialize(j).streamAvailable).toBe(false);
    });

    test('ReceiveFrameBegin rejects garbage, negative and non-integer values', () => {
        for (let j of junk) expect(ReceiveFrameBegin.deserialize(j)).toBeUndefined();
    });

    test('ReceiveFrameChunk rejects garbage, bad base64 and oversized chunks', () => {
        for (let j of junk) expect(ReceiveFrameChunk.deserialize(j)).toBeUndefined();

        expect(ReceiveFrameChunk.deserialize('{"frameNum":1,"chunkNum":0,"encodedData":"!!!!"}')).toBeUndefined();
        expect(ReceiveFrameChunk.deserialize('{"frameNum":1,"chunkNum":0,"encodedData":"abc"}')).toBeUndefined();
        expect(ReceiveFrameChunk.deserialize('{"frameNum":1,"chunkNum":0,"encodedData":5}')).toBeUndefined();
        expect(ReceiveFrameChunk.deserialize(new ReceiveFrameChunk(1, 0, new Uint8Array(CHUNK_SIZE + 1)).serialize())).toBeUndefined();
    });

    test('truncated / corrupted datagrams', () => {
        let packet = fromHex(fixture.chunks[0].packet);
        for (let cut of [0, 1, 5, 13, 16, 17, 40, 60, packet.length - 10, packet.length - 1]) {
            expect(() => deserialize(packet.slice(0, cut))).not.toThrow();
            expect(deserialize(packet.slice(0, cut))).toBeUndefined();
        }

        let corrupted = packet.slice();
        corrupted[100] = 0x00; // inside encodedData
        let cmd = deserialize(corrupted) as Command;
        expect(ReceiveFrameChunk.deserialize(cmd.extra)).toBeUndefined();
    });

    test('isJpeg', () => {
        expect(isJpeg(jpeg)).toBe(true);
        expect(isJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(false);
        expect(isJpeg(jpeg.slice(0, -2))).toBe(false);
        expect(isJpeg(new Uint8Array(0))).toBe(false);
    });
});

describe('FrameAssembler', () => {
    function start(frameNum = 1, data = jpeg, assembler = new FrameAssembler()) {
        expect(assembler.begin(new ReceiveFrameBegin(frameNum, data.length)).status).toBe('started');
        return { assembler, chunks: chunksOf(data, frameNum) };
    }

    test('multiple chunks with a smaller last chunk, in order', () => {
        let { assembler, chunks } = start();
        expect(chunks.at(-1)!.data.length).toBeLessThan(CHUNK_SIZE);

        let r = chunks.map(c => assembler.chunk(c));
        expect(r.map(x => x.status)).toEqual(['progress', 'progress', 'complete']);
        expect(assembler.frameInProgress).toBeNull();
    });

    test('out of order (offset = chunkNum * 4096)', () => {
        let { assembler, chunks } = start();
        let r = [2, 0, 1].map(i => assembler.chunk(chunks[i])).at(-1)!;

        expect(r.status).toBe('complete');
        if (r.status === 'complete') expect(toHex(r.data)).toBe(toHex(jpeg));
    });

    test('duplicate chunk (RC retransmission) is ignored, conflicting duplicate is an error', () => {
        let { assembler, chunks } = start();
        assembler.chunk(chunks[0]);

        expect(assembler.chunk(chunks[0]).status).toBe('ignored');
        expect(assembler.chunk(chunks[1]).status).toBe('progress');

        let tampered = new ReceiveFrameChunk(1, 1, chunks[1].data.map(b => b ^ 1));
        expect(assembler.chunk(tampered).status).toBe('error');
        expect(assembler.frameInProgress).toBeNull();
    });

    test('duplicate BEGIN does not reset progress', () => {
        let { assembler, chunks } = start();
        assembler.chunk(chunks[0]);

        expect(assembler.begin(new ReceiveFrameBegin(1, jpeg.length)).status).toBe('ignored');
        expect(assembler.frameInProgress!.received).toBe(CHUNK_SIZE);
        expect(assembler.begin(new ReceiveFrameBegin(1, jpeg.length + 1)).status).toBe('error');
    });

    test('missing chunk stays incomplete and is reported', () => {
        let { assembler, chunks } = start();
        assembler.chunk(chunks[0]);
        assembler.chunk(chunks[2]);

        expect(assembler.frameInProgress).not.toBeNull();
        expect(assembler.missingChunks).toEqual([1]);

        assembler.abort(); // what the DS does on timeout
        expect(assembler.chunk(chunks[1]).status).toBe('ignored'); // late chunk
    });

    test('wrong frameNum is ignored and does not end up in the frame', () => {
        let { assembler, chunks } = start(5);
        let other = chunksOf(jpeg.map(b => b ^ 0xff), 4);

        expect(assembler.chunk(other[0]).status).toBe('ignored');
        expect(assembler.chunk(new ReceiveFrameChunk(6, 0, chunks[0].data)).status).toBe('ignored');

        let r = chunks.map(c => assembler.chunk(c)).at(-1)!;
        expect(r.status).toBe('complete');
        if (r.status === 'complete') expect(toHex(r.data)).toBe(toHex(jpeg));
    });

    test('stale BEGIN of an older frame is ignored', () => {
        let { assembler, chunks } = start(5);
        chunks.forEach(c => assembler.chunk(c));

        expect(assembler.begin(new ReceiveFrameBegin(5, jpeg.length)).status).toBe('ignored');
        expect(assembler.begin(new ReceiveFrameBegin(3, jpeg.length)).status).toBe('ignored');
        expect(assembler.begin(new ReceiveFrameBegin(6, jpeg.length)).status).toBe('started');

        assembler.reset(); // new connection
        expect(assembler.begin(new ReceiveFrameBegin(0, jpeg.length)).status).toBe('started');
    });

    test('announced length does not match the chunks', () => {
        // BEGIN says shorter than the data: last chunk too long
        let a = start(1, jpeg.slice(0, jpeg.length - 10)).assembler;
        let real = chunksOf(jpeg, 1);
        a.chunk(real[0]); a.chunk(real[1]);
        expect(a.chunk(real[2]).status).toBe('error');

        // BEGIN says one chunk less than sent: extra chunk out of range
        let b = start(1, jpeg.slice(0, CHUNK_SIZE * 2)).assembler;
        expect(b.chunk(real[2]).status).toBe('error');

        // BEGIN says longer: frame never completes (timeout in the DS)
        let c = start(1, new Uint8Array(CHUNK_SIZE * 2 + 100)).assembler;
        expect(c.chunk(real[0]).status).toBe('progress');
        expect(c.chunk(real[1]).status).toBe('progress');
        expect(c.missingChunks).toEqual([2]);
        expect(c.chunk(real[2]).status).toBe('error'); // its size does not match either

        // short non-final chunk
        let d = start().assembler;
        expect(d.chunk(new ReceiveFrameChunk(1, 0, new Uint8Array(100))).status).toBe('error');
    });

    test('frame larger than the limit, empty frame, malformed messages', () => {
        let small = new FrameAssembler(10000);
        expect(small.begin(new ReceiveFrameBegin(1, 10001)).status).toBe('error');
        expect(small.frameInProgress).toBeNull();
        expect(new FrameAssembler().begin(new ReceiveFrameBegin(1, 10 * 1024 * 1024 + 1)).status).toBe('error');
        expect(new FrameAssembler().begin(new ReceiveFrameBegin(1, 0)).status).toBe('error');
        expect(new FrameAssembler().begin(undefined).status).toBe('error');

        let { assembler } = start();
        expect(assembler.chunk(undefined).status).toBe('error');
        expect(assembler.frameInProgress).toBeNull();
        expect(new FrameAssembler().chunk(undefined).status).toBe('ignored');
    });
});
