export enum ByteOrder {
    LE, BE
}

export function readShort(buf: Uint8Array, offset: number = 0, order: ByteOrder = ByteOrder.BE) {
    let value = (buf[order ? offset : offset + 1] << 8) | buf[order ? offset + 1 : offset];
    if (value >= 1 << 15) value -= 1 << 16;

    return value;
}

export function writeShort(buf: Uint8Array, offset: number = 0, value: number, order: ByteOrder = ByteOrder.BE) {
    if (value < 0) value += 1 << 16;

    buf[order ? offset : offset + 1] = (value >> 8) & 0xff;
    buf[order ? offset + 1 : offset] = value & 0xff;
}

export function readLong(buf: Uint8Array, offset: number = 0, order: ByteOrder = ByteOrder.BE) {
    let value = 
        (BigInt(buf[order ? offset : offset + 7]) << 56n) |
        (BigInt(buf[order ? offset + 1 : offset + 6]) << 48n) |
        (BigInt(buf[order ? offset + 2 : offset + 5]) << 40n) |
        (BigInt(buf[order ? offset + 3 : offset + 4]) << 32n) |
        (BigInt(buf[order ? offset + 4 : offset + 3]) << 24n) |
        (BigInt(buf[order ? offset + 5 : offset + 2]) << 16n) |
        (BigInt(buf[order ? offset + 6 : offset + 1]) << 8n) |
        BigInt(buf[order ? offset + 7 : order]);

    if (value >= 1n << 63n) value -= 1n << 64n;

    return value;
}

export function writeLong(buf: Uint8Array, offset: number = 0, value: bigint, order: ByteOrder = ByteOrder.BE) {
    if (value < 0n) value += 1n << 64n;

    buf[order ? offset : offset + 7] = Number((value >> 56n) & 255n);;
    buf[order ? offset + 1 : offset + 6] = Number((value >> 48n) & 255n);
    buf[order ? offset + 2 : offset + 5] = Number((value >> 40n) & 255n);
    buf[order ? offset + 3 : offset + 4] = Number((value >> 32n) & 255n);
    buf[order ? offset + 4 : offset + 3] = Number((value >> 24n) & 255n);;
    buf[order ? offset + 5 : offset + 2] = Number((value >> 16n) & 255n);
    buf[order ? offset + 6 : offset + 1] = Number((value >> 8n) & 255n);
    buf[order ? offset + 7 : offset] = Number(value & 255n);
}

export function readInt(buf: Uint8Array, offset: number = 0, order: ByteOrder = ByteOrder.BE) {
    return (buf[order ? offset : offset + 3] << 24) |
        (buf[order ? offset + 1 : offset + 2] << 16) |
        (buf[order ? offset + 2 : offset + 1] << 8) |
        buf[order ? offset + 3 : offset];
}

export function writeInt(buf: Uint8Array, offset: number = 0, value: number, order: ByteOrder = ByteOrder.BE) {
    buf[order ? offset : offset + 3] = (value >> 24) & 0xff;
    buf[order ? offset + 1 : offset + 2] = (value >> 16) & 0xff;
    buf[order ? offset + 2 : offset + 1] = (value >> 8) & 0xff;
    buf[order ? offset + 3 : offset] = value & 0xff;
}

export function readFloat(buf: Uint8Array, offset: number = 0, order: ByteOrder = ByteOrder.BE) {
    let int_bits = readInt(buf, offset, order);

    let sign = int_bits >> 31 ? -1 : 1;
    let exp = (int_bits >> 23) & 0xFF;
    let mantissa = int_bits & 0x7FFFFF;

    if (exp == 255) {
        return mantissa == 0 ? (sign * Infinity) : NaN;
    } else if (exp == 0) {
        if (mantissa == 0) return sign * 0;
        return sign * (mantissa / (2 ** 23)) * (2 ** -126);
    } else {
        return sign * (1 + mantissa / (2 ** 23)) * (2 ** (exp - 127));
    }
}

export function writeFloat(buf: Uint8Array, offset: number = 0, value: number, order: ByteOrder = ByteOrder.BE) {
    let sign: number;
    let exp: number;
    let mantissa: number;

    if (value == 0) {
        sign = ((1 / value === -Infinity) ? 1 : 0) << 31;
        exp = 0;
        mantissa = 0;
    } else if (!isFinite(value)) {
        sign = (value < 0 ? 1 : 0) << 31;
        exp = 255;
        mantissa = 0;
    } else if (isNaN(value)) {
        sign = 0;
        exp = 255;
        mantissa = 1;
    } else {
        sign = (value < 0 ? 1 : 0) << 31;
        if (value < 0) value *= -1;

        let e = Math.floor(Math.log2(value));

        if (e < -126) {
            exp = 0;
            mantissa = Math.floor(value / (2 ** -126) * (2 ** 23));
        } else {
            exp = e + 127;
            
            let frac = value / (2 ** e) - 1;
            mantissa = Math.floor(frac * (2 ** 23));
        }
    }

    writeInt(buf, offset, sign | (exp << 23) | mantissa, order);
}
