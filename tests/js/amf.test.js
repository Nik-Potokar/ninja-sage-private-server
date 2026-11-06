import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeAmfResponse, encodeAmfRequest } from '../../resources/js/amf.js';

function u16(bytes, value) {
    bytes.push((value >>> 8) & 0xff, value & 0xff);
}

function u32(bytes, value) {
    bytes.push((value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff);
}

function string(bytes, value) {
    const encoded = new TextEncoder().encode(value);
    u16(bytes, encoded.length);
    bytes.push(...encoded);
}

function value(bytes, input) {
    if (typeof input === 'string') {
        bytes.push(2);
        string(bytes, input);
    } else if (typeof input === 'number') {
        bytes.push(0);
        const encoded = new Uint8Array(8);
        new DataView(encoded.buffer).setFloat64(0, input, false);
        bytes.push(...encoded);
    } else if (Array.isArray(input)) {
        bytes.push(10);
        u32(bytes, input.length);
        input.forEach((entry) => value(bytes, entry));
    } else if (input && typeof input === 'object') {
        bytes.push(3);
        Object.entries(input).forEach(([key, entry]) => {
            string(bytes, key);
            value(bytes, entry);
        });
        u16(bytes, 0);
        bytes.push(9);
    } else {
        bytes.push(5);
    }
}

function responseMessage(result) {
    const bytes = [0, 0];
    u16(bytes, 0);
    u16(bytes, 1);
    string(bytes, '/1/onResult');
    string(bytes, '');
    u32(bytes, 0xffffffff);
    value(bytes, result);
    return Uint8Array.from(bytes);
}

test('encodes an AMF0 request envelope and argument array', () => {
    const bytes = encodeAmfRequest('Game.getVersion', []);
    assert.deepEqual(Array.from(bytes.slice(0, 6)), [0, 0, 0, 0, 0, 1]);
    assert.equal(new TextDecoder().decode(bytes.slice(8, 23)), 'Game.getVersion');
    assert.deepEqual(Array.from(bytes.slice(-5)), [10, 0, 0, 0, 0]);
});

test('decodes an AMF0 result object with nested arrays', () => {
    const decoded = decodeAmfResponse(responseMessage({
        status: 1,
        account_data: [{ char_id: 7, character_name: 'Kaito' }],
    }));

    assert.equal(decoded.status, 1);
    assert.deepEqual(decoded.account_data, [{ char_id: 7, character_name: 'Kaito' }]);
});
