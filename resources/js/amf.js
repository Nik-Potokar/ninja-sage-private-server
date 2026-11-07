const encoder = new TextEncoder();
const decoder = new TextDecoder();

class Writer {
    constructor() {
        this.bytes = [];
    }

    byte(value) {
        this.bytes.push(value & 0xff);
    }

    uint16(value) {
        this.byte(value >>> 8);
        this.byte(value);
    }

    uint32(value) {
        this.byte(value >>> 24);
        this.byte(value >>> 16);
        this.byte(value >>> 8);
        this.byte(value);
    }

    raw(value) {
        this.bytes.push(...value);
    }

    shortString(value) {
        const bytes = encoder.encode(String(value));
        if (bytes.length > 0xffff) {
            throw new Error('El texto supera el límite del protocolo AMF0.');
        }
        this.uint16(bytes.length);
        this.raw(bytes);
    }

    value(value) {
        if (value === null || value === undefined) {
            this.byte(5);
            return;
        }
        if (typeof value === 'boolean') {
            this.byte(1);
            this.byte(value ? 1 : 0);
            return;
        }
        if (typeof value === 'number') {
            this.byte(0);
            const bytes = new Uint8Array(8);
            new DataView(bytes.buffer).setFloat64(0, value, false);
            this.raw(bytes);
            return;
        }
        if (typeof value === 'string') {
            const bytes = encoder.encode(value);
            if (bytes.length <= 0xffff) {
                this.byte(2);
                this.uint16(bytes.length);
            } else {
                this.byte(12);
                this.uint32(bytes.length);
            }
            this.raw(bytes);
            return;
        }
        if (Array.isArray(value)) {
            this.byte(10);
            this.uint32(value.length);
            value.forEach((item) => this.value(item));
            return;
        }
        if (typeof value === 'object') {
            this.byte(3);
            Object.entries(value).forEach(([key, item]) => {
                this.shortString(key);
                this.value(item);
            });
            this.uint16(0);
            this.byte(9);
            return;
        }
        throw new Error(`Tipo de dato AMF0 no soportado: ${typeof value}`);
    }

    finish() {
        return new Uint8Array(this.bytes);
    }
}

class Reader {
    constructor(bytes) {
        this.bytes = new Uint8Array(bytes);
        this.view = new DataView(this.bytes.buffer, this.bytes.byteOffset, this.bytes.byteLength);
        this.offset = 0;
    }

    ensure(length) {
        if (this.offset + length > this.bytes.length) {
            throw new Error('La respuesta del gateway AMF está incompleta.');
        }
    }

    byte() {
        this.ensure(1);
        return this.bytes[this.offset++];
    }

    uint16() {
        this.ensure(2);
        const value = this.view.getUint16(this.offset, false);
        this.offset += 2;
        return value;
    }

    uint32() {
        this.ensure(4);
        const value = this.view.getUint32(this.offset, false);
        this.offset += 4;
        return value;
    }

    float64() {
        this.ensure(8);
        const value = this.view.getFloat64(this.offset, false);
        this.offset += 8;
        return value;
    }

    string(length) {
        this.ensure(length);
        const value = decoder.decode(this.bytes.subarray(this.offset, this.offset + length));
        this.offset += length;
        return value;
    }

    shortString() {
        return this.string(this.uint16());
    }

    object() {
        const value = {};
        while (true) {
            const key = this.shortString();
            const marker = this.byte();
            if (marker === 9 && key === '') {
                return value;
            }
            value[key] = this.value(marker);
        }
    }

    value(marker = this.byte()) {
        switch (marker) {
            case 0:
                return this.float64();
            case 1:
                return this.byte() !== 0;
            case 2:
                return this.string(this.uint16());
            case 3:
                return this.object();
            case 5:
            case 6:
            case 13:
                return null;
            case 7:
                this.uint16();
                return null;
            case 8:
                this.uint32();
                return this.object();
            case 10: {
                const length = this.uint32();
                return Array.from({ length }, () => this.value());
            }
            case 11: {
                const date = new Date(this.float64());
                this.uint16();
                return date;
            }
            case 12:
            case 15:
                return this.string(this.uint32());
            default:
                throw new Error(`La respuesta AMF contiene un tipo no soportado (${marker}).`);
        }
    }

    message() {
        this.byte();
        this.byte();
        const headerCount = this.uint16();
        for (let index = 0; index < headerCount; index += 1) {
            this.shortString();
            this.byte();
            this.uint32();
            this.value();
        }

        const bodyCount = this.uint16();
        const bodies = [];
        for (let index = 0; index < bodyCount; index += 1) {
            const target = this.shortString();
            const response = this.shortString();
            this.uint32();
            bodies.push({ target, response, data: this.value() });
        }
        return bodies;
    }
}

export function encodeAmfRequest(target, args) {
    const writer = new Writer();
    writer.byte(0);
    writer.byte(0);
    writer.uint16(0);
    writer.uint16(1);
    writer.shortString(target);
    writer.shortString('/1');
    writer.uint32(0xffffffff);
    writer.value(args);
    return writer.finish();
}

export function decodeAmfResponse(bytes) {
    const bodies = new Reader(bytes).message();
    if (bodies.length === 0) {
        throw new Error('El gateway AMF no devolvió una respuesta.');
    }
    const body = bodies[0];
    if (body.target.endsWith('/onStatus')) {
        throw new Error(body.data?.description || 'El gateway rechazó la operación.');
    }
    if (!body.target.endsWith('/onResult')) {
        throw new Error(`Respuesta AMF inesperada: ${body.target}`);
    }
    return body.data;
}

export async function callAmf(target, args) {
    const response = await fetch('/amf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-amf' },
        body: encodeAmfRequest(target, args),
    });
    if (!response.ok) {
        throw new Error(`El gateway respondió HTTP ${response.status}.`);
    }
    const result = decodeAmfResponse(await response.arrayBuffer());
    if (result && typeof result === 'object' && Number(result.status) === 0) {
        throw new Error(result.error || result.description || 'La operación no fue aceptada.');
    }
    return result;
}
