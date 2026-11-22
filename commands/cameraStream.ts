// Camera stream ("Camera Stream" menu of the official Driver Station) as implemented by FTC SDK 12.0.0:
// org.firstinspires.ftc.robotcore.external.stream.CameraStreamServer / CameraStreamClient and
// org.firstinspires.ftc.robotcore.internal.network.RobotCoreCommandList.Cmd{StreamChange,ReceiveFrameBegin,ReceiveFrameChunk}.
//
// All four messages are regular Robocol commands; this file only handles their `extra` strings.
//
//   CMD_STREAM_CHANGE        RC -> DS  extra = String.valueOf(boolean), i.e. "true" / "false" (not JSON)
//   CMD_REQUEST_FRAME        DS -> RC  extra = "" (new Command(name))
//   CMD_RECEIVE_FRAME_BEGIN  RC -> DS  extra = Gson {"frameNum":int,"length":int}
//   CMD_RECEIVE_FRAME_CHUNK  RC -> DS  extra = Gson {"frameNum":int,"chunkNum":int,"encodedData":string}
//
// `encodedData` is android.util.Base64.encodeToString(data, offset, length, DEFAULT): standard alphabet,
// padded, a '\n' after every 76 characters and a trailing '\n'. Gson (default, HTML-safe) escapes the
// newlines as \n and '=' as \u003d. The JPEG is split in CHUNK_SIZE (4096) byte chunks; the byte offset
// of a chunk is chunkNum * CHUNK_SIZE.

import Command from '../packets/command';

export const CMD_STREAM_CHANGE = 'CMD_STREAM_CHANGE';
export const CMD_REQUEST_FRAME = 'CMD_REQUEST_FRAME';
export const CMD_RECEIVE_FRAME_BEGIN = 'CMD_RECEIVE_FRAME_BEGIN';
export const CMD_RECEIVE_FRAME_CHUNK = 'CMD_RECEIVE_FRAME_CHUNK';

/** CameraStreamServer.CHUNK_SIZE */
export const CHUNK_SIZE = 4096;

/** The SDK does not limit the frame size; this is our own safety limit. */
export const DEFAULT_MAX_FRAME_BYTES = 10 * 1024 * 1024;

const INT_MAX = 2147483647;
const BASE64_LINE_LENGTH = 76;
const BASE64_REGEX = /^[A-Za-z0-9+/]*={0,2}$/;

function isInt(value: unknown, min: number, max = INT_MAX): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

// `Command.deserialize()` already JSON-parses the extra when it can, so accept both forms.
function parseObject(extra: unknown): Record<string, unknown> | undefined {
    if (typeof extra === 'string') {
        try {
            extra = JSON.parse(extra);
        } catch {
            return undefined;
        }
    }

    if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return undefined;
    return extra as Record<string, unknown>;
}

/** Same output as Gson's default (HTML-safe) string escaping for the characters JSON.stringify leaves alone. */
function toGson(value: unknown) {
    return JSON.stringify(value).replace(/[<>&='\u2028\u2029]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}

/** android.util.Base64.encodeToString(bytes, Base64.DEFAULT) */
export function encodeBase64Android(bytes: Uint8Array) {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);

    let encoded = btoa(binary);
    let out = '';

    for (let i = 0; i < encoded.length; i += BASE64_LINE_LENGTH) {
        out += encoded.slice(i, i + BASE64_LINE_LENGTH) + '\n';
    }

    return out;
}

/** Strict base64 decoder (line breaks allowed). Returns undefined for anything that is not valid base64. */
export function decodeBase64(encoded: string): Uint8Array | undefined {
    let clean = encoded.replace(/[\r\n]/g, '');
    if (clean.length % 4 !== 0 || !BASE64_REGEX.test(clean)) return undefined;

    let binary: string;

    try {
        binary = atob(clean);
    } catch {
        return undefined;
    }

    let bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    return bytes;
}

/** RobotCoreCommandList.CmdStreamChange */
export class StreamChange {
    streamAvailable = false;

    constructor(streamAvailable = false) {
        this.streamAvailable = streamAvailable;
    }

    serialize() {
        return String(this.streamAvailable);
    }

    /** Boolean.parseBoolean() semantics: only "true" (any case) means available. Never throws. */
    static deserialize(extra: unknown) {
        if (typeof extra === 'boolean') return new StreamChange(extra);
        return new StreamChange(typeof extra === 'string' && extra.toLowerCase() === 'true');
    }
}

/** RobotCoreCommandList.CmdReceiveFrameBegin */
export class ReceiveFrameBegin {
    frameNum = 0;
    length = 0;

    constructor(frameNum = 0, length = 0) {
        this.frameNum = frameNum;
        this.length = length;
    }

    get chunkCount() {
        return Math.ceil(this.length / CHUNK_SIZE);
    }

    serialize() {
        return toGson({ frameNum: this.frameNum, length: this.length });
    }

    /** Returns undefined for malformed payloads (bad JSON, missing/non-integer fields, negative numbers). */
    static deserialize(extra: unknown) {
        let obj = parseObject(extra);
        if (!obj || !isInt(obj.frameNum, 0) || !isInt(obj.length, 0)) return undefined;

        return new ReceiveFrameBegin(obj.frameNum, obj.length);
    }
}

/** RobotCoreCommandList.CmdReceiveFrameChunk */
export class ReceiveFrameChunk {
    frameNum = 0;
    chunkNum = 0;
    data: Uint8Array = new Uint8Array(0);

    constructor(frameNum = 0, chunkNum = 0, data: Uint8Array = new Uint8Array(0)) {
        this.frameNum = frameNum;
        this.chunkNum = chunkNum;
        this.data = data;
    }

    /** Byte offset of this chunk in the frame (the SDK does not send it; it is chunkNum * CHUNK_SIZE). */
    get offset() {
        return this.chunkNum * CHUNK_SIZE;
    }

    serialize() {
        return toGson({ frameNum: this.frameNum, chunkNum: this.chunkNum, encodedData: encodeBase64Android(this.data) });
    }

    /** Returns undefined for malformed payloads (bad JSON, bad numbers, invalid base64, oversized chunk). */
    static deserialize(extra: unknown) {
        let obj = parseObject(extra);
        if (!obj || !isInt(obj.frameNum, 0) || !isInt(obj.chunkNum, 0) || typeof obj.encodedData !== 'string') return undefined;

        let data = decodeBase64(obj.encodedData);
        if (!data || data.length > CHUNK_SIZE) return undefined;

        return new ReceiveFrameChunk(obj.frameNum, obj.chunkNum, data);
    }
}

/** A CMD_REQUEST_FRAME command (empty extra, like the official Driver Station). Set timestamp/seqNum before sending. */
export function createRequestFrameCommand() {
    let command = new Command();

    command.name = CMD_REQUEST_FRAME;
    command.extra = '';

    return command;
}

/** JPEG start-of-image marker (FF D8 FF) and end-of-image marker (FF D9). Bitmap.compress(JPEG) always produces both. */
export function isJpeg(data: Uint8Array) {
    return data.length >= 4 &&
        data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff &&
        data[data.length - 2] === 0xff && data[data.length - 1] === 0xd9;
}

export type FrameAssemblyResult =
    | { status: 'started'; frameNum: number; length: number }
    | { status: 'progress'; frameNum: number; received: number; length: number }
    | { status: 'complete'; frameNum: number; data: Uint8Array }
    | { status: 'ignored'; reason: string }
    | { status: 'error'; reason: string };

interface PartialFrame {
    frameNum: number;
    length: number;
    data: Uint8Array;
    received: boolean[];
    receivedCount: number;
    receivedBytes: number;
}

/**
 * Rebuilds exactly one frame at a time from CMD_RECEIVE_FRAME_BEGIN / CMD_RECEIVE_FRAME_CHUNK.
 *
 * Unlike the SDK's CameraStreamClient (which just adds up byte counts) this tracks every chunk, because the
 * Robot Controller retransmits unacknowledged commands (every 200 ms, up to 10 times), so duplicate BEGINs
 * and CHUNKs are expected. Chunks may arrive in any order. It never throws on bad input.
 */
export class FrameAssembler {
    readonly maxFrameBytes: number;

    private partial: PartialFrame | null = null;
    private lastFrameNum = -1;

    constructor(maxFrameBytes = DEFAULT_MAX_FRAME_BYTES) {
        this.maxFrameBytes = maxFrameBytes;
    }

    get frameInProgress() {
        return this.partial ? { frameNum: this.partial.frameNum, length: this.partial.length, received: this.partial.receivedBytes } : null;
    }

    /** chunkNums that have not been received yet for the frame in progress */
    get missingChunks() {
        if (!this.partial) return [];
        return this.partial.received.flatMap((r, i) => r ? [] : [i]);
    }

    begin(msg: ReceiveFrameBegin | undefined): FrameAssemblyResult {
        if (!msg) return { status: 'error', reason: 'malformed frame header' };

        if (this.partial && msg.frameNum === this.partial.frameNum) {
            if (msg.length === this.partial.length) return { status: 'ignored', reason: 'duplicate frame header' };

            this.abort();
            return { status: 'error', reason: 'frame header repeated with a different length' };
        }

        if (msg.frameNum <= this.lastFrameNum) return { status: 'ignored', reason: 'stale frame ' + msg.frameNum };

        this.abort();

        if (msg.length <= 0) return { status: 'error', reason: 'empty frame' };
        if (msg.length > this.maxFrameBytes) return { status: 'error', reason: `frame too large (${msg.length} bytes, limit ${this.maxFrameBytes})` };

        this.lastFrameNum = msg.frameNum;
        this.partial = {
            frameNum: msg.frameNum,
            length: msg.length,
            data: new Uint8Array(msg.length),
            received: new Array(msg.chunkCount).fill(false),
            receivedCount: 0,
            receivedBytes: 0,
        };

        return { status: 'started', frameNum: msg.frameNum, length: msg.length };
    }

    chunk(msg: ReceiveFrameChunk | undefined): FrameAssemblyResult {
        if (!msg) {
            if (!this.partial) return { status: 'ignored', reason: 'malformed chunk without a frame in progress' };

            this.abort();
            return { status: 'error', reason: 'malformed frame chunk' };
        }

        let frame = this.partial;

        if (!frame) return { status: 'ignored', reason: 'no frame in progress' };
        if (msg.frameNum !== frame.frameNum) return { status: 'ignored', reason: `chunk of frame ${msg.frameNum} while receiving frame ${frame.frameNum}` };

        let chunkCount = frame.received.length;

        if (msg.chunkNum >= chunkCount) {
            this.abort();
            return { status: 'error', reason: `chunk ${msg.chunkNum} out of range (frame has ${chunkCount} chunks)` };
        }

        let expectedLength = msg.chunkNum < chunkCount - 1 ? CHUNK_SIZE : frame.length - CHUNK_SIZE * (chunkCount - 1);

        if (msg.data.length !== expectedLength) {
            this.abort();
            return { status: 'error', reason: `chunk ${msg.chunkNum} has ${msg.data.length} bytes, expected ${expectedLength}` };
        }

        if (frame.received[msg.chunkNum]) {
            let existing = frame.data.subarray(msg.offset, msg.offset + expectedLength);
            if (existing.every((b, i) => b === msg.data[i])) return { status: 'ignored', reason: 'duplicate chunk ' + msg.chunkNum };

            this.abort();
            return { status: 'error', reason: `chunk ${msg.chunkNum} received twice with different data` };
        }

        frame.data.set(msg.data, msg.offset);
        frame.received[msg.chunkNum] = true;
        frame.receivedCount++;
        frame.receivedBytes += msg.data.length;

        if (frame.receivedCount < chunkCount) {
            return { status: 'progress', frameNum: frame.frameNum, received: frame.receivedBytes, length: frame.length };
        }

        this.partial = null;
        return { status: 'complete', frameNum: frame.frameNum, data: frame.data };
    }

    /** Drop the frame in progress (timeout, stop, preview closed). Late chunks of it will be ignored. */
    abort() {
        this.partial = null;
    }

    /** Drop everything, including the last frame number (new connection: the RC's frame counter may have restarted). */
    reset() {
        this.partial = null;
        this.lastFrameNum = -1;
    }
}
