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

    get cross() {
        return this.a;
    }

    set cross(v) {
        this.a = v;
    }

    get circle() {
        return this.b;
    }

    set circle(v) {
        this.b = v;
    }

    get square() {
        return this.x;
    }

    set square(v) {
        this.x = v;
    }

    get triangle() {
        return this.y;
    }

    set triangle(v) {
        this.y = v;
    }
    
    get share() {
        return this.back;
    }

    set share(v) {
        this.back = v;
    }

    get options() {
        return this.start;
    }

    set options(v) {
        this.start = v;
    }

    get ps() {
        return this.guide;
    }

    set ps(v) {
        this.guide = v;
    }

    touchpad = false;
    touchpadFinger1 = false;
    touchpadFinger2 = false;
    
    touchpadFinger1X = 0;
    touchpadFinger1Y = 0;

    touchpadFinger2X = 0;
    touchpadFinger2Y = 0;

    user = -1;
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
            writeFloat(buf, 34, this.leftTrigger, Packet.BYTE_ORDER);
            writeFloat(buf, 38, this.rightTrigger, Packet.BYTE_ORDER);

            let buttons = 0;

            buttons |= (this.touchpadFinger1 ? 1 : 0) << 17;
            buttons |= (this.touchpadFinger2 ? 1 : 0) << 16;
            buttons |= (this.touchpad ? 1 : 0) << 15;
            buttons |= (this.leftStickButton ? 1 : 0) << 14;
            buttons |= (this.rightStickButton ? 1 : 0) << 13;
            buttons |= (this.dpadUp ? 1 : 0) << 12;
            buttons |= (this.dpadDown ? 1 : 0) << 11;
            buttons |= (this.dpadLeft ? 1 : 0) << 10;
            buttons |= (this.dpadRight ? 1 : 0) << 9;
            buttons |= (this.a ? 1 : 0) << 8;
            buttons |= (this.b ? 1 : 0) << 7;
            buttons |= (this.x ? 1 : 0) << 6;
            buttons |= (this.y ? 1 : 0) << 5;
            buttons |= (this.guide ? 1 : 0) << 4;
            buttons |= (this.start ? 1 : 0) << 3;
            buttons |= (this.back ? 1 : 0) << 2;
            buttons |= (this.leftBumper ? 1 : 0) << 1;
            buttons |= (this.rightBumper ? 1 : 0);

            writeInt(buf, 42, buttons, Packet.BYTE_ORDER);
        }

        if (this.version >= 2) {
            buf[46] = this.user;
        }

        if (this.version >= 3) {
            buf[47] = this.type;
        }

        if (this.version >= 4) {
            buf[48] = this.type;
        }

        if (this.version >= 5) {
            writeFloat(buf, 49, this.touchpadFinger1X, Packet.BYTE_ORDER);
            writeFloat(buf, 53, this.touchpadFinger1Y, Packet.BYTE_ORDER);
            writeFloat(buf, 57, this.touchpadFinger2X, Packet.BYTE_ORDER);
            writeFloat(buf, 61, this.touchpadFinger2Y, Packet.BYTE_ORDER);
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
            this.leftTrigger = readFloat(buf, 34, Packet.BYTE_ORDER);
            this.rightTrigger = readFloat(buf, 38, Packet.BYTE_ORDER);

            let buttons = readInt(buf, 42, Packet.BYTE_ORDER);

            this.touchpadFinger1 = !!(buttons & 0x20000);
            this.touchpadFinger2 = !!(buttons & 0x10000);
            this.touchpad = !!(buttons & 0x8000);
            this.leftStickButton = !!(buttons & 0x4000);
            this.rightStickButton = !!(buttons & 0x2000);
            this.dpadUp = !!(buttons & 0x1000);
            this.dpadDown = !!(buttons & 0x800);
            this.dpadLeft = !!(buttons & 0x400);
            this.dpadRight = !!(buttons & 0x200);
            this.a = !!(buttons & 0x100);
            this.b = !!(buttons & 0x80);
            this.x = !!(buttons & 0x40);
            this.y = !!(buttons & 0x20);
            this.guide = !!(buttons & 0x10);
            this.start = !!(buttons & 0x8);
            this.back = !!(buttons && 0x4);
            this.leftBumper = !!(buttons & 0x2);
            this.rightBumper = !!(buttons & 0x1);
        }

        if (this.version >= 2) {
            this.user = buf[46];
        }

        if (this.version >= 3) {
            this.type = buf[47];
        }

        if (this.version >= 4) {
            let v4_type = buf[48];
            if (v4_type < 5) this.type = v4_type;
        }

        if (this.version >= 5) {
            this.touchpadFinger1X = readFloat(buf, 49, Packet.BYTE_ORDER);
            this.touchpadFinger1Y = readFloat(buf, 53, Packet.BYTE_ORDER);
            this.touchpadFinger2X = readFloat(buf, 57, Packet.BYTE_ORDER);
            this.touchpadFinger2Y = readFloat(buf, 61, Packet.BYTE_ORDER);
        }

        return this;
    }
}