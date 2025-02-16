import { readFloat, readInt, readLong, readShort, writeFloat, writeInt, writeLong } from '../buffer_utils';
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
    seq_num = 0;

    version = 5;
    type = GamepadType.Unknown;

    left_stick_x = 0;
    left_stick_y = 0;
    right_stick_x = 0;
    right_stick_y = 0;
    
    dpad_up = false;
    dpad_down = false;
    dpad_left = false;
    dpad_right = false;

    a = false;
    b = false;
    x = false;
    y = false;

    guide = false;
    start = false;
    back = false;

    left_bumper = false;
    right_bumper = false;

    left_stick_button = false;
    right_stick_button = false;

    left_trigger = 0;
    right_trigger = 0;

    circle = false;
    cross = false;
    triangle = false;
    square = false;

    share = false;
    options = false;

    touchpad = false;
    touchpad_finger_1 = false;
    touchpad_finger_2 = false;
    
    touchpad_finger_1_x = 0;
    touchpad_finger_1_y = 0;

    touchpad_finger_2_x = 0;
    touchpad_finger_2_y = 0;

    ps = false;

    user = GamepadID.Unassigned;
    id = GamepadID.Unassigned;
    timestamp = BigInt(0);

    serialize() {
        let buf = this.with_header(60);

        buf[5] = this.version;

        if (this.version >= 1) {
            writeInt(buf, 6, this.id, Packet.BYTE_ORDER);
            writeLong(buf, 10, this.timestamp, Packet.BYTE_ORDER);
            writeFloat(buf, 18, this.left_stick_x, Packet.BYTE_ORDER);
            writeFloat(buf, 22, this.left_stick_y, Packet.BYTE_ORDER);
            writeFloat(buf, 26, this.right_stick_x, Packet.BYTE_ORDER);
            writeFloat(buf, 30, this.right_stick_y, Packet.BYTE_ORDER);

            let buttons = 0;

            buttons |= this.touchpad_finger_1 ? 1 : 0;
            buttons |= (this.touchpad_finger_2 ? 1 : 0) << 1;
            buttons |= (this.touchpad ? 1 : 0) << 2;
            buttons |= (this.left_stick_button ? 1 : 0) << 3;
            buttons |= (this.right_stick_button ? 1 : 0) << 4;
            buttons |= (this.dpad_up ? 1 : 0) << 5;
            buttons |= (this.dpad_down ? 1 : 0) << 6;
            buttons |= (this.dpad_left ? 1 : 0) << 7;
            buttons |= (this.dpad_right ? 1 : 0) << 8;
            buttons |= (this.a ? 1 : 0) << 9;
            buttons |= (this.b ? 1 : 0) << 10;
            buttons |= (this.x ? 1 : 0) << 11;
            buttons |= (this.y ? 1 : 0) << 12;
            buttons |= (this.guide ? 1 : 0) << 13;
            buttons |= (this.start ? 1 : 0) << 14;
            buttons |= (this.back ? 1 : 0) << 15;
            buttons |= (this.left_bumper ? 1 : 0) << 16;
            buttons |= (this.right_bumper ? 1 : 0) << 17;

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
            writeFloat(buf, 41, this.touchpad_finger_1_x, Packet.BYTE_ORDER);
            writeFloat(buf, 45, this.touchpad_finger_1_y, Packet.BYTE_ORDER);
            writeFloat(buf, 49, this.touchpad_finger_2_x, Packet.BYTE_ORDER);
            writeFloat(buf, 53, this.touchpad_finger_2_y, Packet.BYTE_ORDER);
        }

        return buf;
    }

    deserialize(buf: Uint8Array) {
        if (buf.length < 5 + 33) return; // v1 = len 38

        this.seq_num = readShort(buf, 3, Packet.BYTE_ORDER);
        this.version = buf[5];

        if (this.version >= 1) {
            this.id = readInt(buf, 6, Packet.BYTE_ORDER);
            this.timestamp = readLong(buf, 10, Packet.BYTE_ORDER);
            this.left_stick_x = readFloat(buf, 18, Packet.BYTE_ORDER);
            this.left_stick_y = readFloat(buf, 22, Packet.BYTE_ORDER);
            this.right_stick_x = readFloat(buf, 26, Packet.BYTE_ORDER);
            this.right_stick_y = readFloat(buf, 30, Packet.BYTE_ORDER);

            let buttons = readInt(buf, 34, Packet.BYTE_ORDER);

            this.touchpad_finger_1 = !!(buttons & 0x20000);
            this.touchpad_finger_2 = !!(buttons & 0x10000);
            this.touchpad = !!(buttons & 0x04000);
            this.left_stick_button = !!(buttons & 0x02000);
            this.right_stick_button = !!(buttons & 0x02000);
            this.dpad_up = !!(buttons & 0x01000);
            this.dpad_down = !!(buttons & 0x00800);
            this.dpad_left = !!(buttons & 0x00400);
            this.dpad_right = !!(buttons & 0x00200);
            this.a = !!(buttons & 0x00100);
            this.b = !!(buttons & 0x00080);
            this.x = !!(buttons & 0x00040);
            this.y = !!(buttons & 0x00020);
            this.guide = !!(buttons & 0x00010);
            this.start = !!(buttons & 0x00008);
            this.back = !!(buttons && 0x00004);
            this.left_bumper = !!(buttons & 0x00002);
            this.right_bumper = !!(buttons & 0x00001);
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
            this.touchpad_finger_1_x = readFloat(buf, 41, Packet.BYTE_ORDER);
            this.touchpad_finger_1_y = readFloat(buf, 45, Packet.BYTE_ORDER);
            this.touchpad_finger_2_x = readFloat(buf, 49, Packet.BYTE_ORDER);
            this.touchpad_finger_2_y = readFloat(buf, 53, Packet.BYTE_ORDER);
        }

        return this;
    }
}