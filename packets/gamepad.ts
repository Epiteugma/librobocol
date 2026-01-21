import { readFloat, readInt, readLong, readShort, writeFloat, writeInt, writeLong } from '../bufferUtils';
import Packet from './packet';

export enum GamepadType {
    Unknown,
    LogitechF310,
    Xbox360,
    SonyPS4,
    SonyPS4$Kernel,
}

export enum LegacyGamepadType {
    Unknown,
    LogitechF310,
    Xbox360,
    SonyPS4,
}

export enum GamepadID {
    Synthetic = -2,
    Unassigned = -1,
}

export function toLegacyType(gamepadType: GamepadType) {
    switch (gamepadType) {
        case GamepadType.Unknown:
            return LegacyGamepadType.Unknown;
        case GamepadType.LogitechF310:
            return LegacyGamepadType.LogitechF310;
        case GamepadType.Xbox360:
            return LegacyGamepadType.Xbox360;
        case GamepadType.SonyPS4:
            return LegacyGamepadType.SonyPS4;
        case GamepadType.SonyPS4$Kernel:
            return LegacyGamepadType.SonyPS4;
    }
}

export default class Gamepad extends Packet {
    uid = 2;
    seqNum = 0;

    version = 5;
    type = GamepadType.Unknown;

    leftStickX = 0;
    leftStickY = 0;
    rightStickX = 0;
    rightStickY = 0;
    
    dpadUp = false;
    dpadDown = false;
    dpadLeft = false;
    dpadRight = false;

    a = false;
    b = false;
    x = false;
    y = false;

    guide = false;
    start = false;
    back = false;

    leftBumper = false;
    rightBumper = false;

    leftStickButton = false;
    rightStickButton = false;

    leftTrigger = 0;
    rightTrigger = 0;

    circle = false;
    cross = false;
    triangle = false;
    square = false;

    share = false;
    options = false;

    touchpad = false;
    touchpadFinger1 = false;
    touchpadFinger2 = false;
    
    touchpadFinger1X = 0;
    touchpadFinger1Y = 0;

    touchpadFinger2X = 0;
    touchpadFinger2Y = 0;

    ps = false;

    user = GamepadID.Unassigned;
    id = GamepadID.Unassigned;
    timestamp = 0n;

    serialize() {
        let buf = this.withHeader(60);

        buf[5] = this.version;

        if (this.version >= 1) {
            writeInt(buf, 6, this.id, Packet.BYTE_ORDER);
            writeLong(buf, 10, this.timestamp, Packet.BYTE_ORDER);
            writeFloat(buf, 18, this.leftStickX, Packet.BYTE_ORDER);
            writeFloat(buf, 22, this.leftStickY, Packet.BYTE_ORDER);
            writeFloat(buf, 26, this.rightStickX, Packet.BYTE_ORDER);
            writeFloat(buf, 30, this.rightStickY, Packet.BYTE_ORDER);

            let buttons = 0;

            buttons |= this.touchpadFinger1 ? 1 : 0;
            buttons |= (this.touchpadFinger2 ? 1 : 0) << 1;
            buttons |= (this.touchpad ? 1 : 0) << 2;
            buttons |= (this.leftStickButton ? 1 : 0) << 3;
            buttons |= (this.rightStickButton ? 1 : 0) << 4;
            buttons |= (this.dpadUp ? 1 : 0) << 5;
            buttons |= (this.dpadDown ? 1 : 0) << 6;
            buttons |= (this.dpadLeft ? 1 : 0) << 7;
            buttons |= (this.dpadRight ? 1 : 0) << 8;
            buttons |= (this.a ? 1 : 0) << 9;
            buttons |= (this.b ? 1 : 0) << 10;
            buttons |= (this.x ? 1 : 0) << 11;
            buttons |= (this.y ? 1 : 0) << 12;
            buttons |= (this.guide ? 1 : 0) << 13;
            buttons |= (this.start ? 1 : 0) << 14;
            buttons |= (this.back ? 1 : 0) << 15;
            buttons |= (this.leftBumper ? 1 : 0) << 16;
            buttons |= (this.rightBumper ? 1 : 0) << 17;

            writeInt(buf, 34, buttons, Packet.BYTE_ORDER);
        }

        if (this.version >= 2) {
            buf[38] = this.user;
        }

        if (this.version >= 3) {
            buf[39] = this.type;
        }

        if (this.version >= 4) {
            buf[40] = this.type;
        }

        if (this.version >= 5) {
            writeFloat(buf, 41, this.touchpadFinger1X, Packet.BYTE_ORDER);
            writeFloat(buf, 45, this.touchpadFinger1Y, Packet.BYTE_ORDER);
            writeFloat(buf, 49, this.touchpadFinger2X, Packet.BYTE_ORDER);
            writeFloat(buf, 53, this.touchpadFinger2Y, Packet.BYTE_ORDER);
        }

        return buf;
    }

    deserialize(buf: Uint8Array) {
        if (buf.length < 5 + 33) return; // v1 = len 38

        this.seqNum = readShort(buf, 3, Packet.BYTE_ORDER);
        this.version = buf[5];

        if (this.version >= 1) {
            this.id = readInt(buf, 6, Packet.BYTE_ORDER);
            this.timestamp = readLong(buf, 10, Packet.BYTE_ORDER);
            this.leftStickX = readFloat(buf, 18, Packet.BYTE_ORDER);
            this.leftStickY = readFloat(buf, 22, Packet.BYTE_ORDER);
            this.rightStickX = readFloat(buf, 26, Packet.BYTE_ORDER);
            this.rightStickY = readFloat(buf, 30, Packet.BYTE_ORDER);

            let buttons = readInt(buf, 34, Packet.BYTE_ORDER);

            this.touchpadFinger1 = !!(buttons & 0x20000);
            this.touchpadFinger2 = !!(buttons & 0x10000);
            this.touchpad = !!(buttons & 0x04000);
            this.leftStickButton = !!(buttons & 0x02000);
            this.rightStickButton = !!(buttons & 0x02000);
            this.dpadUp = !!(buttons & 0x01000);
            this.dpadDown = !!(buttons & 0x00800);
            this.dpadLeft = !!(buttons & 0x00400);
            this.dpadRight = !!(buttons & 0x00200);
            this.a = !!(buttons & 0x00100);
            this.b = !!(buttons & 0x00080);
            this.x = !!(buttons & 0x00040);
            this.y = !!(buttons & 0x00020);
            this.guide = !!(buttons & 0x00010);
            this.start = !!(buttons & 0x00008);
            this.back = !!(buttons && 0x00004);
            this.leftBumper = !!(buttons & 0x00002);
            this.rightBumper = !!(buttons & 0x00001);
        }

        if (this.version >= 2) {
            this.user = buf[38];
        }

        if (this.version >= 3) {
            this.type = buf[39];
        }

        if (this.version >= 4) {
            let v4_type = buf[40];
            if (v4_type < 5) this.type = v4_type;
        }

        if (this.version >= 5) {
            this.touchpadFinger1X = readFloat(buf, 41, Packet.BYTE_ORDER);
            this.touchpadFinger1Y = readFloat(buf, 45, Packet.BYTE_ORDER);
            this.touchpadFinger2X = readFloat(buf, 49, Packet.BYTE_ORDER);
            this.touchpadFinger2Y = readFloat(buf, 53, Packet.BYTE_ORDER);
        }

        return this;
    }
}