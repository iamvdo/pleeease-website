(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

},{}],2:[function(require,module,exports){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = Buffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192

/**
 * If `Buffer._useTypedArrays`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (compatible down to IE6)
 */
Buffer._useTypedArrays = (function () {
  // Detect if browser supports Typed Arrays. Supported browsers are IE 10+, Firefox 4+,
  // Chrome 7+, Safari 5.1+, Opera 11.6+, iOS 4.2+. If the browser does not support adding
  // properties to `Uint8Array` instances, then that's the same as no `Uint8Array` support
  // because we need to be able to add all the node Buffer API methods. This is an issue
  // in Firefox 4-29. Now fixed: https://bugzilla.mozilla.org/show_bug.cgi?id=695438
  try {
    var buf = new ArrayBuffer(0)
    var arr = new Uint8Array(buf)
    arr.foo = function () { return 42 }
    return 42 === arr.foo() &&
        typeof arr.subarray === 'function' // Chrome 9-10 lack `subarray`
  } catch (e) {
    return false
  }
})()

/**
 * Class: Buffer
 * =============
 *
 * The Buffer constructor returns instances of `Uint8Array` that are augmented
 * with function properties for all the node `Buffer` API functions. We use
 * `Uint8Array` so that square bracket notation works as expected -- it returns
 * a single octet.
 *
 * By augmenting the instances, we can avoid modifying the `Uint8Array`
 * prototype.
 */
function Buffer (subject, encoding, noZero) {
  if (!(this instanceof Buffer))
    return new Buffer(subject, encoding, noZero)

  var type = typeof subject

  if (encoding === 'base64' && type === 'string') {
    subject = base64clean(subject)
  }

  // Find the length
  var length
  if (type === 'number')
    length = coerce(subject)
  else if (type === 'string')
    length = Buffer.byteLength(subject, encoding)
  else if (type === 'object')
    length = coerce(subject.length) // assume that object is array-like
  else
    throw new Error('First argument needs to be a number, array or string.')

  var buf
  if (Buffer._useTypedArrays) {
    // Preferred: Return an augmented `Uint8Array` instance for best performance
    buf = Buffer._augment(new Uint8Array(length))
  } else {
    // Fallback: Return THIS instance of Buffer (created by `new`)
    buf = this
    buf.length = length
    buf._isBuffer = true
  }

  var i
  if (Buffer._useTypedArrays && typeof subject.byteLength === 'number') {
    // Speed optimization -- use set if we're copying from a typed array
    buf._set(subject)
  } else if (isArrayish(subject)) {
    // Treat array-ish objects as a byte array
    if (Buffer.isBuffer(subject)) {
      for (i = 0; i < length; i++)
        buf[i] = subject.readUInt8(i)
    } else {
      for (i = 0; i < length; i++)
        buf[i] = ((subject[i] % 256) + 256) % 256
    }
  } else if (type === 'string') {
    buf.write(subject, 0, encoding)
  } else if (type === 'number' && !Buffer._useTypedArrays && !noZero) {
    for (i = 0; i < length; i++) {
      buf[i] = 0
    }
  }

  return buf
}

// STATIC METHODS
// ==============

Buffer.isEncoding = function (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.isBuffer = function (b) {
  return !!(b !== null && b !== undefined && b._isBuffer)
}

Buffer.byteLength = function (str, encoding) {
  var ret
  str = str.toString()
  switch (encoding || 'utf8') {
    case 'hex':
      ret = str.length / 2
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8ToBytes(str).length
      break
    case 'ascii':
    case 'binary':
    case 'raw':
      ret = str.length
      break
    case 'base64':
      ret = base64ToBytes(str).length
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = str.length * 2
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.concat = function (list, totalLength) {
  assert(isArray(list), 'Usage: Buffer.concat(list[, length])')

  if (list.length === 0) {
    return new Buffer(0)
  } else if (list.length === 1) {
    return list[0]
  }

  var i
  if (totalLength === undefined) {
    totalLength = 0
    for (i = 0; i < list.length; i++) {
      totalLength += list[i].length
    }
  }

  var buf = new Buffer(totalLength)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

Buffer.compare = function (a, b) {
  assert(Buffer.isBuffer(a) && Buffer.isBuffer(b), 'Arguments must be Buffers')
  var x = a.length
  var y = b.length
  for (var i = 0, len = Math.min(x, y); i < len && a[i] === b[i]; i++) {}
  if (i !== len) {
    x = a[i]
    y = b[i]
  }
  if (x < y) {
    return -1
  }
  if (y < x) {
    return 1
  }
  return 0
}

// BUFFER INSTANCE METHODS
// =======================

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  assert(strLen % 2 === 0, 'Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var byte = parseInt(string.substr(i * 2, 2), 16)
    assert(!isNaN(byte), 'Invalid hex string')
    buf[offset + i] = byte
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  var charsWritten = blitBuffer(utf8ToBytes(string), buf, offset, length)
  return charsWritten
}

function asciiWrite (buf, string, offset, length) {
  var charsWritten = blitBuffer(asciiToBytes(string), buf, offset, length)
  return charsWritten
}

function binaryWrite (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  var charsWritten = blitBuffer(base64ToBytes(string), buf, offset, length)
  return charsWritten
}

function utf16leWrite (buf, string, offset, length) {
  var charsWritten = blitBuffer(utf16leToBytes(string), buf, offset, length)
  return charsWritten
}

Buffer.prototype.write = function (string, offset, length, encoding) {
  // Support both (string, offset, length, encoding)
  // and the legacy (string, encoding, offset, length)
  if (isFinite(offset)) {
    if (!isFinite(length)) {
      encoding = length
      length = undefined
    }
  } else {  // legacy
    var swap = encoding
    encoding = offset
    offset = length
    length = swap
  }

  offset = Number(offset) || 0
  var remaining = this.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }
  encoding = String(encoding || 'utf8').toLowerCase()

  var ret
  switch (encoding) {
    case 'hex':
      ret = hexWrite(this, string, offset, length)
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8Write(this, string, offset, length)
      break
    case 'ascii':
      ret = asciiWrite(this, string, offset, length)
      break
    case 'binary':
      ret = binaryWrite(this, string, offset, length)
      break
    case 'base64':
      ret = base64Write(this, string, offset, length)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = utf16leWrite(this, string, offset, length)
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.prototype.toString = function (encoding, start, end) {
  var self = this

  encoding = String(encoding || 'utf8').toLowerCase()
  start = Number(start) || 0
  end = (end === undefined) ? self.length : Number(end)

  // Fastpath empty strings
  if (end === start)
    return ''

  var ret
  switch (encoding) {
    case 'hex':
      ret = hexSlice(self, start, end)
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8Slice(self, start, end)
      break
    case 'ascii':
      ret = asciiSlice(self, start, end)
      break
    case 'binary':
      ret = binarySlice(self, start, end)
      break
    case 'base64':
      ret = base64Slice(self, start, end)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = utf16leSlice(self, start, end)
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.prototype.toJSON = function () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

Buffer.prototype.equals = function (b) {
  assert(Buffer.isBuffer(b), 'Argument must be a Buffer')
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.compare = function (b) {
  assert(Buffer.isBuffer(b), 'Argument must be a Buffer')
  return Buffer.compare(this, b)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function (target, target_start, start, end) {
  var source = this

  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (!target_start) target_start = 0

  // Copy 0 bytes; we're done
  if (end === start) return
  if (target.length === 0 || source.length === 0) return

  // Fatal error conditions
  assert(end >= start, 'sourceEnd < sourceStart')
  assert(target_start >= 0 && target_start < target.length,
      'targetStart out of bounds')
  assert(start >= 0 && start < source.length, 'sourceStart out of bounds')
  assert(end >= 0 && end <= source.length, 'sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length)
    end = this.length
  if (target.length - target_start < end - start)
    end = target.length - target_start + start

  var len = end - start

  if (len < 100 || !Buffer._useTypedArrays) {
    for (var i = 0; i < len; i++) {
      target[i + target_start] = this[i + start]
    }
  } else {
    target._set(this.subarray(start, start + len), target_start)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  var res = ''
  var tmp = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    if (buf[i] <= 0x7F) {
      res += decodeUtf8Char(tmp) + String.fromCharCode(buf[i])
      tmp = ''
    } else {
      tmp += '%' + buf[i].toString(16)
    }
  }

  return res + decodeUtf8Char(tmp)
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function binarySlice (buf, start, end) {
  return asciiSlice(buf, start, end)
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function (start, end) {
  var len = this.length
  start = clamp(start, len, 0)
  end = clamp(end, len, len)

  if (Buffer._useTypedArrays) {
    return Buffer._augment(this.subarray(start, end))
  } else {
    var sliceLen = end - start
    var newBuf = new Buffer(sliceLen, undefined, true)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
    return newBuf
  }
}

// `get` will be removed in Node 0.13+
Buffer.prototype.get = function (offset) {
  console.log('.get() is deprecated. Access using array indexes instead.')
  return this.readUInt8(offset)
}

// `set` will be removed in Node 0.13+
Buffer.prototype.set = function (v, offset) {
  console.log('.set() is deprecated. Access using array indexes instead.')
  return this.writeUInt8(v, offset)
}

Buffer.prototype.readUInt8 = function (offset, noAssert) {
  if (!noAssert) {
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'Trying to read beyond buffer length')
  }

  if (offset >= this.length)
    return

  return this[offset]
}

function readUInt16 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val
  if (littleEndian) {
    val = buf[offset]
    if (offset + 1 < len)
      val |= buf[offset + 1] << 8
  } else {
    val = buf[offset] << 8
    if (offset + 1 < len)
      val |= buf[offset + 1]
  }
  return val
}

Buffer.prototype.readUInt16LE = function (offset, noAssert) {
  return readUInt16(this, offset, true, noAssert)
}

Buffer.prototype.readUInt16BE = function (offset, noAssert) {
  return readUInt16(this, offset, false, noAssert)
}

function readUInt32 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val
  if (littleEndian) {
    if (offset + 2 < len)
      val = buf[offset + 2] << 16
    if (offset + 1 < len)
      val |= buf[offset + 1] << 8
    val |= buf[offset]
    if (offset + 3 < len)
      val = val + (buf[offset + 3] << 24 >>> 0)
  } else {
    if (offset + 1 < len)
      val = buf[offset + 1] << 16
    if (offset + 2 < len)
      val |= buf[offset + 2] << 8
    if (offset + 3 < len)
      val |= buf[offset + 3]
    val = val + (buf[offset] << 24 >>> 0)
  }
  return val
}

Buffer.prototype.readUInt32LE = function (offset, noAssert) {
  return readUInt32(this, offset, true, noAssert)
}

Buffer.prototype.readUInt32BE = function (offset, noAssert) {
  return readUInt32(this, offset, false, noAssert)
}

Buffer.prototype.readInt8 = function (offset, noAssert) {
  if (!noAssert) {
    assert(offset !== undefined && offset !== null,
        'missing offset')
    assert(offset < this.length, 'Trying to read beyond buffer length')
  }

  if (offset >= this.length)
    return

  var neg = this[offset] & 0x80
  if (neg)
    return (0xff - this[offset] + 1) * -1
  else
    return this[offset]
}

function readInt16 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val = readUInt16(buf, offset, littleEndian, true)
  var neg = val & 0x8000
  if (neg)
    return (0xffff - val + 1) * -1
  else
    return val
}

Buffer.prototype.readInt16LE = function (offset, noAssert) {
  return readInt16(this, offset, true, noAssert)
}

Buffer.prototype.readInt16BE = function (offset, noAssert) {
  return readInt16(this, offset, false, noAssert)
}

function readInt32 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val = readUInt32(buf, offset, littleEndian, true)
  var neg = val & 0x80000000
  if (neg)
    return (0xffffffff - val + 1) * -1
  else
    return val
}

Buffer.prototype.readInt32LE = function (offset, noAssert) {
  return readInt32(this, offset, true, noAssert)
}

Buffer.prototype.readInt32BE = function (offset, noAssert) {
  return readInt32(this, offset, false, noAssert)
}

function readFloat (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  return ieee754.read(buf, offset, littleEndian, 23, 4)
}

Buffer.prototype.readFloatLE = function (offset, noAssert) {
  return readFloat(this, offset, true, noAssert)
}

Buffer.prototype.readFloatBE = function (offset, noAssert) {
  return readFloat(this, offset, false, noAssert)
}

function readDouble (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset + 7 < buf.length, 'Trying to read beyond buffer length')
  }

  return ieee754.read(buf, offset, littleEndian, 52, 8)
}

Buffer.prototype.readDoubleLE = function (offset, noAssert) {
  return readDouble(this, offset, true, noAssert)
}

Buffer.prototype.readDoubleBE = function (offset, noAssert) {
  return readDouble(this, offset, false, noAssert)
}

Buffer.prototype.writeUInt8 = function (value, offset, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'trying to write beyond buffer length')
    verifuint(value, 0xff)
  }

  if (offset >= this.length) return

  this[offset] = value
  return offset + 1
}

function writeUInt16 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'trying to write beyond buffer length')
    verifuint(value, 0xffff)
  }

  var len = buf.length
  if (offset >= len)
    return

  for (var i = 0, j = Math.min(len - offset, 2); i < j; i++) {
    buf[offset + i] =
        (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
            (littleEndian ? i : 1 - i) * 8
  }
  return offset + 2
}

Buffer.prototype.writeUInt16LE = function (value, offset, noAssert) {
  return writeUInt16(this, value, offset, true, noAssert)
}

Buffer.prototype.writeUInt16BE = function (value, offset, noAssert) {
  return writeUInt16(this, value, offset, false, noAssert)
}

function writeUInt32 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'trying to write beyond buffer length')
    verifuint(value, 0xffffffff)
  }

  var len = buf.length
  if (offset >= len)
    return

  for (var i = 0, j = Math.min(len - offset, 4); i < j; i++) {
    buf[offset + i] =
        (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
  return offset + 4
}

Buffer.prototype.writeUInt32LE = function (value, offset, noAssert) {
  return writeUInt32(this, value, offset, true, noAssert)
}

Buffer.prototype.writeUInt32BE = function (value, offset, noAssert) {
  return writeUInt32(this, value, offset, false, noAssert)
}

Buffer.prototype.writeInt8 = function (value, offset, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7f, -0x80)
  }

  if (offset >= this.length)
    return

  if (value >= 0)
    this.writeUInt8(value, offset, noAssert)
  else
    this.writeUInt8(0xff + value + 1, offset, noAssert)
  return offset + 1
}

function writeInt16 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7fff, -0x8000)
  }

  var len = buf.length
  if (offset >= len)
    return

  if (value >= 0)
    writeUInt16(buf, value, offset, littleEndian, noAssert)
  else
    writeUInt16(buf, 0xffff + value + 1, offset, littleEndian, noAssert)
  return offset + 2
}

Buffer.prototype.writeInt16LE = function (value, offset, noAssert) {
  return writeInt16(this, value, offset, true, noAssert)
}

Buffer.prototype.writeInt16BE = function (value, offset, noAssert) {
  return writeInt16(this, value, offset, false, noAssert)
}

function writeInt32 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7fffffff, -0x80000000)
  }

  var len = buf.length
  if (offset >= len)
    return

  if (value >= 0)
    writeUInt32(buf, value, offset, littleEndian, noAssert)
  else
    writeUInt32(buf, 0xffffffff + value + 1, offset, littleEndian, noAssert)
  return offset + 4
}

Buffer.prototype.writeInt32LE = function (value, offset, noAssert) {
  return writeInt32(this, value, offset, true, noAssert)
}

Buffer.prototype.writeInt32BE = function (value, offset, noAssert) {
  return writeInt32(this, value, offset, false, noAssert)
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
    verifIEEE754(value, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }

  var len = buf.length
  if (offset >= len)
    return

  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 7 < buf.length,
        'Trying to write beyond buffer length')
    verifIEEE754(value, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }

  var len = buf.length
  if (offset >= len)
    return

  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  assert(end >= start, 'end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  assert(start >= 0 && start < this.length, 'start out of bounds')
  assert(end >= 0 && end <= this.length, 'end out of bounds')

  var i
  if (typeof value === 'number') {
    for (i = start; i < end; i++) {
      this[i] = value
    }
  } else {
    var bytes = utf8ToBytes(value.toString())
    var len = bytes.length
    for (i = start; i < end; i++) {
      this[i] = bytes[i % len]
    }
  }

  return this
}

Buffer.prototype.inspect = function () {
  var out = []
  var len = this.length
  for (var i = 0; i < len; i++) {
    out[i] = toHex(this[i])
    if (i === exports.INSPECT_MAX_BYTES) {
      out[i + 1] = '...'
      break
    }
  }
  return '<Buffer ' + out.join(' ') + '>'
}

/**
 * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
 * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
 */
Buffer.prototype.toArrayBuffer = function () {
  if (typeof Uint8Array !== 'undefined') {
    if (Buffer._useTypedArrays) {
      return (new Buffer(this)).buffer
    } else {
      var buf = new Uint8Array(this.length)
      for (var i = 0, len = buf.length; i < len; i += 1) {
        buf[i] = this[i]
      }
      return buf.buffer
    }
  } else {
    throw new Error('Buffer.toArrayBuffer not supported in this browser')
  }
}

// HELPER FUNCTIONS
// ================

var BP = Buffer.prototype

/**
 * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
 */
Buffer._augment = function (arr) {
  arr._isBuffer = true

  // save reference to original Uint8Array get/set methods before overwriting
  arr._get = arr.get
  arr._set = arr.set

  // deprecated, will be removed in node 0.13+
  arr.get = BP.get
  arr.set = BP.set

  arr.write = BP.write
  arr.toString = BP.toString
  arr.toLocaleString = BP.toString
  arr.toJSON = BP.toJSON
  arr.equals = BP.equals
  arr.compare = BP.compare
  arr.copy = BP.copy
  arr.slice = BP.slice
  arr.readUInt8 = BP.readUInt8
  arr.readUInt16LE = BP.readUInt16LE
  arr.readUInt16BE = BP.readUInt16BE
  arr.readUInt32LE = BP.readUInt32LE
  arr.readUInt32BE = BP.readUInt32BE
  arr.readInt8 = BP.readInt8
  arr.readInt16LE = BP.readInt16LE
  arr.readInt16BE = BP.readInt16BE
  arr.readInt32LE = BP.readInt32LE
  arr.readInt32BE = BP.readInt32BE
  arr.readFloatLE = BP.readFloatLE
  arr.readFloatBE = BP.readFloatBE
  arr.readDoubleLE = BP.readDoubleLE
  arr.readDoubleBE = BP.readDoubleBE
  arr.writeUInt8 = BP.writeUInt8
  arr.writeUInt16LE = BP.writeUInt16LE
  arr.writeUInt16BE = BP.writeUInt16BE
  arr.writeUInt32LE = BP.writeUInt32LE
  arr.writeUInt32BE = BP.writeUInt32BE
  arr.writeInt8 = BP.writeInt8
  arr.writeInt16LE = BP.writeInt16LE
  arr.writeInt16BE = BP.writeInt16BE
  arr.writeInt32LE = BP.writeInt32LE
  arr.writeInt32BE = BP.writeInt32BE
  arr.writeFloatLE = BP.writeFloatLE
  arr.writeFloatBE = BP.writeFloatBE
  arr.writeDoubleLE = BP.writeDoubleLE
  arr.writeDoubleBE = BP.writeDoubleBE
  arr.fill = BP.fill
  arr.inspect = BP.inspect
  arr.toArrayBuffer = BP.toArrayBuffer

  return arr
}

var INVALID_BASE64_RE = /[^+\/0-9A-z]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

// slice(start, end)
function clamp (index, len, defaultValue) {
  if (typeof index !== 'number') return defaultValue
  index = ~~index;  // Coerce to integer.
  if (index >= len) return len
  if (index >= 0) return index
  index += len
  if (index >= 0) return index
  return 0
}

function coerce (length) {
  // Coerce length to a number (possibly NaN), round up
  // in case it's fractional (e.g. 123.456) then do a
  // double negate to coerce a NaN to 0. Easy, right?
  length = ~~Math.ceil(+length)
  return length < 0 ? 0 : length
}

function isArray (subject) {
  return (Array.isArray || function (subject) {
    return Object.prototype.toString.call(subject) === '[object Array]'
  })(subject)
}

function isArrayish (subject) {
  return isArray(subject) || Buffer.isBuffer(subject) ||
      subject && typeof subject === 'object' &&
      typeof subject.length === 'number'
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    var b = str.charCodeAt(i)
    if (b <= 0x7F) {
      byteArray.push(b)
    } else {
      var start = i
      if (b >= 0xD800 && b <= 0xDFFF) i++
      var h = encodeURIComponent(str.slice(start, i+1)).substr(1).split('%')
      for (var j = 0; j < h.length; j++) {
        byteArray.push(parseInt(h[j], 16))
      }
    }
  }
  return byteArray
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(str)
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length))
      break
    dst[i + offset] = src[i]
  }
  return i
}

function decodeUtf8Char (str) {
  try {
    return decodeURIComponent(str)
  } catch (err) {
    return String.fromCharCode(0xFFFD) // UTF 8 invalid char
  }
}

/*
 * We have to make sure that the value is a valid integer. This means that it
 * is non-negative. It has no fractional component and that it does not
 * exceed the maximum allowed value.
 */
function verifuint (value, max) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value >= 0, 'specified a negative value for writing an unsigned value')
  assert(value <= max, 'value is larger than maximum value for type')
  assert(Math.floor(value) === value, 'value has a fractional component')
}

function verifsint (value, max, min) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value <= max, 'value larger than maximum allowed value')
  assert(value >= min, 'value smaller than minimum allowed value')
  assert(Math.floor(value) === value, 'value has a fractional component')
}

function verifIEEE754 (value, max, min) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value <= max, 'value larger than maximum allowed value')
  assert(value >= min, 'value smaller than minimum allowed value')
}

function assert (test, message) {
  if (!test) throw new Error(message || 'Failed assertion')
}

},{"base64-js":3,"ieee754":4}],3:[function(require,module,exports){
var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

;(function (exports) {
	'use strict';

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

	var PLUS   = '+'.charCodeAt(0)
	var SLASH  = '/'.charCodeAt(0)
	var NUMBER = '0'.charCodeAt(0)
	var LOWER  = 'a'.charCodeAt(0)
	var UPPER  = 'A'.charCodeAt(0)

	function decode (elt) {
		var code = elt.charCodeAt(0)
		if (code === PLUS)
			return 62 // '+'
		if (code === SLASH)
			return 63 // '/'
		if (code < NUMBER)
			return -1 //no match
		if (code < NUMBER + 10)
			return code - NUMBER + 26 + 26
		if (code < UPPER + 26)
			return code - UPPER
		if (code < LOWER + 26)
			return code - LOWER + 26
	}

	function b64ToByteArray (b64) {
		var i, j, l, tmp, placeHolders, arr

		if (b64.length % 4 > 0) {
			throw new Error('Invalid string. Length must be a multiple of 4')
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		var len = b64.length
		placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

		// base64 is 4/3 + up to two characters of the original data
		arr = new Arr(b64.length * 3 / 4 - placeHolders)

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length

		var L = 0

		function push (v) {
			arr[L++] = v
		}

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
			push((tmp & 0xFF0000) >> 16)
			push((tmp & 0xFF00) >> 8)
			push(tmp & 0xFF)
		}

		if (placeHolders === 2) {
			tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
			push(tmp & 0xFF)
		} else if (placeHolders === 1) {
			tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
			push((tmp >> 8) & 0xFF)
			push(tmp & 0xFF)
		}

		return arr
	}

	function uint8ToBase64 (uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length

		function encode (num) {
			return lookup.charAt(num)
		}

		function tripletToBase64 (num) {
			return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
		}

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
			output += tripletToBase64(temp)
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1]
				output += encode(temp >> 2)
				output += encode((temp << 4) & 0x3F)
				output += '=='
				break
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
				output += encode(temp >> 10)
				output += encode((temp >> 4) & 0x3F)
				output += encode((temp << 2) & 0x3F)
				output += '='
				break
		}

		return output
	}

	exports.toByteArray = b64ToByteArray
	exports.fromByteArray = uint8ToBase64
}(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

},{}],4:[function(require,module,exports){
exports.read = function(buffer, offset, isLE, mLen, nBytes) {
  var e, m,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      nBits = -7,
      i = isLE ? (nBytes - 1) : 0,
      d = isLE ? -1 : 1,
      s = buffer[offset + i];

  i += d;

  e = s & ((1 << (-nBits)) - 1);
  s >>= (-nBits);
  nBits += eLen;
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8);

  m = e & ((1 << (-nBits)) - 1);
  e >>= (-nBits);
  nBits += mLen;
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8);

  if (e === 0) {
    e = 1 - eBias;
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity);
  } else {
    m = m + Math.pow(2, mLen);
    e = e - eBias;
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
};

exports.write = function(buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0),
      i = isLE ? 0 : (nBytes - 1),
      d = isLE ? 1 : -1,
      s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

  value = Math.abs(value);

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0;
    e = eMax;
  } else {
    e = Math.floor(Math.log(value) / Math.LN2);
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--;
      c *= 2;
    }
    if (e + eBias >= 1) {
      value += rt / c;
    } else {
      value += rt * Math.pow(2, 1 - eBias);
    }
    if (value * c >= 2) {
      e++;
      c /= 2;
    }

    if (e + eBias >= eMax) {
      m = 0;
      e = eMax;
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen);
      e = e + eBias;
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
      e = 0;
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8);

  e = (e << mLen) | m;
  eLen += mLen;
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8);

  buffer[offset + i - d] |= s * 128;
};

},{}],5:[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
var splitPathRe =
    /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
var splitPath = function(filename) {
  return splitPathRe.exec(filename).slice(1);
};

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function(path) {
  var result = splitPath(path),
      root = result[0],
      dir = result[1];

  if (!root && !dir) {
    // No dirname whatsoever
    return '.';
  }

  if (dir) {
    // It has a dirname, strip trailing slash
    dir = dir.substr(0, dir.length - 1);
  }

  return root + dir;
};


exports.basename = function(path, ext) {
  var f = splitPath(path)[2];
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPath(path)[3];
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

}).call(this,require("MnQM5j"))
},{"MnQM5j":6}],6:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],7:[function(require,module,exports){
var pleeease = require('../../node_modules/pleeease-brunch/node_modules/pleeease');

// expose pleeease
window.pleeease = pleeease;
},{"../../node_modules/pleeease-brunch/node_modules/pleeease":8}],8:[function(require,module,exports){
(function (process){
'use strict';

var postcss        = require('postcss'),
    prefixer       = require('autoprefixer'),
    minifier       = require('csswring'),
    mqpacker       = require('css-mqpacker'),
    vars           = require('postcss-vars'),
    rem            = require('pixrem'),
    filter         = require('pleeease-filters'),
    importer       = require('../lib/processors/import'),
    pseudoElements = require('../lib/processors/pseudoElements'),
    extend         = require('deep-extend');

var config,
    pipeline;

var usePlugin = function (name, fn, options) {

    if (options === undefined) {
        return pipeline.use(name[fn]);
    } else if (options === true) {
        return pipeline.use(name()[fn]);
    } else {
        if (!Array.isArray(options)) {
            options = [options];
        }
        return pipeline.use(name.apply(null, options)[fn]);
    }

};

function Pleeease (options) {

    var defaults = require('../lib/options');
    config = extend(defaults, options);

}

Pleeease.prototype.process = function (css) {

    var _options;

    pipeline = postcss();

    // importer
    _options = config.optimizers.import;
    if (_options) {
        if (_options === true) {
            _options = process.cwd();
        }
        pipeline = usePlugin(importer, 'processor', [_options]);
    }

    // fallbacks
    _options = config.fallbacks;
    if (_options) {

        for (var fallback in _options) {

            if (_options.hasOwnProperty(fallback) && _options[fallback] !== false) {

                switch (fallback) {

                    // variables
                    case 'variables':
                        pipeline = usePlugin(vars, 'processor');
                        break;

                    // filters
                    case 'filters':
                        pipeline = usePlugin(filter, 'postcss', _options[fallback]);
                        break;

                    // rem
                    case 'rem':
                        pipeline = usePlugin(rem, 'postcss', _options[fallback]);
                        break;

                    // pseudo-elements
                    case 'pseudoElements':
                        pipeline = usePlugin(pseudoElements, 'processor');

                }

            }

        }

    }

    // mqpacker
    if (config.optimizers.mqpacker) {
        pipeline = usePlugin(mqpacker, 'processor');
    }

    // prefixer
    _options = config.fallbacks.autoprefixer;
    if (_options) {
        pipeline = usePlugin(prefixer, 'postcss', _options);
    }

    // minifier
    if (config.optimizers.minifier) {
        pipeline = usePlugin(minifier, 'processor');
    }

    // sourcemaps
    var opts = (config.sourcemaps) ? {map: 'inline', to: config.output} : {};

    return pipeline.process(css, opts).css;

};

var pleeease = function(options) {
    return new Pleeease(options);
};
pleeease.process = function(css, options) {
    return new Pleeease(options).process(css);
};
module.exports = pleeease;
}).call(this,require("MnQM5j"))
},{"../lib/options":9,"../lib/processors/import":10,"../lib/processors/pseudoElements":11,"MnQM5j":6,"autoprefixer":14,"css-mqpacker":83,"csswring":85,"deep-extend":88,"pixrem":89,"pleeease-filters":90,"postcss":129,"postcss-vars":92}],9:[function(require,module,exports){
'use strict';

var fs         = require('fs'),
	path       = require('path'),
	extend     = require('deep-extend');

var configFile = '.pleeeaserc';

var options = {
	'in': ['*.css'],
	'out': 'app.min.css',

	'sourcemaps': false,

	'fallbacks': {
		'autoprefixer': true,
		'variables': true,
		'filters': true,
		'rem': true,
		'pseudoElements': true
	},
	'optimizers': {
		'import': true,
		'mqpacker': true,
		'minifier': true
	}
};

// check for .pleeeaserc config file
if (fs.existsSync !== undefined && path.existsSync !== undefined) {

	if ((fs.existsSync || path.existsSync)(configFile)) {
		var config = JSON.parse(fs.readFileSync(configFile));

		options = extend(options, config);

	}

}

module.exports = options;
},{"deep-extend":88,"fs":1,"path":5}],10:[function(require,module,exports){
'use strict';

var fs      = require('fs'),
    path    = require('path'),
    postcss = require('postcss');

function Importer (dirname) {
    Importer.prototype.dirname = path.resolve(dirname);
}
Importer.prototype.processor = function (css) {

    var root = postcss.root();
    // process CSS
    var styles = process(css);

    styles.each(function (rule) {
        root.append(rule.clone());
    });

    return root;

};
function process (style) {

    // create new rules
    var rules = [];

    // for each rule
    style.each(function (rule) {

        // get the filename if it's an @import
        var file = getFileIfAtImport(rule);

        // if it's an @import OK
        if (file) {

            // store dirname
            var dirname = path.dirname(file);

            // get the CSS from @import-ed file
            var processed = getCSSFromImportedFile(file);
            // resolve all @import url
            processed.eachAtRule(function (rule) {
                if (rule.name === 'import') {
                    var file = getFilename(rule.params);
                    // if @import don't contain media
                    if (file !== 'false') {
                        // resolve the path
                        rule.params = path.resolve(dirname, file);
                    }
                }
            });

            // store each rules
            processed.each(function (rule) {
                rules.push(rule);
            });

        } else {

            // this is not an @import, store the rule to the rules
            rules.push(rule);

        }

    });

    // replace all rules
    style.rules = rules;

    // if the file still have @import: process style
    if (hasImports(style)) {
        process(style);
    }

    return style;

}
function getCSSFromImportedFile (filename) {

    try {
        var data = fs.readFileSync(filename, 'utf8');
        var style = postcss.parse(data, {map: true, from: filename});
        return style;
    } catch (err) {
        throw new Error('Resolving path failed for "' + path.basename(filename) + '"');
    }

}
function getFileIfAtImport (rule) {

    if (rule.type === 'atrule' && rule.name === 'import') {
        var file = getFilename(rule.params);
        // if @import don't contain media
        if (file !== 'false') {
            // resolve the path
            return path.resolve(Importer.prototype.dirname, file);
        } else {
            return false;
        }
    }

}
function hasImports (style) {

    var yes = false;

    style.eachAtRule(function (rule) {
        if (rule.name === 'import') {
            yes = getFileIfAtImport(rule);
        }
    });

    return yes;

}
function getFilename (params) {

    // search for the url
    var RE_URL = /^(url\(["\']?|["\']{1})(\S[^"\'\)]+)["\']?[\)]?(.*)/;
    // get the filename
    var file = params.replace(RE_URL, function(_, hash, url, media) {
        // if a media is specified OR if it's an URL: ignore @import
        if (media !== '' || /^[\s"\']*http/.test(url)) {
            return false;
        }
        return url;
    });
    // return file without "" or ''
    return file.replace(/^("|\')/, '').replace(/("|\')$/, '');

}

var importer = function(dirname) {
    return new Importer(dirname);
};
module.exports = importer;
},{"fs":1,"path":5,"postcss":129}],11:[function(require,module,exports){
'use strict';

module.exports.processor = function (css) {

	// the regexp
	var regexp = /:(:before|:after|:first-letter|:first-line)/g;

	// for each rules
	css.eachRule(function (rule) {

		if ( rule.selector.match(regexp) ) {

			// In every ::before/::after rule
			rule.selector = rule.selector.replace(regexp, function(_, pseudo) {
				return pseudo;
			});

		}

	});

	return css;

};
},{}],12:[function(require,module,exports){
(function() {
  var convert, data, intervals, major, name, names, normalize, _ref;

  names = ['firefox', 'chrome', 'safari', 'ios_saf', 'opera', 'ie', 'bb', 'android'];

  major = ['firefox', 'chrome', 'safari', 'ios_saf', 'opera', 'android', 'ie', 'ie_mob'];

  normalize = function(array) {
    return array.reverse().filter(function(i) {
      return i;
    });
  };

  intervals = function(array) {
    var i, interval, result, splited, sub, _i, _len;
    result = [];
    for (_i = 0, _len = array.length; _i < _len; _i++) {
      interval = array[_i];
      splited = interval.split('-');
      splited = splited.sort().reverse();
      sub = (function() {
        var _j, _len1, _results;
        _results = [];
        for (_j = 0, _len1 = splited.length; _j < _len1; _j++) {
          i = splited[_j];
          _results.push([i, interval, splited.length]);
        }
        return _results;
      })();
      result = result.concat(sub);
    }
    return result;
  };

  convert = function(name, data) {
    var future, result, versions;
    future = normalize(data.versions.slice(-3));
    versions = intervals(normalize(data.versions.slice(0, -3)));
    result = {};
    result.prefix = name === 'opera' ? '-o-' : "-" + data.prefix + "-";
    if (major.indexOf(name) === -1) {
      result.minor = true;
    }
    if (future.length) {
      result.future = future;
    }
    result.versions = versions.map(function(i) {
      return i[0];
    });
    result.popularity = versions.map(function(i) {
      return data.usage_global[i[1]] / i[2];
    });
    return result;
  };

  module.exports = {};

  _ref = require('caniuse-db/data').agents;
  for (name in _ref) {
    data = _ref[name];
    module.exports[name] = convert(name, data);
  }

}).call(this);

},{"caniuse-db/data":54}],13:[function(require,module,exports){
(function() {
  var browsers, feature, map, prefix, textDecoration,
    __slice = [].slice;

  browsers = require('./browsers');

  feature = function(data, opts, callback) {
    var browser, interval, match, need, sorted, support, version, versions, _i, _len, _ref, _ref1, _ref2;
    if (!callback) {
      _ref = [opts, {}], callback = _ref[0], opts = _ref[1];
    }
    match = opts.full ? /y\sx($|\s)/ : /\sx($|\s)/;
    need = [];
    _ref1 = data.stats;
    for (browser in _ref1) {
      versions = _ref1[browser];
      for (interval in versions) {
        support = versions[interval];
        _ref2 = interval.split('-');
        for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
          version = _ref2[_i];
          if (browsers[browser] && support.match(match)) {
            version = version.replace(/\.0$/, '');
            need.push(browser + ' ' + version);
          }
        }
      }
    }
    sorted = need.sort(function(a, b) {
      a = a.split(' ');
      b = b.split(' ');
      if (a[0] > b[0]) {
        return 1;
      } else if (a[0] < b[0]) {
        return -1;
      } else {
        return parseFloat(a[1]) - parseFloat(b[1]);
      }
    });
    return callback(sorted);
  };

  map = function(browsers, callback) {
    var browser, name, version, _i, _len, _ref, _results;
    _results = [];
    for (_i = 0, _len = browsers.length; _i < _len; _i++) {
      browser = browsers[_i];
      _ref = browser.split(' '), name = _ref[0], version = _ref[1];
      version = parseFloat(version);
      _results.push(callback(browser, name, version));
    }
    return _results;
  };

  prefix = function() {
    var data, name, names, _i, _j, _len, _results;
    names = 2 <= arguments.length ? __slice.call(arguments, 0, _i = arguments.length - 1) : (_i = 0, []), data = arguments[_i++];
    _results = [];
    for (_j = 0, _len = names.length; _j < _len; _j++) {
      name = names[_j];
      _results.push(module.exports[name] = data);
    }
    return _results;
  };

  module.exports = {};

  feature(require('caniuse-db/features-json/border-radius'), function(browsers) {
    return prefix('border-radius', 'border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius', {
      mistakes: ['-ms-'],
      browsers: browsers,
      transition: true
    });
  });

  feature(require('caniuse-db/features-json/css-boxshadow'), function(browsers) {
    return prefix('box-shadow', {
      browsers: browsers,
      transition: true
    });
  });

  feature(require('caniuse-db/features-json/css-animation'), function(browsers) {
    return prefix('animation', 'animation-name', 'animation-duration', 'animation-delay', 'animation-direction', 'animation-fill-mode', 'animation-iteration-count', 'animation-play-state', 'animation-timing-function', '@keyframes', {
      browsers: browsers
    });
  });

  feature(require('caniuse-db/features-json/css-transitions'), function(browsers) {
    return prefix('transition', 'transition-property', 'transition-duration', 'transition-delay', 'transition-timing-function', {
      mistakes: ['-ms-'],
      browsers: browsers
    });
  });

  feature(require('caniuse-db/features-json/transforms2d'), function(browsers) {
    return prefix('transform', 'transform-origin', {
      browsers: browsers,
      transition: true
    });
  });

  feature(require('caniuse-db/features-json/transforms3d'), function(browsers) {
    prefix('perspective', 'perspective-origin', {
      browsers: browsers,
      transition: true
    });
    return prefix('transform-style', 'backface-visibility', {
      browsers: browsers
    });
  });

  feature(require('caniuse-db/features-json/css-gradients'), function(browsers) {
    browsers = map(browsers, function(browser, name, version) {
      if (name === 'android' && version < 4 || name === 'ios_saf' && version < 5 || name === 'safari' && version < 5.1) {
        return browser + ' old';
      } else {
        return browser;
      }
    });
    return prefix('linear-gradient', 'repeating-linear-gradient', 'radial-gradient', 'repeating-radial-gradient', {
      props: ['background', 'background-image', 'border-image'],
      mistakes: ['-ms-'],
      browsers: browsers
    });
  });

  feature(require('caniuse-db/features-json/css3-boxsizing'), function(browsers) {
    return prefix('box-sizing', {
      browsers: browsers
    });
  });

  feature(require('caniuse-db/features-json/css-filters'), function(browsers) {
    return prefix('filter', {
      browsers: browsers,
      transition: true
    });
  });

  feature(require('caniuse-db/features-json/multicolumn'), function(browsers) {
    prefix('columns', 'column-width', 'column-gap', 'column-rule', 'column-rule-color', 'column-rule-width', {
      browsers: browsers,
      transition: true
    });
    return prefix('column-count', 'column-rule-style', 'column-span', 'column-fill', 'break-before', 'break-after', 'break-inside', {
      browsers: browsers
    });
  });

  feature(require('caniuse-db/features-json/user-select-none'), function(browsers) {
    return prefix('user-select', {
      browsers: browsers
    });
  });

  feature(require('caniuse-db/features-json/flexbox'), function(browsers) {
    browsers = map(browsers, function(browser, name, version) {
      if ((name === 'safari' || name === 'ios_saf') && version < 7) {
        return browser + ' 2009';
      } else if (name === 'chrome' && version < 21) {
        return browser + ' 2009';
      } else {
        return browser;
      }
    });
    prefix('display-flex', 'inline-flex', {
      props: ['display'],
      browsers: browsers
    });
    prefix('flex', 'flex-grow', 'flex-shrink', 'flex-basis', {
      transition: true,
      browsers: browsers
    });
    return prefix('flex-direction', 'flex-wrap', 'flex-flow', 'justify-content', 'order', 'align-items', 'align-self', 'align-content', {
      browsers: browsers
    });
  });

  feature(require('caniuse-db/features-json/calc'), function(browsers) {
    return prefix('calc', {
      props: ['*'],
      browsers: browsers
    });
  });

  feature(require('caniuse-db/features-json/background-img-opts'), function(browsers) {
    return prefix('background-clip', 'background-origin', 'background-size', {
      browsers: browsers
    });
  });

  feature(require('caniuse-db/features-json/font-feature'), function(browsers) {
    return prefix('font-feature-settings', 'font-variant-ligatures', 'font-language-override', 'font-kerning', {
      browsers: browsers
    });
  });

  feature(require('caniuse-db/features-json/border-image'), function(browsers) {
    return prefix('border-image', {
      browsers: browsers
    });
  });

  feature(require('caniuse-db/features-json/css-selection'), function(browsers) {
    return prefix('::selection', {
      selector: true,
      browsers: browsers
    });
  });

  feature(require('caniuse-db/features-json/css-placeholder'), function(browsers) {
    browsers = map(browsers, function(browser, name, version) {
      if (name === 'firefox' && version <= 18) {
        return browser + ' old';
      } else {
        return browser;
      }
    });
    return prefix('::placeholder', {
      selector: true,
      browsers: browsers
    });
  });

  feature(require('caniuse-db/features-json/css-hyphens'), function(browsers) {
    return prefix('hyphens', {
      browsers: browsers
    });
  });

  feature(require('caniuse-db/features-json/fullscreen'), function(browsers) {
    return prefix(':fullscreen', {
      selector: true,
      browsers: browsers
    });
  });

  feature(require('caniuse-db/features-json/css3-tabsize'), function(browsers) {
    return prefix('tab-size', {
      browsers: browsers
    });
  });

  feature(require('caniuse-db/features-json/intrinsic-width'), function(browsers) {
    return prefix('max-content', 'min-content', 'fit-content', 'fill-available', {
      props: ['width', 'min-width', 'max-width', 'height', 'min-height', 'max-height'],
      browsers: browsers
    });
  });

  feature(require('caniuse-db/features-json/css3-cursors-newer'), function(browsers) {
    prefix('zoom-in', 'zoom-out', {
      props: ['cursor'],
      browsers: browsers.concat(['chrome 3'])
    });
    return prefix('grab', 'grabbing', {
      props: ['cursor'],
      browsers: browsers.concat(['firefox 24', 'firefox 25', 'firefox 26'])
    });
  });

  feature(require('caniuse-db/features-json/css-sticky'), function(browsers) {
    return prefix('sticky', {
      props: ['position'],
      browsers: browsers
    });
  });

  feature(require('caniuse-db/features-json/pointer'), function(browsers) {
    return prefix('touch-action', {
      browsers: browsers
    });
  });

  textDecoration = require('caniuse-db/features-json/text-decoration');

  feature(textDecoration, function(browsers) {
    return prefix('text-decoration-style', {
      browsers: browsers
    });
  });

  feature(textDecoration, {
    full: true
  }, function(browsers) {
    return prefix('text-decoration-line', 'text-decoration-color', {
      browsers: browsers
    });
  });

  feature(require('caniuse-db/features-json/text-size-adjust'), function(browsers) {
    return prefix('text-size-adjust', {
      browsers: browsers
    });
  });

  feature(require('caniuse-db/features-json/css-masks'), function(browsers) {
    return prefix('clip-path', 'mask', 'mask-clip', 'mask-composite', 'mask-image', 'mask-origin', 'mask-position', 'mask-repeat', 'mask-size', {
      browsers: browsers
    });
  });

}).call(this);

},{"./browsers":12,"caniuse-db/features-json/background-img-opts":55,"caniuse-db/features-json/border-image":56,"caniuse-db/features-json/border-radius":57,"caniuse-db/features-json/calc":58,"caniuse-db/features-json/css-animation":59,"caniuse-db/features-json/css-boxshadow":60,"caniuse-db/features-json/css-filters":61,"caniuse-db/features-json/css-gradients":62,"caniuse-db/features-json/css-hyphens":63,"caniuse-db/features-json/css-masks":64,"caniuse-db/features-json/css-placeholder":65,"caniuse-db/features-json/css-selection":66,"caniuse-db/features-json/css-sticky":67,"caniuse-db/features-json/css-transitions":68,"caniuse-db/features-json/css3-boxsizing":69,"caniuse-db/features-json/css3-cursors-newer":70,"caniuse-db/features-json/css3-tabsize":71,"caniuse-db/features-json/flexbox":72,"caniuse-db/features-json/font-feature":73,"caniuse-db/features-json/fullscreen":74,"caniuse-db/features-json/intrinsic-width":75,"caniuse-db/features-json/multicolumn":76,"caniuse-db/features-json/pointer":77,"caniuse-db/features-json/text-decoration":78,"caniuse-db/features-json/text-size-adjust":79,"caniuse-db/features-json/transforms2d":80,"caniuse-db/features-json/transforms3d":81,"caniuse-db/features-json/user-select-none":82}],14:[function(require,module,exports){
(function() {
  var Autoprefixer, Browsers, Prefixes, autoprefixer, infoCache, isPlainObject, postcss,
    __slice = [].slice,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  postcss = require('postcss');

  Browsers = require('./browsers');

  Prefixes = require('./prefixes');

  infoCache = null;

  isPlainObject = function(obj) {
    return Object.prototype.toString.apply(obj) === '[object Object]';
  };

  autoprefixer = function() {
    var browsers, options, prefixes, reqs;
    reqs = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    if (reqs.length === 1 && isPlainObject(reqs[0])) {
      options = reqs[0];
      reqs = void 0;
    } else if (reqs.length === 0 || (reqs.length === 1 && (reqs[0] == null))) {
      reqs = void 0;
    } else if (reqs.length <= 2 && (reqs[0] instanceof Array || (reqs[0] == null))) {
      options = reqs[1];
      reqs = reqs[0];
    } else if (typeof reqs[reqs.length - 1] === 'object') {
      options = reqs.pop();
    }
    if (reqs == null) {
      reqs = autoprefixer["default"];
    }
    browsers = new Browsers(autoprefixer.data.browsers, reqs);
    prefixes = new Prefixes(autoprefixer.data.prefixes, browsers, options);
    return new Autoprefixer(prefixes, autoprefixer.data);
  };

  autoprefixer.data = {
    browsers: require('../data/browsers'),
    prefixes: require('../data/prefixes')
  };

  Autoprefixer = (function() {
    function Autoprefixer(prefixes, data, options) {
      this.prefixes = prefixes;
      this.data = data;
      this.options = options != null ? options : {};
      this.postcss = __bind(this.postcss, this);
      this.browsers = this.prefixes.browsers.selected;
    }

    Autoprefixer.prototype.process = function(str, options) {
      if (options == null) {
        options = {};
      }
      return this.processor().process(str, options);
    };

    Autoprefixer.prototype.postcss = function(css) {
      this.prefixes.processor.remove(css);
      return this.prefixes.processor.add(css);
    };

    Autoprefixer.prototype.info = function() {
      infoCache || (infoCache = require('./info'));
      return infoCache(this.prefixes);
    };

    Autoprefixer.prototype.processor = function() {
      return this.processorCache || (this.processorCache = postcss(this.postcss));
    };

    return Autoprefixer;

  })();

  autoprefixer["default"] = ['> 1%', 'last 2 versions', 'Firefox ESR', 'Opera 12.1'];

  autoprefixer.loadDefault = function() {
    return this.defaultCache || (this.defaultCache = autoprefixer(this["default"]));
  };

  autoprefixer.process = function(str, options) {
    if (options == null) {
      options = {};
    }
    return this.loadDefault().process(str, options);
  };

  autoprefixer.compile = function(str, options) {
    if (options == null) {
      options = {};
    }
    return this.loadDefault().compile(str, options);
  };

  autoprefixer.postcss = function(css) {
    return this.loadDefault().postcss(css);
  };

  autoprefixer.info = function() {
    return this.loadDefault().info();
  };

  module.exports = autoprefixer;

}).call(this);

},{"../data/browsers":12,"../data/prefixes":13,"./browsers":15,"./info":43,"./prefixes":48,"postcss":129}],15:[function(require,module,exports){
(function() {
  var Browsers, utils;

  utils = require('./utils');

  Browsers = (function() {
    Browsers.prefixes = function() {
      var data, i, name;
      if (this.prefixesCache) {
        return this.prefixesCache;
      }
      data = require('../data/browsers');
      return this.prefixesCache = utils.uniq((function() {
        var _results;
        _results = [];
        for (name in data) {
          i = data[name];
          _results.push(i.prefix);
        }
        return _results;
      })()).sort(function(a, b) {
        return b.length - a.length;
      });
    };

    Browsers.withPrefix = function(value) {
      if (!this.prefixesRegexp) {
        this.prefixesRegexp = RegExp("" + (this.prefixes().join('|')));
      }
      return this.prefixesRegexp.test(value);
    };

    function Browsers(data, requirements) {
      this.data = data;
      this.selected = this.parse(requirements);
    }

    Browsers.prototype.parse = function(requirements) {
      var selected;
      if (!(requirements instanceof Array)) {
        requirements = [requirements];
      }
      selected = [];
      requirements.map((function(_this) {
        return function(req) {
          var i, match, name, _ref;
          _ref = _this.requirements;
          for (name in _ref) {
            i = _ref[name];
            if (match = req.match(i.regexp)) {
              selected = selected.concat(i.select.apply(_this, match.slice(1)));
              return;
            }
          }
          return utils.error("Unknown browser requirement `" + req + "`");
        };
      })(this));
      return utils.uniq(selected);
    };

    Browsers.prototype.aliases = {
      fx: 'firefox',
      ff: 'firefox',
      ios: 'ios_saf',
      explorer: 'ie',
      blackberry: 'bb',
      explorermobile: 'ie_mob',
      operamini: 'op_mini',
      operamobile: 'op_mob',
      chromeandroid: 'and_chr',
      firefoxandroid: 'and_ff'
    };

    Browsers.prototype.requirements = {
      none: {
        regexp: /^none$/i,
        select: function() {
          return [];
        }
      },
      lastVersions: {
        regexp: /^last (\d+) versions?$/i,
        select: function(versions) {
          return this.browsers(function(data) {
            if (data.minor) {
              return [];
            } else {
              return data.versions.slice(0, versions);
            }
          });
        }
      },
      lastByBrowser: {
        regexp: /^last (\d+) (\w+) versions?$/i,
        select: function(versions, browser) {
          var data;
          data = this.byName(browser);
          return data.versions.slice(0, versions).map(function(v) {
            return "" + data.name + " " + v;
          });
        }
      },
      globalStatistics: {
        regexp: /^> (\d+(\.\d+)?)%$/,
        select: function(popularity) {
          return this.browsers(function(data) {
            if (data.minor) {
              return [];
            } else {
              return data.versions.filter(function(version, i) {
                return data.popularity[i] > popularity;
              });
            }
          });
        }
      },
      newerThen: {
        regexp: /^(\w+) (>=?)\s*([\d\.]+)/,
        select: function(browser, sign, version) {
          var data, filter;
          data = this.byName(browser);
          version = parseFloat(version);
          if (sign === '>') {
            filter = function(v) {
              return v > version;
            };
          } else if (sign === '>=') {
            filter = function(v) {
              return v >= version;
            };
          }
          return data.versions.filter(filter).map(function(v) {
            return "" + data.name + " " + v;
          });
        }
      },
      esr: {
        regexp: /^(firefox|ff|fx) esr$/i,
        select: function() {
          return ['firefox 24'];
        }
      },
      direct: {
        regexp: /^(\w+) ([\d\.]+)$/,
        select: function(browser, version) {
          var data, first, last;
          data = this.byName(browser);
          version = parseFloat(version);
          last = data.future ? data.future[0] : data.versions[0];
          first = data.versions[data.versions.length - 1];
          if (version > last) {
            version = last;
          } else if (version < first) {
            version = first;
          }
          return ["" + data.name + " " + version];
        }
      }
    };

    Browsers.prototype.browsers = function(criteria) {
      var browser, data, selected, versions, _ref;
      selected = [];
      _ref = this.data;
      for (browser in _ref) {
        data = _ref[browser];
        versions = criteria(data).map(function(version) {
          return "" + browser + " " + version;
        });
        selected = selected.concat(versions);
      }
      return selected;
    };

    Browsers.prototype.prefix = function(browser) {
      var name, version, _ref;
      _ref = browser.split(' '), name = _ref[0], version = _ref[1];
      if (name === 'opera' && parseFloat(version) >= 15) {
        return '-webkit-';
      } else {
        return this.data[name].prefix;
      }
    };

    Browsers.prototype.isSelected = function(browser) {
      return this.selected.indexOf(browser) !== -1;
    };

    Browsers.prototype.byName = function(name) {
      var data;
      name = name.toLowerCase();
      name = this.aliases[name] || name;
      data = this.data[name];
      if (!data) {
        utils.error("Unknown browser " + browser);
      }
      data.name = name;
      return data;
    };

    return Browsers;

  })();

  module.exports = Browsers;

}).call(this);

},{"../data/browsers":12,"./utils":52}],16:[function(require,module,exports){
(function() {
  var Browsers, Declaration, Prefixer, utils, vendor,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  Prefixer = require('./prefixer');

  Browsers = require('./browsers');

  vendor = require('postcss/lib/vendor');

  utils = require('./utils');

  Declaration = (function(_super) {
    __extends(Declaration, _super);

    function Declaration() {
      return Declaration.__super__.constructor.apply(this, arguments);
    }

    Declaration.prototype.check = function(decl) {
      return true;
    };

    Declaration.prototype.prefixed = function(prop, prefix) {
      return prefix + prop;
    };

    Declaration.prototype.normalize = function(prop) {
      return prop;
    };

    Declaration.prototype.otherPrefixes = function(value, prefix) {
      var other, _i, _len, _ref;
      _ref = Browsers.prefixes();
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        other = _ref[_i];
        if (other === prefix) {
          continue;
        }
        if (value.indexOf(other) !== -1) {
          return true;
        }
      }
      return false;
    };

    Declaration.prototype.set = function(decl, prefix) {
      decl.prop = this.prefixed(decl.prop, prefix);
      return decl;
    };

    Declaration.prototype.needCascade = function(decl) {
      return decl._autoprefixerCascade || (decl._autoprefixerCascade = this.all.options.cascade !== false && decl.before.indexOf("\n") !== -1);
    };

    Declaration.prototype.maxPrefixed = function(prefixes, decl) {
      var max, prefix, _i, _len;
      if (decl._autoprefixerMax) {
        return decl._autoprefixerMax;
      }
      max = 0;
      for (_i = 0, _len = prefixes.length; _i < _len; _i++) {
        prefix = prefixes[_i];
        prefix = utils.removeNote(prefix);
        if (prefix.length > max) {
          max = prefix.length;
        }
      }
      return decl._autoprefixerMax = max;
    };

    Declaration.prototype.calcBefore = function(prefixes, decl, prefix) {
      var before, diff, i, max, _i;
      if (prefix == null) {
        prefix = '';
      }
      before = decl.before;
      max = this.maxPrefixed(prefixes, decl);
      diff = max - utils.removeNote(prefix).length;
      for (i = _i = 0; 0 <= diff ? _i < diff : _i > diff; i = 0 <= diff ? ++_i : --_i) {
        before += ' ';
      }
      return before;
    };

    Declaration.prototype.restoreBefore = function(decl) {
      var lines, min;
      lines = decl.before.split("\n");
      min = lines[lines.length - 1];
      this.all.group(decl).up(function(prefixed) {
        var array, last;
        array = prefixed.before.split("\n");
        last = array[array.length - 1];
        if (last.length < min.length) {
          return min = last;
        }
      });
      lines[lines.length - 1] = min;
      return decl.before = lines.join("\n");
    };

    Declaration.prototype.insert = function(decl, prefix, prefixes) {
      var cloned;
      cloned = this.set(this.clone(decl), prefix);
      if (!cloned) {
        return;
      }
      if (this.needCascade(decl)) {
        cloned.before = this.calcBefore(prefixes, decl, prefix);
      }
      return decl.parent.insertBefore(decl, cloned);
    };

    Declaration.prototype.add = function(decl, prefix, prefixes) {
      var already, prefixed;
      prefixed = this.prefixed(decl.prop, prefix);
      already = this.all.group(decl).up(function(i) {
        return i.prop === prefixed;
      });
      already || (already = this.all.group(decl).down(function(i) {
        return i.prop === prefixed;
      }));
      if (already || this.otherPrefixes(decl.value, prefix)) {
        return;
      }
      return this.insert(decl, prefix, prefixes);
    };

    Declaration.prototype.process = function(decl) {
      var prefixes;
      if (this.needCascade(decl)) {
        prefixes = Declaration.__super__.process.apply(this, arguments);
        if (prefixes != null ? prefixes.length : void 0) {
          this.restoreBefore(decl);
          return decl.before = this.calcBefore(prefixes, decl);
        }
      } else {
        return Declaration.__super__.process.apply(this, arguments);
      }
    };

    Declaration.prototype.old = function(prop, prefix) {
      return [this.prefixed(prop, prefix)];
    };

    return Declaration;

  })(Prefixer);

  module.exports = Declaration;

}).call(this);

},{"./browsers":15,"./prefixer":47,"./utils":52,"postcss/lib/vendor":136}],17:[function(require,module,exports){
(function() {
  var AlignContent, Declaration, flexSpec,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  flexSpec = require('./flex-spec');

  Declaration = require('../declaration');

  AlignContent = (function(_super) {
    __extends(AlignContent, _super);

    function AlignContent() {
      return AlignContent.__super__.constructor.apply(this, arguments);
    }

    AlignContent.names = ['align-content', 'flex-line-pack'];

    AlignContent.oldValues = {
      'flex-end': 'end',
      'flex-start': 'start',
      'space-between': 'justify',
      'space-around': 'distribute'
    };

    AlignContent.prototype.prefixed = function(prop, prefix) {
      var spec, _ref;
      _ref = flexSpec(prefix), spec = _ref[0], prefix = _ref[1];
      if (spec === 2012) {
        return prefix + 'flex-line-pack';
      } else {
        return AlignContent.__super__.prefixed.apply(this, arguments);
      }
    };

    AlignContent.prototype.normalize = function(prop) {
      return 'align-content';
    };

    AlignContent.prototype.set = function(decl, prefix) {
      var spec;
      spec = flexSpec(prefix)[0];
      if (spec === 2012) {
        decl.value = AlignContent.oldValues[decl.value] || decl.value;
        return AlignContent.__super__.set.call(this, decl, prefix);
      } else if (spec === 'final') {
        return AlignContent.__super__.set.apply(this, arguments);
      }
    };

    return AlignContent;

  })(Declaration);

  module.exports = AlignContent;

}).call(this);

},{"../declaration":16,"./flex-spec":32}],18:[function(require,module,exports){
(function() {
  var AlignItems, Declaration, flexSpec,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  flexSpec = require('./flex-spec');

  Declaration = require('../declaration');

  AlignItems = (function(_super) {
    __extends(AlignItems, _super);

    function AlignItems() {
      return AlignItems.__super__.constructor.apply(this, arguments);
    }

    AlignItems.names = ['align-items', 'flex-align', 'box-align'];

    AlignItems.oldValues = {
      'flex-end': 'end',
      'flex-start': 'start'
    };

    AlignItems.prototype.prefixed = function(prop, prefix) {
      var spec, _ref;
      _ref = flexSpec(prefix), spec = _ref[0], prefix = _ref[1];
      if (spec === 2009) {
        return prefix + 'box-align';
      } else if (spec === 2012) {
        return prefix + 'flex-align';
      } else {
        return AlignItems.__super__.prefixed.apply(this, arguments);
      }
    };

    AlignItems.prototype.normalize = function(prop) {
      return 'align-items';
    };

    AlignItems.prototype.set = function(decl, prefix) {
      var spec;
      spec = flexSpec(prefix)[0];
      if (spec === 2009 || spec === 2012) {
        decl.value = AlignItems.oldValues[decl.value] || decl.value;
        return AlignItems.__super__.set.call(this, decl, prefix);
      } else {
        return AlignItems.__super__.set.apply(this, arguments);
      }
    };

    return AlignItems;

  })(Declaration);

  module.exports = AlignItems;

}).call(this);

},{"../declaration":16,"./flex-spec":32}],19:[function(require,module,exports){
(function() {
  var AlignSelf, Declaration, flexSpec,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  flexSpec = require('./flex-spec');

  Declaration = require('../declaration');

  AlignSelf = (function(_super) {
    __extends(AlignSelf, _super);

    function AlignSelf() {
      return AlignSelf.__super__.constructor.apply(this, arguments);
    }

    AlignSelf.names = ['align-self', 'flex-item-align'];

    AlignSelf.oldValues = {
      'flex-end': 'end',
      'flex-start': 'start'
    };

    AlignSelf.prototype.prefixed = function(prop, prefix) {
      var spec, _ref;
      _ref = flexSpec(prefix), spec = _ref[0], prefix = _ref[1];
      if (spec === 2012) {
        return prefix + 'flex-item-align';
      } else {
        return AlignSelf.__super__.prefixed.apply(this, arguments);
      }
    };

    AlignSelf.prototype.normalize = function(prop) {
      return 'align-self';
    };

    AlignSelf.prototype.set = function(decl, prefix) {
      var spec;
      spec = flexSpec(prefix)[0];
      if (spec === 2012) {
        decl.value = AlignSelf.oldValues[decl.value] || decl.value;
        return AlignSelf.__super__.set.call(this, decl, prefix);
      } else if (spec === 'final') {
        return AlignSelf.__super__.set.apply(this, arguments);
      }
    };

    return AlignSelf;

  })(Declaration);

  module.exports = AlignSelf;

}).call(this);

},{"../declaration":16,"./flex-spec":32}],20:[function(require,module,exports){
(function() {
  var BackgroundSize, Declaration,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  Declaration = require('../declaration');

  BackgroundSize = (function(_super) {
    __extends(BackgroundSize, _super);

    function BackgroundSize() {
      return BackgroundSize.__super__.constructor.apply(this, arguments);
    }

    BackgroundSize.names = ['background-size'];

    BackgroundSize.prototype.set = function(decl, prefix) {
      if (prefix === '-webkit-' && decl.value.indexOf(' ') === -1) {
        decl.value = decl.value + ' ' + decl.value;
      }
      return BackgroundSize.__super__.set.call(this, decl, prefix);
    };

    return BackgroundSize;

  })(Declaration);

  module.exports = BackgroundSize;

}).call(this);

},{"../declaration":16}],21:[function(require,module,exports){
(function() {
  var BorderImage, Declaration,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  Declaration = require('../declaration');

  BorderImage = (function(_super) {
    __extends(BorderImage, _super);

    function BorderImage() {
      return BorderImage.__super__.constructor.apply(this, arguments);
    }

    BorderImage.names = ['border-image'];

    BorderImage.prototype.set = function(decl, prefix) {
      decl.value = decl.value.replace(/\s+fill(\s)/, '$1');
      return BorderImage.__super__.set.call(this, decl, prefix);
    };

    return BorderImage;

  })(Declaration);

  module.exports = BorderImage;

}).call(this);

},{"../declaration":16}],22:[function(require,module,exports){
(function() {
  var BorderRadius, Declaration,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  Declaration = require('../declaration');

  BorderRadius = (function(_super) {
    var hor, mozilla, normal, ver, _i, _j, _len, _len1, _ref, _ref1;

    __extends(BorderRadius, _super);

    function BorderRadius() {
      return BorderRadius.__super__.constructor.apply(this, arguments);
    }

    BorderRadius.names = ['border-radius'];

    BorderRadius.toMozilla = {};

    BorderRadius.toNormal = {};

    _ref = ['top', 'bottom'];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      ver = _ref[_i];
      _ref1 = ['left', 'right'];
      for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
        hor = _ref1[_j];
        normal = "border-" + ver + "-" + hor + "-radius";
        mozilla = "border-radius-" + ver + hor;
        BorderRadius.names.push(normal);
        BorderRadius.names.push(mozilla);
        BorderRadius.toMozilla[normal] = mozilla;
        BorderRadius.toNormal[mozilla] = normal;
      }
    }

    BorderRadius.prototype.prefixed = function(prop, prefix) {
      if (prefix === '-moz-') {
        return prefix + (BorderRadius.toMozilla[prop] || prop);
      } else {
        return BorderRadius.__super__.prefixed.apply(this, arguments);
      }
    };

    BorderRadius.prototype.normalize = function(prop) {
      return BorderRadius.toNormal[prop] || prop;
    };

    return BorderRadius;

  })(Declaration);

  module.exports = BorderRadius;

}).call(this);

},{"../declaration":16}],23:[function(require,module,exports){
(function() {
  var BreakInside, Declaration,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  Declaration = require('../declaration');

  BreakInside = (function(_super) {
    __extends(BreakInside, _super);

    function BreakInside() {
      return BreakInside.__super__.constructor.apply(this, arguments);
    }

    BreakInside.names = ['break-inside', 'page-break-inside', 'column-break-inside'];

    BreakInside.prototype.prefixed = function(prop, prefix) {
      if (prefix === '-webkit-') {
        return prefix + 'column-break-inside';
      } else if (prefix === '-moz-') {
        return 'page-break-inside';
      } else {
        return BreakInside.__super__.prefixed.apply(this, arguments);
      }
    };

    BreakInside.prototype.normalize = function() {
      return 'break-inside';
    };

    BreakInside.prototype.set = function(decl, prefix) {
      if (decl.value === 'avoid-column' || decl.value === 'avoid-page') {
        decl.value = 'avoid';
      }
      return BreakInside.__super__.set.apply(this, arguments);
    };

    BreakInside.prototype.insert = function(decl, prefix, prefixes) {
      if (decl.value === 'avoid-region') {

      } else if (decl.value === 'avoid-page' && prefix === '-webkit-') {

      } else {
        return BreakInside.__super__.insert.apply(this, arguments);
      }
    };

    return BreakInside;

  })(Declaration);

  module.exports = BreakInside;

}).call(this);

},{"../declaration":16}],24:[function(require,module,exports){
(function() {
  var DisplayFlex, OldDisplayFlex, OldValue, Value, flexSpec,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  flexSpec = require('./flex-spec');

  OldValue = require('../old-value');

  Value = require('../value');

  OldDisplayFlex = (function(_super) {
    __extends(OldDisplayFlex, _super);

    function OldDisplayFlex(name) {
      this.name = name;
    }

    OldDisplayFlex.prototype.check = function(value) {
      return value === this.name;
    };

    return OldDisplayFlex;

  })(OldValue);

  DisplayFlex = (function(_super) {
    __extends(DisplayFlex, _super);

    DisplayFlex.names = ['display-flex', 'inline-flex'];

    function DisplayFlex(name, prefixes) {
      DisplayFlex.__super__.constructor.apply(this, arguments);
      if (name === 'display-flex') {
        this.name = 'flex';
      }
    }

    DisplayFlex.prototype.check = function(decl) {
      return decl.value === this.name;
    };

    DisplayFlex.prototype.prefixed = function(prefix) {
      var spec, _ref;
      _ref = flexSpec(prefix), spec = _ref[0], prefix = _ref[1];
      return prefix + (spec === 2009 ? this.name === 'flex' ? 'box' : 'inline-box' : spec === 2012 ? this.name === 'flex' ? 'flexbox' : 'inline-flexbox' : spec === 'final' ? this.name : void 0);
    };

    DisplayFlex.prototype.replace = function(string, prefix) {
      return this.prefixed(prefix);
    };

    DisplayFlex.prototype.old = function(prefix) {
      var prefixed;
      prefixed = this.prefixed(prefix);
      if (prefixed) {
        return new OldValue(prefixed);
      }
    };

    return DisplayFlex;

  })(Value);

  module.exports = DisplayFlex;

}).call(this);

},{"../old-value":46,"../value":53,"./flex-spec":32}],25:[function(require,module,exports){
(function() {
  var FillAvailable, OldValue, Value,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  OldValue = require('../old-value');

  Value = require('../value');

  FillAvailable = (function(_super) {
    __extends(FillAvailable, _super);

    function FillAvailable() {
      return FillAvailable.__super__.constructor.apply(this, arguments);
    }

    FillAvailable.names = ['fill-available'];

    FillAvailable.prototype.replace = function(string, prefix) {
      if (prefix === '-moz-') {
        return string.replace(this.regexp(), '$1-moz-available$3');
      } else {
        return FillAvailable.__super__.replace.apply(this, arguments);
      }
    };

    FillAvailable.prototype.old = function(prefix) {
      if (prefix === '-moz-') {
        return new OldValue('-moz-available');
      } else {
        return FillAvailable.__super__.old.apply(this, arguments);
      }
    };

    return FillAvailable;

  })(Value);

  module.exports = FillAvailable;

}).call(this);

},{"../old-value":46,"../value":53}],26:[function(require,module,exports){
(function() {
  var Declaration, Filter,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  Declaration = require('../declaration');

  Filter = (function(_super) {
    __extends(Filter, _super);

    function Filter() {
      return Filter.__super__.constructor.apply(this, arguments);
    }

    Filter.names = ['filter'];

    Filter.prototype.check = function(decl) {
      var v;
      v = decl.value;
      return v.toLowerCase().indexOf('alpha(') === -1 && v.indexOf('DXImageTransform.Microsoft') === -1 && v.indexOf('data:image/svg+xml') === -1;
    };

    return Filter;

  })(Declaration);

  module.exports = Filter;

}).call(this);

},{"../declaration":16}],27:[function(require,module,exports){
(function() {
  var Declaration, FlexBasis, flexSpec,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  flexSpec = require('./flex-spec');

  Declaration = require('../declaration');

  FlexBasis = (function(_super) {
    __extends(FlexBasis, _super);

    function FlexBasis() {
      return FlexBasis.__super__.constructor.apply(this, arguments);
    }

    FlexBasis.names = ['flex-basis', 'flex-preferred-size'];

    FlexBasis.prototype.normalize = function() {
      return 'flex-basis';
    };

    FlexBasis.prototype.prefixed = function(prop, prefix) {
      var spec, _ref;
      _ref = flexSpec(prefix), spec = _ref[0], prefix = _ref[1];
      if (spec === 2012) {
        return prefix + 'flex-preferred-size';
      } else {
        return FlexBasis.__super__.prefixed.apply(this, arguments);
      }
    };

    FlexBasis.prototype.set = function(decl, prefix) {
      var spec, _ref;
      _ref = flexSpec(prefix), spec = _ref[0], prefix = _ref[1];
      if (spec === 2012 || spec === 'final') {
        return FlexBasis.__super__.set.apply(this, arguments);
      }
    };

    return FlexBasis;

  })(Declaration);

  module.exports = FlexBasis;

}).call(this);

},{"../declaration":16,"./flex-spec":32}],28:[function(require,module,exports){
(function() {
  var Declaration, FlexDirection, flexSpec,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  flexSpec = require('./flex-spec');

  Declaration = require('../declaration');

  FlexDirection = (function(_super) {
    __extends(FlexDirection, _super);

    function FlexDirection() {
      return FlexDirection.__super__.constructor.apply(this, arguments);
    }

    FlexDirection.names = ['flex-direction', 'box-direction', 'box-orient'];

    FlexDirection.prototype.normalize = function(prop) {
      return 'flex-direction';
    };

    FlexDirection.prototype.insert = function(decl, prefix, prefixes) {
      var already, cloned, dir, orient, spec, value, _ref;
      _ref = flexSpec(prefix), spec = _ref[0], prefix = _ref[1];
      if (spec === 2009) {
        already = decl.parent.some(function(i) {
          return i.prop === prefix + 'box-orient' || i.prop === prefix + 'box-direction';
        });
        if (already) {
          return;
        }
        value = decl.value;
        orient = value.indexOf('row') !== -1 ? 'horizontal' : 'vertical';
        dir = value.indexOf('reverse') !== -1 ? 'reverse' : 'normal';
        cloned = this.clone(decl);
        cloned.prop = prefix + 'box-orient';
        cloned.value = orient;
        if (this.needCascade(decl)) {
          cloned.before = this.calcBefore(prefixes, decl, prefix);
        }
        decl.parent.insertBefore(decl, cloned);
        cloned = this.clone(decl);
        cloned.prop = prefix + 'box-direction';
        cloned.value = dir;
        if (this.needCascade(decl)) {
          cloned.before = this.calcBefore(prefixes, decl, prefix);
        }
        return decl.parent.insertBefore(decl, cloned);
      } else {
        return FlexDirection.__super__.insert.apply(this, arguments);
      }
    };

    FlexDirection.prototype.old = function(prop, prefix) {
      var spec, _ref;
      _ref = flexSpec(prefix), spec = _ref[0], prefix = _ref[1];
      if (spec === 2009) {
        return [prefix + 'box-orient', prefix + 'box-direction'];
      } else {
        return FlexDirection.__super__.old.apply(this, arguments);
      }
    };

    return FlexDirection;

  })(Declaration);

  module.exports = FlexDirection;

}).call(this);

},{"../declaration":16,"./flex-spec":32}],29:[function(require,module,exports){
(function() {
  var Declaration, FlexFlow, flexSpec,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  flexSpec = require('./flex-spec');

  Declaration = require('../declaration');

  FlexFlow = (function(_super) {
    __extends(FlexFlow, _super);

    function FlexFlow() {
      return FlexFlow.__super__.constructor.apply(this, arguments);
    }

    FlexFlow.names = ['flex-flow'];

    FlexFlow.prototype.set = function(decl, prefix) {
      var spec, _ref;
      _ref = flexSpec(prefix), spec = _ref[0], prefix = _ref[1];
      if (spec === 2012) {
        return FlexFlow.__super__.set.apply(this, arguments);
      } else if (spec === 'final') {
        return FlexFlow.__super__.set.apply(this, arguments);
      }
    };

    return FlexFlow;

  })(Declaration);

  module.exports = FlexFlow;

}).call(this);

},{"../declaration":16,"./flex-spec":32}],30:[function(require,module,exports){
(function() {
  var Declaration, Flex, flexSpec,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  flexSpec = require('./flex-spec');

  Declaration = require('../declaration');

  Flex = (function(_super) {
    __extends(Flex, _super);

    function Flex() {
      return Flex.__super__.constructor.apply(this, arguments);
    }

    Flex.names = ['flex-grow', 'flex-positive'];

    Flex.prototype.normalize = function() {
      return 'flex';
    };

    Flex.prototype.prefixed = function(prop, prefix) {
      var spec, _ref;
      _ref = flexSpec(prefix), spec = _ref[0], prefix = _ref[1];
      if (spec === 2009) {
        return prefix + 'box-flex';
      } else if (spec === 2012) {
        return prefix + 'flex-positive';
      } else {
        return Flex.__super__.prefixed.apply(this, arguments);
      }
    };

    return Flex;

  })(Declaration);

  module.exports = Flex;

}).call(this);

},{"../declaration":16,"./flex-spec":32}],31:[function(require,module,exports){
(function() {
  var Declaration, FlexShrink, flexSpec,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  flexSpec = require('./flex-spec');

  Declaration = require('../declaration');

  FlexShrink = (function(_super) {
    __extends(FlexShrink, _super);

    function FlexShrink() {
      return FlexShrink.__super__.constructor.apply(this, arguments);
    }

    FlexShrink.names = ['flex-shrink', 'flex-negative'];

    FlexShrink.prototype.normalize = function() {
      return 'flex-shrink';
    };

    FlexShrink.prototype.prefixed = function(prop, prefix) {
      var spec, _ref;
      _ref = flexSpec(prefix), spec = _ref[0], prefix = _ref[1];
      if (spec === 2012) {
        return prefix + 'flex-negative';
      } else {
        return FlexShrink.__super__.prefixed.apply(this, arguments);
      }
    };

    FlexShrink.prototype.set = function(decl, prefix) {
      var spec, _ref;
      _ref = flexSpec(prefix), spec = _ref[0], prefix = _ref[1];
      if (spec === 2012 || spec === 'final') {
        return FlexShrink.__super__.set.apply(this, arguments);
      }
    };

    return FlexShrink;

  })(Declaration);

  module.exports = FlexShrink;

}).call(this);

},{"../declaration":16,"./flex-spec":32}],32:[function(require,module,exports){
(function() {
  module.exports = function(prefix) {
    var spec;
    spec = prefix === '-webkit- 2009' || prefix === '-moz-' ? 2009 : prefix === '-ms-' ? 2012 : prefix === '-webkit-' ? 'final' : void 0;
    if (prefix === '-webkit- 2009') {
      prefix = '-webkit-';
    }
    return [spec, prefix];
  };

}).call(this);

},{}],33:[function(require,module,exports){
(function() {
  var Declaration, FlexWrap, flexSpec,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  flexSpec = require('./flex-spec');

  Declaration = require('../declaration');

  FlexWrap = (function(_super) {
    __extends(FlexWrap, _super);

    function FlexWrap() {
      return FlexWrap.__super__.constructor.apply(this, arguments);
    }

    FlexWrap.names = ['flex-wrap'];

    FlexWrap.prototype.set = function(decl, prefix) {
      var spec;
      spec = flexSpec(prefix)[0];
      if (spec !== 2009) {
        return FlexWrap.__super__.set.apply(this, arguments);
      }
    };

    return FlexWrap;

  })(Declaration);

  module.exports = FlexWrap;

}).call(this);

},{"../declaration":16,"./flex-spec":32}],34:[function(require,module,exports){
(function() {
  var Declaration, Flex, flexSpec,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  flexSpec = require('./flex-spec');

  Declaration = require('../declaration');

  Flex = (function(_super) {
    __extends(Flex, _super);

    function Flex() {
      return Flex.__super__.constructor.apply(this, arguments);
    }

    Flex.names = ['flex', 'box-flex'];

    Flex.oldValues = {
      'auto': '1',
      'none': '0'
    };

    Flex.prototype.prefixed = function(prop, prefix) {
      var spec, _ref;
      _ref = flexSpec(prefix), spec = _ref[0], prefix = _ref[1];
      if (spec === 2009) {
        return prefix + 'box-flex';
      } else {
        return Flex.__super__.prefixed.apply(this, arguments);
      }
    };

    Flex.prototype.normalize = function() {
      return 'flex';
    };

    Flex.prototype.set = function(decl, prefix) {
      var spec;
      spec = flexSpec(prefix)[0];
      if (spec === 2009) {
        decl.value = decl.value.split(' ')[0];
        decl.value = Flex.oldValues[decl.value] || decl.value;
        return Flex.__super__.set.call(this, decl, prefix);
      } else {
        return Flex.__super__.set.apply(this, arguments);
      }
    };

    return Flex;

  })(Declaration);

  module.exports = Flex;

}).call(this);

},{"../declaration":16,"./flex-spec":32}],35:[function(require,module,exports){
(function() {
  var Fullscreen, Selector,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  Selector = require('../selector');

  Fullscreen = (function(_super) {
    __extends(Fullscreen, _super);

    function Fullscreen() {
      return Fullscreen.__super__.constructor.apply(this, arguments);
    }

    Fullscreen.names = [':fullscreen'];

    Fullscreen.prototype.prefixed = function(prefix) {
      if ('-webkit-' === prefix) {
        return ':-webkit-full-screen';
      } else if ('-moz-' === prefix) {
        return ':-moz-full-screen';
      } else {
        return ":" + prefix + "fullscreen";
      }
    };

    return Fullscreen;

  })(Selector);

  module.exports = Fullscreen;

}).call(this);

},{"../selector":50}],36:[function(require,module,exports){
(function() {
  var Gradient, OldValue, Value, isDirection, list, utils,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  OldValue = require('../old-value');

  Value = require('../value');

  utils = require('../utils');

  list = require('postcss/lib/list');

  isDirection = /top|left|right|bottom/gi;

  Gradient = (function(_super) {
    __extends(Gradient, _super);

    function Gradient() {
      return Gradient.__super__.constructor.apply(this, arguments);
    }

    Gradient.names = ['linear-gradient', 'repeating-linear-gradient', 'radial-gradient', 'repeating-radial-gradient'];

    Gradient.prototype.replace = function(string, prefix) {
      return list.space(string).map((function(_this) {
        return function(value) {
          var after, args, close, params;
          if (value.slice(0, +_this.name.length + 1 || 9e9) !== _this.name + '(') {
            return value;
          }
          close = value.lastIndexOf(')');
          after = value.slice(close + 1);
          args = value.slice(_this.name.length + 1, +(close - 1) + 1 || 9e9);
          params = list.comma(args);
          params = _this.newDirection(params);
          if (prefix === '-webkit- old') {
            return _this.oldWebkit(value, args, params, after);
          } else {
            _this.convertDirection(params);
            return prefix + _this.name + '(' + params.join(', ') + ')' + after;
          }
        };
      })(this)).join(' ');
    };

    Gradient.prototype.directions = {
      top: 'bottom',
      left: 'right',
      bottom: 'top',
      right: 'left'
    };

    Gradient.prototype.oldDirections = {
      'top': 'left bottom, left top',
      'left': 'right top, left top',
      'bottom': 'left top, left bottom',
      'right': 'left top, right top',
      'top right': 'left bottom, right top',
      'top left': 'right bottom, left top',
      'right top': 'left bottom, right top',
      'right bottom': 'left top, right bottom',
      'bottom right': 'left top, right bottom',
      'bottom left': 'right top, left bottom',
      'left top': 'right bottom, left top',
      'left bottom': 'right top, left bottom'
    };

    Gradient.prototype.newDirection = function(params) {
      var first, value;
      first = params[0];
      if (first.indexOf('to ') === -1 && isDirection.test(first)) {
        first = first.split(' ');
        first = (function() {
          var _i, _len, _results;
          _results = [];
          for (_i = 0, _len = first.length; _i < _len; _i++) {
            value = first[_i];
            _results.push(this.directions[value.toLowerCase()] || value);
          }
          return _results;
        }).call(this);
        params[0] = 'to ' + first.join(' ');
      }
      return params;
    };

    Gradient.prototype.oldWebkit = function(value, args, params, after) {
      if (this.name !== 'linear-gradient') {
        return value;
      }
      if (params[0] && params[0].indexOf('deg') !== -1) {
        return value;
      }
      if (args.indexOf('-corner') !== -1) {
        return value;
      }
      if (args.indexOf('-side') !== -1) {
        return value;
      }
      params = this.oldDirection(params);
      params = this.colorStops(params);
      return '-webkit-gradient(linear, ' + params.join(', ') + ')' + after;
    };

    Gradient.prototype.convertDirection = function(params) {
      if (params.length > 0) {
        if (params[0].slice(0, 3) === 'to ') {
          return params[0] = this.fixDirection(params[0]);
        } else if (params[0].indexOf('deg') !== -1) {
          return params[0] = this.fixAngle(params[0]);
        } else if (params[0].indexOf(' at ') !== -1) {
          return this.fixRadial(params);
        }
      }
    };

    Gradient.prototype.fixDirection = function(param) {
      var value;
      param = param.split(' ');
      param.splice(0, 1);
      param = (function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = param.length; _i < _len; _i++) {
          value = param[_i];
          _results.push(this.directions[value.toLowerCase()] || value);
        }
        return _results;
      }).call(this);
      return param.join(' ');
    };

    Gradient.prototype.roundFloat = function(float, digits) {
      return parseFloat(float.toFixed(digits));
    };

    Gradient.prototype.fixAngle = function(param) {
      param = parseFloat(param);
      param = Math.abs(450 - param) % 360;
      param = this.roundFloat(param, 3);
      return "" + param + "deg";
    };

    Gradient.prototype.oldDirection = function(params) {
      var direction;
      if (params.length === 0) {
        params;
      }
      if (params[0].indexOf('to ') !== -1) {
        direction = params[0].replace(/^to\s+/, '');
        direction = this.oldDirections[direction];
        params[0] = direction;
        return params;
      } else {
        direction = this.oldDirections.bottom;
        return [direction].concat(params);
      }
    };

    Gradient.prototype.colorStops = function(params) {
      return params.map(function(param, i) {
        var color, match, position, _ref;
        if (i === 0) {
          return param;
        }
        _ref = list.space(param), color = _ref[0], position = _ref[1];
        if (position == null) {
          match = param.match(/^(.*\))(\d.*)$/);
          if (match) {
            color = match[1];
            position = match[2];
          }
        }
        if (position && position.indexOf(')') !== -1) {
          color += ' ' + position;
          position = void 0;
        }
        if (i === 1 && (position === void 0 || position === '0%')) {
          return "from(" + color + ")";
        } else if (i === params.length - 1 && (position === void 0 || position === '100%')) {
          return "to(" + color + ")";
        } else if (position) {
          return "color-stop(" + position + ", " + color + ")";
        } else {
          return "color-stop(" + color + ")";
        }
      });
    };

    Gradient.prototype.fixRadial = function(params) {
      var first;
      first = params[0].split(/\s+at\s+/);
      return params.splice(0, 1, first[1], first[0]);
    };

    Gradient.prototype.old = function(prefix) {
      var regexp, string, type;
      if (prefix === '-webkit-') {
        type = this.name === 'linear-gradient' ? 'linear' : 'radial';
        string = '-gradient';
        regexp = utils.regexp("-webkit-(" + type + "-gradient|gradient\\(\\s*" + type + ")", false);
        return new OldValue(prefix + this.name, string, regexp);
      } else {
        return Gradient.__super__.old.apply(this, arguments);
      }
    };

    return Gradient;

  })(Value);

  module.exports = Gradient;

}).call(this);

},{"../old-value":46,"../utils":52,"../value":53,"postcss/lib/list":125}],37:[function(require,module,exports){
(function() {
  var Declaration, JustifyContent, flexSpec,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  flexSpec = require('./flex-spec');

  Declaration = require('../declaration');

  JustifyContent = (function(_super) {
    __extends(JustifyContent, _super);

    function JustifyContent() {
      return JustifyContent.__super__.constructor.apply(this, arguments);
    }

    JustifyContent.names = ['justify-content', 'flex-pack', 'box-pack'];

    JustifyContent.oldValues = {
      'flex-end': 'end',
      'flex-start': 'start',
      'space-between': 'justify',
      'space-around': 'distribute'
    };

    JustifyContent.prototype.prefixed = function(prop, prefix) {
      var spec, _ref;
      _ref = flexSpec(prefix), spec = _ref[0], prefix = _ref[1];
      if (spec === 2009) {
        return prefix + 'box-pack';
      } else if (spec === 2012) {
        return prefix + 'flex-pack';
      } else {
        return JustifyContent.__super__.prefixed.apply(this, arguments);
      }
    };

    JustifyContent.prototype.normalize = function(prop) {
      return 'justify-content';
    };

    JustifyContent.prototype.set = function(decl, prefix) {
      var spec, value;
      spec = flexSpec(prefix)[0];
      if (spec === 2009 || spec === 2012) {
        value = JustifyContent.oldValues[decl.value] || decl.value;
        decl.value = value;
        if (spec !== 2009 || value !== 'distribute') {
          return JustifyContent.__super__.set.call(this, decl, prefix);
        }
      } else if (spec === 'final') {
        return JustifyContent.__super__.set.apply(this, arguments);
      }
    };

    return JustifyContent;

  })(Declaration);

  module.exports = JustifyContent;

}).call(this);

},{"../declaration":16,"./flex-spec":32}],38:[function(require,module,exports){
(function() {
  var Declaration, Order, flexSpec,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  flexSpec = require('./flex-spec');

  Declaration = require('../declaration');

  Order = (function(_super) {
    __extends(Order, _super);

    function Order() {
      return Order.__super__.constructor.apply(this, arguments);
    }

    Order.names = ['order', 'flex-order', 'box-ordinal-group'];

    Order.prototype.prefixed = function(prop, prefix) {
      var spec, _ref;
      _ref = flexSpec(prefix), spec = _ref[0], prefix = _ref[1];
      if (spec === 2009) {
        return prefix + 'box-ordinal-group';
      } else if (spec === 2012) {
        return prefix + 'flex-order';
      } else {
        return Order.__super__.prefixed.apply(this, arguments);
      }
    };

    Order.prototype.normalize = function(prop) {
      return 'order';
    };

    Order.prototype.set = function(decl, prefix) {
      var spec;
      spec = flexSpec(prefix)[0];
      if (spec === 2009) {
        decl.value = (parseInt(decl.value) + 1).toString();
        return Order.__super__.set.call(this, decl, prefix);
      } else {
        return Order.__super__.set.apply(this, arguments);
      }
    };

    return Order;

  })(Declaration);

  module.exports = Order;

}).call(this);

},{"../declaration":16,"./flex-spec":32}],39:[function(require,module,exports){
(function() {
  var Placeholder, Selector,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  Selector = require('../selector');

  Placeholder = (function(_super) {
    __extends(Placeholder, _super);

    function Placeholder() {
      return Placeholder.__super__.constructor.apply(this, arguments);
    }

    Placeholder.names = ['::placeholder'];

    Placeholder.prototype.possible = function() {
      return Placeholder.__super__.possible.apply(this, arguments).concat('-moz- old');
    };

    Placeholder.prototype.prefixed = function(prefix) {
      if ('-webkit-' === prefix) {
        return '::-webkit-input-placeholder';
      } else if ('-ms-' === prefix) {
        return ':-ms-input-placeholder';
      } else if ('-moz- old' === prefix) {
        return ':-moz-placeholder';
      } else {
        return "::" + prefix + "placeholder";
      }
    };

    return Placeholder;

  })(Selector);

  module.exports = Placeholder;

}).call(this);

},{"../selector":50}],40:[function(require,module,exports){
(function() {
  var Declaration, TransformDecl,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  Declaration = require('../declaration');

  TransformDecl = (function(_super) {
    __extends(TransformDecl, _super);

    function TransformDecl() {
      return TransformDecl.__super__.constructor.apply(this, arguments);
    }

    TransformDecl.names = ['transform', 'transform-origin'];

    TransformDecl.functions3d = ['matrix3d', 'translate3d', 'translateZ', 'scale3d', 'scaleZ', 'rotate3d', 'rotateX', 'rotateY', 'rotateZ', 'perspective'];

    TransformDecl.prototype.keykrameParents = function(decl) {
      var parent;
      parent = decl.parent;
      while (parent) {
        if (parent.type === 'atrule' && parent.name === 'keyframes') {
          return true;
        }
        parent = parent.parent;
      }
      return false;
    };

    TransformDecl.prototype.contain3d = function(decl) {
      var func, _i, _len, _ref;
      if (decl.prop === 'transform-origin') {
        return false;
      }
      _ref = TransformDecl.functions3d;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        func = _ref[_i];
        if (decl.value.indexOf("" + func + "(") !== -1) {
          return true;
        }
      }
      return false;
    };

    TransformDecl.prototype.insert = function(decl, prefix, prefixes) {
      if (prefix === '-ms-') {
        if (!this.contain3d(decl) && !this.keykrameParents(decl)) {
          return TransformDecl.__super__.insert.apply(this, arguments);
        }
      } else if (prefix === '-o-') {
        if (!this.contain3d(decl)) {
          return TransformDecl.__super__.insert.apply(this, arguments);
        }
      } else {
        return TransformDecl.__super__.insert.apply(this, arguments);
      }
    };

    return TransformDecl;

  })(Declaration);

  module.exports = TransformDecl;

}).call(this);

},{"../declaration":16}],41:[function(require,module,exports){
(function() {
  var TransformValue, Value,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  Value = require('../value');

  TransformValue = (function(_super) {
    __extends(TransformValue, _super);

    function TransformValue() {
      return TransformValue.__super__.constructor.apply(this, arguments);
    }

    TransformValue.names = ['transform'];

    TransformValue.prototype.replace = function(value, prefix) {
      if (prefix === '-ms-') {
        return value;
      } else {
        return TransformValue.__super__.replace.apply(this, arguments);
      }
    };

    return TransformValue;

  })(Value);

  module.exports = TransformValue;

}).call(this);

},{"../value":53}],42:[function(require,module,exports){
(function() {
  var OldValue, Transition, Value,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  OldValue = require('../old-value');

  Value = require('../value');

  Transition = (function(_super) {
    __extends(Transition, _super);

    function Transition() {
      return Transition.__super__.constructor.apply(this, arguments);
    }

    Transition.names = ['flex', 'flex-grow', 'flex-shrink', 'flex-basis'];

    Transition.prototype.prefixed = function(prefix) {
      return this.all.prefixed(this.name, prefix);
    };

    Transition.prototype.replace = function(string, prefix) {
      return string.replace(this.regexp(), '$1' + this.prefixed(prefix) + '$3');
    };

    Transition.prototype.old = function(prefix) {
      return new OldValue(this.prefixed(prefix));
    };

    return Transition;

  })(Value);

  module.exports = Transition;

}).call(this);

},{"../old-value":46,"../value":53}],43:[function(require,module,exports){
(function() {
  var capitalize, names, prefix;

  capitalize = function(str) {
    return str.slice(0, 1).toUpperCase() + str.slice(1);
  };

  names = {
    ie: 'IE',
    ie_mob: 'IE Mobile',
    ios_saf: 'iOS',
    op_mini: 'Opera Mini',
    op_mob: 'Opera Mobile',
    and_chr: 'Chrome for Android',
    and_ff: 'Firefox for Android'
  };

  prefix = function(name, transition, prefixes) {
    var out;
    out = '  ' + name + (transition ? '*' : '') + ': ';
    out += prefixes.map(function(i) {
      return i.replace(/^-(.*)-$/g, '$1');
    }).join(', ');
    out += "\n";
    return out;
  };

  module.exports = function(prefixes) {
    var atrules, browser, data, list, name, needTransition, out, props, selector, selectors, string, transitionProp, useTransition, value, values, version, versions, _i, _j, _k, _len, _len1, _len2, _ref, _ref1, _ref2, _ref3, _ref4, _ref5, _ref6;
    if (prefixes.browsers.selected.length === 0) {
      return "No browsers selected";
    }
    versions = [];
    _ref = prefixes.browsers.selected;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      browser = _ref[_i];
      _ref1 = browser.split(' '), name = _ref1[0], version = _ref1[1];
      name = names[name] || capitalize(name);
      if (versions[name]) {
        versions[name].push(version);
      } else {
        versions[name] = [version];
      }
    }
    out = "Browsers:\n";
    for (browser in versions) {
      list = versions[browser];
      list = list.sort(function(a, b) {
        return parseFloat(b) - parseFloat(a);
      });
      out += '  ' + browser + ': ' + list.join(', ') + "\n";
    }
    atrules = '';
    _ref2 = prefixes.add;
    for (name in _ref2) {
      data = _ref2[name];
      if (name[0] === '@' && data.prefixes) {
        atrules += prefix(name, false, data.prefixes);
      }
    }
    if (atrules !== '') {
      out += "\nAt-Rules:\n" + atrules;
    }
    selectors = '';
    _ref3 = prefixes.add.selectors;
    for (_j = 0, _len1 = _ref3.length; _j < _len1; _j++) {
      selector = _ref3[_j];
      if (selector.prefixes) {
        selectors += prefix(selector.name, false, selector.prefixes);
      }
    }
    if (selectors !== '') {
      out += "\nSelectors:\n" + selectors;
    }
    values = '';
    props = '';
    useTransition = false;
    needTransition = (_ref4 = prefixes.add.transition) != null ? _ref4.prefixes : void 0;
    _ref5 = prefixes.add;
    for (name in _ref5) {
      data = _ref5[name];
      if (name[0] !== '@' && data.prefixes) {
        transitionProp = needTransition && prefixes.data[name].transition;
        if (transitionProp) {
          useTransition = true;
        }
        props += prefix(name, transitionProp, data.prefixes);
      }
      if (!data.values) {
        continue;
      }
      if (prefixes.transitionProps.some(function(i) {
        return i === name;
      })) {
        continue;
      }
      _ref6 = data.values;
      for (_k = 0, _len2 = _ref6.length; _k < _len2; _k++) {
        value = _ref6[_k];
        string = prefix(value.name, false, value.prefixes);
        if (values.indexOf(string) === -1) {
          values += string;
        }
      }
    }
    if (useTransition) {
      props += "  * - can be used in transition\n";
    }
    if (props !== '') {
      out += "\nProperties:\n" + props;
    }
    if (values !== '') {
      out += "\nValues:\n" + values;
    }
    return out;
  };

}).call(this);

},{}],44:[function(require,module,exports){
(function() {
  var Keyframes, Prefixer,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  Prefixer = require('./prefixer');

  Keyframes = (function(_super) {
    __extends(Keyframes, _super);

    function Keyframes() {
      return Keyframes.__super__.constructor.apply(this, arguments);
    }

    Keyframes.prototype.add = function(atRule, prefix) {
      var already, cloned, prefixed;
      prefixed = prefix + atRule.name;
      already = atRule.parent.some(function(i) {
        return i.name === prefixed && i.params === atRule.params;
      });
      if (already) {
        return;
      }
      cloned = this.clone(atRule, {
        name: prefixed
      });
      return atRule.parent.insertBefore(atRule, cloned);
    };

    Keyframes.prototype.process = function(node) {
      var parent, prefix, _i, _len, _ref, _results;
      parent = this.parentPrefix(node);
      _ref = this.prefixes;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        prefix = _ref[_i];
        if (parent && parent !== prefix) {
          continue;
        }
        _results.push(this.add(node, prefix));
      }
      return _results;
    };

    return Keyframes;

  })(Prefixer);

  module.exports = Keyframes;

}).call(this);

},{"./prefixer":47}],45:[function(require,module,exports){
(function() {
  var OldSelector;

  OldSelector = (function() {
    function OldSelector(selector, prefix) {
      var _i, _len, _ref;
      this.prefix = prefix;
      this.prefixed = selector.prefixed(this.prefix);
      this.regexp = selector.regexp(this.prefix);
      this.prefixeds = [];
      _ref = selector.possible();
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        prefix = _ref[_i];
        this.prefixeds.push([selector.prefixed(prefix), selector.regexp(prefix)]);
      }
      this.unprefixed = selector.name;
      this.nameRegexp = selector.regexp();
    }

    OldSelector.prototype.isHack = function(rule) {
      var before, index, regexp, rules, some, string, _i, _len, _ref, _ref1;
      index = rule.parent.index(rule) + 1;
      rules = rule.parent.rules;
      while (index < rules.length) {
        before = rules[index].selector;
        if (!before) {
          return true;
        }
        if (before.indexOf(this.unprefixed) !== -1 && before.match(this.nameRegexp)) {
          return false;
        }
        some = false;
        _ref = this.prefixeds;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          _ref1 = _ref[_i], string = _ref1[0], regexp = _ref1[1];
          if (before.indexOf(string) !== -1 && before.match(regexp)) {
            some = true;
            break;
          }
        }
        if (!some) {
          return true;
        }
        index += 1;
      }
      return true;
    };

    OldSelector.prototype.check = function(rule) {
      if (rule.selector.indexOf(this.prefixed) === -1) {
        return false;
      }
      if (!rule.selector.match(this.regexp)) {
        return false;
      }
      if (this.isHack(rule)) {
        return false;
      }
      return true;
    };

    return OldSelector;

  })();

  module.exports = OldSelector;

}).call(this);

},{}],46:[function(require,module,exports){
(function() {
  var OldValue, utils;

  utils = require('./utils');

  OldValue = (function() {
    function OldValue(name, string, regexp) {
      this.name = name;
      this.string = string;
      this.regexp = regexp;
      this.regexp || (this.regexp = utils.regexp(this.name));
      this.string || (this.string = this.name);
    }

    OldValue.prototype.check = function(value) {
      if (value.indexOf(this.string) !== -1) {
        return !!value.match(this.regexp);
      } else {
        return false;
      }
    };

    return OldValue;

  })();

  module.exports = OldValue;

}).call(this);

},{"./utils":52}],47:[function(require,module,exports){
(function() {
  var Browsers, Prefixer, utils, vendor;

  Browsers = require('./browsers');

  vendor = require('postcss/lib/vendor');

  utils = require('./utils');

  Prefixer = (function() {
    Prefixer.hack = function(klass) {
      var name, _i, _len, _ref, _results;
      this.hacks || (this.hacks = {});
      _ref = klass.names;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        name = _ref[_i];
        _results.push(this.hacks[name] = klass);
      }
      return _results;
    };

    Prefixer.load = function(name, prefixes, all) {
      var klass, _ref;
      klass = (_ref = this.hacks) != null ? _ref[name] : void 0;
      if (klass) {
        return new klass(name, prefixes, all);
      } else {
        return new this(name, prefixes, all);
      }
    };

    Prefixer.clone = function(node, overrides) {
      var cloned;
      cloned = node.clone(overrides);
      if (node.type === 'decl') {
        cloned.between = node.between;
      }
      delete cloned._autoprefixerPrefix;
      delete cloned._autoprefixerValues;
      return cloned;
    };

    function Prefixer(name, prefixes, all) {
      this.name = name;
      this.prefixes = prefixes;
      this.all = all;
    }

    Prefixer.prototype.parentPrefix = function(node) {
      var prefix;
      prefix = node._autoprefixerPrefix != null ? node._autoprefixerPrefix : node.type === 'decl' && node.prop[0] === '-' ? vendor.prefix(node.prop) : node.type === 'root' ? false : node.type === 'rule' && node.selector.indexOf(':-') !== -1 ? node.selector.match(/:(-\w+-)/)[1] : node.type === 'atrule' && node.name[0] === '-' ? vendor.prefix(node.name) : this.parentPrefix(node.parent);
      if (Browsers.prefixes().indexOf(prefix) === -1) {
        prefix = false;
      }
      return node._autoprefixerPrefix = prefix;
    };

    Prefixer.prototype.process = function(node) {
      var added, parent, prefix, prefixes, _i, _j, _len, _len1, _ref;
      if (!this.check(node)) {
        return;
      }
      parent = this.parentPrefix(node);
      prefixes = [];
      _ref = this.prefixes;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        prefix = _ref[_i];
        if (parent && parent !== utils.removeNote(prefix)) {
          continue;
        }
        prefixes.push(prefix);
      }
      added = [];
      for (_j = 0, _len1 = prefixes.length; _j < _len1; _j++) {
        prefix = prefixes[_j];
        if (this.add(node, prefix, added.concat([prefix]))) {
          added.push(prefix);
        }
      }
      return added;
    };

    Prefixer.prototype.clone = function(node, overrides) {
      return Prefixer.clone(node, overrides);
    };

    return Prefixer;

  })();

  module.exports = Prefixer;

}).call(this);

},{"./browsers":15,"./utils":52,"postcss/lib/vendor":136}],48:[function(require,module,exports){
(function() {
  var Browsers, Declaration, Keyframes, Prefixes, Processor, Selector, Supports, Value, declsCache, utils, vendor;

  utils = require('./utils');

  vendor = require('postcss/lib/vendor');

  Declaration = require('./declaration');

  Processor = require('./processor');

  Keyframes = require('./keyframes');

  Supports = require('./supports');

  Browsers = require('./browsers');

  Selector = require('./selector');

  Value = require('./value');

  Selector.hack(require('./hacks/fullscreen'));

  Selector.hack(require('./hacks/placeholder'));

  Declaration.hack(require('./hacks/flex'));

  Declaration.hack(require('./hacks/order'));

  Declaration.hack(require('./hacks/filter'));

  Declaration.hack(require('./hacks/flex-flow'));

  Declaration.hack(require('./hacks/flex-grow'));

  Declaration.hack(require('./hacks/flex-wrap'));

  Declaration.hack(require('./hacks/align-self'));

  Declaration.hack(require('./hacks/flex-basis'));

  Declaration.hack(require('./hacks/align-items'));

  Declaration.hack(require('./hacks/flex-shrink'));

  Declaration.hack(require('./hacks/break-inside'));

  Declaration.hack(require('./hacks/border-image'));

  Declaration.hack(require('./hacks/align-content'));

  Declaration.hack(require('./hacks/border-radius'));

  Declaration.hack(require('./hacks/transform-decl'));

  Declaration.hack(require('./hacks/flex-direction'));

  Declaration.hack(require('./hacks/justify-content'));

  Declaration.hack(require('./hacks/background-size'));

  Value.hack(require('./hacks/gradient'));

  Value.hack(require('./hacks/transition'));

  Value.hack(require('./hacks/display-flex'));

  Value.hack(require('./hacks/fill-available'));

  Value.hack(require('./hacks/transform-value'));

  declsCache = {};

  Prefixes = (function() {
    function Prefixes(data, browsers, options) {
      var _ref;
      this.data = data;
      this.browsers = browsers;
      this.options = options != null ? options : {};
      _ref = this.preprocess(this.select(this.data)), this.add = _ref[0], this.remove = _ref[1];
      this.processor = new Processor(this);
    }

    Prefixes.prototype.transitionProps = ['transition', 'transition-property'];

    Prefixes.prototype.cleaner = function() {
      var empty;
      if (!this.cleanerCache) {
        if (this.browsers.selected.length) {
          empty = new Browsers(this.browsers.data, []);
          this.cleanerCache = new Prefixes(this.data, empty, this.options);
        } else {
          return this;
        }
      }
      return this.cleanerCache;
    };

    Prefixes.prototype.select = function(list) {
      var add, all, data, name, notes, selected;
      selected = {
        add: {},
        remove: {}
      };
      for (name in list) {
        data = list[name];
        add = data.browsers.map(function(i) {
          var params;
          params = i.split(' ');
          return {
            browser: params[0] + ' ' + params[1],
            note: params[2]
          };
        });
        notes = add.filter(function(i) {
          return i.note;
        }).map((function(_this) {
          return function(i) {
            return _this.browsers.prefix(i.browser) + ' ' + i.note;
          };
        })(this));
        notes = utils.uniq(notes);
        add = add.filter((function(_this) {
          return function(i) {
            return _this.browsers.isSelected(i.browser);
          };
        })(this)).map((function(_this) {
          return function(i) {
            var prefix;
            prefix = _this.browsers.prefix(i.browser);
            if (i.note) {
              return prefix + ' ' + i.note;
            } else {
              return prefix;
            }
          };
        })(this));
        add = this.sort(utils.uniq(add));
        all = data.browsers.map((function(_this) {
          return function(i) {
            return _this.browsers.prefix(i);
          };
        })(this));
        if (data.mistakes) {
          all = all.concat(data.mistakes);
        }
        all = all.concat(notes);
        all = utils.uniq(all);
        if (add.length) {
          selected.add[name] = add;
          if (add.length < all.length) {
            selected.remove[name] = all.filter(function(i) {
              return add.indexOf(i) === -1;
            });
          }
        } else {
          selected.remove[name] = all;
        }
      }
      return selected;
    };

    Prefixes.prototype.sort = function(prefixes) {
      return prefixes.sort(function(a, b) {
        var aLength, bLength;
        aLength = utils.removeNote(a).length;
        bLength = utils.removeNote(b).length;
        if (aLength === bLength) {
          return b.length - a.length;
        } else {
          return bLength - aLength;
        }
      });
    };

    Prefixes.prototype.preprocess = function(selected) {
      var add, name, old, olds, prefix, prefixed, prefixes, prop, props, remove, selector, value, values, _i, _j, _k, _l, _len, _len1, _len2, _len3, _len4, _len5, _len6, _m, _n, _o, _ref, _ref1, _ref2;
      add = {
        selectors: [],
        '@supports': new Supports(this)
      };
      _ref = selected.add;
      for (name in _ref) {
        prefixes = _ref[name];
        if (name === '@keyframes') {
          add[name] = new Keyframes(name, prefixes, this);
        } else if (this.data[name].selector) {
          add.selectors.push(Selector.load(name, prefixes, this));
        } else {
          props = this.data[name].transition ? this.transitionProps : this.data[name].props;
          if (props) {
            value = Value.load(name, prefixes, this);
            for (_i = 0, _len = props.length; _i < _len; _i++) {
              prop = props[_i];
              if (!add[prop]) {
                add[prop] = {
                  values: []
                };
              }
              add[prop].values.push(value);
            }
          }
          if (!this.data[name].props) {
            values = ((_ref1 = add[name]) != null ? _ref1.values : void 0) || [];
            add[name] = Declaration.load(name, prefixes, this);
            add[name].values = values;
          }
        }
      }
      remove = {
        selectors: []
      };
      _ref2 = selected.remove;
      for (name in _ref2) {
        prefixes = _ref2[name];
        if (this.data[name].selector) {
          selector = Selector.load(name, prefixes);
          for (_j = 0, _len1 = prefixes.length; _j < _len1; _j++) {
            prefix = prefixes[_j];
            remove.selectors.push(selector.old(prefix));
          }
        } else if (name[0] === '@') {
          for (_k = 0, _len2 = prefixes.length; _k < _len2; _k++) {
            prefix = prefixes[_k];
            prefixed = '@' + prefix + name.slice(1);
            remove[prefixed] = {
              remove: true
            };
          }
        } else {
          props = this.data[name].transition ? this.transitionProps : this.data[name].props;
          if (props) {
            value = Value.load(name, [], this);
            for (_l = 0, _len3 = prefixes.length; _l < _len3; _l++) {
              prefix = prefixes[_l];
              old = value.old(prefix);
              if (old) {
                for (_m = 0, _len4 = props.length; _m < _len4; _m++) {
                  prop = props[_m];
                  if (!remove[prop]) {
                    remove[prop] = {};
                  }
                  if (!remove[prop].values) {
                    remove[prop].values = [];
                  }
                  remove[prop].values.push(old);
                }
              }
            }
          }
          if (!this.data[name].props) {
            for (_n = 0, _len5 = prefixes.length; _n < _len5; _n++) {
              prefix = prefixes[_n];
              prop = vendor.unprefixed(name);
              olds = this.decl(name).old(name, prefix);
              for (_o = 0, _len6 = olds.length; _o < _len6; _o++) {
                prefixed = olds[_o];
                if (!remove[prefixed]) {
                  remove[prefixed] = {};
                }
                remove[prefixed].remove = true;
              }
            }
          }
        }
      }
      return [add, remove];
    };

    Prefixes.prototype.decl = function(prop) {
      var decl;
      decl = declsCache[prop];
      if (decl) {
        return decl;
      } else {
        return declsCache[prop] = Declaration.load(prop);
      }
    };

    Prefixes.prototype.unprefixed = function(prop) {
      prop = vendor.unprefixed(prop);
      return this.decl(prop).normalize(prop);
    };

    Prefixes.prototype.prefixed = function(prop, prefix) {
      prop = vendor.unprefixed(prop);
      return this.decl(prop).prefixed(prop, prefix);
    };

    Prefixes.prototype.values = function(type, prop) {
      var data, global, values, _ref, _ref1;
      data = this[type];
      global = (_ref = data['*']) != null ? _ref.values : void 0;
      values = (_ref1 = data[prop]) != null ? _ref1.values : void 0;
      if (global && values) {
        return utils.uniq(global.concat(values));
      } else {
        return global || values || [];
      }
    };

    Prefixes.prototype.group = function(decl) {
      var checker, index, length, rule, unprefixed;
      rule = decl.parent;
      index = rule.index(decl);
      length = rule.decls.length;
      unprefixed = this.unprefixed(decl.prop);
      checker = (function(_this) {
        return function(step, callback) {
          var other;
          index += step;
          while (index >= 0 && index < length) {
            other = rule.decls[index];
            if (other.type === 'decl') {
              if (step === -1 && other.prop === unprefixed) {
                if (!Browsers.withPrefix(other.value)) {
                  break;
                }
              }
              if (_this.unprefixed(other.prop) !== unprefixed) {
                break;
              } else if (callback(other) === true) {
                return true;
              }
              if (step === +1 && other.prop === unprefixed) {
                if (!Browsers.withPrefix(other.value)) {
                  break;
                }
              }
            }
            index += step;
          }
          return false;
        };
      })(this);
      return {
        up: function(callback) {
          return checker(-1, callback);
        },
        down: function(callback) {
          return checker(+1, callback);
        }
      };
    };

    return Prefixes;

  })();

  module.exports = Prefixes;

}).call(this);

},{"./browsers":15,"./declaration":16,"./hacks/align-content":17,"./hacks/align-items":18,"./hacks/align-self":19,"./hacks/background-size":20,"./hacks/border-image":21,"./hacks/border-radius":22,"./hacks/break-inside":23,"./hacks/display-flex":24,"./hacks/fill-available":25,"./hacks/filter":26,"./hacks/flex":34,"./hacks/flex-basis":27,"./hacks/flex-direction":28,"./hacks/flex-flow":29,"./hacks/flex-grow":30,"./hacks/flex-shrink":31,"./hacks/flex-wrap":33,"./hacks/fullscreen":35,"./hacks/gradient":36,"./hacks/justify-content":37,"./hacks/order":38,"./hacks/placeholder":39,"./hacks/transform-decl":40,"./hacks/transform-value":41,"./hacks/transition":42,"./keyframes":44,"./processor":49,"./selector":50,"./supports":51,"./utils":52,"./value":53,"postcss/lib/vendor":136}],49:[function(require,module,exports){
(function() {
  var Processor, Value, utils, vendor;

  vendor = require('postcss/lib/vendor');

  Value = require('./value');

  utils = require('./utils');

  Processor = (function() {
    function Processor(prefixes) {
      this.prefixes = prefixes;
    }

    Processor.prototype.add = function(css) {
      var keyframes, selector, supports, _i, _len, _ref;
      keyframes = this.prefixes.add['@keyframes'];
      supports = this.prefixes.add['@supports'];
      css.eachAtRule(function(rule) {
        if (rule.name === 'keyframes') {
          return keyframes != null ? keyframes.process(rule) : void 0;
        } else if (rule.name === 'supports') {
          return supports.process(rule);
        }
      });
      _ref = this.prefixes.add.selectors;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        selector = _ref[_i];
        css.eachRule(function(rule) {
          return selector.process(rule);
        });
      }
      css.eachDecl((function(_this) {
        return function(decl) {
          var prefix;
          prefix = _this.prefixes.add[decl.prop];
          if (prefix && prefix.prefixes) {
            return prefix.process(decl);
          }
        };
      })(this));
      return css.eachDecl((function(_this) {
        return function(decl) {
          var unprefixed, value, _j, _len1, _ref1;
          unprefixed = _this.prefixes.unprefixed(decl.prop);
          _ref1 = _this.prefixes.values('add', unprefixed);
          for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
            value = _ref1[_j];
            value.process(decl);
          }
          return Value.save(_this.prefixes, decl);
        };
      })(this));
    };

    Processor.prototype.remove = function(css) {
      var checker, _i, _len, _ref;
      css.eachAtRule((function(_this) {
        return function(rule, i) {
          if (_this.prefixes.remove['@' + rule.name]) {
            return rule.parent.remove(i);
          }
        };
      })(this));
      _ref = this.prefixes.remove.selectors;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        checker = _ref[_i];
        css.eachRule((function(_this) {
          return function(rule, i) {
            if (checker.check(rule)) {
              return rule.parent.remove(i);
            }
          };
        })(this));
      }
      return css.eachDecl((function(_this) {
        return function(decl, i) {
          var notHack, rule, unprefixed, _j, _len1, _ref1, _ref2;
          rule = decl.parent;
          unprefixed = _this.prefixes.unprefixed(decl.prop);
          if ((_ref1 = _this.prefixes.remove[decl.prop]) != null ? _ref1.remove : void 0) {
            notHack = _this.prefixes.group(decl).down(function(other) {
              return other.prop === unprefixed;
            });
            if (notHack) {
              if (decl.before.indexOf("\n") > -1) {
                _this.reduceSpaces(decl);
              }
              rule.remove(i);
              return;
            }
          }
          _ref2 = _this.prefixes.values('remove', unprefixed);
          for (_j = 0, _len1 = _ref2.length; _j < _len1; _j++) {
            checker = _ref2[_j];
            if (checker.check(decl.value)) {
              rule.remove(i);
              return;
            }
          }
        };
      })(this));
    };

    Processor.prototype.reduceSpaces = function(decl) {
      var diff, parts, prevMin, stop;
      stop = false;
      this.prefixes.group(decl).up(function(other) {
        return stop = true;
      });
      if (stop) {
        return;
      }
      parts = decl.before.split("\n");
      prevMin = parts[parts.length - 1].length;
      diff = false;
      return this.prefixes.group(decl).down(function(other) {
        var last;
        parts = other.before.split("\n");
        last = parts.length - 1;
        if (parts[last].length > prevMin) {
          if (diff === false) {
            diff = parts[last].length - prevMin;
          }
          parts[last] = parts[last].slice(0, -diff);
          return other.before = parts.join("\n");
        }
      });
    };

    return Processor;

  })();

  module.exports = Processor;

}).call(this);

},{"./utils":52,"./value":53,"postcss/lib/vendor":136}],50:[function(require,module,exports){
(function() {
  var Browsers, OldSelector, Prefixer, Selector, utils,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  OldSelector = require('./old-selector');

  Prefixer = require('./prefixer');

  Browsers = require('./browsers');

  utils = require('./utils');

  Selector = (function(_super) {
    __extends(Selector, _super);

    function Selector(name, prefixes, all) {
      this.name = name;
      this.prefixes = prefixes;
      this.all = all;
      this.regexpCache = {};
    }

    Selector.prototype.check = function(rule) {
      if (rule.selector.indexOf(this.name) !== -1) {
        return !!rule.selector.match(this.regexp());
      } else {
        return false;
      }
    };

    Selector.prototype.prefixed = function(prefix) {
      return this.name.replace(/^([^\w]*)/, '$1' + prefix);
    };

    Selector.prototype.regexp = function(prefix) {
      var name;
      if (this.regexpCache[prefix]) {
        return this.regexpCache[prefix];
      }
      name = prefix ? this.prefixed(prefix) : this.name;
      return this.regexpCache[prefix] = RegExp("(^|[^:\"'=])" + (utils.escapeRegexp(name)), "gi");
    };

    Selector.prototype.possible = function() {
      return Browsers.prefixes();
    };

    Selector.prototype.prefixeds = function(rule) {
      var prefix, prefixeds, _i, _len, _ref;
      if (rule._autoprefixerPrefixeds) {
        return rule._autoprefixerPrefixeds;
      }
      prefixeds = {};
      _ref = this.possible();
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        prefix = _ref[_i];
        prefixeds[prefix] = this.replace(rule.selector, prefix);
      }
      return rule._autoprefixerPrefixeds = prefixeds;
    };

    Selector.prototype.already = function(rule, prefixeds, prefix) {
      var before, index, key, prefixed, some;
      index = rule.parent.index(rule) - 1;
      while (index >= 0) {
        before = rule.parent.rules[index];
        if (before.type !== 'rule') {
          return false;
        }
        some = false;
        for (key in prefixeds) {
          prefixed = prefixeds[key];
          if (before.selector === prefixed) {
            if (prefix === key) {
              return true;
            } else {
              some = true;
              break;
            }
          }
        }
        if (!some) {
          return false;
        }
        index -= 1;
      }
      return false;
    };

    Selector.prototype.replace = function(selector, prefix) {
      return selector.replace(this.regexp(), '$1' + this.prefixed(prefix));
    };

    Selector.prototype.add = function(rule, prefix) {
      var cloned, prefixeds;
      prefixeds = this.prefixeds(rule);
      if (this.already(rule, prefixeds, prefix)) {
        return;
      }
      cloned = this.clone(rule, {
        selector: prefixeds[prefix]
      });
      return rule.parent.insertBefore(rule, cloned);
    };

    Selector.prototype.old = function(prefix) {
      return new OldSelector(this, prefix);
    };

    return Selector;

  })(Prefixer);

  module.exports = Selector;

}).call(this);

},{"./browsers":15,"./old-selector":45,"./prefixer":47,"./utils":52}],51:[function(require,module,exports){
(function() {
  var Prefixes, Supports, Value, findCondition, findDecl, list, postcss, split, utils;

  Prefixes = require('./prefixes');

  Value = require('./value');

  utils = require('./utils');

  postcss = require('postcss');

  list = require('postcss/lib/list');

  split = /\(\s*([^\(\):]+)\s*:([^\)]+)/;

  findDecl = /\(\s*([^\(\):]+)\s*:\s*([^\)]+)\s*\)/g;

  findCondition = /(not\s*)?\(\s*([^\(\):]+)\s*:\s*([^\)]+)\s*\)\s*or\s*/gi;

  Supports = (function() {
    function Supports(all) {
      this.all = all;
    }

    Supports.prototype.virtual = function(prop, value) {
      var rule;
      rule = postcss.parse('a{}').first;
      rule.append({
        prop: prop,
        value: value,
        before: ''
      });
      return rule;
    };

    Supports.prototype.prefixed = function(prop, value) {
      var decl, prefixer, rule, _i, _j, _len, _len1, _ref, _ref1;
      rule = this.virtual(prop, value);
      prefixer = this.all.add[prop];
      if (prefixer != null) {
        if (typeof prefixer.process === "function") {
          prefixer.process(rule.first);
        }
      }
      _ref = rule.decls;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        decl = _ref[_i];
        _ref1 = this.all.values('add', prop);
        for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
          value = _ref1[_j];
          value.process(decl);
        }
        Value.save(this.all, decl);
      }
      return rule.decls;
    };

    Supports.prototype.clean = function(params) {
      return params.replace(findCondition, (function(_this) {
        return function(all) {
          var check, checker, prop, unprefixed, value, _, _i, _len, _ref, _ref1, _ref2;
          if (all.slice(0, 3).toLowerCase() === 'not') {
            return all;
          }
          _ref = all.match(split), _ = _ref[0], prop = _ref[1], value = _ref[2];
          unprefixed = _this.all.unprefixed(prop);
          if ((_ref1 = _this.all.cleaner().remove[prop]) != null ? _ref1.remove : void 0) {
            check = new RegExp('(\\(|\\s)' + utils.escapeRegexp(unprefixed) + ':');
            if (check.test(params)) {
              return '';
            }
          }
          _ref2 = _this.all.cleaner().values('remove', unprefixed);
          for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
            checker = _ref2[_i];
            if (checker.check(value)) {
              return '';
            }
          }
          return all;
        };
      })(this)).replace(/\(\s*\((.*)\)\s*\)/g, '($1)');
    };

    Supports.prototype.process = function(rule) {
      rule.params = this.clean(rule.params);
      return rule.params = rule.params.replace(findDecl, (function(_this) {
        return function(all, prop, value) {
          var i, stringed;
          stringed = (function() {
            var _i, _len, _ref, _results;
            _ref = this.prefixed(prop, value);
            _results = [];
            for (_i = 0, _len = _ref.length; _i < _len; _i++) {
              i = _ref[_i];
              _results.push("(" + i.prop + ": " + i.value + ")");
            }
            return _results;
          }).call(_this);
          if (stringed.length === 1) {
            return stringed[0];
          } else {
            return '(' + stringed.join(' or ') + ')';
          }
        };
      })(this));
    };

    return Supports;

  })();

  module.exports = Supports;

}).call(this);

},{"./prefixes":48,"./utils":52,"./value":53,"postcss":129,"postcss/lib/list":125}],52:[function(require,module,exports){
(function() {
  module.exports = {
    error: function(text) {
      var err;
      err = new Error(text);
      err.autoprefixer = true;
      throw err;
    },
    uniq: function(array) {
      var filtered, i, _i, _len;
      filtered = [];
      for (_i = 0, _len = array.length; _i < _len; _i++) {
        i = array[_i];
        if (filtered.indexOf(i) === -1) {
          filtered.push(i);
        }
      }
      return filtered;
    },
    removeNote: function(string) {
      if (string.indexOf(' ') === -1) {
        return string;
      } else {
        return string.split(' ')[0];
      }
    },
    escapeRegexp: function(string) {
      return string.replace(/[.?*+\^\$\[\]\\(){}|\-]/g, '\\$&');
    },
    regexp: function(word, escape) {
      if (escape == null) {
        escape = true;
      }
      if (escape) {
        word = this.escapeRegexp(word);
      }
      return RegExp("(^|[\\s,(])(" + word + "($|[\\s(,]))", "gi");
    }
  };

}).call(this);

},{}],53:[function(require,module,exports){
(function() {
  var OldValue, Prefixer, Value, utils, vendor,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  Prefixer = require('./prefixer');

  OldValue = require('./old-value');

  utils = require('./utils');

  vendor = require('postcss/lib/vendor');

  Value = (function(_super) {
    __extends(Value, _super);

    function Value() {
      return Value.__super__.constructor.apply(this, arguments);
    }

    Value.save = function(prefixes, decl) {
      var already, cloned, prefix, prefixed, propPrefix, rule, trimmed, value, _ref, _results;
      _ref = decl._autoprefixerValues;
      _results = [];
      for (prefix in _ref) {
        value = _ref[prefix];
        if (value === decl.value) {
          continue;
        }
        propPrefix = vendor.prefix(decl.prop);
        if (propPrefix === prefix) {
          _results.push(decl.value = value);
        } else if (propPrefix === '-pie-') {
          continue;
        } else {
          prefixed = prefixes.prefixed(decl.prop, prefix);
          rule = decl.parent;
          if (rule.every(function(i) {
            return i.prop !== prefixed;
          })) {
            trimmed = value.replace(/\s+/, ' ');
            already = rule.some(function(i) {
              return i.prop === decl.prop && i.value.replace(/\s+/, ' ') === trimmed;
            });
            if (!already) {
              cloned = this.clone(decl, {
                value: value
              });
              _results.push(decl.parent.insertBefore(decl, cloned));
            } else {
              _results.push(void 0);
            }
          } else {
            _results.push(void 0);
          }
        }
      }
      return _results;
    };

    Value.prototype.check = function(decl) {
      var value;
      value = decl.value;
      if (value.indexOf(this.name) !== -1) {
        return !!value.match(this.regexp());
      } else {
        return false;
      }
    };

    Value.prototype.regexp = function() {
      return this.regexpCache || (this.regexpCache = utils.regexp(this.name));
    };

    Value.prototype.replace = function(string, prefix) {
      return string.replace(this.regexp(), '$1' + prefix + '$2');
    };

    Value.prototype.add = function(decl, prefix) {
      var value;
      decl._autoprefixerValues || (decl._autoprefixerValues = {});
      value = decl._autoprefixerValues[prefix] || decl.value;
      value = this.replace(value, prefix);
      if (value) {
        return decl._autoprefixerValues[prefix] = value;
      }
    };

    Value.prototype.old = function(prefix) {
      return new OldValue(prefix + this.name);
    };

    return Value;

  })(Prefixer);

  module.exports = Value;

}).call(this);

},{"./old-value":46,"./prefixer":47,"./utils":52,"postcss/lib/vendor":136}],54:[function(require,module,exports){
module.exports={"eras":{"e-31":"31 versions back","e-30":"30 versions back","e-29":"29 versions back","e-28":"28 versions back","e-27":"27 versions back","e-26":"26 versions back","e-25":"25 versions back","e-24":"24 versions back","e-23":"23 versions back","e-22":"22 versions back","e-21":"21 versions back","e-20":"20 versions back","e-19":"19 versions back","e-18":"18 versions back","e-17":"17 versions back","e-16":"16 versions back","e-15":"15 versions back","e-14":"14 versions back","e-13":"13 versions back","e-12":"12 versions back","e-11":"11 versions back","e-10":"10 versions back","e-9":"9 versions back","e-8":"8 versions back","e-7":"7 versions back","e-6":"6 versions back","e-5":"5 versions back","e-4":"4 versions back","e-3":"3 versions back","e-2":"2 versions back","e-1":"Previous version","e0":"Current","e1":"Near future","e2":"Farther future","e3":"3 versions ahead"},"agents":{"ie":{"browser":"IE","abbr":"IE","prefix":"ms","type":"desktop","usage_global":{"10":2.63025,"11":7.18231,"5.5":0.009298,"6":0.278852,"7":0.135658,"8":4.46163,"9":2.6001},"versions":[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,"5.5","6","7","8","9","10","11",null,null,null],"current_version":""},"firefox":{"browser":"Firefox","abbr":"FF","prefix":"moz","type":"desktop","usage_global":{"10":0.064377,"11":0.057224,"12":0.128754,"13":0.050071,"14":0.050071,"15":0.064377,"16":0.100142,"17":0.078683,"18":0.050071,"19":0.057224,"2":0.007153,"20":0.07153,"21":0.264661,"22":0.092989,"23":0.078683,"24":0.200284,"25":0.092989,"26":0.171672,"27":0.185978,"28":0.307579,"29":6.53784,"3":0.078683,"3.5":0.021459,"3.6":0.14306,"30":4.68521,"31":0.193131,"32":0.014306,"33":0.007153,"4":0.035765,"5":0.021459,"6":0.035765,"7":0.021459,"8":0.050071,"9":0.028612},"versions":[null,"2","3","3.5","3.6","4","5","6","7","8","9","10","11","12","13","14","15","16","17","18","19","20","21","22","23","24","25","26","27","28","29","30","31","32","33"],"current_version":""},"chrome":{"browser":"Chrome","abbr":"Chr.","prefix":"webkit","type":"desktop","usage_global":{"10":0.028612,"11":0.114448,"12":0.042918,"13":0.035765,"14":0.028612,"15":0.035765,"16":0.028612,"17":0.021459,"18":0.057224,"19":0.014306,"20":0.028612,"21":0.393415,"22":0.121601,"23":0.050071,"24":0.050071,"25":0.057224,"26":0.221743,"27":0.536475,"28":0.128754,"29":0.300426,"30":0.193131,"31":0.593699,"32":0.472098,"33":0.844054,"34":1.33761,"35":28.3903,"36":0.114448,"37":0.150213,"38":0,"4":0.021459,"5":0.014306,"6":0.021459,"7":0.014306,"8":0.014306,"9":0.014306},"versions":["4","5","6","7","8","9","10","11","12","13","14","15","16","17","18","19","20","21","22","23","24","25","26","27","28","29","30","31","32","33","34","35","36","37","38"],"current_version":""},"safari":{"browser":"Safari","abbr":"Saf.","prefix":"webkit","type":"desktop","usage_global":{"3.1":0,"3.2":0.008692,"4":0.107295,"5":0.193131,"5.1":0.672382,"6":0.329038,"6.1":0.57224,"7":1.63804,"8":0},"versions":[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,"3.1","3.2","4","5","5.1","6","6.1","7","8",null,null],"current_version":""},"opera":{"browser":"Opera","abbr":"Op.","prefix":"webkit","type":"desktop","usage_global":{"10.0-10.1":0.014306,"10.5":0.008392,"10.6":0.007296,"11":0.014996,"11.1":0.008219,"11.5":0.007296,"11.6":0.014306,"12":0.021459,"12.1":0.321885,"15":0.007153,"16":0.007153,"17":0.007153,"18":0.021459,"19":0.014306,"20":0.064377,"21":0.107295,"22":0.364803,"23":0.007153,"24":0,"9.5-9.6":0.007153},"versions":[null,null,null,null,null,null,null,null,null,null,null,null,null,null,"9.5-9.6","10.0-10.1","10.5","10.6","11","11.1","11.5","11.6","12","12.1","15","16","17","18","19","20","21","22","23","24",null],"current_version":"","prefix_exceptions":{"10.0-10.1":"o","10.5":"o","10.6":"o","11":"o","11.1":"o","11.5":"o","11.6":"o","12":"o","12.1":"o","9.5-9.6":"o"}},"ios_saf":{"browser":"iOS Safari","abbr":"iOS","prefix":"webkit","type":"mobile","usage_global":{"3.2":0,"4.0-4.1":0.00666865,"4.2-4.3":0.0400119,"5.0-5.1":0.186722,"6.0-6.1":0.733551,"7.0-7.1":5.69503,"8":0},"versions":[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,"3.2","4.0-4.1","4.2-4.3","5.0-5.1","6.0-6.1","7.0-7.1","8",null,null],"current_version":""},"op_mini":{"browser":"Opera Mini","abbr":"O.Mini","prefix":"o","type":"mobile","usage_global":{"5.0-7.0":3.19172},"versions":[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,"5.0-7.0",null,null,null],"current_version":""},"android":{"browser":"Android Browser","abbr":"And.","prefix":"webkit","type":"mobile","usage_global":{"2.1":0.0208543,"2.2":0.0556116,"2.3":1.03577,"3":0,"4":0.855028,"4.1":2.01592,"4.2-4.3":2.04373,"4.4":0.945397,"4.4.3":0},"versions":[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,"2.1","2.2","2.3","3","4","4.1","4.2-4.3","4.4","4.4.3",null,null],"current_version":""},"op_mob":{"browser":"Opera Mobile","abbr":"O.Mob","prefix":"o","type":"mobile","usage_global":{"0":0,"10":0,"11.5":0,"12":0.0198698,"12.1":0.0596095},"versions":[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,"10",null,null,"11.5","12","12.1","0",null,null,null],"current_version":"22","prefix_exceptions":{"0":"webkit"}},"bb":{"browser":"Blackberry Browser","abbr":"BB","prefix":"webkit","type":"mobile","usage_global":{"10":0,"7":0.110321},"versions":[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,"7","10",null,null,null],"current_version":""},"and_chr":{"browser":"Chrome for Android","abbr":"Chr/And.","prefix":"webkit","type":"mobile","usage_global":{"0":5.52318},"versions":[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,"0",null,null,null],"current_version":"35"},"and_ff":{"browser":"Firefox for Android","abbr":"FF/And.","prefix":"moz","type":"mobile","usage_global":{"0":0.119574},"versions":[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,"0",null,null,null],"current_version":"30"},"ie_mob":{"browser":"IE Mobile","abbr":"IE.Mob","prefix":"ms","type":"mobile","usage_global":{"10":0.408117},"versions":[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,"10",null,null,null],"current_version":""}},"statuses":{"rec":"Recommendation","pr":"Proposed Recommendation","cr":"Candidate Recommendation","wd":"Working Draft","other":"Other","unoff":"Unofficial / Note"},"cats":{"CSS":["CSS","CSS2","CSS3"],"HTML5":["Canvas","HTML5"],"JS API":["JS API"],"Other":["Other","DOM","PNG"],"SVG":["SVG"]},"updated":1404324579,"data":{"png-alpha":{"title":"PNG alpha transparency","description":"Semi-transparent areas in PNG files","spec":"http://www.w3.org/TR/PNG/","status":"rec","links":[{"url":"http://en.wikipedia.org/wiki/Portable_Network_Graphics","title":"Wikipedia"},{"url":"http://dillerdesign.com/experiment/DD_belatedPNG/","title":"Workaround for IE6"}],"categories":["PNG"],"stats":{"ie":{"5.5":"n","6":"p","7":"y","8":"y","9":"y","10":"y","11":"y"},"firefox":{"2":"y","3":"y","3.5":"y","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"y","3.2":"y","4":"y","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"y","9.5-9.6":"y","10.0-10.1":"y","10.5":"y","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"y","4.0-4.1":"y","4.2-4.3":"y","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"y"},"android":{"2.1":"y","2.2":"y","2.3":"y","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"y","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"IE6 does support full transparency in 8-bit PNGs, which can sometimes be an alternative to 24-bit PNGs.","usage_perc_y":93.17,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":""},"apng":{"title":"Animated PNG (APNG)","description":"Like animated GIFs, but allowing 24-bit colors and alpha transparency","spec":"https://wiki.mozilla.org/APNG_Specification","status":"unoff","links":[{"url":"http://en.wikipedia.org/wiki/APNG","title":"Wikipedia"},{"url":"https://chrome.google.com/webstore/detail/ehkepjiconegkhpodgoaeamnpckdbblp","title":"Chrome extension providing support"},{"url":"https://github.com/davidmz/apng-canvas","title":"Polyfill using canvas"}],"categories":["PNG"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n"},"firefox":{"2":"n","3":"y","3.5":"y","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"n","32":"n","33":"n","34":"n","35":"n","36":"n","37":"n","38":"n"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"n","6.1":"n","7":"n","8":"y"},"opera":{"9":"n","9.5-9.6":"y","10.0-10.1":"y","10.5":"y","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"n","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"n","4.4.3":"n"},"bb":{"7":"n","10":"n"},"op_mob":{"10":"y","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"n"},"and_chr":{"0":"n"},"and_ff":{"0":"y"},"ie_mob":{"10":"n"}},"notes":"Where support for APNG is missing, only the first frame is displayed","usage_perc_y":14.67,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":""},"video":{"title":"Video element","description":"Method of playing videos on webpages (without requiring a plug-in)","spec":"http://www.whatwg.org/specs/web-apps/current-work/multipage/video.html#video","status":"wd","links":[{"url":"https://raw.github.com/phiggins42/has.js/master/detect/video.js#video","title":"has.js test"},{"url":"http://camendesign.co.uk/code/video_for_everybody","title":"Video for Everybody"},{"url":"http://webmproject.org","title":"WebM format information"},{"url":"http://dev.opera.com/articles/view/everything-you-need-to-know-about-html5-video-and-audio/","title":"Detailed article on video/audio elements"},{"url":"http://diveinto.org/html5/video.html","title":"Video on the Web - includes info on Android support"},{"url":"http://docs.webplatform.org/wiki/html/elements/video","title":"WebPlatform Docs"}],"categories":["HTML5"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"y","10":"y","11":"y"},"firefox":{"2":"n","3":"n","3.5":"y","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"y","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"y","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"y","4.0-4.1":"y","4.2-4.3":"y","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"a","2.2":"a","2.3":"y","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"n","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"Different browsers have support for different video formats, see sub-features for details. \r\n\r\nThe Android browser (before 2.3) requires <a href=\"http://www.broken-links.com/2010/07/08/making-html5-video-work-on-android-phones/\">specific handling</a> to run the video element.","usage_perc_y":85.18,"usage_perc_a":0.08,"ucprefix":false,"parent":"","keywords":"<video>"},"audio":{"title":"Audio element","description":"Method of playing sound on webpages (without requiring a plug-in)","spec":"http://www.whatwg.org/specs/web-apps/current-work/multipage/video.html#audio","status":"wd","links":[{"url":"http://textopia.org/androidsoundformats.html","title":"File format test page"},{"url":"http://24ways.org/2010/the-state-of-html5-audio","title":"Detailed article on support"},{"url":"http://www.phoboslab.org/log/2011/03/the-state-of-html5-audio","title":"The State of HTML5 Audio"},{"url":"http://html5doctor.com/native-audio-in-the-browser/","title":"HTML5 Doctor article"},{"url":"http://www.jplayer.org/latest/demos/","title":"Demos of audio player that uses the audio element"},{"url":"http://docs.webplatform.org/wiki/html/elements/audio","title":"WebPlatform Docs"},{"url":"https://raw.github.com/phiggins42/has.js/master/detect/audio.js#audio","title":"has.js test"},{"url":"http://dev.opera.com/articles/view/everything-you-need-to-know-about-html5-video-and-audio/","title":"Detailed article on video/audio elements"}],"categories":["HTML5"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"y","10":"y","11":"y"},"firefox":{"2":"n","3":"n","3.5":"y","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"y","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"a","10.0-10.1":"a","10.5":"y","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"y","4.2-4.3":"y","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"y","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"n","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"","usage_perc_y":85.18,"usage_perc_a":0.02,"ucprefix":false,"parent":"","keywords":""},"contenteditable":{"title":"contenteditable attribute (basic support)","description":"Method of making any HTML element editable","spec":"http://www.w3.org/TR/html/editing.html#contenteditable","status":"cr","links":[{"url":"http://html5demos.com/contenteditable","title":"Demo page"},{"url":"http://accessgarage.wordpress.com/2009/05/08/how-to-hack-your-app-to-make-contenteditable-work/","title":"Blog post on usage problems"},{"url":"http://blog.whatwg.org/the-road-to-html-5-contenteditable","title":"WHATWG blog post"},{"url":"http://docs.webplatform.org/wiki/html/attributes/contentEditable","title":"WebPlatform Docs"}],"categories":["HTML5"],"stats":{"ie":{"5.5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y"},"firefox":{"2":"n","3":"a","3.5":"y","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"y","3.2":"y","4":"y","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"y","9.5-9.6":"y","10.0-10.1":"y","10.5":"y","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"This support only refers to very basic editing capability, implementations vary significantly on how certain elements can be edited.","usage_perc_y":89,"usage_perc_a":0.08,"ucprefix":false,"parent":"","keywords":""},"dragndrop":{"title":"Drag and Drop","description":"Method of easily dragging and dropping elements on a page, requiring minimal JavaScript.","spec":"http://www.w3.org/TR/html5/editing.html#dnd","status":"wd","links":[{"url":"http://html5doctor.com/native-drag-and-drop/","title":"HTML5 Doctor article"},{"url":"http://html5demos.com/drag","title":"Demo with link blocks"},{"url":"http://nettutsplus.s3.amazonaws.com/64_html5dragdrop/demo/index.html","title":"Shopping cart demo"},{"url":"http://docs.webplatform.org/wiki/dom/DragEvent","title":"WebPlatform Docs"}],"categories":["HTML5"],"stats":{"ie":{"5.5":"a","6":"a","7":"a","8":"a","9":"a","10":"a","11":"a"},"firefox":{"2":"p","3":"p","3.5":"y","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"y","3.2":"y","4":"y","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"p","9.5-9.6":"p","10.0-10.1":"p","10.5":"p","10.6":"p","11":"p","11.1":"p","11.5":"p","11.6":"p","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"n","8":"n"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"n","4.4.3":"n"},"bb":{"7":"n","10":"n"},"op_mob":{"10":"p","11":"p","11.1":"p","11.5":"p","12":"p","12.1":"y","0":"n"},"and_chr":{"0":"n"},"and_ff":{"0":"n"},"ie_mob":{"10":"y"}},"notes":"Partial support in older IE refers to no support for the dataTransfer.files or .types objects and limited supported formats for dataTransfer.setData/getData. dataTransfer.items only supported by google chrome. IE has no support for .setDragImage. Firefox supports any kind of DOM elements for .setDragImage. Chrome must have either an HTMLImageElement or any kind of DOM elements attached to the DOM and within the viewport of the browser for .setDragImage.","usage_perc_y":53.39,"usage_perc_a":17.3,"ucprefix":false,"parent":"","keywords":"draganddrop"},"queryselector":{"title":"querySelector/querySelectorAll","description":"Method of accessing DOM elements using CSS selectors","spec":"http://www.w3.org/TR/selectors-api/","status":"rec","links":[{"url":"http://docs.webplatform.org/wiki/css/selectors_api/querySelector","title":"WebPlatform Docs"},{"url":"http://cjihrig.com/blog/javascripts-selectors-api/","title":"Blog post"},{"url":"https://developer.mozilla.org/En/DOM/Element.querySelectorAll","title":"MDN article on querySelectorAll"},{"url":"https://developer.mozilla.org/en/DOM/element.querySelector","title":"MDN article on querySelector"}],"categories":["DOM"],"stats":{"ie":{"5.5":"n","6":"p","7":"p","8":"y","9":"y","10":"y","11":"y"},"firefox":{"2":"p","3":"p","3.5":"y","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"y","3.2":"y","4":"y","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"p","9.5-9.6":"p","10.0-10.1":"y","10.5":"y","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"y","4.0-4.1":"y","4.2-4.3":"y","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"y"},"android":{"2.1":"y","2.2":"y","2.3":"y","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"y","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"Only works for the CSS selectors available. Thus the IE8 implementation is limited to the CSS 2.1 selectors","usage_perc_y":92.94,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":"query,selectors,selectors api"},"getelementsbyclassname":{"title":"getElementsByClassName","description":"Method of accessing DOM elements by class name","spec":"http://www.w3.org/TR/dom/#dom-document-getelementsbyclassname","status":"wd","links":[{"url":"http://docs.webplatform.org/wiki/dom/HTMLElement/getElementsByClassName","title":"WebPlatform Docs"},{"url":"http://www.quirksmode.org/dom/tests/basics.html#getElementsByClassName","title":"Test page"}],"categories":["HTML5","DOM"],"stats":{"ie":{"5.5":"n","6":"p","7":"p","8":"p","9":"y","10":"y","11":"y"},"firefox":{"2":"p","3":"y","3.5":"y","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"y","3.2":"y","4":"y","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"y","10.0-10.1":"y","10.5":"y","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"y","4.0-4.1":"y","4.2-4.3":"y","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"y"},"android":{"2.1":"y","2.2":"y","2.3":"y","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"y","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"","usage_perc_y":88.56,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":"byclassname"},"forms":{"title":"HTML5 form features","description":"Expanded form options, including things like date pickers, sliders, validation, placeholders and multiple file uploads. Previously known as \"Web forms 2.0\".","spec":"http://www.whatwg.org/specs/web-apps/current-work/multipage/forms.html","status":"wd","links":[{"url":"https://github.com/westonruter/webforms2","title":"Cross-browser JS implementation (based on original spec)"},{"url":"http://www.miketaylr.com/code/input-type-attr.html","title":"HTML5 inputs and attribute support page"}],"categories":["HTML5"],"stats":{"ie":{"5.5":"n","6":"p","7":"p","8":"p","9":"p","10":"a","11":"a"},"firefox":{"2":"p","3":"p","3.5":"p","3.6":"p","4":"a","5":"a","6":"a","7":"a","8":"a","9":"a","10":"a","11":"a","12":"a","13":"a","14":"a","15":"a","16":"a","17":"a","18":"a","19":"a","20":"a","21":"a","22":"a","23":"a","24":"a","25":"a","26":"a","27":"a","28":"a","29":"a","30":"a","31":"a","32":"a","33":"a"},"chrome":{"4":"a","5":"a","6":"a","7":"a","8":"a","9":"a","10":"a","11":"a","12":"a","13":"a","14":"a","15":"a","16":"a","17":"a","18":"a","19":"a","20":"a","21":"a","22":"a","23":"a","24":"a","25":"a","26":"a","27":"a","28":"a","29":"a","30":"a","31":"a","32":"a","33":"a","34":"a","35":"a","36":"a","37":"a","38":"a"},"safari":{"3.1":"p","3.2":"p","4":"a","5":"a","5.1":"a","6":"a","6.1":"a","7":"a","8":"a"},"opera":{"9":"y","9.5-9.6":"y","10.0-10.1":"y","10.5":"y","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"a","16":"a","17":"a","18":"a","19":"a","20":"a","21":"a","22":"a","23":"a","24":"a"},"ios_saf":{"3.2":"n","4.0-4.1":"a","4.2-4.3":"a","5.0-5.1":"a","6.0-6.1":"a","7.0-7.1":"a","8":"a"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"a","4.4.3":"a"},"bb":{"7":"n","10":"a"},"op_mob":{"10":"y","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"a"},"and_chr":{"0":"a"},"and_ff":{"0":"a"},"ie_mob":{"10":"a"}},"notes":"","usage_perc_y":0.51,"usage_perc_a":75.87,"ucprefix":false,"parent":"","keywords":"input,datepicker"},"html5semantic":{"title":"New semantic elements","description":"HTML5 offers some new elements, primarily for semantic purposes. The elements include: section, article, aside, header, footer, nav, figure, figcaption, time, mark, main.","spec":"http://www.whatwg.org/specs/web-apps/current-work/multipage/semantics.html#sections","status":"wd","links":[{"url":"http://blog.whatwg.org/supporting-new-elements-in-ie","title":"Workaround for IE"},{"url":"http://blog.whatwg.org/styling-ie-noscript","title":"Alternate workaround"},{"url":"http://oli.jp/2009/html5-structure3/","title":"Article on structural elements"},{"url":"https://raw.github.com/phiggins42/has.js/master/detect/dom.js#dom-html5-elements","title":"has.js test"}],"categories":["HTML5"],"stats":{"ie":{"5.5":"n","6":"p","7":"p","8":"p","9":"y #1","10":"y #1","11":"y #1"},"firefox":{"2":"n","3":"a #1","3.5":"a #1","3.6":"a #1","4":"y #1","5":"y #1","6":"y #1","7":"y #1","8":"y #1","9":"y #1","10":"y #1","11":"y #1","12":"y #1","13":"y #1","14":"y #1","15":"y #1","16":"y #1","17":"y #1","18":"y #1","19":"y #1","20":"y #1","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"a #1","5":"a #1","6":"y #1","7":"y #1","8":"y #1","9":"y #1","10":"y #1","11":"y #1","12":"y #1","13":"y #1","14":"y #1","15":"y #1","16":"y #1","17":"y #1","18":"y #1","19":"y #1","20":"y #1","21":"y #1","22":"y #1","23":"y #1","24":"y #1","25":"y #1","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"a #1","3.2":"a #1","4":"a #1","5":"y #1","5.1":"y #1","6":"y #1","6.1":"y","7":"y","8":"y"},"opera":{"9":"a #1","9.5-9.6":"a #1","10.0-10.1":"a #1","10.5":"a #1","10.6":"a #1","11":"a #1","11.1":"y #1","11.5":"y #1","11.6":"y #1","12":"y #1","12.1":"y #1","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"a #1","4.0-4.1":"y #1","4.2-4.3":"y #1","5.0-5.1":"y #1","6.0-6.1":"y #1","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"a #1"},"android":{"2.1":"a #1","2.2":"y #1","2.3":"y #1","3":"y #1","4":"y #1","4.1":"y #1","4.2-4.3":"y #1","4.4":"y","4.4.3":"y"},"bb":{"7":"y #1","10":"y #1"},"op_mob":{"10":"a #1","11":"y #1","11.1":"y #1","11.5":"y #1","12":"y #1","12.1":"y #1","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y #1"}},"notes":"Partial support refers to missing the default styling. This is easily taken care of by using display:block for all new elements (except time and mark, these should be display:inline anyway). IE11 and older versions of other browsers do not support the &lt;main> element.","usage_perc_y":84.9,"usage_perc_a":3.67,"ucprefix":false,"parent":"","keywords":""},"offline-apps":{"title":"Offline web applications","description":"Method of defining web page files to be cached using a cache manifest file, allowing them to work offline on subsequent visits to the page","spec":"http://www.whatwg.org/specs/web-apps/current-work/multipage/offline.html","status":"wd","links":[{"url":"http://diveinto.org/html5/offline.html","title":"Dive Into HTML5 article"},{"url":"http://hacks.mozilla.org/2010/01/offline-web-applications/","title":"Mozilla Hacks article/demo"},{"url":"http://docs.webplatform.org/wiki/apis/appcache/ApplicationCache","title":"WebPlatform Docs"},{"url":"http://www.sitepoint.com/offline-web-application-tutorial/","title":"Sitepoint tutorial"}],"categories":["HTML5"],"stats":{"ie":{"5.5":"n","6":"p","7":"p","8":"p","9":"n","10":"y","11":"y"},"firefox":{"2":"p","3":"a","3.5":"y","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"p","3.2":"p","4":"y","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"p","10.5":"p","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"y","4.0-4.1":"y","4.2-4.3":"y","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"y","2.2":"y","2.3":"y","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"n","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"","usage_perc_y":82.65,"usage_perc_a":0.08,"ucprefix":false,"parent":"","keywords":"appcache,app cache,application cache,online"},"webworkers":{"title":"Web Workers","description":"Method of running scripts in the background, isolated from the web page","spec":"http://www.w3.org/TR/workers/","status":"cr","links":[{"url":"http://nerget.com/rayjs-mt/rayjs.html","title":"Web Worker demo"},{"url":"https://developer.mozilla.org/En/Using_web_workers","title":"MDN article"},{"url":"http://net.tutsplus.com/tutorials/javascript-ajax/getting-started-with-web-workers/","title":"Tutorial"},{"url":"http://code.google.com/p/ie-web-worker/","title":"Polyfill for IE (single threaded)"}],"categories":["JS API"],"stats":{"ie":{"5.5":"n","6":"p","7":"p","8":"p","9":"p","10":"y","11":"y"},"firefox":{"2":"p","3":"p","3.5":"y","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"p","3.2":"p","4":"y","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"p","10.5":"p","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"y","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"p","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"","usage_perc_y":76.6,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":""},"fontface":{"title":"@font-face Web fonts","description":"Method of displaying fonts downloaded from websites","spec":"http://www.w3.org/TR/css3-webfonts/","status":"wd","links":[{"url":"http://docs.webplatform.org/wiki/css/atrules/@font-face","title":"WebPlatform Docs"},{"url":"http://en.wikipedia.org/wiki/Web_typography","title":"Wikipedia"},{"url":"http://webfonts.info","title":"News and information site"},{"url":"http://www.css3files.com/font/","title":"Information page"}],"categories":["CSS3"],"stats":{"ie":{"5.5":"a","6":"a","7":"a","8":"a","9":"y","10":"y","11":"y"},"firefox":{"2":"n","3":"n","3.5":"y","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"y","4":"y","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"y","10.5":"y","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"a","4.0-4.1":"a","4.2-4.3":"y","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"a","2.3":"a","3":"a","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"a","10":"y"},"op_mob":{"10":"y","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"Partial support before IE9 refers to only supporting EOT fonts. Safari for iOS 4.1 and below only supports SVG fonts.","usage_perc_y":84.05,"usage_perc_a":6.09,"ucprefix":false,"parent":"","keywords":"font face"},"eot":{"title":"EOT - Embedded OpenType fonts","description":"Type of font that can be derived from a regular font, allowing small files and legal use of high-quality fonts. Usage is restricted by the file being tied to the website","spec":"http://www.w3.org/Submission/EOT/","status":"unoff","links":[{"url":"http://en.wikipedia.org/wiki/Embedded_OpenType","title":"Wikipedia"},{"url":"http://www.microsoft.com/typography/web/embedding/default.aspx","title":"Example pages"}],"categories":["Other"],"stats":{"ie":{"5.5":"n","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"n","32":"n","33":"n"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"n","32":"n","33":"n","34":"n","35":"n","36":"n","37":"n","38":"n"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"n","6.1":"n","7":"n","8":"n"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"n","8":"n"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"n","4.4.3":"n"},"bb":{"7":"n","10":"n"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"n"},"and_chr":{"0":"n"},"and_ff":{"0":"n"},"ie_mob":{"10":"n"}},"notes":"Proposal by Microsoft, being considered for W3C standardization.","usage_perc_y":17.29,"usage_perc_a":0,"ucprefix":false,"parent":"fontface","keywords":""},"woff":{"title":"WOFF - Web Open Font Format","description":"Compressed TrueType/OpenType font that contains information about the font's source.","spec":"http://www.w3.org/TR/WOFF/","status":"rec","links":[{"url":"http://hacks.mozilla.org/2009/10/woff/","title":"Mozilla hacks blog post"}],"categories":["Other"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"y","10":"y","11":"y"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"n","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"n","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"Reported to be supported in some modified versions of the Android 4.0 browser.","usage_perc_y":78.81,"usage_perc_a":0,"ucprefix":false,"parent":"fontface","keywords":""},"multibackgrounds":{"title":"CSS3 Multiple backgrounds","description":"Method of using multiple images as a background","spec":"http://www.w3.org/TR/css3-background/","status":"cr","links":[{"url":"http://www.css3.info/preview/multiple-backgrounds/","title":"Demo & information page"},{"url":"http://docs.webplatform.org/wiki/css/properties/background-image","title":"WebPlatform Docs"},{"url":"http://www.css3files.com/background/","title":"Information page"}],"categories":["CSS3"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"y","10":"y","11":"y"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"y","3.2":"y","4":"y","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"y","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"y","4.0-4.1":"y","4.2-4.3":"y","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"y"},"android":{"2.1":"y","2.2":"y","2.3":"y","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"y","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"","usage_perc_y":88.44,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":""},"border-image":{"title":"CSS3 Border images","description":"Method of using images for borders","spec":"http://www.w3.org/TR/css3-background/#the-border-image","status":"cr","links":[{"url":"http://docs.webplatform.org/wiki/css/properties/border-image","title":"WebPlatform Docs"},{"url":"http://www.css3files.com/border/","title":"Information page"}],"categories":["CSS3"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"y"},"firefox":{"2":"n","3":"n","3.5":"a x","3.6":"a x","4":"a x","5":"a x","6":"a x","7":"a x","8":"a x","9":"a x","10":"a x","11":"a x","12":"a x","13":"a x","14":"a x","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"a x","5":"a x","6":"a x","7":"a x","8":"a x","9":"a x","10":"a x","11":"a x","12":"a x","13":"a x","14":"a x","15":"y x","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"a x","3.2":"a x","4":"a x","5":"a x","5.1":"a x","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"a","10.6":"a","11":"a x","11.1":"a x","11.5":"a x","11.6":"a x","12":"a x","12.1":"a x","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"a x","4.0-4.1":"a x","4.2-4.3":"a x","5.0-5.1":"a x","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"a x","2.2":"a x","2.3":"a x","3":"a x","4":"a x","4.1":"a x","4.2-4.3":"a x","4.4":"y","4.4.3":"y"},"bb":{"7":"a x","10":"y"},"op_mob":{"10":"n","11":"a x","11.1":"a x","11.5":"a x","12":"a x","12.1":"a x","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"n"}},"notes":"Note that both the border-style and border-width must be specified for border-images to work according to spec, though older implementations may not have this requirement. Partial support refers to supporting the shorthand syntax, but not the individual properties (border-image-source, border-image-slice, etc). ","usage_perc_y":70.74,"usage_perc_a":8.89,"ucprefix":false,"parent":"","keywords":""},"background-img-opts":{"title":"CSS3 Background-image options","description":"New properties to affect background images, including background-clip, background-origin and background-size","spec":"http://www.w3.org/TR/css3-background/#backgrounds","status":"cr","links":[{"url":"https://github.com/louisremi/background-size-polyfill","title":"Polyfill for IE7-8"},{"url":"http://www.css3files.com/background/","title":"Information page"},{"url":"http://www.standardista.com/css3/css3-background-properties","title":"Detailed compatibility tables and demos"}],"categories":["CSS3"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"y","10":"y","11":"y"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"a x","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"a","3.2":"a","4":"a","5":"y","5.1":"y","6":"a","6.1":"a","7":"a","8":"a"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"a x","10.5":"y","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"a","4.0-4.1":"y","4.2-4.3":"y","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"a"},"android":{"2.1":"a x","2.2":"y x","2.3":"y x","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"y","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"Partial support in Opera Mini refers to not supporting background sizing or background attachments. However Opera Mini 7.5 supports background sizing (including cover and contain values). Partial support in Safari 6 refers to not supporting background sizing offset from edges syntax.","usage_perc_y":82.43,"usage_perc_a":6.03,"ucprefix":false,"parent":"","keywords":""},"css-table":{"title":"CSS Table display","description":"Method of displaying elements as tables, rows, and cells","spec":"http://www.w3.org/TR/CSS21/tables.html","status":"rec","links":[{"url":"http://www.onenaught.com/posts/201/use-css-displaytable-for-layout","title":"Blog post on usage"}],"categories":["CSS2"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"y","9":"y","10":"y","11":"y"},"firefox":{"2":"y","3":"y","3.5":"y","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"y","3.2":"y","4":"y","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"y","9.5-9.6":"y","10.0-10.1":"y","10.5":"y","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"y","4.0-4.1":"y","4.2-4.3":"y","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"y"},"android":{"2.1":"y","2.2":"y","2.3":"y","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"y","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"","usage_perc_y":93.04,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":"display:table, display: table,table-cell,table-row,table-layout"},"css-gencontent":{"title":"CSS Generated content for pseudo-elements","description":"Method of displaying text or images before or after the given element's contents using the :before and :after pseudo-elements","spec":"http://www.w3.org/TR/CSS21/generate.html","status":"rec","links":[{"url":"http://dev.opera.com/articles/view/css-generated-content-techniques/","title":"Dev.Opera article"},{"url":"http://www.westciv.com/style_master/academy/css_tutorial/advanced/generated_content.html","title":"Guide on usage"},{"url":"http://docs.webplatform.org/wiki/css/generated_and_replaced_content","title":"WebPlatform Docs"}],"categories":["CSS2","CSS3"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"a","9":"y","10":"y","11":"y"},"firefox":{"2":"y","3":"y","3.5":"y","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"y","3.2":"y","4":"y","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"y","9.5-9.6":"y","10.0-10.1":"y","10.5":"y","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"y","4.0-4.1":"y","4.2-4.3":"y","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"y"},"android":{"2.1":"y","2.2":"y","2.3":"y","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"y","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"IE8 only supports the single-colon CSS 2.1 syntax (i.e. :pseudo-class). It does not support the double-colon CSS3 syntax (i.e. ::pseudo-element)","usage_perc_y":88.57,"usage_perc_a":4.46,"ucprefix":false,"parent":"","keywords":"before,after"},"css-fixed":{"title":"CSS position:fixed","description":"Method of keeping an element in a fixed location regardless of scroll position","spec":"http://www.w3.org/TR/CSS21/visuren.html#fixed-positioning","status":"rec","links":[{"url":"http://www.css-101.org/fixed-positioning/05.php","title":"Workaround for IE6"},{"url":"http://docs.webplatform.org/wiki/css/properties/position","title":"WebPlatform Docs"},{"url":"http://bradfrostweb.com/blog/mobile/fixed-position/","title":"Article on mobile support"}],"categories":["CSS"],"stats":{"ie":{"5.5":"n","6":"p","7":"y","8":"y","9":"y","10":"y","11":"y"},"firefox":{"2":"y","3":"y","3.5":"y","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"y","3.2":"y","4":"y","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"y","9.5-9.6":"y","10.0-10.1":"y","10.5":"y","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"a","6.0-6.1":"a","7.0-7.1":"a","8":"a"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"a","2.2":"a","2.3":"a","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"y","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"Only works in Android 2.2+ by using the following meta tag: &lt;meta name=\"viewport\" content=\"width=device-width, user-scalable=no\">. Partial support in iOS Safari refers to <a href=\"http://remysharp.com/2012/05/24/issues-with-position-fixed-scrolling-on-ios/\">buggy behavior</a>.","usage_perc_y":82.21,"usage_perc_a":7.73,"ucprefix":false,"parent":"","keywords":""},"hashchange":{"title":"Hashchange event","description":"Event triggered in JavaScript when the URL's hash has changed (for example: page.html#foo to page.html#bar) ","spec":"http://www.w3.org/TR/html5/history.html#event-hashchange","status":"cr","links":[{"url":"http://www.quirksmode.org/dom/events/tests/hashchange.html","title":"Simple demo"},{"url":"http://docs.webplatform.org/wiki/dom/Element/hashchange","title":"WebPlatform Docs"},{"url":"http://github.com/3nr1c/jUri.js","title":"Polyfill"},{"url":"http://msdn.microsoft.com/en-us/library/cc288209(VS.85).aspx","title":"MSDN article"},{"url":"https://developer.mozilla.org/en/DOM/window.onhashchange","title":"MDN article"}],"categories":["JS API","HTML5"],"stats":{"ie":{"5.5":"p","6":"p","7":"p","8":"y","9":"y","10":"y","11":"y"},"firefox":{"2":"p","3":"p","3.5":"p","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"p","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"p","3.2":"p","4":"p","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"p","9.5-9.6":"p","10.0-10.1":"p","10.5":"p","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"y","4.2-4.3":"y","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"y","2.3":"y","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"p","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"","usage_perc_y":89.54,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":"onhashchange,HashChangeEvent"},"css-sel2":{"title":"CSS 2.1 selectors","description":"Allows more accurate element selecting, using >, +, [attr], :first-child, etc.","spec":"http://www.w3.org/TR/CSS21/selector.html","status":"rec","links":[{"url":"http://docs.webplatform.org/wiki/css/selectors","title":"WebPlatform Docs"},{"url":"http://www.quirksmode.org/css/contents.html","title":"Detailed support information"},{"url":"http://www.yourhtmlsource.com/stylesheets/advancedselectors.html","title":"Examples of advanced selectors"},{"url":"http://selectivizr.com","title":"Selectivizr: Polyfill for IE6-8"}],"categories":["CSS2"],"stats":{"ie":{"5.5":"n","6":"p","7":"y","8":"y","9":"y","10":"y","11":"y"},"firefox":{"2":"y","3":"y","3.5":"y","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"y","3.2":"y","4":"y","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"y","9.5-9.6":"y","10.0-10.1":"y","10.5":"y","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"y","4.0-4.1":"y","4.2-4.3":"y","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"y"},"android":{"2.1":"y","2.2":"y","2.3":"y","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"y","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"","usage_perc_y":93.17,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":"child selector,:hover,adjacent,sibling,adjacent sibling"},"css-sel3":{"title":"CSS3 selectors","description":"Advanced element selection using selectors like :nth-child(), :last-child, :first-of-type, :checked, :disabled, etc.","spec":"http://www.w3.org/TR/css3-selectors/","status":"rec","links":[{"url":"http://docs.webplatform.org/wiki/css/selectors","title":"WebPlatform Docs"},{"url":"http://selectivizr.com","title":"Selectivizr: Polyfill for IE6-8"},{"url":"http://www.css3.info/selectors-test/","title":"Automated CSS3 selector test"},{"url":"http://www.quirksmode.org/css/selectors/","title":"Detailed support information"}],"categories":["CSS3"],"stats":{"ie":{"5.5":"n","6":"p","7":"a","8":"a","9":"y","10":"y","11":"y"},"firefox":{"2":"n","3":"n","3.5":"y","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"y","4":"y","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"y","10.0-10.1":"y","10.5":"y","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"y","4.0-4.1":"y","4.2-4.3":"y","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"y"},"android":{"2.1":"y","2.2":"y","2.3":"y","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"y","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"IE7 and IE8 support only these CSS3 selectors: General siblings (element1~element2) and Attribute selectors [attr^=val], [attr$=val], and [attr*=val]","usage_perc_y":88.48,"usage_perc_a":4.6,"ucprefix":false,"parent":"","keywords":":target,:not"},"css-textshadow":{"title":"CSS3 Text-shadow","description":"Method of applying one or more shadow or blur effects to text","spec":"http://www.w3.org/TR/css-text-decor-3/#text-shadow-property","status":"wd","links":[{"url":"http://hacks.mozilla.org/2009/06/text-shadow/","title":"Mozilla hacks article"},{"url":"http://www.css3files.com/shadow/#textshadow","title":"Information page"},{"url":"http://docs.webplatform.org/wiki/css/properties/text-shadow","title":"WebPlatform Docs"},{"url":"http://ie.microsoft.com/testdrive/Graphics/hands-on-css3/hands-on_text-shadow.htm","title":"Live editor"}],"categories":["CSS3"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"y","11":"y"},"firefox":{"2":"n","3":"n","3.5":"y","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"a","3.2":"a","4":"y","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"y","10.0-10.1":"y","10.5":"y","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"y","4.0-4.1":"y","4.2-4.3":"y","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"a"},"android":{"2.1":"y","2.2":"y","2.3":"y","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"a","10":"y"},"op_mob":{"10":"y","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"Opera Mini ignores the blur-radius set, so no blur effect is visible. Text-shadow behavior can be somewhat emulated in older IE versions using the non-standard \"dropshadow\" or \"glow\" filters. ","usage_perc_y":82.57,"usage_perc_a":3.31,"ucprefix":false,"parent":"","keywords":""},"css-boxshadow":{"title":"CSS3 Box-shadow","description":"Method of displaying an inner or outer shadow effect to elements","spec":"http://www.w3.org/TR/css3-background/#box-shadow","status":"cr","links":[{"url":"http://docs.webplatform.org/wiki/css/properties/box-shadow","title":"WebPlatform Docs"},{"url":"http://www.css3files.com/shadow/","title":"Information page"},{"url":"http://westciv.com/tools/boxshadows/index.html","title":"Live editor"},{"url":"http://tests.themasta.com/blogstuff/boxshadowdemo.html","title":"Demo of various effects"},{"url":"https://developer.mozilla.org/En/CSS/-moz-box-shadow","title":"MDN article"}],"categories":["CSS3"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"y","10":"y","11":"y"},"firefox":{"2":"n","3":"n","3.5":"y x","3.6":"y x","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y x","5":"y x","6":"y x","7":"y x","8":"y x","9":"y x","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"a x","3.2":"a x","4":"a x","5":"y x","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"y","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"a x","4.0-4.1":"y x","4.2-4.3":"y x","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"a x","2.2":"a x","2.3":"a x","3":"a x","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y x","10":"y"},"op_mob":{"10":"n","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"Can be partially emulated in older IE versions using the non-standard \"shadow\" filter. Partial support in Safari, iOS Safari and Android Browser refers to missing \"inset\" and blur radius value support.","usage_perc_y":84.04,"usage_perc_a":1.23,"ucprefix":false,"parent":"","keywords":"box-shadows,boxshadows,box shadow,shaow"},"css3-colors":{"title":"CSS3 Colors","description":"Method of describing colors using Hue, Saturation and Lightness (hsl()) rather than just RGB, as well as allowing alpha-transparency with rgba() and hsla().","spec":"http://www.w3.org/TR/css3-color/","status":"rec","links":[{"url":"http://docs.webplatform.org/wiki/css/color#RGBA_Notation","title":"WebPlatform Docs"},{"url":"http://www.css3files.com/color/","title":"Information page"},{"url":"http://dev.opera.com/articles/view/color-in-opera-10-hsl-rgb-and-alpha-transparency/","title":"Dev.Opera article"}],"categories":["CSS3"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"y","10":"y","11":"y"},"firefox":{"2":"a","3":"y","3.5":"y","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"y","3.2":"y","4":"y","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"a","10.0-10.1":"y","10.5":"y","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"y","4.0-4.1":"y","4.2-4.3":"y","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"y"},"android":{"2.1":"y","2.2":"y","2.3":"y","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"y","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"","usage_perc_y":88.55,"usage_perc_a":0.01,"ucprefix":false,"parent":"","keywords":"rgb,hsl,rgba,hsla"},"css3-boxsizing":{"title":"CSS3 Box-sizing","description":"Method of specifying whether or not an element's borders and padding should be included in size units","spec":"http://www.w3.org/TR/css3-ui/#box-sizing","status":"wd","links":[{"url":"http://css-tricks.com/box-sizing/","title":"CSS Tricks"},{"url":"http://docs.webplatform.org/wiki/css/properties/box-sizing","title":"WebPlatform Docs"},{"url":"https://github.com/Schepp/box-sizing-polyfill","title":"Polyfill for IE"},{"url":"https://developer.mozilla.org/En/CSS/Box-sizing","title":"MDN article"},{"url":"http://www.456bereastreet.com/archive/201104/controlling_width_with_css3_box-sizing/","title":"Blog post"}],"categories":["CSS3"],"stats":{"ie":{"5.5":"p","6":"p","7":"p","8":"a","9":"a","10":"a","11":"a"},"firefox":{"2":"y x","3":"y x","3.5":"y x","3.6":"y x","4":"y x","5":"y x","6":"y x","7":"y x","8":"y x","9":"y x","10":"y x","11":"y x","12":"y x","13":"y x","14":"y x","15":"y x","16":"y x","17":"y x","18":"y x","19":"y x","20":"y x","21":"y x","22":"y x","23":"y x","24":"y x","25":"y x","26":"y x","27":"y x","28":"y x","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"a x","5":"a x","6":"a x","7":"a x","8":"a x","9":"a x","10":"a","11":"a","12":"a","13":"a","14":"a","15":"a","16":"a","17":"a","18":"a","19":"a","20":"a","21":"a","22":"a","23":"a","24":"a","25":"a","26":"a","27":"a","28":"a","29":"a","30":"a","31":"a","32":"a","33":"a","34":"a","35":"a","36":"a","37":"a","38":"a"},"safari":{"3.1":"a x","3.2":"a x","4":"a x","5":"a x","5.1":"a","6":"a","6.1":"a","7":"a","8":"a"},"opera":{"9":"n","9.5-9.6":"a","10.0-10.1":"a","10.5":"a","10.6":"a","11":"a","11.1":"a","11.5":"a","11.6":"a","12":"a","12.1":"a","15":"a","16":"a","17":"a","18":"a","19":"a","20":"a","21":"a","22":"a","23":"a","24":"a"},"ios_saf":{"3.2":"a x","4.0-4.1":"a x","4.2-4.3":"a x","5.0-5.1":"a","6.0-6.1":"a","7.0-7.1":"a","8":"a"},"op_mini":{"5.0-7.0":"a"},"android":{"2.1":"a x","2.2":"a x","2.3":"a x","3":"a x","4":"a","4.1":"a","4.2-4.3":"a","4.4":"a","4.4.3":"a"},"bb":{"7":"a x","10":"a"},"op_mob":{"10":"a","11":"a","11.1":"a","11.5":"a","12":"a","12.1":"a","0":"a"},"and_chr":{"0":"a"},"and_ff":{"0":"y"},"ie_mob":{"10":"a"}},"notes":"Partial support refers to supporting only the \"border-box\" value, not \"padding-box\" (which was added to the spec later).","usage_perc_y":14.17,"usage_perc_a":78.86,"ucprefix":false,"parent":"","keywords":"border-box,content-box,padding-box"},"css-mediaqueries":{"title":"CSS3 Media Queries","description":"Method of applying styles based on media information. Includes things like page and device dimensions","spec":"http://www.w3.org/TR/css3-mediaqueries/","status":"rec","links":[{"url":"http://docs.webplatform.org/wiki/css/atrules/@media","title":"WebPlatform Docs"},{"url":"http://webdesignerwall.com/tutorials/responsive-design-with-css3-media-queries","title":"Media Queries tutorial"},{"url":"http://ie.microsoft.com/testdrive/HTML5/85CSS3_MediaQueries/","title":"IE demo page with information"},{"url":"https://github.com/scottjehl/Respond","title":"Polyfill for IE"}],"categories":["CSS3"],"stats":{"ie":{"5.5":"p","6":"p","7":"p","8":"p","9":"y","10":"y","11":"y"},"firefox":{"2":"n","3":"n","3.5":"y","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"a","3.2":"a","4":"y","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"y","10.0-10.1":"y","10.5":"y","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"y","4.0-4.1":"y","4.2-4.3":"y","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"y"},"android":{"2.1":"y","2.2":"y","2.3":"y","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"y","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"Incomplete support by older webkit browsers refers to only acknowledging different media rules on page reload","usage_perc_y":88.47,"usage_perc_a":0.01,"ucprefix":false,"parent":"","keywords":"@media"},"multicolumn":{"title":"CSS3 Multiple column layout","description":"Method of flowing information in multiple columns","spec":"http://www.w3.org/TR/css3-multicol/","status":"cr","links":[{"url":"http://webdesign.tutsplus.com/tutorials/htmlcss-tutorials/an-introduction-to-the-css3-multiple-column-layout-module/","title":"Introduction page"},{"url":"http://docs.webplatform.org/wiki/css/properties/column-width","title":"WebPlatform Docs"},{"url":"http://dev.opera.com/articles/view/css3-multi-column-layout/","title":"Dev.Opera article"}],"categories":["CSS3"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"y","11":"y"},"firefox":{"2":"a x","3":"a x","3.5":"a x","3.6":"a x","4":"a x","5":"a x","6":"a x","7":"a x","8":"a x","9":"a x","10":"a x","11":"a x","12":"a x","13":"a x","14":"a x","15":"a x","16":"a x","17":"a x","18":"a x","19":"a x","20":"a x","21":"a x","22":"a x","23":"a x","24":"a x","25":"a x","26":"a x","27":"a x","28":"a x","29":"a x","30":"a x","31":"a x","32":"a x","33":"a x"},"chrome":{"4":"a x","5":"a x","6":"a x","7":"a x","8":"a x","9":"a x","10":"a x","11":"a x","12":"a x","13":"a x","14":"a x","15":"a x","16":"a x","17":"a x","18":"a x","19":"a x","20":"a x","21":"a x","22":"a x","23":"a x","24":"a x","25":"a x","26":"a x","27":"a x","28":"a x","29":"a x","30":"a x","31":"a x","32":"a x","33":"a x","34":"a x","35":"a x","36":"a x","37":"a x","38":"a x"},"safari":{"3.1":"a x","3.2":"a x","4":"a x","5":"a x","5.1":"a x","6":"a x","6.1":"a x","7":"a x","8":"a x"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"a x","16":"a x","17":"a x","18":"a x","19":"a x","20":"a x","21":"a x","22":"a x","23":"a x","24":"a x"},"ios_saf":{"3.2":"a x","4.0-4.1":"a x","4.2-4.3":"a x","5.0-5.1":"a x","6.0-6.1":"a x","7.0-7.1":"a x","8":"a x"},"op_mini":{"5.0-7.0":"y"},"android":{"2.1":"a x","2.2":"a x","2.3":"a x","3":"a x","4":"a x","4.1":"a x","4.2-4.3":"a x","4.4":"a x","4.4.3":"a x"},"bb":{"7":"a x","10":"a x"},"op_mob":{"10":"n","11":"n","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"a x"},"and_chr":{"0":"a x"},"and_ff":{"0":"a x"},"ie_mob":{"10":"y"}},"notes":"Partial support refers to not supporting the break-before, break-after, break-inside properties. Webkit browsers do have equivalent support for the non-standard -webkit-column-break-* properties.","usage_perc_y":13.87,"usage_perc_a":72.05,"ucprefix":false,"parent":"","keywords":"column-count"},"border-radius":{"title":"CSS3 Border-radius (rounded corners)","description":"Method of making the border corners round","spec":"http://www.w3.org/TR/css3-background/#the-border-radius","status":"cr","links":[{"url":"http://muddledramblings.com/table-of-css3-border-radius-compliance","title":"Detailed compliance table"},{"url":"http://border-radius.com","title":"Border-radius CSS Generator"},{"url":"http://docs.webplatform.org/wiki/css/properties/border-radius","title":"WebPlatform Docs"},{"url":"http://css3pie.com/","title":"Polyfill which includes border-radius"},{"url":"http://www.css3files.com/border/#borderradius","title":"Information page"}],"categories":["CSS3"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"y","10":"y","11":"y"},"firefox":{"2":"a x","3":"y x","3.5":"y x","3.6":"y x","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y x","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"y x","3.2":"y x","4":"y x","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"y","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"y x","4.0-4.1":"y","4.2-4.3":"y","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"y x","2.2":"y","2.3":"y","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"n","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"","usage_perc_y":85.35,"usage_perc_a":0.01,"ucprefix":false,"parent":"","keywords":"roundedcorners, border radius,-moz-border-radius"},"transforms2d":{"title":"CSS3 Transforms","description":"Method of transforming an element including rotating, scaling, etc.","spec":"http://www.w3.org/TR/css3-2d-transforms/","status":"wd","links":[{"url":"https://raw.github.com/phiggins42/has.js/master/detect/css.js#css-transform","title":"has.js test"},{"url":"https://developer.mozilla.org/en/CSS/-moz-transform","title":"MDN article"},{"url":"http://www.westciv.com/tools/transforms/","title":"Live editor"},{"url":"http://www.webresourcesdepot.com/cross-browser-css-transforms-csssandpaper/","title":"Workaround script for IE"},{"url":"http://www.css3files.com/transform/","title":"Information page"},{"url":"http://www.useragentman.com/IETransformsTranslator/","title":"Converter for IE"},{"url":"http://docs.webplatform.org/wiki/css/transforms/transform","title":"WebPlatform Docs"}],"categories":["CSS3"],"stats":{"ie":{"5.5":"n","6":"p","7":"p","8":"p","9":"y x","10":"y","11":"y"},"firefox":{"2":"n","3":"n","3.5":"y x","3.6":"y x","4":"y x","5":"y x","6":"y x","7":"y x","8":"y x","9":"y x","10":"y x","11":"y x","12":"y x","13":"y x","14":"y x","15":"y x","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y x","5":"y x","6":"y x","7":"y x","8":"y x","9":"y x","10":"y x","11":"y x","12":"y x","13":"y x","14":"y x","15":"y x","16":"y x","17":"y x","18":"y x","19":"y x","20":"y x","21":"y x","22":"y x","23":"y x","24":"y x","25":"y x","26":"y x","27":"y x","28":"y x","29":"y x","30":"y x","31":"y x","32":"y x","33":"y x","34":"y x","35":"y x","36":"y","37":"y","38":"y"},"safari":{"3.1":"y x","3.2":"y x","4":"y x","5":"y x","5.1":"y x","6":"y x","6.1":"y x","7":"y x","8":"y x"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"y x","10.6":"y x","11":"y x","11.1":"y x","11.5":"y x","11.6":"y x","12":"y x","12.1":"y","15":"y x","16":"y x","17":"y x","18":"y x","19":"y x","20":"y x","21":"y x","22":"y x","23":"y","24":"y"},"ios_saf":{"3.2":"y x","4.0-4.1":"y x","4.2-4.3":"y x","5.0-5.1":"y x","6.0-6.1":"y x","7.0-7.1":"y x","8":"y x"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"y x","2.2":"y x","2.3":"y x","3":"y x","4":"y x","4.1":"y x","4.2-4.3":"y x","4.4":"y x","4.4.3":"y x"},"bb":{"7":"y x","10":"y x"},"op_mob":{"10":"n","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y x"},"and_chr":{"0":"y x"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"The scale transform can be emulated in IE < 9 using Microsoft's \"zoom\" extension, others are (not easily) possible using the MS Matrix filter","usage_perc_y":85.27,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":"transformation,translate,rotation,rotate,scale,css-transforms"},"use-strict":{"title":"ECMAScript 5 Strict Mode","description":"Method of placing code in a \"strict\" operating context.","spec":"http://ecma-international.org/ecma-262/5.1/#sec-14.1","status":"other","links":[{"url":"http://ejohn.org/blog/ecmascript-5-strict-mode-json-and-more/","title":"Information page"},{"url":"http://javascriptweblog.wordpress.com/2011/05/03/javascript-strict-mode/","title":"Article with test suite"}],"categories":["Other"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"y","11":"y"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"a","5.1":"a","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"Partial support in older Safari refers to strict mode still accepting a lot of JS that should be considered invalid.","usage_perc_y":80.03,"usage_perc_a":0.87,"ucprefix":false,"parent":"","keywords":""},"transforms3d":{"title":"CSS3 3D Transforms","description":"Method of transforming an element in the third dimension","spec":"http://www.w3.org/TR/css3-3d-transforms/","status":"wd","links":[{"url":"http://css3.bradshawenterprises.com/flip/","title":"Multi-browser demo"},{"url":"http://thewebrocks.com/demos/3D-css-tester/","title":"3D CSS Tester"},{"url":"http://hacks.mozilla.org/2011/10/css-3d-transformations-in-firefox-nightly/","title":"Mozilla hacks article"},{"url":"https://raw.github.com/phiggins42/has.js/master/detect/css.js#css-transform","title":"has.js test"},{"url":"http://docs.webplatform.org/wiki/css/transforms/transform","title":"WebPlatform Docs"}],"categories":["CSS3"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"a","11":"a"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"y x","11":"y x","12":"y x","13":"y x","14":"y x","15":"y x","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"y x","13":"y x","14":"y x","15":"y x","16":"y x","17":"y x","18":"y x","19":"y x","20":"y x","21":"y x","22":"y x","23":"y x","24":"y x","25":"y x","26":"y x","27":"y x","28":"y x","29":"y x","30":"y x","31":"y x","32":"y x","33":"y x","34":"y x","35":"y x","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"y x","5":"y x","5.1":"y x","6":"y x","6.1":"y x","7":"y x","8":"y x"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"y x","16":"y x","17":"y x","18":"y x","19":"y x","20":"y x","21":"y x","22":"y x","23":"y","24":"y"},"ios_saf":{"3.2":"y x","4.0-4.1":"y x","4.2-4.3":"y x","5.0-5.1":"y x","6.0-6.1":"y x","7.0-7.1":"y x","8":"y x"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"y x","4":"y x","4.1":"y x","4.2-4.3":"y x","4.4":"y x","4.4.3":"y x"},"bb":{"7":"y x","10":"y x"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"y x"},"and_chr":{"0":"y x"},"and_ff":{"0":"y"},"ie_mob":{"10":"a"}},"notes":"Partial support in IE refers to not supporting <a href=\"http://msdn.microsoft.com/en-us/library/ie/hh673529%28v=vs.85%29.aspx#the_ms_transform_style_property\">the transform-style: preserve-3d property</a>. This prevents nesting 3D transformed elements.","usage_perc_y":70.24,"usage_perc_a":10.22,"ucprefix":false,"parent":"","keywords":"css 3d,3dtransforms,translate3d,transform3d"},"sharedworkers":{"title":"Shared Web Workers","description":"Method of allowing multiple scripts to communicate with a single web worker.","spec":"http://www.w3.org/TR/workers/#shared-workers-introduction","status":"cr","links":[{"url":"http://greenido.wordpress.com/2011/11/03/web-workers-part-3-out-of-3-shared-wrokers/","title":"Blog post"},{"url":"http://www.sitepoint.com/javascript-shared-web-workers-html5/","title":"Sitepoint article"}],"categories":["JS API"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"y","5.1":"y","6":"y","6.1":"n","7":"n","8":"n"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"n","8":"n"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"n","4.4.3":"n"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"u","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"n"},"and_chr":{"0":"n"},"and_ff":{"0":"y"},"ie_mob":{"10":"n"}},"notes":"","usage_perc_y":49.35,"usage_perc_a":0,"ucprefix":false,"parent":"webworkers","keywords":"shared worker"},"css-hyphens":{"title":"CSS Hyphenation","description":"Method of controlling when words at the end of lines should be hyphenated using the \"hyphens\" property.","spec":"http://www.w3.org/TR/css3-text/#hyphenation","status":"wd","links":[{"url":"http://blog.fontdeck.com/post/9037028497/hyphens","title":"Blog post"},{"url":"http://docs.webplatform.org/wiki/css/properties/hyphens","title":"WebPlatform Docs"},{"url":"https://developer.mozilla.org/en/CSS/hyphens","title":"MDN article"}],"categories":["CSS3"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"y x","11":"y x"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"y x","7":"y x","8":"y x","9":"y x","10":"y x","11":"y x","12":"y x","13":"y x","14":"y x","15":"y x","16":"y x","17":"y x","18":"y x","19":"y x","20":"y x","21":"y x","22":"y x","23":"y x","24":"y x","25":"y x","26":"y x","27":"y x","28":"y x","29":"y x","30":"y x","31":"y x","32":"y x","33":"y x"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"n","32":"n","33":"n","34":"n","35":"n","36":"n","37":"n","38":"n"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"y x","6":"y x","6.1":"y x","7":"y x","8":"y x"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"y x","5.0-5.1":"y x","6.0-6.1":"y x","7.0-7.1":"y x","8":"y x"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"n","4.4.3":"n"},"bb":{"7":"n","10":"n"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"n"},"and_chr":{"0":"n"},"and_ff":{"0":"y x"},"ie_mob":{"10":"n"}},"notes":"Chrome 29- and Android 4.0 Browser support \"-webkit-hyphens: none\", but not the \"auto\" property. Chrome 30+ doesn't support it either.","usage_perc_y":33.54,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":"hyphen,shy"},"css-transitions":{"title":"CSS3 Transitions","description":"Simple method of animating certain properties of an element","spec":"http://www.w3.org/TR/css3-transitions/","status":"wd","links":[{"url":"http://www.webdesignerdepot.com/2010/01/css-transitions-101/","title":"Article on usage"},{"url":"http://www.the-art-of-web.com/css/timing-function/","title":"Examples on timing functions"},{"url":"http://www.opera.com/docs/specs/presto2.12/css/transitions/#anima","title":"Animation of property types support in Opera"},{"url":"http://www.css3files.com/transition/","title":"Information page"},{"url":"http://docs.webplatform.org/wiki/css/properties/transition","title":"WebPlatform Docs"}],"categories":["CSS3"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"y","11":"y"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"y x","5":"y x","6":"y x","7":"y x","8":"y x","9":"y x","10":"y x","11":"y x","12":"y x","13":"y x","14":"y x","15":"y x","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y x","5":"y x","6":"y x","7":"y x","8":"y x","9":"y x","10":"y x","11":"y x","12":"y x","13":"y x","14":"y x","15":"y x","16":"y x","17":"y x","18":"y x","19":"y x","20":"y x","21":"y x","22":"y x","23":"y x","24":"y x","25":"y x","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"y x","3.2":"y x","4":"y x","5":"y x","5.1":"y x","6":"y x","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"y x","10.6":"y x","11":"y x","11.1":"y x","11.5":"y x","11.6":"y x","12":"y x","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"y x","4.0-4.1":"y x","4.2-4.3":"y x","5.0-5.1":"y x","6.0-6.1":"y x","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"y x","2.2":"y x","2.3":"y x","3":"y x","4":"y x","4.1":"y x","4.2-4.3":"y x","4.4":"y","4.4.3":"y"},"bb":{"7":"y x","10":"y x"},"op_mob":{"10":"y x","11":"y x","11.1":"y x","11.5":"y x","12":"y x","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"","usage_perc_y":82.5,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":"css transition"},"font-feature":{"title":"Font feature settings","description":"Method of applying advanced typographic and language-specific font features to supported OpenType fonts.","spec":"http://w3.org/TR/css3-fonts/#font-rend-props","status":"wd","links":[{"url":"http://ie.microsoft.com/testdrive/Graphics/opentype/","title":"Demo pages (IE/Firefox only)"},{"url":"http://hacks.mozilla.org/2010/11/firefox-4-font-feature-support/","title":"Mozilla hacks article"},{"url":"http://html5accessibility.com/","title":"Detailed tables on accessability support"},{"url":"http://docs.webplatform.org/wiki/css/properties/font-feature-settings","title":"WebPlatform Docs"}],"categories":["CSS3"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"y","11":"y"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"a x","5":"a x","6":"a x","7":"a x","8":"a x","9":"a x","10":"a x","11":"a x","12":"a x","13":"a x","14":"a x","15":"y x","16":"y x","17":"y x","18":"y x","19":"y x","20":"y x","21":"y x","22":"y x","23":"y x","24":"y x","25":"y x","26":"y x","27":"y x","28":"y x","29":"y x","30":"y x","31":"y x","32":"y x","33":"y x"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"a x","17":"a x","18":"a x","19":"a x","20":"a x","21":"y x","22":"y x","23":"y x","24":"y x","25":"y x","26":"y x","27":"y x","28":"y x","29":"y x","30":"y x","31":"y x","32":"y x","33":"y x","34":"y x","35":"y x","36":"y x","37":"y x","38":"y x"},"safari":{"3.1":"n","3.2":"n","4":"a","5":"a","5.1":"a","6":"a","6.1":"n","7":"n","8":"n"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"y x","16":"y x","17":"y x","18":"y x","19":"y x","20":"y x","21":"y x","22":"y x","23":"y x","24":"y x"},"ios_saf":{"3.2":"a","4.0-4.1":"a","4.2-4.3":"a","5.0-5.1":"a","6.0-6.1":"a","7.0-7.1":"y x","8":"y x"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"y x","4.4.3":"y x"},"bb":{"7":"n","10":"y x"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"y x"},"and_chr":{"0":"y x"},"and_ff":{"0":"y x"},"ie_mob":{"10":"n"}},"notes":"Partial support in older Firefox versions refers to using an older syntax. Partial support in older Chrome versions refers to lacking support in Mac OS X. ","usage_perc_y":69.91,"usage_perc_a":2.96,"ucprefix":false,"parent":"","keywords":"font-feature,font-feature-settings,kern,kerning,font-variant-alternates,ligatures,font-variant-ligatures"},"css-animation":{"title":"CSS3 Animation","description":"Complex method of animating certain properties of an element","spec":"http://www.w3.org/TR/css3-animations/","status":"wd","links":[{"url":"http://robertnyman.com/2010/05/06/css3-animations/","title":"Blog post on usage"},{"url":"http://www.css3files.com/animation/","title":"Information page"},{"url":"http://docs.webplatform.org/wiki/css/properties/animations","title":"WebPlatform Docs"}],"categories":["CSS3"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"y","11":"y"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"y x","6":"y x","7":"y x","8":"y x","9":"y x","10":"y x","11":"y x","12":"y x","13":"y x","14":"y x","15":"y x","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y x","5":"y x","6":"y x","7":"y x","8":"y x","9":"y x","10":"y x","11":"y x","12":"y x","13":"y x","14":"y x","15":"y x","16":"y x","17":"y x","18":"y x","19":"y x","20":"y x","21":"y x","22":"y x","23":"y x","24":"y x","25":"y x","26":"y x","27":"y x","28":"y x","29":"y x","30":"y x","31":"y x","32":"y x","33":"y x","34":"y x","35":"y x","36":"y x","37":"y x","38":"y x"},"safari":{"3.1":"n","3.2":"n","4":"y x","5":"y x","5.1":"y x","6":"y x","6.1":"y x","7":"y x","8":"y x"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"y x","12.1":"y","15":"y x","16":"y x","17":"y x","18":"y x","19":"y x","20":"y x","21":"y x","22":"y x","23":"y x","24":"y x"},"ios_saf":{"3.2":"y x","4.0-4.1":"y x","4.2-4.3":"y x","5.0-5.1":"y x","6.0-6.1":"y x","7.0-7.1":"y x","8":"y x"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"a x","2.2":"a x","2.3":"a x","3":"a x","4":"y x","4.1":"y x","4.2-4.3":"y x","4.4":"y x","4.4.3":"y x"},"bb":{"7":"y x","10":"y x"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"y","0":"y x"},"and_chr":{"0":"y x"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"Partial support in Android browser refers to buggy behavior in different scenarios.","usage_perc_y":81.27,"usage_perc_a":1.11,"ucprefix":false,"parent":"","keywords":"animations,css-animations,keyframe,keyframes"},"css-gradients":{"title":"CSS Gradients","description":"Method of defining a linear or radial color gradient as a CSS image.","spec":"http://www.w3.org/TR/css3-images/","status":"cr","links":[{"url":"http://css3pie.com/","title":"Tool to emulate support in IE"},{"url":"http://www.css3files.com/gradient/","title":"Information page"},{"url":"http://www.colorzilla.com/gradient-editor/","title":"Cross-browser editor"},{"url":"http://docs.webplatform.org/wiki/css/functions/linear-gradient","title":"WebPlatform Docs"}],"categories":["CSS3"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"y","11":"y"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"y x","4":"y x","5":"y x","6":"y x","7":"y x","8":"y x","9":"y x","10":"y x","11":"y x","12":"y x","13":"y x","14":"y x","15":"y x","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"a x","5":"a x","6":"a x","7":"a x","8":"a x","9":"a x","10":"y x","11":"y x","12":"y x","13":"y x","14":"y x","15":"y x","16":"y x","17":"y x","18":"y x","19":"y x","20":"y x","21":"y x","22":"y x","23":"y x","24":"y x","25":"y x","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"a x","5":"a x","5.1":"y x","6":"y x","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"a x","11.5":"a x","11.6":"y x","12":"y x","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"a x","4.0-4.1":"a x","4.2-4.3":"a x","5.0-5.1":"y x","6.0-6.1":"y x","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"a x","2.2":"a x","2.3":"a x","3":"a x","4":"y x","4.1":"y x","4.2-4.3":"y x","4.4":"y","4.4.3":"y"},"bb":{"7":"a x","10":"y x"},"op_mob":{"10":"n","11":"n","11.1":"a x","11.5":"a x","12":"y x","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"Partial support in Opera 11.10 and 11.50 also refers to only having support for linear gradients. Support can be somewhat emulated in older IE versions using the non-standard \"gradient\" filter. Firefox 10+, Opera 11.6+, Chrome 26+ and IE10 also support the new \"to (side)\" syntax.","usage_perc_y":80.92,"usage_perc_a":1.69,"ucprefix":false,"parent":"","keywords":"linear,linear-gradient,gradiant"},"css-canvas":{"title":"CSS Canvas Drawings","description":"Method of using HTML5 Canvas as a background image","spec":"http://webkit.org/blog/176/css-canvas-drawing/","status":"unoff","links":[{"url":"http://webkit.org/blog/176/css-canvas-drawing/","title":"Webkit blog post"}],"categories":["CSS"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"u","32":"u","33":"u"},"chrome":{"4":"y x","5":"y x","6":"y x","7":"y x","8":"y x","9":"y x","10":"y x","11":"y x","12":"y x","13":"y x","14":"y x","15":"y x","16":"y x","17":"y x","18":"y x","19":"y x","20":"y x","21":"y x","22":"y x","23":"y x","24":"y x","25":"y x","26":"y x","27":"y x","28":"y x","29":"y x","30":"y x","31":"y x","32":"y x","33":"y x","34":"y x","35":"y x","36":"y x","37":"y x","38":"y x"},"safari":{"3.1":"n","3.2":"n","4":"y x","5":"y x","5.1":"y x","6":"y x","6.1":"y x","7":"y x","8":"y x"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"y x","16":"y x","17":"y x","18":"y x","19":"y x","20":"y x","21":"y x","22":"y x","23":"y x","24":"y x"},"ios_saf":{"3.2":"y x","4.0-4.1":"y x","4.2-4.3":"y x","5.0-5.1":"y x","6.0-6.1":"y x","7.0-7.1":"y x","8":"y x"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"y x","2.2":"y x","2.3":"y x","3":"y x","4":"y x","4.1":"y x","4.2-4.3":"y x","4.4":"y x","4.4.3":"y x"},"bb":{"7":"y x","10":"y x"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"y x"},"and_chr":{"0":"y x"},"and_ff":{"0":"n"},"ie_mob":{"10":"n"}},"notes":"Proposal by Webkit, being considered for W3C standardization. A similar effect can be achieved in Firefox 4+ using the -moz-element() background property","usage_perc_y":57.87,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":""},"css-reflections":{"title":"CSS Reflections","description":"Method of displaying a reflection of an element","spec":"http://webkit.org/blog/182/css-reflections/","status":"unoff","links":[{"url":"http://webkit.org/blog/182/css-reflections/","title":"Webkit blog post"}],"categories":["CSS"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"n","32":"n","33":"n"},"chrome":{"4":"y x","5":"y x","6":"y x","7":"y x","8":"y x","9":"y x","10":"y x","11":"y x","12":"y x","13":"y x","14":"y x","15":"y x","16":"y x","17":"y x","18":"y x","19":"y x","20":"y x","21":"y x","22":"y x","23":"y x","24":"y x","25":"y x","26":"y x","27":"y x","28":"y x","29":"y x","30":"y x","31":"y x","32":"y x","33":"y x","34":"y x","35":"y x","36":"y x","37":"y x","38":"y x"},"safari":{"3.1":"n","3.2":"n","4":"y x","5":"y x","5.1":"y x","6":"y x","6.1":"y x","7":"y x","8":"y x"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"y x","16":"y x","17":"y x","18":"y x","19":"y x","20":"y x","21":"y x","22":"y x","23":"y x","24":"y x"},"ios_saf":{"3.2":"y x","4.0-4.1":"y x","4.2-4.3":"y x","5.0-5.1":"y x","6.0-6.1":"y x","7.0-7.1":"y x","8":"y x"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"y x","2.2":"y x","2.3":"y x","3":"y x","4":"y x","4.1":"y x","4.2-4.3":"y x","4.4":"y x","4.4.3":"y x"},"bb":{"7":"y x","10":"y x"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"y x"},"and_chr":{"0":"y x"},"and_ff":{"0":"n"},"ie_mob":{"10":"n"}},"notes":"Similar effect can be achieved in Firefox 4+ using the -moz-element() background property","usage_perc_y":57.87,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":"box-reflect"},"css-masks":{"title":"CSS Masks","description":"Method of displaying part of an element, using a selected image as a mask","spec":"http://www.w3.org/TR/css-masking/","status":"wd","links":[{"url":"http://www.html5rocks.com/en/tutorials/masking/adobe/","title":"HTML5 Rocks article"},{"url":"http://docs.webplatform.org/wiki/css/properties/mask","title":"WebPlatform Docs"},{"url":"http://thenittygritty.co/css-masking","title":"Detailed blog post"}],"categories":["CSS"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n"},"firefox":{"2":"n","3":"n","3.5":"a","3.6":"a","4":"a","5":"a","6":"a","7":"a","8":"a","9":"a","10":"a","11":"a","12":"a","13":"a","14":"a","15":"a","16":"a","17":"a","18":"a","19":"a","20":"a","21":"a","22":"a","23":"a","24":"a","25":"a","26":"a","27":"a","28":"a","29":"a","30":"a","31":"a","32":"a","33":"a"},"chrome":{"4":"a x","5":"a x","6":"a x","7":"a x","8":"a x","9":"a x","10":"a x","11":"a x","12":"a x","13":"a x","14":"a x","15":"a x","16":"a x","17":"a x","18":"a x","19":"a x","20":"a x","21":"a x","22":"a x","23":"a x","24":"a x","25":"a x","26":"a x","27":"a x","28":"a x","29":"a x","30":"a x","31":"a x","32":"a x","33":"a x","34":"a x","35":"a x","36":"a x","37":"a x","38":"a x"},"safari":{"3.1":"n","3.2":"n","4":"a x","5":"a x","5.1":"a x","6":"a x","6.1":"a x","7":"a x","8":"a x"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"a x","16":"a x","17":"a x","18":"a x","19":"a x","20":"a x","21":"a x","22":"a x","23":"a x","24":"a x"},"ios_saf":{"3.2":"a x","4.0-4.1":"a x","4.2-4.3":"a x","5.0-5.1":"a x","6.0-6.1":"a x","7.0-7.1":"a x","8":"a x"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"a x","2.2":"a x","2.3":"a x","3":"a x","4":"a x","4.1":"a x","4.2-4.3":"a x","4.4":"a x","4.4.3":"a x"},"bb":{"7":"a x","10":"a x"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"a x"},"and_chr":{"0":"a x"},"and_ff":{"0":"a"},"ie_mob":{"10":"n"}},"notes":"Partial support in WebKit/Blink browsers refers to supporting the mask-image and mask-box-image properties, but lacks support for othe parts of the spec. Partial support in Firefox refers to only support for inline SVG mask elements i.e. mask: url(#foo).","usage_perc_y":0,"usage_perc_a":71.95,"ucprefix":false,"parent":"","keywords":""},"svg":{"title":"SVG (basic support)","description":"Method of displaying basic Vector Graphics features using the embed or object elements. Refers to the SVG 1.1 spec.","spec":"http://www.w3.org/TR/SVG/","status":"rec","links":[{"url":"http://svg-edit.googlecode.com","title":"Web-based SVG editor"},{"url":"https://raw.github.com/phiggins42/has.js/master/detect/graphics.js#svg","title":"has.js test"},{"url":"http://www.alistapart.com/articles/using-svg-for-flexible-scalable-and-fun-backgrounds-part-i","title":"A List Apart article"},{"url":"http://en.wikipedia.org/wiki/Scalable_Vector_Graphics","title":"Wikipedia"},{"url":"http://code.google.com/p/svgweb/","title":"SVG Web: Flash-based polyfill"},{"url":"http://svg-wow.org/","title":"SVG showcase site"}],"categories":["SVG"],"stats":{"ie":{"5.5":"n","6":"p","7":"p","8":"p","9":"y","10":"y","11":"y"},"firefox":{"2":"a","3":"y","3.5":"y","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"a","3.2":"y","4":"y","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"y","9.5-9.6":"y","10.0-10.1":"y","10.5":"y","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"y","4.0-4.1":"y","4.2-4.3":"y","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"y"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"y","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"","usage_perc_y":87.46,"usage_perc_a":0.01,"ucprefix":false,"parent":"","keywords":""},"svg-css":{"title":"SVG in CSS backgrounds","description":"Method of using SVG images as CSS backgrounds","spec":"http://www.w3.org/TR/css3-background/#background-image","status":"cr","links":[{"url":"http://designfestival.com/a-farewell-to-css3-gradients/","title":"Tutorial for advanced effects"}],"categories":["SVG","CSS3"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"y","10":"y","11":"y"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"a","5":"a","6":"a","7":"a","8":"a","9":"a","10":"a","11":"a","12":"a","13":"a","14":"a","15":"a","16":"a","17":"a","18":"a","19":"a","20":"a","21":"a","22":"a","23":"a","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"a","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"a","4":"a","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"y","10.0-10.1":"y","10.5":"y","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"a","4.0-4.1":"a","4.2-4.3":"y","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"a"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"a","11":"a","11.1":"a","11.5":"a","12":"a","12.1":"a","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"Partial support in older Firefox and Opera Mini/Mobile refers to SVG images being blurry when scaled. Partial support in iOS Safari and older Safari versions refers to failing to support tiling or the background-position property.","usage_perc_y":82.39,"usage_perc_a":4.82,"ucprefix":false,"parent":"","keywords":"svg-in-css,svgincss,css-svg"},"svg-smil":{"title":"SVG SMIL animation","description":"Method of using animation elements to animate SVG images","spec":"http://www.w3.org/TR/SVG/animate.html","status":"rec","links":[{"url":"http://svg-wow.org/blog/category/animation/","title":"Examples on SVG WOW"},{"url":"http://leunen.me/fakesmile/","title":"JS library to support SMIL in SVG"},{"url":"https://github.com/madsgraphics/SVGEventListener","title":"Polyfill for SMIL animate events on SVG"},{"url":"https://raw.github.com/phiggins42/has.js/master/detect/graphics.js#svg-smil","title":"has.js test"},{"url":"https://developer.mozilla.org/en/SVG/SVG_animation_with_SMIL","title":"MDN article"}],"categories":["SVG"],"stats":{"ie":{"5.5":"n","6":"p","7":"p","8":"p","9":"p","10":"p","11":"p"},"firefox":{"2":"p","3":"p","3.5":"p","3.6":"p","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"a","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"p","3.2":"p","4":"a","5":"a","5.1":"a","6":"a","6.1":"y","7":"y","8":"y"},"opera":{"9":"y","9.5-9.6":"y","10.0-10.1":"y","10.5":"y","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"a","4.0-4.1":"a","4.2-4.3":"a","5.0-5.1":"a","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"y","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"p"}},"notes":"Partial support in Safari refers to not working in HTML files.","usage_perc_y":69.63,"usage_perc_a":1.56,"ucprefix":false,"parent":"","keywords":""},"svg-fonts":{"title":"SVG fonts","description":"Method of using fonts defined as SVG shapes","spec":"http://www.w3.org/TR/SVG/fonts.html","status":"rec","links":[{"url":"http://opentype.info/blog/2010/04/13/the-ipad-and-svg-fonts-in-mobile-safari/","title":"Blog post on usage for iPad"},{"url":"http://jeremie.patonnier.net/post/2011/02/07/Why-are-SVG-Fonts-so-different","title":"Blog post"}],"categories":["SVG"],"stats":{"ie":{"5.5":"n","6":"p","7":"p","8":"p","9":"n","10":"n","11":"n"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"n","32":"n","33":"n"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"y","4":"y","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"y","9.5-9.6":"y","10.0-10.1":"y","10.5":"y","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"y","4.0-4.1":"y","4.2-4.3":"y","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"y","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"n"},"ie_mob":{"10":"n"}},"notes":"Supported in Opera Mini in SVG images only, not in HTML.","usage_perc_y":57.28,"usage_perc_a":0,"ucprefix":false,"parent":"fontface","keywords":""},"svg-filters":{"title":"SVG filters","description":"Method of using photoshop-like effects on SVG objects including blurring and color manipulation.","spec":"http://www.w3.org/TR/SVG/filters.html","status":"rec","links":[{"url":"http://electricbeach.org/?p=950","title":"Experiments with filter effects"},{"url":"http://docs.webplatform.org/wiki/svg/elements/filter","title":"WebPlatform Docs"},{"url":"http://svg-wow.org/blog/category/filters/","title":"SVG filter demos"}],"categories":["SVG"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"y","11":"y"},"firefox":{"2":"n","3":"y","3.5":"y","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"n","5":"a","6":"a","7":"a","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"y","9.5-9.6":"y","10.0-10.1":"y","10.5":"y","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"y"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"y","4.4.3":"y"},"bb":{"7":"n","10":"y"},"op_mob":{"10":"y","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"","usage_perc_y":78.54,"usage_perc_a":0.05,"ucprefix":false,"parent":"","keywords":""},"svg-html":{"title":"SVG effects for HTML","description":"Method of using SVG transforms, filters, etc on HTML elements using either CSS or the foreignObject element","spec":"http://www.w3.org/TR/SVG11/extend.html#ForeignObjectElement","status":"wd","links":[{"url":"https://dvcs.w3.org/hg/FXTF/raw-file/tip/filters/index.html","title":"Filter Effects draft"},{"url":"https://developer.mozilla.org/en/SVG/Tutorial/Other_content_in_SVG","title":"MDN Tutorial"},{"url":"https://developer.mozilla.org/En/Applying_SVG_effects_to_HTML_content","title":"MDN Reference page"}],"categories":["SVG"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"a","10":"a","11":"a"},"firefox":{"2":"n","3":"a","3.5":"y","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"a","5":"a","6":"a","7":"a","8":"a","9":"a","10":"a","11":"a","12":"a","13":"a","14":"a","15":"a","16":"a","17":"a","18":"a","19":"a","20":"a","21":"a","22":"a","23":"a","24":"a","25":"a","26":"a","27":"a","28":"a","29":"a","30":"a","31":"a","32":"a","33":"a","34":"a","35":"a","36":"a","37":"a","38":"a"},"safari":{"3.1":"n","3.2":"n","4":"a","5":"a","5.1":"a","6":"a","6.1":"a","7":"a","8":"a"},"opera":{"9":"a","9.5-9.6":"a","10.0-10.1":"a","10.5":"a","10.6":"a","11":"a","11.1":"a","11.5":"a","11.6":"a","12":"a","12.1":"a","15":"a","16":"a","17":"a","18":"a","19":"a","20":"a","21":"a","22":"a","23":"a","24":"a"},"ios_saf":{"3.2":"a","4.0-4.1":"a","4.2-4.3":"a","5.0-5.1":"a","6.0-6.1":"a","7.0-7.1":"a","8":"a"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"a","4.4.3":"a"},"bb":{"7":"n","10":"y"},"op_mob":{"10":"a","11":"a","11.1":"a","11.5":"a","12":"a","12.1":"a","0":"a"},"and_chr":{"0":"a"},"and_ff":{"0":"y"},"ie_mob":{"10":"n"}},"notes":"Partial support refers to lack of filter support or buggy result from effects. A <a href=\"https://dvcs.w3.org/hg/FXTF/raw-file/tip/filters/index.html\">CSS Filter Effects</a> specification is in the works that would replace this method.","usage_perc_y":14.08,"usage_perc_a":64.74,"ucprefix":false,"parent":"","keywords":""},"svg-html5":{"title":"Inline SVG in HTML5","description":"Method of using SVG tags directly in HTML documents. Requires HTML5 parser.","spec":"http://www.w3.org/TR/html5/embedded-content-0.html#svg-0","status":"cr","links":[{"url":"http://samples.msdn.microsoft.com/ietestcenter/html5/svghtml_harness.htm?url=SVG_HTML_Elements_001","title":"Test suite"},{"url":"http://hacks.mozilla.org/2010/05/firefox-4-the-html5-parser-inline-svg-speed-and-more/","title":"Mozilla Hacks blog post"}],"categories":["SVG","HTML5"],"stats":{"ie":{"5.5":"n","6":"p","7":"p","8":"p","9":"y","10":"y","11":"y"},"firefox":{"2":"p","3":"p","3.5":"p","3.6":"p","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"p","5":"p","6":"p","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"p","3.2":"p","4":"p","5":"p","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"p","9.5-9.6":"p","10.0-10.1":"p","10.5":"p","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"p","4.0-4.1":"p","4.2-4.3":"p","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"p","11":"p","11.1":"p","11.5":"p","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"","usage_perc_y":83.53,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":""},"canvas":{"title":"Canvas (basic support)","description":"Method of generating fast, dynamic graphics using JavaScript","spec":"http://www.w3.org/TR/html5/embedded-content-0.html#the-canvas-element","status":"cr","links":[{"url":"https://raw.github.com/phiggins42/has.js/master/detect/graphics.js#canvas","title":"has.js test"},{"url":"http://www.canvasdemos.com/","title":"Showcase site"},{"url":"https://developer.mozilla.org/en/Canvas_tutorial","title":"Tutorial by Mozilla"},{"url":"http://explorercanvas.googlecode.com/","title":"Implementation for Internet Explorer"},{"url":"http://www.diveinto.org/html5/canvas.html","title":"Another tutorial"},{"url":"http://glimr.rubyforge.org/cake/canvas.html","title":"Animation kit "}],"categories":["Canvas","HTML5"],"stats":{"ie":{"5.5":"n","6":"p","7":"p","8":"p","9":"y","10":"y","11":"y"},"firefox":{"2":"y","3":"y","3.5":"y","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"y","3.2":"y","4":"y","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"y","9.5-9.6":"y","10.0-10.1":"y","10.5":"y","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"y","4.0-4.1":"y","4.2-4.3":"y","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"a"},"android":{"2.1":"a","2.2":"a","2.3":"a","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"y","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"Opera Mini supports the canvas element, but is unable to play animations or run other more complex applications. Android 2.x supports canvas except the toDataURL() function. See http://code.google.com/p/android/issues/detail?id=7901 Some (slow) workarounds are described here: http://stackoverflow.com/q/10488033/841830","usage_perc_y":84.27,"usage_perc_a":4.3,"ucprefix":false,"parent":"","keywords":""},"canvas-text":{"title":"Text API for Canvas","description":"Method of displaying text on Canvas elements","spec":"http://www.whatwg.org/specs/web-apps/current-work/multipage/the-canvas-element.html#text-0","status":"wd","links":[{"url":"https://raw.github.com/phiggins42/has.js/master/detect/graphics.js#canvas-text","title":"has.js test"},{"url":"http://code.google.com/p/canvas-text/","title":"Support library"},{"url":"https://developer.mozilla.org/en/Drawing_text_using_a_canvas#Additional_examples","title":"Examples by Mozilla"},{"url":"http://docs.webplatform.org/wiki/apis/canvas/CanvasRenderingContext2D/fillText","title":"WebPlatform Docs"}],"categories":["Canvas","HTML5"],"stats":{"ie":{"5.5":"n","6":"p","7":"p","8":"p","9":"y","10":"y","11":"y"},"firefox":{"2":"p","3":"p","3.5":"y","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"p","3.2":"p","4":"y","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"p","9.5-9.6":"p","10.0-10.1":"p","10.5":"y","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"y","4.0-4.1":"y","4.2-4.3":"y","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"y","2.2":"y","2.3":"y","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"p","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"","usage_perc_y":85.26,"usage_perc_a":0,"ucprefix":false,"parent":"canvas","keywords":""},"namevalue-storage":{"title":"Web Storage - name/value pairs","description":"Method of storing data locally like cookies, but for larger amounts of data (sessionStorage and localStorage, used to fall under HTML5).","spec":"http://www.w3.org/TR/webstorage/#storage","status":"rec","links":[{"url":"http://code.google.com/p/sessionstorage/","title":"Support library"},{"url":"http://docs.webplatform.org/wiki/apis/web-storage/Storage/localStorage","title":"WebPlatform Docs"},{"url":"http://html5demos.com/storage","title":"Simple demo"},{"url":"https://developer.mozilla.org/En/DOM/Storage","title":"Gecko reference"},{"url":"https://raw.github.com/phiggins42/has.js/master/detect/features.js#native-localstorage;native-sessionstorage","title":"has.js test"}],"categories":["JS API"],"stats":{"ie":{"5.5":"n","6":"p","7":"p","8":"y","9":"y","10":"y","11":"y"},"firefox":{"2":"a","3":"a","3.5":"y","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"y","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"y","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"y","4.0-4.1":"y","4.2-4.3":"y","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"y","2.2":"y","2.3":"y","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"n","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"","usage_perc_y":89.72,"usage_perc_a":0.09,"ucprefix":false,"parent":"","keywords":"webstorage,local storage"},"sql-storage":{"title":"Web SQL Database","description":"Method of storing data client-side, allows Sqlite database queries for access and manipulation","spec":"http://www.w3.org/TR/webdatabase/","status":"unoff","links":[{"url":"https://raw.github.com/phiggins42/has.js/master/detect/features.js#native-sql-db","title":"has.js test"},{"url":"http://html5doctor.com/introducing-web-sql-databases/","title":"HTML5 Doctor article"}],"categories":["JS API"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"n","32":"n","33":"n"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"y","3.2":"y","4":"y","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"y","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"y","4.0-4.1":"y","4.2-4.3":"y","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"y","2.2":"y","2.3":"y","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"n","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"n"},"ie_mob":{"10":"n"}},"notes":"The Web SQL Database specification is no longer being maintained and support may be dropped in future versions.","usage_perc_y":58.36,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":"db-storage,websql"},"indexeddb":{"title":"IndexedDB","description":"Method of storing data client-side, allows indexed database queries. Previously known as WebSimpleDB API.","spec":"http://www.w3.org/TR/IndexedDB/","status":"cr","links":[{"url":"https://raw.github.com/phiggins42/has.js/master/detect/features.js#native-indexeddb","title":"has.js test"},{"url":"https://github.com/axemclion/IndexedDBShim","title":"Polyfill for browsers supporting WebSQL"},{"url":"http://docs.webplatform.org/wiki/apis/indexedDB","title":"WebPlatform Docs"},{"url":"http://hacks.mozilla.org/2010/06/comparing-indexeddb-and-webdatabase/","title":"Mozilla Hacks article"}],"categories":["JS API"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"a","11":"a"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"a x","5":"a x","6":"a x","7":"a x","8":"a x","9":"a x","10":"y x","11":"y x","12":"y x","13":"y x","14":"y x","15":"y x","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"p","5":"p","6":"p","7":"p","8":"p","9":"p","10":"n","11":"a x","12":"a x","13":"a x","14":"a x","15":"a x","16":"a x","17":"a x","18":"a x","19":"a x","20":"a x","21":"a x","22":"a x","23":"y x","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"p","3.2":"p","4":"p","5":"p","5.1":"p","6":"p","6.1":"p","7":"p","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"p","10.6":"p","11":"p","11.1":"p","11.5":"p","11.6":"p","12":"p","12.1":"p","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"p","4.0-4.1":"p","4.2-4.3":"p","5.0-5.1":"p","6.0-6.1":"p","7.0-7.1":"p","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"p","2.2":"p","2.3":"p","3":"p","4":"p","4.1":"p","4.2-4.3":"p","4.4":"y","4.4.3":"y"},"bb":{"7":"p","10":"a x"},"op_mob":{"10":"n","11":"p","11.1":"p","11.5":"p","12":"p","12.1":"p","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"Partial support in IE 10 & 11 refers to a number of subfeatures <a href=\"http://codepen.io/cemerick/pen/Itymi\">not being supported</a>. Partial support in BB10 refers to an <a href=\"http://www.w3.org/TR/2011/WD-IndexedDB-20110419/\">outdated specification</a> being implemented. Code targeting the <a href=\"http://www.w3.org/TR/IndexedDB/\">current state of the specification</a> might not work.","usage_perc_y":54.64,"usage_perc_a":10.93,"ucprefix":false,"parent":"","keywords":"indexdb"},"eventsource":{"title":"Server-sent DOM events","description":"Method of continuously sending data from a server to the browser, rather than repeatedly requesting it (EventSource interface, used to fall under HTML5)","spec":"http://www.w3.org/TR/eventsource/","status":"cr","links":[{"url":"https://raw.github.com/phiggins42/has.js/master/detect/features.js#native-eventsource","title":"has.js test"},{"url":"http://www.html5rocks.com/tutorials/eventsource/basics/","title":"HTML5 Rocks tutorial"},{"url":"http://samshull.blogspot.com/2010/10/ajax-push-in-ios-safari-and-chrome-with.html","title":"Blog post with demo"}],"categories":["JS API"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"n","5":"n","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"a","9.5-9.6":"a","10.0-10.1":"a","10.5":"a","10.6":"a","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"y","4.2-4.3":"y","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"a","11":"a","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"n"}},"notes":"","usage_perc_y":66.03,"usage_perc_a":0.05,"ucprefix":false,"parent":"","keywords":"serversent,s-sent-events"},"x-doc-messaging":{"title":"Cross-document messaging","description":"Method of sending information from a page on one domain to a page on a different one (using postMessage)","spec":"http://www.whatwg.org/specs/web-apps/current-work/multipage/comms.html#crossDocumentMessages","status":"wd","links":[{"url":"https://developer.mozilla.org/en/DOM/window.postMessage","title":"MDN article"},{"url":"https://raw.github.com/phiggins42/has.js/master/detect/features.js#native-crosswindowmessaging","title":"has.js test"},{"url":"http://docs.webplatform.org/wiki/apis/web-messaging/MessagePort/postMessage","title":"WebPlatform Docs"},{"url":"http://html5demos.com/postmessage2","title":"Simple demo"}],"categories":["JS API"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"a","9":"a","10":"a","11":"y"},"firefox":{"2":"n","3":"y","3.5":"y","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"y","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"y","10.0-10.1":"y","10.5":"y","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"y","4.0-4.1":"y","4.2-4.3":"y","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"y"},"android":{"2.1":"y","2.2":"y","2.3":"y","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"y","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"a"}},"notes":"Partial support in IE8-9 refers to only working in frames/iframes (not other tabs/windows). Also in IE 9 and below an object cannot be sent using postMessage. Partial support in IE10 refers to <a href=\"http://stackoverflow.com/questions/16226924/is-cross-origin-postmessage-broken-in-ie10\">limitations in certain conditions</a>","usage_perc_y":82.91,"usage_perc_a":10.1,"ucprefix":false,"parent":"","keywords":""},"datauri":{"title":"Data URIs","description":"Method of embedding images and other files in webpages as a string of text","spec":"http://www.ietf.org/rfc/rfc2397.txt","status":"other","links":[{"url":"http://en.wikipedia.org/wiki/data_URI_scheme","title":"Wikipedia"},{"url":"http://www.websiteoptimization.com/speed/tweak/inline-images/","title":"Data URL converter"},{"url":"http://css-tricks.com/5970-data-uris/","title":"Information page"}],"categories":["Other"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"a","9":"a","10":"a","11":"a"},"firefox":{"2":"y","3":"y","3.5":"y","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"y","3.2":"y","4":"y","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"y","9.5-9.6":"y","10.0-10.1":"y","10.5":"y","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"y","4.0-4.1":"y","4.2-4.3":"y","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"y"},"android":{"2.1":"y","2.2":"y","2.3":"y","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"y","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"a"}},"notes":"Support in Internet Explorer 8 is limited to images and linked resources like CSS files, not HTML files. Max URI length in IE8 is 32KB. In IE9+ JavaScript files are supported too and the maximum size limit set to 4GB.","usage_perc_y":75.75,"usage_perc_a":17.28,"ucprefix":false,"parent":"","keywords":"data url,datauris,data uri,dataurl,dataurls"},"mathml":{"title":"MathML","description":"Special tags that allow mathematical formulas and notations to be written on web pages.","spec":"http://www.w3.org/TR/MathML/","status":"rec","links":[{"url":"https://developer.mozilla.org/en/MathML/Element","title":"MDN element reference"},{"url":"http://www.mozilla.org/projects/mathml/demo/","title":"MathML demos"},{"url":"http://en.wikipedia.org/wiki/MathML","title":"Wikipedia"},{"url":"http://www.mathjax.org","title":"Cross-browser support script"}],"categories":["Other"],"stats":{"ie":{"5.5":"n","6":"p","7":"p","8":"p","9":"n","10":"n","11":"n"},"firefox":{"2":"y","3":"y","3.5":"y","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"p","5":"p","6":"p","7":"p","8":"p","9":"p","10":"p","11":"p","12":"p","13":"p","14":"p","15":"p","16":"p","17":"p","18":"p","19":"p","20":"p","21":"p","22":"p","23":"p","24":"y","25":"p","26":"p","27":"p","28":"p","29":"p","30":"p","31":"p","32":"p","33":"p","34":"p","35":"p","36":"p","37":"p","38":"p"},"safari":{"3.1":"p","3.2":"p","4":"p","5":"p","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"a","10.0-10.1":"a","10.5":"a","10.6":"a","11":"a","11.1":"a","11.5":"a","11.6":"a","12":"a","12.1":"a","15":"p","16":"p","17":"p","18":"p","19":"p","20":"p","21":"p","22":"p","23":"p","24":"p"},"ios_saf":{"3.2":"p","4.0-4.1":"p","4.2-4.3":"p","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"p"},"android":{"2.1":"p","2.2":"p","2.3":"p","3":"p","4":"p","4.1":"p","4.2-4.3":"p","4.4":"p","4.4.3":"p"},"bb":{"7":"p","10":"y"},"op_mob":{"10":"p","11":"p","11.1":"p","11.5":"p","12":"p","12.1":"p","0":"p"},"and_chr":{"0":"p"},"and_ff":{"0":"y"},"ie_mob":{"10":"n"}},"notes":"Opera's support is limited to a CSS profile of MathML. Support was added in Chrome 24, but removed afterwards due to instability.","usage_perc_y":24.05,"usage_perc_a":0.43,"ucprefix":false,"parent":"","keywords":""},"css-featurequeries":{"title":"CSS Feature Queries","description":"CSS Feature Queries allow authors to condition rules based on whether particular property declarations are supported in CSS using the @supports at rule.","spec":"http://www.w3.org/TR/css3-conditional/#at-supports","status":"cr","links":[{"url":"http://mcc.id.au/blog/2012/08/supports","title":"@supports in Firefox"},{"url":"https://developer.mozilla.org/en-US/docs/Web/CSS/@supports","title":"MDN Article"},{"url":"http://docs.webplatform.org/wiki/css/atrules/@supports","title":"WebPlatform Docs"},{"url":"http://dabblet.com/gist/3895764","title":"Test case"}],"categories":["CSS3"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"n","6.1":"n","7":"n","8":"n"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"n","8":"n"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"y","4.4.3":"y"},"bb":{"7":"n","10":"n"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"n"}},"notes":"","usage_perc_y":52.6,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":"supports,conditional"},"xhtml":{"title":"XHTML served as application/xhtml+xml","description":"A strict form of HTML, and allows embedding of other XML languages","spec":"http://www.w3.org/TR/xhtml1/","status":"rec","links":[{"url":"http://en.wikipedia.org/wiki/XHTML","title":"Wikipedia"},{"url":"http://www.xmlplease.com/xhtml/xhtml5polyglot/","title":"Information on XHTML5"},{"url":"http://docs.webplatform.org/wiki/concepts/internet_and_web/the_web_standards_model#What_is_XHTML.3F","title":"WebPlatform Docs"}],"categories":["Other"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"y","10":"y","11":"y"},"firefox":{"2":"y","3":"y","3.5":"y","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"y","3.2":"y","4":"y","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"y","9.5-9.6":"y","10.0-10.1":"y","10.5":"y","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"y","4.0-4.1":"y","4.2-4.3":"y","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"y"},"android":{"2.1":"y","2.2":"y","2.3":"y","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"y","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"The XHTML syntax is very close to HTML, and thus is almost always (<a href=\"https://developer.mozilla.org/en-US/docs/XHTML#MIME_type_versus_DOCTYPE\">incorrectly</a>) served as text/html on the web.","usage_perc_y":88.57,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":"xhtml+xml"},"xhtmlsmil":{"title":"XHTML+SMIL animation","description":"Method of using SMIL animation in web pages","spec":"http://www.w3.org/TR/XHTMLplusSMIL/","status":"unoff","links":[{"url":"http://en.wikipedia.org/wiki/XHTML%2BSMIL","title":"Wikipedia"},{"url":"http://leunen.me/fakesmile/","title":"JS library to support XHTML+SMIL"}],"categories":["Other"],"stats":{"ie":{"5.5":"n","6":"a","7":"a","8":"a","9":"n","10":"n","11":"n"},"firefox":{"2":"p","3":"p","3.5":"p","3.6":"p","4":"p","5":"p","6":"p","7":"p","8":"p","9":"p","10":"p","11":"p","12":"p","13":"p","14":"p","15":"p","16":"p","17":"p","18":"p","19":"p","20":"p","21":"p","22":"p","23":"p","24":"p","25":"p","26":"p","27":"p","28":"p","29":"p","30":"p","31":"p","32":"p","33":"p"},"chrome":{"4":"p","5":"p","6":"p","7":"p","8":"p","9":"p","10":"p","11":"p","12":"p","13":"p","14":"p","15":"p","16":"p","17":"p","18":"p","19":"p","20":"p","21":"p","22":"p","23":"p","24":"p","25":"p","26":"p","27":"p","28":"p","29":"p","30":"p","31":"p","32":"p","33":"p","34":"p","35":"p","36":"p","37":"p","38":"p"},"safari":{"3.1":"p","3.2":"p","4":"p","5":"p","5.1":"p","6":"p","6.1":"p","7":"p","8":"p"},"opera":{"9":"p","9.5-9.6":"p","10.0-10.1":"p","10.5":"p","10.6":"p","11":"p","11.1":"p","11.5":"p","11.6":"p","12":"p","12.1":"p","15":"p","16":"p","17":"p","18":"p","19":"p","20":"p","21":"p","22":"p","23":"p","24":"p"},"ios_saf":{"3.2":"p","4.0-4.1":"p","4.2-4.3":"p","5.0-5.1":"p","6.0-6.1":"p","7.0-7.1":"p","8":"p"},"op_mini":{"5.0-7.0":"p"},"android":{"2.1":"p","2.2":"p","2.3":"p","3":"p","4":"p","4.1":"p","4.2-4.3":"p","4.4":"p","4.4.3":"p"},"bb":{"7":"p","10":"p"},"op_mob":{"10":"p","11":"p","11.1":"p","11.5":"p","12":"p","12.1":"p","0":"p"},"and_chr":{"0":"p"},"and_ff":{"0":"p"},"ie_mob":{"10":"n"}},"notes":"Internet Explorer supports the W3C proposal HTML+TIME, which is largely the same as XHTML+SMIL","usage_perc_y":0,"usage_perc_a":4.88,"ucprefix":false,"parent":"xhtml","keywords":""},"wai-aria":{"title":"WAI-ARIA Accessibility features","description":"Method of providing ways for people with disabilities to use dynamic web content and web applications.","spec":"http://www.w3.org/TR/wai-aria/","status":"rec","links":[{"url":"http://www.alistapart.com/articles/the-accessibility-of-wai-aria/","title":"ALA Article"},{"url":"http://www.paciellogroup.com/blog/2011/10/browser-assistive-technology-tests-redux/","title":"Links to various test results"},{"url":"http://www.w3.org/WAI/intro/aria","title":"Information page"},{"url":"http://zufelt.ca/blog/are-you-confused-html5-and-wai-aria-yet","title":"HTML5/WAI-ARIA information"},{"url":"http://en.wikipedia.org/wiki/WAI-ARIA","title":"Wikipedia"}],"categories":["Other"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"y","9":"y","10":"y","11":"y"},"firefox":{"2":"a","3":"y","3.5":"y","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"a","5":"a","6":"a","7":"a","8":"a","9":"a","10":"a","11":"a","12":"a","13":"a","14":"a","15":"a","16":"a","17":"a","18":"a","19":"a","20":"a","21":"a","22":"a","23":"a","24":"a","25":"a","26":"a","27":"a","28":"a","29":"a","30":"a","31":"a","32":"a","33":"a","34":"a","35":"a","36":"a","37":"a","38":"a"},"safari":{"3.1":"n","3.2":"n","4":"a","5":"a","5.1":"a","6":"a","6.1":"a","7":"a","8":"a"},"opera":{"9":"n","9.5-9.6":"a","10.0-10.1":"a","10.5":"a","10.6":"a","11":"a","11.1":"a","11.5":"a","11.6":"a","12":"a","12.1":"a","15":"a","16":"a","17":"a","18":"a","19":"a","20":"a","21":"a","22":"a","23":"a","24":"a"},"ios_saf":{"3.2":"a","4.0-4.1":"a","4.2-4.3":"a","5.0-5.1":"a","6.0-6.1":"a","7.0-7.1":"a","8":"a"},"op_mini":{"5.0-7.0":"a"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"a","4.4.3":"a"},"bb":{"7":"n","10":"n"},"op_mob":{"10":"a","11":"a","11.1":"a","11.5":"a","12":"a","12.1":"a","0":"a"},"and_chr":{"0":"a"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"","usage_perc_y":31.44,"usage_perc_a":55.44,"ucprefix":false,"parent":"","keywords":"wai,aria"},"geolocation":{"title":"Geolocation","description":"Method of informing a website of the user's geographical location","spec":"http://www.w3.org/TR/geolocation-API/","status":"cr","links":[{"url":"http://docs.webplatform.org/wiki/apis/geolocation","title":"WebPlatform Docs"},{"url":"https://raw.github.com/phiggins42/has.js/master/detect/features.js#native-geolocation","title":"has.js test"},{"url":"http://html5demos.com/geo","title":"Simple demo"}],"categories":["JS API"],"stats":{"ie":{"5.5":"n","6":"p","7":"p","8":"p","9":"y","10":"y","11":"y"},"firefox":{"2":"p","3":"p","3.5":"y","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"a","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"p","3.2":"p","4":"p","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"p","10.5":"p","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"n","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"y","4.0-4.1":"y","4.2-4.3":"y","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"y","2.2":"y","2.3":"y","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"p","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"","usage_perc_y":85.11,"usage_perc_a":0.02,"ucprefix":false,"parent":"","keywords":""},"flexbox":{"title":"Flexible Box Layout Module","description":"Method of positioning elements in horizontal or vertical stacks.","spec":"http://www.w3.org/TR/css3-flexbox/","status":"cr","links":[{"url":"http://bennettfeely.com/flexplorer/","title":"Flexbox CSS generator"},{"url":"http://philipwalton.github.io/solved-by-flexbox/","title":"Examples on how to solve common layout problems with flexbox"},{"url":"http://dev.opera.com/articles/view/advanced-cross-browser-flexbox/","title":"Tutorial on cross-browser support"},{"url":"http://css-tricks.com/snippets/css/a-guide-to-flexbox/","title":"A Complete Guide to Flexbox"},{"url":"http://the-echoplex.net/flexyboxes/","title":"Flexbox playground and code generator"},{"url":"http://www.adobe.com/devnet/html5/articles/working-with-flexbox-the-new-spec.html","title":"Article on using the latest spec"}],"categories":["CSS3"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"a x #2","11":"y"},"firefox":{"2":"a x #1","3":"a x #1","3.5":"a x #1","3.6":"a x #1","4":"a x #1","5":"a x #1","6":"a x #1","7":"a x #1","8":"a x #1","9":"a x #1","10":"a x #1","11":"a x #1","12":"a x #1","13":"a x #1","14":"a x #1","15":"a x #1","16":"a x #1","17":"a x #1","18":"a x #1","19":"a x #1","20":"a x #1","21":"a x #1","22":"a #3","23":"a #3","24":"a #3","25":"a #3","26":"a #3","27":"a #3","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"a x #1","5":"a x #1","6":"a x #1","7":"a x #1","8":"a x #1","9":"a x #1","10":"a x #1","11":"a x #1","12":"a x #1","13":"a x #1","14":"a x #1","15":"a x #1","16":"a x #1","17":"a x #1","18":"a x #1","19":"a x #1","20":"a x #1","21":"y x","22":"y x","23":"y x","24":"y x","25":"y x","26":"y x","27":"y x","28":"y x","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"a x #1","3.2":"a x #1","4":"a x #1","5":"a x #1","5.1":"a x #1","6":"a x #1","6.1":"y x","7":"y x","8":"y x"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"y","15":"y x","16":"y x","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"a x #1","4.0-4.1":"a x #1","4.2-4.3":"a x #1","5.0-5.1":"a x #1","6.0-6.1":"a x #1","7.0-7.1":"y x","8":"y x"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"a x #1","2.2":"a x #1","2.3":"a x #1","3":"a x #1","4":"a x #1","4.1":"a x #1","4.2-4.3":"a x #1","4.4":"y","4.4.3":"y"},"bb":{"7":"a x #1","10":"y x"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"a x #2"}},"notes":"Most partial support refers to supporting an <a href=\"http://www.w3.org/TR/2009/WD-css3-flexbox-20090723/\">older version</a> of the specification or an <a href=\"http://www.w3.org/TR/2012/WD-css3-flexbox-20120322/\">older syntax</a>.","usage_perc_y":68.36,"usage_perc_a":14.29,"ucprefix":false,"parent":"","keywords":"flex"},"webgl":{"title":"WebGL - 3D Canvas graphics","description":"Method of generating dynamic 3D graphics using JavaScript, accelerated through hardware","spec":"https://www.khronos.org/registry/webgl/specs/1.0/","status":"other","links":[{"url":"http://hacks.mozilla.org/2009/12/webgl-draft-released-today/","title":"Firefox blog post"},{"url":"http://iewebgl.com/","title":"Polyfill for IE"},{"url":"http://khronos.org/webgl/wiki/Getting_a_WebGL_Implementation","title":"Instructions on enabling WebGL"},{"url":"http://webkit.org/blog/603/webgl-now-available-in-webkit-nightlies/","title":"Webkit blog post"},{"url":"http://www.khronos.org/webgl/wiki/Tutorial","title":"Tutorial"}],"categories":["Canvas"],"stats":{"ie":{"5.5":"n","6":"p","7":"p","8":"p","9":"p","10":"p","11":"y"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"a","5":"a","6":"a","7":"a","8":"a","9":"a","10":"a","11":"a","12":"a","13":"a","14":"a","15":"a","16":"a","17":"a","18":"a","19":"a","20":"a","21":"a","22":"a","23":"a","24":"a","25":"a","26":"a","27":"a","28":"a","29":"a","30":"a","31":"a","32":"a","33":"a"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"a","9":"a","10":"a","11":"a","12":"a","13":"a","14":"a","15":"a","16":"a","17":"a","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"a","6":"a","6.1":"a","7":"a","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"a","12.1":"a","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"n","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"n","4.4.3":"n"},"bb":{"7":"n","10":"y"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"a","12.1":"a","0":"y"},"and_chr":{"0":"a"},"and_ff":{"0":"a"},"ie_mob":{"10":"p"}},"notes":"Support listed as \"partial\" refers to the fact that not all users with these browsers have WebGL access. This is due to the additional requirement for users to have <a href=\"http://www.khronos.org/webgl/wiki/BlacklistsAndWhitelists\">up to date video drivers</a>. This problem was <a href=\"http://blog.chromium.org/2012/02/gpu-accelerating-2d-canvas-and-enabling.html\">solved in Chrome</a> as of version 18.\r\n\r\nNote that WebGL is part of the <a href=\"http://www.khronos.org/webgl/\">Khronos Group</a>, not the W3C.","usage_perc_y":41.84,"usage_perc_a":23.44,"ucprefix":false,"parent":"canvas","keywords":"web gl"},"fileapi":{"title":"File API","description":"Method of manipulating file objects in web applications client-side, as well as programmatically selecting them and accessing their data.","spec":"http://www.w3.org/TR/FileAPI/","status":"wd","links":[{"url":"http://docs.webplatform.org/wiki/apis/file","title":"WebPlatform Docs"},{"url":"https://developer.mozilla.org/en/Using_files_from_web_applications","title":"MDN article"}],"categories":["JS API"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"y","11":"y"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"n","5":"n","6":"a","7":"a","8":"a","9":"a","10":"a","11":"a","12":"a","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"a","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"a","4":"a","4.1":"a","4.2-4.3":"a","4.4":"y","4.4.3":"y"},"bb":{"7":"a","10":"y"},"op_mob":{"10":"n","11":"n","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"n"}},"notes":"Partial support in older Safari and other WebKit browsers refers to lacking FileReader support. ","usage_perc_y":74.57,"usage_perc_a":5.95,"ucprefix":false,"parent":"","keywords":"FileReader"},"shadowdom":{"title":"Shadow DOM","description":"Method of establishing and maintaining functional boundaries between DOM trees and how these trees interact with each other within a document, thus enabling better functional encapsulation within the DOM.","spec":"http://www.w3.org/TR/shadow-dom/","status":"wd","links":[{"url":"http://www.html5rocks.com/tutorials/webcomponents/shadowdom/","title":"HTML5Rocks - Shadow DOM 101 article"},{"url":"http://html5-demos.appspot.com/static/shadowdom-visualizer/index.html","title":"Shadow DOM Visualizer"}],"categories":["DOM","HTML5"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"y","32":"y","33":"y"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"y x","26":"y x","27":"y x","28":"y x","29":"y x","30":"y x","31":"y x","32":"y x","33":"y x","34":"y x","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"n","6.1":"n","7":"n","8":"n"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"y x","16":"y x","17":"y x","18":"y x","19":"y x","20":"y x","21":"y x","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"n","8":"n"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"y x","4.4.3":"y x"},"bb":{"7":"n","10":"n"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"n"},"ie_mob":{"10":"n"}},"notes":"","usage_perc_y":40.62,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":"web components"},"websockets":{"title":"Web Sockets","description":"Bidirectional communication technology for web apps","spec":"http://www.w3.org/TR/websockets/","status":"cr","links":[{"url":"http://docs.webplatform.org/wiki/apis/websocket","title":"WebPlatform Docs"},{"url":"http://updates.html5rocks.com/2011/08/What-s-different-in-the-new-WebSocket-protocol","title":"Details on newer protocol"},{"url":"http://websocket.org/aboutwebsocket.html","title":"WebSockets information"},{"url":"http://en.wikipedia.org/wiki/WebSocket","title":"Wikipedia"},{"url":"https://raw.github.com/phiggins42/has.js/master/detect/features.js#native-websockets","title":"has.js test"}],"categories":["JS API"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"y","11":"y"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"a","5":"a","6":"y x","7":"y x","8":"y x","9":"y x","10":"y x","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"a","5":"a","6":"a","7":"a","8":"a","9":"a","10":"a","11":"a","12":"a","13":"a","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"a","5.1":"a","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"a","11.1":"a","11.5":"a","11.6":"a","12":"a","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"a","5.0-5.1":"a","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"n","11":"a","11.1":"a","11.5":"a","12":"a","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"Partial support refers to the websockets implementation using an older version of the protocol and/or the implementation being disabled by default (due to security issues with the older protocol).","usage_perc_y":74.78,"usage_perc_a":1.56,"ucprefix":true,"parent":"","keywords":""},"script-async":{"title":"async attribute for external scripts","description":"The boolean async attribute on script elements allows the external JavaScript file to run when it's available, without delaying page load first.","spec":"http://www.w3.org/TR/html5/scripting-1.html#attr-script-async","status":"cr","links":[{"url":"https://raw.github.com/phiggins42/has.js/master/detect/script.js#script-async","title":"has.js test"},{"url":"http://ie.microsoft.com/testdrive/Performance/AsyncScripts/Default.html","title":"Demo"},{"url":"https://developer.mozilla.org/en/HTML/Element/script#Attributes","title":"MDN article"}],"categories":["HTML5","DOM"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"y","11":"y"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"a","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"Using script.async = false; to maintain execution order for dynamically-added scripts isn't supported in Safari 5.0","usage_perc_y":80.62,"usage_perc_a":0.19,"ucprefix":false,"parent":"","keywords":""},"cors":{"title":"Cross-Origin Resource Sharing","description":"Method of performing XMLHttpRequests across domains","spec":"http://www.w3.org/TR/cors/","status":"rec","links":[{"url":"https://raw.github.com/phiggins42/has.js/master/detect/features.js#native-cors-xhr","title":"has.js test"},{"url":"http://msdn.microsoft.com/en-us/library/cc288060(VS.85).aspx","title":"Alternative implementation by IE8"},{"url":"http://hacks.mozilla.org/2009/07/cross-site-xmlhttprequest-with-cors/","title":"Mozilla Hacks blog post"},{"url":"http://dev.opera.com/articles/view/dom-access-control-using-cross-origin-resource-sharing/","title":"DOM access using CORS"}],"categories":["JS API"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"a","9":"a","10":"y","11":"y"},"firefox":{"2":"n","3":"n","3.5":"y","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"y","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"y","4.0-4.1":"y","4.2-4.3":"y","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"y","2.2":"y","2.3":"y","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"Supported somewhat in IE8 and IE9 using the XDomainRequest object (but has <a href=\" http://blogs.msdn.com/b/ieinternals/archive/2010/05/13/xdomainrequest-restrictions-limitations-and-workarounds.aspx\">limitations</a>)","usage_perc_y":82.6,"usage_perc_a":7.06,"ucprefix":false,"parent":"","keywords":""},"calc":{"title":"calc() as CSS unit value","description":"Method of allowing calculated values for length units, i.e. width: calc(100% - 3em)","spec":"http://www.w3.org/TR/css3-values/#calc","status":"cr","links":[{"url":"http://docs.webplatform.org/wiki/css/functions/calc","title":"WebPlatform Docs"},{"url":"https://developer.mozilla.org/en/CSS/-moz-calc","title":"MDN article"},{"url":"http://hacks.mozilla.org/2010/06/css3-calc/","title":"Mozilla Hacks article"}],"categories":["CSS3"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"a","10":"y","11":"y"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"y x","5":"y x","6":"y x","7":"y x","8":"y x","9":"y x","10":"y x","11":"y x","12":"y x","13":"y x","14":"y x","15":"y x","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"y x","20":"y x","21":"y x","22":"y x","23":"y x","24":"y x","25":"y x","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"y x","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"y x","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"y","4.4.3":"y"},"bb":{"7":"n","10":"y x"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"Support can be somewhat emulated in older versions of IE using the non-standard expression() syntax. Partial support in IE9 refers to the browser crashing when used as a background-position value.","usage_perc_y":74.17,"usage_perc_a":2.6,"ucprefix":false,"parent":"","keywords":""},"ruby":{"title":"Ruby annotation","description":"Method of adding pronunciation or other annotations using ruby elements (primarily used in East Asian typography)","spec":"http://www.w3.org/TR/html-markup/ruby.html","status":"wd","links":[{"url":"http://docs.webplatform.org/wiki/html/elements/ruby","title":"WebPlatform Docs"},{"url":"https://addons.mozilla.org/firefox/addon/1935/","title":"Add-on \"XHTML Ruby Support\" for Firefox"},{"url":"http://html5doctor.com/ruby-rt-rp-element/","title":"HTML5 Doctor article"},{"url":"https://addons.mozilla.org/firefox/addon/6812/","title":"Addon \"HTML Ruby\" for Firefox support"}],"categories":["HTML5"],"stats":{"ie":{"5.5":"a","6":"a","7":"a","8":"a","9":"a","10":"a","11":"a"},"firefox":{"2":"p","3":"p","3.5":"p","3.6":"p","4":"p","5":"p","6":"p","7":"p","8":"p","9":"p","10":"p","11":"p","12":"p","13":"p","14":"p","15":"p","16":"p","17":"p","18":"p","19":"p","20":"p","21":"p","22":"p","23":"p","24":"p","25":"p","26":"p","27":"p","28":"p","29":"p","30":"p","31":"p","32":"p","33":"p"},"chrome":{"4":"p","5":"a","6":"a","7":"a","8":"a","9":"a","10":"a","11":"a","12":"a","13":"a","14":"a","15":"a","16":"a","17":"a","18":"a","19":"a","20":"a","21":"a","22":"a","23":"a","24":"a","25":"a","26":"a","27":"a","28":"a","29":"a","30":"a","31":"a","32":"a","33":"a","34":"a","35":"a","36":"a","37":"a","38":"a"},"safari":{"3.1":"p","3.2":"p","4":"p","5":"a","5.1":"a","6":"a","6.1":"a","7":"a","8":"a"},"opera":{"9":"p","9.5-9.6":"p","10.0-10.1":"p","10.5":"p","10.6":"p","11":"p","11.1":"p","11.5":"p","11.6":"p","12":"p","12.1":"p","15":"a","16":"a","17":"a","18":"a","19":"a","20":"a","21":"a","22":"a","23":"a","24":"a"},"ios_saf":{"3.2":"p","4.0-4.1":"p","4.2-4.3":"p","5.0-5.1":"a","6.0-6.1":"a","7.0-7.1":"a","8":"a"},"op_mini":{"5.0-7.0":"p"},"android":{"2.1":"p","2.2":"p","2.3":"p","3":"a","4":"a","4.1":"a","4.2-4.3":"a","4.4":"a","4.4.3":"a"},"bb":{"7":"p","10":"a"},"op_mob":{"10":"p","11":"p","11.1":"p","11.5":"p","12":"p","12.1":"p","0":"a"},"and_chr":{"0":"a"},"and_ff":{"0":"p"},"ie_mob":{"10":"a"}},"notes":"Browsers without native support can still simulate support using CSS. Partial support refers to only supporting basic ruby, may still be missing writing-mode, Complex ruby and CSS3 Ruby","usage_perc_y":0,"usage_perc_a":74.18,"ucprefix":false,"parent":"","keywords":""},"css-opacity":{"title":"CSS3 Opacity","description":"Method of setting the transparency level of an element","spec":"http://www.w3.org/TR/css3-color/","status":"rec","links":[{"url":"http://docs.webplatform.org/wiki/css/properties/opacity","title":"WebPlatform Docs"},{"url":"http://www.css3files.com/color/#opacity","title":"Information page"}],"categories":["CSS3"],"stats":{"ie":{"5.5":"a","6":"a","7":"a","8":"a","9":"y","10":"y","11":"y"},"firefox":{"2":"y","3":"y","3.5":"y","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"y","3.2":"y","4":"y","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"y","9.5-9.6":"y","10.0-10.1":"y","10.5":"y","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"y","4.0-4.1":"y","4.2-4.3":"y","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"y"},"android":{"2.1":"y","2.2":"y","2.3":"y","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"y","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"Transparency for elements in IE8 and older can be achieved using the proprietary \"filter\" property and does not work well with PNG images using alpha transparency.","usage_perc_y":88.57,"usage_perc_a":4.89,"ucprefix":false,"parent":"","keywords":"transparent,transparency,alpha"},"form-validation":{"title":"Form validation","description":"Method of setting required fields and field types without requiring JavaScript","spec":"http://www.whatwg.org/specs/web-apps/current-work/multipage/forms.html#client-side-form-validation","status":"wd","links":[{"url":"http://docs.webplatform.org/wiki/html/attributes/required","title":"WebPlatform Docs"}],"categories":["HTML5"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"y","11":"y"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"a","5.1":"a","6":"a","6.1":"a","7":"a","8":"a"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"y","10.5":"y","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"n","8":"n"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"n","4.4.3":"y"},"bb":{"7":"n","10":"y"},"op_mob":{"10":"y","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"a"}},"notes":"Partial support in Safari refers to lack of notice when form with required fields is attempted to be submitted. Partial support in IE10 mobile refers to lack of warning when blocking submission.","usage_perc_y":64.74,"usage_perc_a":3.81,"ucprefix":false,"parent":"forms","keywords":""},"history":{"title":"Session history management","description":"Method of manipulating the user's browser's session history in JavaScript using history.pushState, history.replaceState and the popstate event","spec":"http://www.w3.org/TR/html5/browsers.html#history-1","status":"cr","links":[{"url":"http://docs.webplatform.org/wiki/dom/History","title":"WebPlatform Docs"},{"url":"http://html5demos.com/history","title":"Demo page"},{"url":"http://www.adequatelygood.com/2010/7/Saner-HTML5-History-Management","title":"Introduction to history management"},{"url":"https://github.com/browserstate/history.js","title":"History.js polyfill "},{"url":"https://developer.mozilla.org/en/DOM/Manipulating_the_browser_history","title":"MDN article"},{"url":"https://raw.github.com/phiggins42/has.js/master/detect/features.js#native-history-state","title":"has.js test"}],"categories":["HTML5"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"y","11":"y"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"n","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"a","5.1":"a","6":"a","6.1":"a","7":"a","8":"a"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"a","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"y","2.3":"y","3":"n","4":"n","4.1":"n","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"n","11":"n","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"Older iOS versions and Android 4.0.4 claim support, but implementation is too buggy to be useful. Partial support in other Safari browsers refers to other buggy behavior.","usage_perc_y":75.98,"usage_perc_a":3.44,"ucprefix":false,"parent":"","keywords":"onpushstate,onreplacestate"},"json":{"title":"JSON parsing","description":"Method of converting JavaScript objects to JSON strings and JSON back to objects using JSON.stringify() and JSON.parse()","spec":"http://es5.github.com/#x15.12","status":"other","links":[{"url":"http://www.json.org/js.html","title":"JSON in JS (includes script w/support)"},{"url":"http://docs.webplatform.org/wiki/apis/json","title":"WebPlatform Docs"},{"url":"https://raw.github.com/phiggins42/has.js/master/detect/json.js#json","title":"has.js test"},{"url":"https://developer.mozilla.org/En/Using_native_JSON","title":"MDN article"}],"categories":["JS API"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"y","9":"y","10":"y","11":"y"},"firefox":{"2":"n","3":"n","3.5":"y","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"y","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"y","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"y","4.2-4.3":"y","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"y"},"android":{"2.1":"y","2.2":"y","2.3":"y","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"y","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"Requires document to be in IE8+ <a href=\"http://msdn.microsoft.com/en-us/library/cc288325(VS.85).aspx\">standards mode</a> to work in IE8.","usage_perc_y":92.91,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":""},"classlist":{"title":"classList (DOMTokenList )","description":"Method of easily manipulating classes on elements, using the DOMTokenList object.","spec":"http://www.w3.org/TR/dom/#dom-element-classlist","status":"wd","links":[{"url":"http://www.sitepoint.com/exploring-classlist-api/","title":"SitePoint article"},{"url":"http://docs.webplatform.org/wiki/dom/Element/classList","title":"WebPlatform Docs"},{"url":"http://hacks.mozilla.org/2010/01/classlist-in-firefox-3-6/","title":"Mozilla Hacks article"},{"url":"http://aurelio.audero.it/demo/classlist-api-demo.html","title":"Demo using classList"},{"url":"https://github.com/eligrey/classList.js","title":"Polyfill script"}],"categories":["HTML5","DOM"],"stats":{"ie":{"5.5":"p","6":"p","7":"p","8":"p","9":"p","10":"y","11":"y"},"firefox":{"2":"p","3":"p","3.5":"p","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"p","5":"p","6":"p","7":"p","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"p","3.2":"p","4":"p","5":"p","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"p","9.5-9.6":"p","10.0-10.1":"p","10.5":"p","10.6":"p","11":"p","11.1":"p","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"p","4.0-4.1":"p","4.2-4.3":"p","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"p"},"android":{"2.1":"p","2.2":"p","2.3":"p","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"p","11":"p","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"","usage_perc_y":81.07,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":""},"text-overflow":{"title":"CSS3 Text-overflow","description":"Append ellipsis when text overflows its containing element","spec":"http://www.w3.org/TR/css3-ui/#text-overflow0","status":"wd","links":[{"url":"http://docs.webplatform.org/wiki/css/properties/text-overflow","title":"WebPlatform Docs"},{"url":"https://developer.mozilla.org/En/CSS/Text-overflow","title":"MDN article"},{"url":"https://github.com/rmorse/AutoEllipsis","title":"jQuery polyfill for Firefox"},{"url":"http://www.css3files.com/text/","title":"Information page"},{"url":"https://raw.github.com/phiggins42/has.js/master/detect/css.js#css-text-overflow","title":"has.js test"}],"categories":["CSS3"],"stats":{"ie":{"5.5":"n","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y"},"firefox":{"2":"p","3":"p","3.5":"p","3.6":"p","4":"p","5":"p","6":"p","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"y","3.2":"y","4":"y","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"y x","9.5-9.6":"y x","10.0-10.1":"y x","10.5":"y x","10.6":"y x","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"y","4.0-4.1":"y","4.2-4.3":"y","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"y x"},"android":{"2.1":"y","2.2":"y","2.3":"y","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"y x","11":"y x","11.1":"y x","11.5":"y x","12":"y x","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"","usage_perc_y":93.11,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":"textoverflow,ellipsis"},"webm":{"title":"WebM video format","description":"Multimedia format designed to provide a royalty-free, high-quality open video compression format for use with HTML5 video. WebM supports the video codec VP8 and VP9.","spec":"http://www.webmproject.org/","status":"other","links":[{"url":"http://www.broken-links.com/2010/09/01/playing-webm-in-safari-with-plugins/","title":"Info on supporting WebM in Safari"},{"url":"https://raw.github.com/phiggins42/has.js/master/detect/video.js#video-webm","title":"has.js test"},{"url":"https://tools.google.com/dlpage/webmmf","title":"Codec for IE9 support"},{"url":"http://webmproject.org","title":"Official website"},{"url":"http://perian.org/","title":"Perian :Mac OSX Webm Codec install"}],"categories":["Other"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"p","10":"p","11":"p"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"a","5":"a","6":"a","7":"a","8":"a","9":"a","10":"a","11":"a","12":"a","13":"a","14":"a","15":"a","16":"a","17":"a","18":"a","19":"a","20":"a","21":"a","22":"a","23":"a","24":"a","25":"a","26":"a","27":"a","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"n","5":"n","6":"a","7":"a","8":"a","9":"a","10":"a","11":"a","12":"a","13":"a","14":"a","15":"a","16":"a","17":"a","18":"a","19":"a","20":"a","21":"a","22":"a","23":"a","24":"a","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"p","4":"p","5":"p","5.1":"p","6":"p","6.1":"p","7":"p","8":"p"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"a","11":"a","11.1":"a","11.5":"a","11.6":"a","12":"a","12.1":"a","15":"a","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"n","8":"n"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"a","3":"a","4":"a","4.1":"a","4.2-4.3":"a","4.4":"a","4.4.3":"a"},"bb":{"7":"n","10":"n"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"a"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"p"}},"notes":"Will work in IE9+ and Safari/MacOSX provided the user has the WebM codecs installed. Partial support indicates that at least one codec is supported but not all.","usage_perc_y":51.32,"usage_perc_a":10.47,"ucprefix":false,"parent":"video","keywords":"matroska"},"mpeg4":{"title":"MPEG-4/H.264 video format","description":"Commonly used video compression format (not royalty-free)","spec":"http://ip.hhi.de/imagecom_G1/assets/pdfs/csvt_overview_0305.pdf","status":"other","links":[{"url":"http://en.wikipedia.org/wiki/H.264/MPEG-4_AVC","title":"Wikipedia article"},{"url":"http://www.interoperabilitybridges.com/html5-extension-for-wmp-plugin","title":"Firefox extension allowing support in Win7"}],"categories":["Other"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"y","10":"y","11":"y"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"a","22":"a","23":"a","24":"a","25":"a","26":"a","27":"a","28":"a","29":"a","30":"a","31":"a","32":"a","33":"a"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"y","4":"y","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n"},"ios_saf":{"3.2":"y","4.0-4.1":"y","4.2-4.3":"y","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"a","2.2":"a","2.3":"a","3":"a","4":"a","4.1":"a","4.2-4.3":"a","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"n","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"a"},"ie_mob":{"10":"y"}},"notes":"The Android 2.3 browser currently requires <a href=\"http://www.broken-links.com/2010/07/08/making-html5-video-work-on-android-phones/\">specific handling</a> to play videos. Firefox <a href=\"http://blog.lizardwrangler.com/2012/03/18/video-user-experience-and-our-mission/\">will include support</a> on some platforms in upcoming versions. Firefox supports H.264 on Windows 7 and later since version 21. Firefox supports H.264 on Linux since version 26 if the appropriate gstreamer plug-ins are installed. Partial support for Firefox refers to the lack of support in OSX & some Linux platforms, for Android Firefox it refers to the inability of hardware acceleration.","usage_perc_y":64.15,"usage_perc_a":18.98,"ucprefix":false,"parent":"video","keywords":"avc,mp4,mpv,mov,aac"},"ogv":{"title":"Ogg/Theora video format","description":"Free lossy video compression format.","spec":"http://theora.org/doc/","status":"other","links":[{"url":"http://en.wikipedia.org/wiki/Theora","title":"Wikipedia article"}],"categories":["Other"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"p","10":"p","11":"p"},"firefox":{"2":"n","3":"n","3.5":"y","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"n","6.1":"n","7":"n","8":"n"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"y","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"n","8":"n"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"n","4.4.3":"n"},"bb":{"7":"n","10":"n"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"n"},"and_chr":{"0":"n"},"and_ff":{"0":"y"},"ie_mob":{"10":"p"}},"notes":"","usage_perc_y":49.58,"usage_perc_a":0,"ucprefix":false,"parent":"video","keywords":"xiph"},"wordwrap":{"title":"CSS3 Overflow-wrap","description":"Allows lines to be broken within words if an otherwise unbreakable string is too long to fit.","spec":"http://www.w3.org/TR/css3-text/#overflow-wrap","status":"wd","links":[{"url":"https://developer.mozilla.org/En/CSS/Word-wrap","title":"MDN article"},{"url":"http://docs.webplatform.org/wiki/css/properties/word-wrap","title":"WebPlatform Docs"},{"url":"http://www.css3files.com/text/#wordwrap","title":"Information page"}],"categories":["CSS3"],"stats":{"ie":{"5.5":"a","6":"a","7":"a","8":"a","9":"a","10":"a","11":"a"},"firefox":{"2":"n","3":"n","3.5":"a","3.6":"a","4":"a","5":"a","6":"a","7":"a","8":"a","9":"a","10":"a","11":"a","12":"a","13":"a","14":"a","15":"a","16":"a","17":"a","18":"a","19":"a","20":"a","21":"a","22":"a","23":"a","24":"a","25":"a","26":"a","27":"a","28":"a","29":"a","30":"a","31":"a","32":"a","33":"a"},"chrome":{"4":"a","5":"a","6":"a","7":"a","8":"a","9":"a","10":"a","11":"a","12":"a","13":"a","14":"a","15":"a","16":"a","17":"a","18":"a","19":"a","20":"a","21":"a","22":"a","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"a","3.2":"a","4":"a","5":"a","5.1":"a","6":"a","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"a","10.6":"a","11":"a","11.1":"a","11.5":"a","11.6":"a","12":"a","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"a","4.0-4.1":"a","4.2-4.3":"a","5.0-5.1":"a","6.0-6.1":"a","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"a"},"android":{"2.1":"a","2.2":"a","2.3":"a","3":"a","4":"a","4.1":"a","4.2-4.3":"a","4.4":"y","4.4.3":"y"},"bb":{"7":"a","10":"y"},"op_mob":{"10":"a","11":"a","11.1":"a","11.5":"a","12":"a","12.1":"a","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"a"},"ie_mob":{"10":"a"}},"notes":"Partial support refers to requiring the legacy name \"word-wrap\" (rather than overflow-wrap) to work.","usage_perc_y":48.74,"usage_perc_a":44.61,"ucprefix":false,"parent":"","keywords":"wordwrap,word-wrap"},"progressmeter":{"title":"Progress & Meter","description":"Method of indicating a progress state (progress element) or the current level of a gauge (meter element).\r\n","spec":"http://www.whatwg.org/specs/web-apps/current-work/multipage/the-button-element.html#the-progress-element","status":"wd","links":[{"url":"http://peter.sh/examples/?/html/meter-progress.html","title":"Examples of progress and meter elements"},{"url":"http://docs.webplatform.org/wiki/html/elements/progress","title":"WebPlatform Docs"},{"url":"http://html5doctor.com/measure-up-with-the-meter-tag/","title":"HTML5 Doctor on meter element "},{"url":"http://dev.opera.com/articles/view/new-form-features-in-HTML5/#newoutput","title":"Dev.Opera article"}],"categories":["HTML5"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"a","11":"a"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"a","7":"a","8":"a","9":"a","10":"a","11":"a","12":"a","13":"a","14":"a","15":"a","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"a","8":"a"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"n","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"a"}},"notes":"Partial support in Firefox 6-15, IE10 & iOS7 Safari refers to supporting the progress element, but not the meter element. iOS7 Safari also does not support \"indeterminate\" progress elements.","usage_perc_y":57.92,"usage_perc_a":16.47,"ucprefix":false,"parent":"forms","keywords":""},"object-fit":{"title":"CSS3 object-fit/object-position","description":"Method of specifying how an object (image or video) should fit inside its box. object-fit options include \"contain\" (fit according to aspect ratio), \"fill\" (stretches object to fill) and \"cover\" (overflows box but maintains ratio), where object-position allows the object to be repositioned like background-image does.","spec":"http://www.w3.org/TR/css3-images/","status":"cr","links":[{"url":"https://github.com/anselmh/object-fit","title":"object-fit JavaScript-Polyfill"},{"url":"http://dev.opera.com/articles/view/css3-object-fit-object-position/","title":"Dev.Opera article"},{"url":"http://docs.webplatform.org/wiki/css/properties/object-fit","title":"WebPlatform Docs"}],"categories":["CSS3"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"u","32":"u","33":"u"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"n","6.1":"n","7":"n","8":"n"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"y x","11":"y x","11.1":"y x","11.5":"y x","11.6":"y x","12":"y x","12.1":"y x","15":"n","16":"n","17":"n","18":"n","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"n","8":"n"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"n","4.4.3":"n"},"bb":{"7":"n","10":"n"},"op_mob":{"10":"n","11":"y x","11.1":"y x","11.5":"y x","12":"y x","12.1":"y x","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"n"},"ie_mob":{"10":"n"}},"notes":"","usage_perc_y":38.46,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":"objectfit,objectposition"},"xhr2":{"title":"XMLHttpRequest 2","description":"Adds more functionality to AJAX requests like file uploads, transfer progress information and the ability to send form data.","spec":"http://www.w3.org/TR/XMLHttpRequest2/","status":"wd","links":[{"url":"http://docs.webplatform.org/wiki/apis/xhr/XMLHttpRequest","title":"WebPlatform Docs"},{"url":"https://github.com/3nr1c/jUri.js","title":"Polyfill for FormData object"},{"url":"https://developer.mozilla.org/en/XMLHttpRequest/FormData","title":"MDN article on FormData"}],"categories":["DOM","JS API"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"y","11":"y"},"firefox":{"2":"n","3":"n","3.5":"a","3.6":"a","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"u","5":"u","6":"u","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"","usage_perc_y":81.11,"usage_perc_a":0.16,"ucprefix":false,"parent":"","keywords":"formdata"},"minmaxwh":{"title":"CSS min/max-width/height","description":"Method of setting a minimum or maximum width or height to an element. ","spec":"http://www.w3.org/TR/CSS21/visudet.html#min-max-widths","status":"rec","links":[{"url":"http://www.impressivewebs.com/min-max-width-height-css/","title":"CSS Basics post"},{"url":"http://code.google.com/p/ie7-js/","title":"JS library with support"},{"url":"http://docs.webplatform.org/wiki/css/properties/min-width","title":"WebPlatform Docs"}],"categories":["CSS2"],"stats":{"ie":{"5.5":"p","6":"p","7":"y","8":"y","9":"y","10":"y","11":"y"},"firefox":{"2":"y","3":"y","3.5":"y","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"y","3.2":"y","4":"y","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"y","9.5-9.6":"y","10.0-10.1":"y","10.5":"y","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"y","4.0-4.1":"y","4.2-4.3":"y","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"y"},"android":{"2.1":"y","2.2":"y","2.3":"y","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"y","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"IE7 does not support \"inherit\" as a value on any of these properties. IE8 has some bugs with max-width/height combined with overflow: auto/scroll.","usage_perc_y":93.17,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":"min-width,min-height,max-width,max-height"},"details":{"title":"Details & Summary elements","description":"The &lt;details> element generates a simple no-JavaScript widget to show/hide element contents, optionally by clicking on its child &lt;summary> element.","spec":"http://www.whatwg.org/specs/web-apps/current-work/multipage/interactive-elements.html#the-details-element","status":"wd","links":[{"url":"http://mathiasbynens.be/notes/html5-details-jquery","title":"jQuery fallback script"},{"url":"http://html5doctor.com/summary-figcaption-element/","title":"HTML5 Doctor article"},{"url":"https://gist.github.com/370590","title":"Fallback script"},{"url":"https://raw.github.com/phiggins42/has.js/master/detect/features.js#native-details","title":"has.js test"},{"url":"http://docs.webplatform.org/wiki/html/elements/details","title":"WebPlatform Docs"}],"categories":["HTML5"],"stats":{"ie":{"5.5":"n","6":"p","7":"p","8":"p","9":"n","10":"n","11":"n"},"firefox":{"2":"n","3":"p","3.5":"p","3.6":"p","4":"p","5":"p","6":"p","7":"p","8":"p","9":"p","10":"p","11":"p","12":"p","13":"p","14":"p","15":"p","16":"p","17":"p","18":"p","19":"p","20":"p","21":"p","22":"p","23":"p","24":"p","25":"p","26":"p","27":"p","28":"p","29":"p","30":"p","31":"p","32":"p","33":"p"},"chrome":{"4":"p","5":"p","6":"p","7":"p","8":"p","9":"p","10":"p","11":"p","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"p","3.2":"p","4":"p","5":"p","5.1":"p","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"p","9.5-9.6":"p","10.0-10.1":"p","10.5":"p","10.6":"p","11":"p","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"p","4.0-4.1":"p","4.2-4.3":"p","5.0-5.1":"p","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"p"},"android":{"2.1":"p","2.2":"p","2.3":"p","3":"p","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"p","10":"y"},"op_mob":{"10":"p","11":"p","11.1":"p","11.5":"p","12":"p","12.1":"p","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"n"},"ie_mob":{"10":"n"}},"notes":"","usage_perc_y":55.2,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":""},"text-stroke":{"title":"CSS text-stroke","description":"Method of declaring the outline (stroke) width and color for text.","spec":"http://developer.apple.com/library/safari/documentation/appleapplications/reference/SafariCSSRef/Articles/StandardCSSProperties.html#//apple_ref/doc/uid/TP30001266-_webkit_text_stroke","status":"unoff","links":[{"url":"http://www.westciv.com/tools/textStroke/","title":"Live editor"},{"url":"http://css-tricks.com/7405-adding-stroke-to-web-text/","title":"Information & workarounds"}],"categories":["CSS"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"u","32":"u","33":"u"},"chrome":{"4":"y x","5":"y x","6":"y x","7":"y x","8":"y x","9":"y x","10":"y x","11":"y x","12":"y x","13":"y x","14":"y x","15":"y x","16":"y x","17":"y x","18":"y x","19":"y x","20":"y x","21":"y x","22":"y x","23":"y x","24":"y x","25":"y x","26":"y x","27":"y x","28":"y x","29":"y x","30":"y x","31":"y x","32":"y x","33":"y x","34":"y x","35":"y x","36":"y x","37":"y x","38":"y x"},"safari":{"3.1":"y x","3.2":"y x","4":"y x","5":"y x","5.1":"y x","6":"y x","6.1":"y x","7":"y x","8":"y x"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"y x","16":"y x","17":"y x","18":"y x","19":"y x","20":"y x","21":"y x","22":"y x","23":"y x","24":"y x"},"ios_saf":{"3.2":"a x","4.0-4.1":"y x","4.2-4.3":"y x","5.0-5.1":"y x","6.0-6.1":"y x","7.0-7.1":"y x","8":"y x"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"y x","2.2":"y x","2.3":"y x","3":"n","4":"y x","4.1":"y x","4.2-4.3":"y x","4.4":"y x","4.4.3":"y x"},"bb":{"7":"y x","10":"y x"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"y x"},"and_chr":{"0":"y x"},"and_ff":{"0":"n"},"ie_mob":{"10":"n"}},"notes":"Does not yet appear in any W3C specification. Was briefly included in a spec as the \"text-outline\" property, but this was removed.","usage_perc_y":57.88,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":"textstroke,stroke-color,stroke-width,fill-color"},"inline-block":{"title":"CSS inline-block","description":"Method of displaying an element as a block while flowing it with text. ","spec":"http://www.w3.org/TR/CSS21/visuren.html#fixed-positioning","status":"rec","links":[{"url":"http://blog.mozilla.com/webdev/2009/02/20/cross-browser-inline-block/","title":"Info on cross browser support"},{"url":"http://docs.webplatform.org/wiki/css/properties/display","title":"WebPlatform Docs"},{"url":"http://robertnyman.com/2010/02/24/css-display-inline-block-why-it-rocks-and-why-it-sucks/","title":"Blog post w/info"}],"categories":["CSS2"],"stats":{"ie":{"5.5":"a","6":"a","7":"a","8":"y","9":"y","10":"y","11":"y"},"firefox":{"2":"a x","3":"y","3.5":"y","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"y","3.2":"y","4":"y","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"y","9.5-9.6":"y","10.0-10.1":"y","10.5":"y","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"y","4.0-4.1":"y","4.2-4.3":"y","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"y"},"android":{"2.1":"y","2.2":"y","2.3":"y","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"y","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"Only supported in IE6 and IE7 on elements with a display of \"inline\" by default. <a href=\"http://blog.mozilla.com/webdev/2009/02/20/cross-browser-inline-block/\">Alternative properties</a> are available to provide complete cross-browser support.","usage_perc_y":93.03,"usage_perc_a":0.43,"ucprefix":false,"parent":"","keywords":"inlineblock"},"notifications":{"title":"Web Notifications","description":"Method of alerting the user outside of a web page by displaying notifications (that do not require interaction by the user).","spec":"http://www.w3.org/TR/notifications/","status":"wd","links":[{"url":"https://addons.mozilla.org/en-us/firefox/addon/221523/","title":"Add-on "},{"url":"http://www.html5rocks.com/tutorials/notifications/quick/","title":"HTML5 Rocks tutorial"},{"url":"https://developer.mozilla.org/en-US/docs/Web/API/notification","title":"MDN Notifications"},{"url":"http://www.chromium.org/developers/design-documents/desktop-notifications/api-specification","title":"Chromium API"},{"url":"http://aurelio.audero.it/demo/web-notifications-api-demo.html","title":"Demo"},{"url":"http://www.sitepoint.com/introduction-web-notifications-api/","title":"SitePoint article"}],"categories":["JS API"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"n","5":"a x","6":"a x","7":"a x","8":"a x","9":"a x","10":"a x","11":"a x","12":"a x","13":"a x","14":"a x","15":"a x","16":"a x","17":"a x","18":"a x","19":"a x","20":"a x","21":"a x","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"n","8":"n"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"a x","4.4.3":"a x"},"bb":{"7":"n","10":"y"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"a x"},"and_chr":{"0":"n"},"and_ff":{"0":"y"},"ie_mob":{"10":"n"}},"notes":"","usage_perc_y":48.79,"usage_perc_a":1.85,"ucprefix":false,"parent":"","keywords":""},"stream":{"title":"getUserMedia/Stream API","description":"Method of accessing external device data (such as a webcam video stream). Formerly this was envisioned as the &lt;device> element.","spec":"http://www.w3.org/TR/mediacapture-streams/","status":"wd","links":[{"url":"http://docs.webplatform.org/wiki/dom/Navigator/getUserMedia","title":"WebPlatform Docs"},{"url":"http://my.opera.com/core/blog/2011/03/23/webcam-orientation-preview","title":"Technology preview from Opera"}],"categories":["JS API","HTML5"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"y x","18":"y x","19":"y x","20":"y x","21":"y x","22":"y x","23":"y x","24":"y x","25":"y x","26":"y x","27":"y x","28":"y x","29":"y x","30":"y x","31":"y x","32":"y x","33":"y x"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"y x","22":"y x","23":"y x","24":"y x","25":"y x","26":"y x","27":"y x","28":"y x","29":"y x","30":"y x","31":"y x","32":"y x","33":"y x","34":"y x","35":"y x","36":"y x","37":"y x","38":"y x"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"n","6.1":"n","7":"n","8":"n"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"y","12.1":"y","15":"n","16":"n","17":"n","18":"y x","19":"y x","20":"y x","21":"y x","22":"y x","23":"y x","24":"y x"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"n","8":"n"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"n","4.4.3":"n"},"bb":{"7":"n","10":"y x"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"y","12.1":"y","0":"y x"},"and_chr":{"0":"y"},"and_ff":{"0":"y x"},"ie_mob":{"10":"n"}},"notes":"","usage_perc_y":53.69,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":"camera,device,getUserMedia,media stream,Media Capture API"},"svg-img":{"title":"SVG in HTML img element","description":"Method of displaying SVG images in HTML using &lt;img>","spec":"http://www.w3.org/TR/html5/dom.html#embedded-content","status":"cr","links":[{"url":"http://www.codedread.com/blog/","title":"Blog with SVGs an images"},{"url":"http://blog.dholbert.org/2010/10/svg-as-image.html","title":"Blog post with examples"}],"categories":["SVG"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"y","10":"y","11":"y"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"a","4":"y","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"y","9.5-9.6":"y","10.0-10.1":"y","10.5":"y","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"a","4.0-4.1":"y","4.2-4.3":"y","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"y"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"y","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"","usage_perc_y":87.2,"usage_perc_a":0.01,"ucprefix":false,"parent":"","keywords":"svg-as-img,svg-in-img"},"datalist":{"title":"Datalist element","description":"Method of setting a list of options for a user to select in a text field, while leaving the ability to enter a custom value.","spec":"http://www.whatwg.org/specs/web-apps/current-work/multipage/the-button-element.html#the-datalist-element","status":"wd","links":[{"url":"http://github.com/thgreasi/datalist-polyfill","title":"Minimal Datalist polyfill w/tutorial"},{"url":"http://docs.webplatform.org/wiki/html/elements/datalist","title":"WebPlatform Docs"},{"url":"https://developer.mozilla.org/en/HTML/Element/datalist","title":"MDN reference"},{"url":"http://demo.agektmr.com/datalist/","title":"Eiji Kitamura's options demos & tests"},{"url":"http://afarkas.github.com/webshim/demos/","title":"HTML5 Library including datalist support"},{"url":"http://hacks.mozilla.org/2010/11/firefox-4-html5-forms/","title":"Mozilla Hacks article"}],"categories":["HTML5"],"stats":{"ie":{"5.5":"n","6":"p","7":"p","8":"p","9":"p","10":"a","11":"a"},"firefox":{"2":"p","3":"p","3.5":"p","3.6":"p","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"p","5":"p","6":"p","7":"p","8":"p","9":"p","10":"p","11":"p","12":"p","13":"p","14":"p","15":"p","16":"p","17":"p","18":"p","19":"n","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"p","3.2":"p","4":"p","5":"p","5.1":"p","6":"n","6.1":"n","7":"n","8":"n"},"opera":{"9":"y","9.5-9.6":"y","10.0-10.1":"y","10.5":"y","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"p","4.0-4.1":"p","4.2-4.3":"p","5.0-5.1":"p","6.0-6.1":"p","7.0-7.1":"p","8":"p"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"p","2.2":"p","2.3":"p","3":"p","4":"p","4.1":"p","4.2-4.3":"p","4.4":"p","4.4.3":"y"},"bb":{"7":"p","10":"y"},"op_mob":{"10":"y","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"p"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"p"}},"notes":"Partial support in IE10 refers to <a href=\"http://playground.onereason.eu/2013/04/ie10s-lousy-support-for-datalists/\">significantly buggy behavior</a>.","usage_perc_y":54.54,"usage_perc_a":9.81,"ucprefix":false,"parent":"forms","keywords":"list attribute"},"dataset":{"title":"dataset & data-* attributes","description":"Method of applying and accessing custom data to elements.","spec":"http://www.whatwg.org/specs/web-apps/current-work/multipage/elements.html#embedding-custom-non-visible-data-with-the-data-*-attributes","status":"wd","links":[{"url":"https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement.dataset","title":"MDN Reference - dataset"},{"url":"http://html5doctor.com/html5-custom-data-attributes/","title":"HTML5 Doctor article"},{"url":"https://developer.mozilla.org/en-US/docs/Web/Guide/HTML/Using_data_attributes","title":"MDN Guide - Using data-* attributes"},{"url":"http://html5demos.com/dataset","title":"Demo using dataset"},{"url":"http://docs.webplatform.org/wiki/html/attributes/data-*","title":"WebPlatform Docs"},{"url":"https://raw.github.com/phiggins42/has.js/master/detect/dom.js#dom-dataset","title":"has.js test"}],"categories":["HTML5"],"stats":{"ie":{"5.5":"a","6":"a","7":"a","8":"a","9":"a","10":"a","11":"y"},"firefox":{"2":"a","3":"a","3.5":"a","3.6":"a","4":"a","5":"a","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"a","5":"a","6":"a","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"a","3.2":"a","4":"a","5":"a","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"a","9.5-9.6":"a","10.0-10.1":"a","10.5":"a","10.6":"a","11":"a","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"a","4.0-4.1":"a","4.2-4.3":"a","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"a"},"android":{"2.1":"a","2.2":"a","2.3":"a","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"a","11":"a","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"a"}},"notes":"All browsers can already use data-* attributes and access them using getAttribute. \"Supported\" refers to accessing the values using the dataset property. Current spec only refers to support on HTML elements, only some browsers also have support for SVG/MathML elements.","usage_perc_y":77.85,"usage_perc_a":15.61,"ucprefix":false,"parent":"","keywords":"DOMStringMap"},"css-grid":{"title":"CSS Grid Layout","description":"Method of using a grid concept to lay out content, providing a mechanism for authors to divide available space for lay out into columns and rows using a set of predictable sizing behaviors","spec":"http://www.w3.org/TR/css3-grid-layout/","status":"wd","links":[{"url":"https://bugzilla.mozilla.org/show_bug.cgi?id=616605","title":"Mozilla (Firefox) feature request"},{"url":"http://blogs.msdn.com/b/ie/archive/2011/04/14/ie10-platform-preview-and-css-features-for-adaptive-layouts.aspx","title":"IE Blog post"},{"url":"https://github.com/codler/Grid-Layout-Polyfill","title":"Grid Layout Polyfill"},{"url":"https://bugs.webkit.org/show_bug.cgi?id=60731","title":"Webkit (Chrome, Safari, etc.) feature request"}],"categories":["CSS"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"p","10":"y x","11":"y x"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"p","20":"p","21":"p","22":"p","23":"p","24":"p","25":"p","26":"p","27":"p","28":"p","29":"p","30":"p","31":"u","32":"u","33":"u"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"p","26":"p","27":"p","28":"p","29":"p","30":"p","31":"p","32":"p","33":"p","34":"p","35":"p","36":"u","37":"u","38":"u"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"p","6.1":"p","7":"p","8":"p"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"p","7.0-7.1":"p","8":"p"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"p","4.4":"p","4.4.3":"p"},"bb":{"7":"n","10":"n"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"p"},"and_chr":{"0":"p"},"and_ff":{"0":"n"},"ie_mob":{"10":"y x"}},"notes":"","usage_perc_y":10.22,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":"grids,grid-row,grid-column"},"menu":{"title":"Toolbar/context menu","description":"Method of defining a toolbar menu, a context menu or a list of (interactive) options using the &lt;menu> element.","spec":"http://www.whatwg.org/specs/web-apps/current-work/multipage/interactive-elements.html#the-menuitem-element","status":"cr","links":[{"url":"http://addyosmani.github.com/jQuery-contextMenu/","title":"jQuery polyfill"},{"url":"https://bug617528.bugzilla.mozilla.org/attachment.cgi?id=554309","title":"Demo"},{"url":"https://raw.github.com/phiggins42/has.js/master/detect/events.js#event-contextmenu","title":"has.js test"}],"categories":["HTML5"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"a","9":"a","10":"a","11":"a","12":"a","13":"a","14":"a","15":"a","16":"a","17":"a","18":"a","19":"a","20":"a","21":"a","22":"a","23":"a","24":"a","25":"a","26":"a","27":"a","28":"a","29":"a","30":"a","31":"a","32":"a","33":"a"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"n","32":"n","33":"n","34":"n","35":"n","36":"u","37":"u","38":"u"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"n","6.1":"n","7":"n","8":"n"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"n","8":"n"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"n","4.4.3":"n"},"bb":{"7":"n","10":"n"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"n"},"and_chr":{"0":"n"},"and_ff":{"0":"n"},"ie_mob":{"10":"n"}},"notes":"Partial support in Firefox refers to being limited to context menus, not toolbar menus.","usage_perc_y":0,"usage_perc_a":13.68,"ucprefix":false,"parent":"","keywords":"contextmenu,menuitem,command"},"rem":{"title":"rem (root em) units","description":"Type of unit similar to \"em\", but relative only to the root element, not any parent element. Thus compounding does not occur as it does with \"em\" units.","spec":"http://www.w3.org/TR/css3-values/#font-relative-lengths","status":"cr","links":[{"url":"https://github.com/chuckcarpenter/REM-unit-polyfill","title":"REM Polyfill"},{"url":"http://snook.ca/archives/html_and_css/font-size-with-rem","title":"Article on usage"}],"categories":["CSS3"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"y","10":"y","11":"y"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"u","5":"u","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"y","4.2-4.3":"y","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"y","2.2":"y","2.3":"y","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"","usage_perc_y":85.05,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":""},"ttf":{"title":"TTF/OTF - TrueType and OpenType font support","description":"Support for the TrueType (.ttf)and OpenType (.otf) outline font formats in @font-face. ","spec":"http://developer.apple.com/fonts/TTRefMan/index.html","status":"other","links":[{"url":"http://stackoverflow.com/questions/17694143/what-is-the-status-of-ttf-support-in-internet-explorer","title":"What is the status of TTF support in Internet Explorer?"}],"categories":["CSS3"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"a","10":"a","11":"a"},"firefox":{"2":"n","3":"n","3.5":"y","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"y","3.2":"y","4":"y","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"y","10.5":"y","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"y","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"y","2.3":"y","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"y","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"u"}},"notes":"Partial support in IE9 refers to the fonts only working <a href=\"http://blogs.msdn.com/b/ie/archive/2010/07/15/the-css-corner-better-web-typography-for-better-design.aspx\">when set to be \"installable\"</a>.","usage_perc_y":72.43,"usage_perc_a":12.41,"ucprefix":false,"parent":"fontface","keywords":""},"touch":{"title":"Touch events","description":"Method of registering when, where and how the interface is touched, for devices with a touch screen. These DOM events are similar to mousedown, mousemove, etc.","spec":"http://www.w3.org/TR/touch-events/","status":"rec","links":[{"url":"http://schepers.cc/getintouch","title":"Information on the spec development"},{"url":"http://www.quirksmode.org/m/tests/drag2.html","title":"Multi-touch demo"},{"url":"http://msdn.microsoft.com/en-us/library/ie/hh673557(v=vs.85).aspx","title":"Internet Explorer's gesture and touch implementation."},{"url":"http://www.quirksmode.org/mobile/tableTouch.html","title":"Detailed support tables"},{"url":"http://github.com/CamHenlin/TouchPolyfill","title":"Touch polyfill for supporting touch events on Internet Explorer"}],"categories":["DOM","JS API"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"p","11":"p"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"a","5":"a","6":"a","7":"a","8":"a","9":"a","10":"a","11":"a","12":"a","13":"a","14":"a","15":"a","16":"a","17":"a","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"n","32":"n","33":"n"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"n","6.1":"n","7":"n","8":"n"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"y","4.0-4.1":"y","4.2-4.3":"y","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"y","2.2":"y","2.3":"y","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"n","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"p"}},"notes":"Internet Explorer implements Pointer Events specification which supports more input devices than Touch Events one.","usage_perc_y":54.45,"usage_perc_a":0.79,"ucprefix":false,"parent":"","keywords":"touchstart,touchend,touchmove,touchenter,touchleave,touchcancel"},"matchesselector":{"title":"matches() DOM method","description":"Method of testing whether or not a DOM element matches a given selector. Formerly known (and largely supported with prefix) as matchesSelector.","spec":"http://www.w3.org/TR/selectors-api2/","status":"wd","links":[{"url":"https://developer.mozilla.org/en/DOM/Element.mozMatchesSelector","title":"MDN article"},{"url":"http://docs.webplatform.org/wiki/dom/HTMLElement/matchesSelector","title":"WebPlatform Docs"}],"categories":["JS API","DOM"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"a x","10":"a x","11":"a x"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"a x","4":"a x","5":"a x","6":"a x","7":"a x","8":"a x","9":"a x","10":"a x","11":"a x","12":"a x","13":"a x","14":"a x","15":"a x","16":"a x","17":"a x","18":"a x","19":"a x","20":"a x","21":"a x","22":"a x","23":"a x","24":"a x","25":"a x","26":"a x","27":"a x","28":"a x","29":"a x","30":"a x","31":"a x","32":"a x","33":"a x"},"chrome":{"4":"a x","5":"a x","6":"a x","7":"a x","8":"a x","9":"a x","10":"a x","11":"a x","12":"a x","13":"a x","14":"a x","15":"a x","16":"a x","17":"a x","18":"a x","19":"a x","20":"a x","21":"a x","22":"a x","23":"a x","24":"a x","25":"a x","26":"a x","27":"a x","28":"a x","29":"a x","30":"a x","31":"a x","32":"a x","33":"a x","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"a x","5.1":"a x","6":"a x","6.1":"a x","7":"a x","8":"a x"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"a x","11.6":"a x","12":"a x","12.1":"a x","15":"a x","16":"a x","17":"a x","18":"a x","19":"a x","20":"a x","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"a x","4.2-4.3":"a x","5.0-5.1":"a x","6.0-6.1":"a x","7.0-7.1":"a x","8":"a x"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"a x","2.3":"a x","3":"a x","4":"a x","4.1":"a x","4.2-4.3":"a x","4.4":"a x","4.4.3":"a x"},"bb":{"7":"a x","10":"a x"},"op_mob":{"10":"n","11":"n","11.1":"a x","11.5":"a x","12":"a x","12.1":"a x","0":"a x"},"and_chr":{"0":"y"},"and_ff":{"0":"a x"},"ie_mob":{"10":"a x"}},"notes":"Partial support refers to supporting the older specification's \"matchesSelector\" name rather than just \"matches\".","usage_perc_y":36,"usage_perc_a":49.08,"ucprefix":false,"parent":"","keywords":" matchesSelector"},"pointer-events":{"title":"CSS pointer-events (for HTML)","description":"This CSS property, when set to \"none\" allows elements to not receive hover/click events, instead the event will occur on anything behind it. ","spec":"http://wiki.csswg.org/spec/css4-ui#pointer-events","status":"unoff","links":[{"url":"http://robertnyman.com/2010/03/22/css-pointer-events-to-allow-clicks-on-underlying-elements/","title":"Article & tutorial"},{"url":"https://raw.github.com/phiggins42/has.js/master/detect/css.js#css-pointerevents","title":"has.js test"}],"categories":["CSS3"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"y"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"y","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"y","4.0-4.1":"y","4.2-4.3":"y","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"y","2.2":"y","2.3":"y","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"n"}},"notes":"Already part of the SVG specification, and all SVG-supporting browsers appear to support the property on SVG elements.","usage_perc_y":79.12,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":"pointerevents"},"blobbuilder":{"title":"Blob constructing","description":"Construct Blobs (binary large objects) either using the BlobBuilder API (deprecated) or the Blob constructor.","spec":"http://www.w3.org/TR/file-writer-api/#the-blobbuilder-interface","status":"wd","links":[{"url":"https://developer.mozilla.org/en-US/docs/DOM/Blob","title":"MDN article on Blobs"},{"url":"https://developer.mozilla.org/en/DOM/BlobBuilder","title":"MDN article on BlobBuilder"}],"categories":["JS API"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"y","11":"y"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"a x","7":"a x","8":"a x","9":"a x","10":"a x","11":"a x","12":"a x","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"a x","9":"a x","10":"a x","11":"a x","12":"a x","13":"a x","14":"a x","15":"a x","16":"a x","17":"a x","18":"a x","19":"a x","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"a x","4":"a x","4.1":"a x","4.2-4.3":"a x","4.4":"a x","4.4.3":"a x"},"bb":{"7":"n","10":"y"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"Partial support refers to only supporting the now deprecated BlobBuilder to create blobs.","usage_perc_y":73.15,"usage_perc_a":6.68,"ucprefix":true,"parent":"fileapi","keywords":""},"filereader":{"title":"FileReader API","description":"Method of reading the contents of a File or Blob object into memory","spec":"http://www.w3.org/TR/FileAPI/#dfn-filereader","status":"wd","links":[{"url":"https://developer.mozilla.org/en/DOM/FileReader","title":"FileReader API"},{"url":"http://docs.webplatform.org/wiki/apis/file/FileReader","title":"WebPlatform Docs"}],"categories":["JS API"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"y","11":"y"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"n","5":"n","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"n","10":"y"},"op_mob":{"10":"n","11":"n","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"","usage_perc_y":80.14,"usage_perc_a":0,"ucprefix":false,"parent":"fileapi","keywords":""},"filesystem":{"title":"Filesystem & FileWriter API","description":"Method of reading and writing files to a sandboxed file system.\r\n","spec":"http://www.w3.org/TR/file-system-api/","status":"wd","links":[{"url":"http://www.html5rocks.com/en/tutorials/file/filesystem/","title":"HTML5 Rocks tutorial"},{"url":"http://docs.webplatform.org/wiki/apis/filesystem","title":"WebPlatform Docs"}],"categories":["JS API"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"n","32":"n","33":"n"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"a x","9":"a x","10":"a x","11":"a x","12":"a x","13":"y x","14":"y x","15":"y x","16":"y x","17":"y x","18":"y x","19":"y x","20":"y x","21":"y x","22":"y x","23":"y x","24":"y x","25":"y x","26":"y x","27":"y x","28":"y x","29":"y x","30":"y x","31":"y x","32":"y x","33":"y x","34":"y x","35":"y x","36":"y x","37":"y x","38":"y x"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"n","6.1":"n","7":"n","8":"n"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"y x","16":"y x","17":"y x","18":"y x","19":"y x","20":"y x","21":"y x","22":"y x","23":"y x","24":"y x"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"n","8":"n"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"n","4.4.3":"n"},"bb":{"7":"n","10":"y x"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"y x"},"and_chr":{"0":"y x"},"and_ff":{"0":"n"},"ie_mob":{"10":"n"}},"notes":"","usage_perc_y":40.33,"usage_perc_a":0.21,"ucprefix":false,"parent":"","keywords":"filewriter"},"bloburls":{"title":"Blob URLs","description":"Method of creating URL handles to the specified File or Blob object.","spec":"http://www.w3.org/TR/FileAPI/#url","status":"wd","links":[{"url":"https://developer.mozilla.org/en/DOM/window.URL.createObjectURL","title":"MDN article"}],"categories":["JS API"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"y","11":"y"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"y x","9":"y x","10":"y x","11":"y x","12":"y x","13":"y x","14":"y x","15":"y x","16":"y x","17":"y x","18":"y x","19":"y x","20":"y x","21":"y x","22":"y x","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"y x","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"y x","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"y x","4.1":"y x","4.2-4.3":"y x","4.4":"y","4.4.3":"y"},"bb":{"7":"n","10":"y x"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"y x"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"n"}},"notes":"","usage_perc_y":79.1,"usage_perc_a":0,"ucprefix":false,"parent":"fileapi","keywords":"createobjecturl"},"rellist":{"title":"relList (DOMTokenList)","description":"Method of easily manipulating rel attribute values on elements, using the DOMTokenList object (similar to classList).","spec":"http://www.w3.org/TR/html5/text-level-semantics.html#the-a-element","status":"wd","links":[{"url":"https://developer.mozilla.org/en-US/docs/DOM/DOMTokenList","title":"MDN - DOMTokenList"}],"categories":["DOM","HTML5"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"n","32":"n","33":"n","34":"n","35":"n","36":"n","37":"n","38":"n"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"n","6.1":"n","7":"n","8":"n"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"n","8":"n"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"n","4.4.3":"n"},"bb":{"7":"n","10":"n"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"n"},"and_chr":{"0":"n"},"and_ff":{"0":"y"},"ie_mob":{"10":"n"}},"notes":"","usage_perc_y":5.02,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":""},"typedarrays":{"title":"Typed Arrays","description":"JavaScript typed arrays provide a mechanism for accessing raw binary data much more efficiently.\r\n","spec":"http://www.khronos.org/registry/typedarray/specs/latest/","status":"other","links":[{"url":"https://developer.mozilla.org/en/javascript_typed_arrays","title":"MDN article"}],"categories":["JS API"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"y","11":"y"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"n","5":"n","6":"n","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"y","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"n","10":"y"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"","usage_perc_y":80.86,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":"float64array,dataview,uint8array"},"deviceorientation":{"title":"DeviceOrientation events","description":"API for detecting orientation and motion events from the device running the browser.","spec":"http://www.w3.org/TR/orientation-event/","status":"wd","links":[{"url":"http://www.html5rocks.com/en/tutorials/device/orientation/","title":"HTML5 Rocks tutorial"},{"url":"http://html5labs.interoperabilitybridges.com/prototypes/device-orientation-events/device-orientation-events/info","title":"DeviceOrientation implementation prototype for IE10"},{"url":"http://aurelio.audero.it/demo/device-orientation-api-demo.html","title":"Demo"},{"url":"https://raw.github.com/phiggins42/has.js/master/detect/features.js#native-orientation","title":"has.js test"}],"categories":["JS API"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"a"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"p","4":"p","5":"p","6":"a","7":"a","8":"a","9":"a","10":"a","11":"a","12":"a","13":"a","14":"a","15":"a","16":"a","17":"a","18":"a","19":"a","20":"a","21":"a","22":"a","23":"a","24":"a","25":"a","26":"a","27":"a","28":"a","29":"a","30":"a","31":"a","32":"a","33":"a"},"chrome":{"4":"n","5":"n","6":"n","7":"a","8":"a","9":"a","10":"a","11":"a","12":"a","13":"a","14":"a","15":"a","16":"a","17":"a","18":"a","19":"a","20":"a","21":"a","22":"a","23":"a","24":"a","25":"a","26":"a","27":"a","28":"a","29":"a","30":"a","31":"a","32":"a","33":"a","34":"a","35":"a","36":"a","37":"a","38":"a"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"n","6.1":"n","7":"n","8":"n"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"a","16":"a","17":"a","18":"a","19":"a","20":"a","21":"a","22":"a","23":"a","24":"a"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"a","5.0-5.1":"a","6.0-6.1":"a","7.0-7.1":"a","8":"a"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"a","4":"a","4.1":"a","4.2-4.3":"a","4.4":"a","4.4.3":"a"},"bb":{"7":"n","10":"a"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"y","12.1":"y","0":"a"},"and_chr":{"0":"a"},"and_ff":{"0":"a"},"ie_mob":{"10":"n"}},"notes":"Partial support refers to the lack of compassneedscalibration event. Partial support also refers to the lack of devicemotion event support for Chrome 30- and Opera. Opera Mobile 14 lost the ondevicemotion event support. Firefox 3.6, 4 and 5 support the non-standard <a href=\"https://developer.mozilla.org/en/DOM/MozOrientation\">MozOrientation</a> event.","usage_perc_y":0.08,"usage_perc_a":74.12,"ucprefix":false,"parent":"","keywords":""},"script-defer":{"title":"defer attribute for external scripts","description":"The boolean defer attribute on script elements allows the external JavaScript file to run when the DOM is loaded, without delaying page load first.","spec":"http://www.w3.org/TR/html5/the-script-element.html#attr-script-defer","status":"cr","links":[{"url":"http://docs.webplatform.org/wiki/html/attributes/defer","title":"WebPlatform Docs"},{"url":"https://developer.mozilla.org/en/HTML/Element/script#Attributes","title":"MDN article"},{"url":"https://raw.github.com/phiggins42/has.js/master/detect/script.js#script-defer","title":"has.js test"}],"categories":["DOM","HTML5"],"stats":{"ie":{"5.5":"a","6":"a","7":"a","8":"a","9":"a","10":"y","11":"y"},"firefox":{"2":"n","3":"n","3.5":"y","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"Partial support refers to a buggy implementation in IE<10","usage_perc_y":80.84,"usage_perc_a":7.49,"ucprefix":false,"parent":"","keywords":""},"nav-timing":{"title":"Navigation Timing API","description":"API for accessing timing information related to navigation and elements.","spec":"http://www.w3.org/TR/navigation-timing/","status":"cr","links":[{"url":"http://docs.webplatform.org/wiki/apis/navigation_timing","title":"WebPlatform Docs"},{"url":"http://www.html5rocks.com/en/tutorials/webperformance/basics/","title":"HTML5 Rocks tutorial"},{"url":"https://developer.mozilla.org/en/API/navigationTiming","title":"MDN article"}],"categories":["DOM","JS API"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"y","10":"y","11":"y"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"n","5":"n","6":"y x","7":"y x","8":"y x","9":"y x","10":"y x","11":"y x","12":"y x","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"n","6.1":"n","7":"n","8":"n"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"n","8":"n"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"n","10":"y"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"","usage_perc_y":73.09,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":"performance,performance.timing"},"audio-api":{"title":"Web Audio API","description":"High-level JavaScript API for processing and synthesizing audio","spec":"http://www.w3.org/TR/webaudio/","status":"wd","links":[{"url":"http://docs.webplatform.org/wiki/apis/webaudio","title":"WebPlatform Docs"},{"url":"https://github.com/corbanbrook/audionode.js","title":"Polyfill to support Web Audio API in Firefox"},{"url":"http://www.doboism.com/projects/webaudio-compatibility/","title":"Additional browser compatibility tests for specific features"},{"url":"https://github.com/g200kg/WAAPISim","title":"Polyfill to enable Web Audio API through Firefox Audio Data api or flash"}],"categories":["JS API"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"y x","11":"y x","12":"y x","13":"y x","14":"y x","15":"y x","16":"y x","17":"y x","18":"y x","19":"y x","20":"y x","21":"y x","22":"y x","23":"y x","24":"y x","25":"y x","26":"y x","27":"y x","28":"y x","29":"y x","30":"y x","31":"y x","32":"y x","33":"y x","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"y x","6.1":"y x","7":"y x","8":"y x"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"y x","16":"y x","17":"y x","18":"y x","19":"y x","20":"y x","21":"y x","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"y x","7.0-7.1":"y x","8":"y x"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"n","4.4.3":"n"},"bb":{"7":"n","10":"n"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"n"}},"notes":"Firefox versions < 25 support an alternative, deprecated audio API.","usage_perc_y":61.8,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":"web-audio"},"css-regions":{"title":"CSS Regions","description":"Method of flowing content into multiple elements.","spec":"http://www.w3.org/TR/css3-regions/","status":"wd","links":[{"url":"http://html.adobe.com/webstandards/cssregions/","title":"Adobe demos and samples"},{"url":"http://docs.webplatform.org/wiki/css/atrules/@region","title":"WebPlatform Docs"},{"url":"http://msdn.microsoft.com/en-us/ie/hh272902#_CSSConnected","title":"IE10 developer guide info"}],"categories":["CSS3"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"a x","11":"a x"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"n","32":"n","33":"n"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"a x","16":"a x","17":"a x","18":"a x","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"n","32":"n","33":"n","34":"n","35":"n","36":"n","37":"n","38":"n"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"n","6.1":"y x","7":"y x","8":"y x"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"y x","8":"y x"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"n","4.4.3":"n"},"bb":{"7":"n","10":"n"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"n"},"and_chr":{"0":"n"},"and_ff":{"0":"n"},"ie_mob":{"10":"a x"}},"notes":"Currently supported in WebKit Nightly using <code>-webkit-flow-into: flow_name;</code> and <code>-webkit-from-flow: flow_name;</code>. Support in Chrome 19+ is disabled by default and can be enabled using a runtime flag (see <code>about:flags</code>) or a command line flag (see  <a href=\"http://peter.sh/experiments/chromium-command-line-switches/#enable-css-regions\">this list</a>). For Chrome 19-22 the flag is named \"Enable CSS Regions\" / <code>--enable-css-regions</code>, while for Chrome 23+ the flag is named \"Enable experimental Web Platform features\" / <code>--enable-experimental-web-platform-features</code>. Support in IE10 is limited to using an iframe as a content source with the <code>-ms-flow-into: flow_name;</code> and <code>-ms-flow-from: flow_name;</code> syntax. ","usage_perc_y":7.91,"usage_perc_a":10.36,"ucprefix":false,"parent":"","keywords":""},"fullscreen":{"title":"Full Screen API","description":"API for allowing content (like a video or canvas element) to take up the entire screen.","spec":"http://www.w3.org/TR/fullscreen/","status":"wd","links":[{"url":"http://docs.webplatform.org/wiki/dom/methods/requestFullscreen","title":"WebPlatform Docs"},{"url":"https://developer.mozilla.org/en/DOM/Using_full-screen_mode","title":"MDN article"},{"url":"http://hacks.mozilla.org/2012/01/using-the-fullscreen-api-in-web-browsers/","title":"Mozilla hacks article"},{"url":"http://jlongster.com/2011/11/21/canvas.html","title":"Blog post"}],"categories":["JS API"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"y x"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"a x","11":"a x","12":"a x","13":"a x","14":"a x","15":"a x","16":"a x","17":"a x","18":"a x","19":"a x","20":"a x","21":"a x","22":"a x","23":"a x","24":"a x","25":"a x","26":"a x","27":"a x","28":"a x","29":"a x","30":"a x","31":"a x","32":"a x","33":"a x"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"a x","16":"a x","17":"a x","18":"a x","19":"a x","20":"y x","21":"y x","22":"y x","23":"y x","24":"y x","25":"y x","26":"y x","27":"y x","28":"y x","29":"y x","30":"y x","31":"y x","32":"y x","33":"y x","34":"y x","35":"y x","36":"y x","37":"y x","38":"y x"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"a x","6":"y x","6.1":"y x","7":"y x","8":"y x"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"y","15":"y x","16":"y x","17":"y x","18":"y x","19":"y x","20":"y x","21":"y x","22":"y x","23":"y x","24":"y x"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"n","8":"n"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"n","4.4.3":"n"},"bb":{"7":"n","10":"a"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"y x"},"and_chr":{"0":"y x"},"and_ff":{"0":"a x"},"ie_mob":{"10":"n"}},"notes":"Partial support refers to supporting an earlier draft of the spec.","usage_perc_y":50.15,"usage_perc_a":14.55,"ucprefix":false,"parent":"","keywords":"full-screen"},"requestanimationframe":{"title":"requestAnimationFrame","description":"API allowing a more efficient way of running script-based animation, compared to traditional methods using timeouts.","spec":"http://www.w3.org/TR/animation-timing/#requestAnimationFrame","status":"cr","links":[{"url":"http://paulirish.com/2011/requestanimationframe-for-smart-animating/","title":"Blog post"},{"url":"http://hacks.mozilla.org/2011/08/animating-with-javascript-from-setinterval-to-requestanimationframe/","title":"Mozilla Hacks article"},{"url":"http://docs.webplatform.org/wiki/dom/Window/requestAnimationFrame","title":"WebPlatform Docs"}],"categories":["JS API"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"y","11":"y"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"y x","5":"y x","6":"y x","7":"y x","8":"y x","9":"y x","10":"y x","11":"y x","12":"y x","13":"y x","14":"y x","15":"y x","16":"y x","17":"y x","18":"y x","19":"y x","20":"y x","21":"y x","22":"y x","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"y x","11":"y x","12":"y x","13":"y x","14":"y x","15":"y x","16":"y x","17":"y x","18":"y x","19":"y x","20":"y x","21":"y x","22":"y x","23":"y x","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"y x","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"y x","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"y","4.4.3":"y"},"bb":{"7":"n","10":"y x"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"","usage_perc_y":74.57,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":""},"input-range":{"title":"Range input type","description":"Form field type that allows the user to select a value using a slider widget.","spec":"http://www.whatwg.org/specs/web-apps/current-work/multipage/states-of-the-type-attribute.html#range-state-(type=range)","status":"wd","links":[{"url":"https://raw.github.com/phiggins42/has.js/master/detect/form.js#input-type-range","title":"has.js test"},{"url":"https://github.com/freqdec/fd-slider","title":"Cross-browser polyfill"},{"url":"https://github.com/fryn/html5slider","title":"Polyfill for Firefox"},{"url":"http://docs.webplatform.org/wiki/html/elements/input/type/range","title":"WebPlatform Docs"},{"url":"http://tutorialzine.com/2011/12/what-you-need-to-know-html5-range-input/","title":"Tutorial"},{"url":"https://github.com/andreruffert/rangeslider.js","title":"rangeslider.js polyfill"}],"categories":["HTML5"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"y","11":"y"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"u","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"y","3.2":"y","4":"y","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"y","9.5-9.6":"y","10.0-10.1":"y","10.5":"y","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"a","2.2":"a","2.3":"a","3":"a","4":"a","4.1":"a","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"y","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"Currently all Android browsers with partial support hide the slider input field by default. However, the element <a href=\"http://tiffanybbrown.com/2012/02/07/input-typerange-and-androids-stock-browser/\">can be styled</a> to be made visible and usable.","usage_perc_y":77.16,"usage_perc_a":3.98,"ucprefix":false,"parent":"forms","keywords":""},"matchmedia":{"title":"matchMedia","description":"API for finding out whether or not a media query applies to the document.","spec":"http://www.w3.org/TR/cssom-view/#dom-window-matchmedia","status":"wd","links":[{"url":"https://github.com/paulirish/matchMedia.js/","title":"matchMedia.js polyfill"},{"url":"https://developer.mozilla.org/en/DOM/window.matchMedia","title":"MDN article"},{"url":"https://developer.mozilla.org/en/CSS/Using_media_queries_from_code","title":"MDN tutorial"},{"url":"http://docs.webplatform.org/wiki/css/media_queries/apis/matchMedia","title":"WebPlatform Docs"}],"categories":["JS API","DOM"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"y","11":"y"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"n","10":"y"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"","usage_perc_y":80.68,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":"mediaquerylist"},"input-datetime":{"title":"Date/time input types","description":"Form field widget to easily allow users to enter dates and/or times, generally by using a calendar widget.","spec":"http://www.whatwg.org/specs/web-apps/current-work/multipage/states-of-the-type-attribute.html#date-state-(type=date)","status":"wd","links":[{"url":"http://net.tutsplus.com/tutorials/javascript-ajax/quick-tip-cross-browser-datepickers-within-minutes/","title":"Datepicker tutorial w/polyfill"},{"url":"https://github.com/zoltan-dulac/html5Forms.js","title":"Polyfill for HTML5 forms"},{"url":"http://docs.webplatform.org/wiki/html/elements/input/type/date","title":"WebPlatform Docs"},{"url":"https://raw.github.com/phiggins42/has.js/master/detect/form.js#input-type-datetime;input-type-datetime-local","title":"has.js test"}],"categories":["HTML5"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"n","32":"n","33":"n"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"a","21":"a","22":"a","23":"a","24":"a","25":"a","26":"a","27":"a","28":"a","29":"a","30":"a","31":"a","32":"a","33":"a","34":"a","35":"a","36":"a","37":"a","38":"a"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"n","6.1":"u","7":"n","8":"n"},"opera":{"9":"y","9.5-9.6":"y","10.0-10.1":"y","10.5":"y","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"a","16":"a","17":"a","18":"a","19":"a","20":"a","21":"a","22":"a","23":"a","24":"a"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"a","6.0-6.1":"a","7.0-7.1":"a","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"y","4.4.3":"y"},"bb":{"7":"n","10":"y"},"op_mob":{"10":"y","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"a"},"and_chr":{"0":"y"},"and_ff":{"0":"n"},"ie_mob":{"10":"n"}},"notes":"Safari provides date-formatted text fields, but no real calendar widget. Partial support in Chrome refers to a missing calendar widget for the \"datetime\" type (and other types in older versions). Some modified versions of the Android 4.x browser do have support for date/time fields. Partial support in iOS refers to a lack of support for attributes like step, min, or max.","usage_perc_y":6.98,"usage_perc_a":41.2,"ucprefix":false,"parent":"forms","keywords":"datepicker,timepicker"},"input-color":{"title":"Color input type","description":"Form field allowing the user to select a color.","spec":"http://www.whatwg.org/specs/web-apps/current-work/multipage/states-of-the-type-attribute.html#color-state-(type=color)","status":"wd","links":[{"url":"http://www.html5tutorial.info/html5-color.php","title":"Tutorial"},{"url":"https://github.com/jonstipe/color-polyfill","title":"Polyfill"},{"url":"http://docs.webplatform.org/wiki/html/elements/input/type/color","title":"WebPlatform Docs"}],"categories":["HTML5"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"n","6.1":"n","7":"n","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"n","16":"n","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"n","8":"n"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"y","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"n"},"ie_mob":{"10":"n"}},"notes":"","usage_perc_y":53.05,"usage_perc_a":0,"ucprefix":false,"parent":"forms","keywords":"colour"},"input-number":{"title":"Number input type","description":"Form field type for numbers.","spec":"http://www.whatwg.org/specs/web-apps/current-work/multipage/states-of-the-type-attribute.html#number-state-(type=number)","status":"wd","links":[{"url":"https://github.com/jonstipe/number-polyfill","title":"Polyfill"},{"url":"http://www.html5tutorial.info/html5-number.php","title":"Tutorial"},{"url":"http://docs.webplatform.org/wiki/html/elements/input/type/number","title":"WebPlatform Docs"},{"url":"https://raw.github.com/phiggins42/has.js/master/detect/form.js#input-type-number","title":"has.js test"}],"categories":["HTML5"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"a","11":"a"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"n","5":"n","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"y","9.5-9.6":"y","10.0-10.1":"y","10.5":"y","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"a","4.0-4.1":"a","4.2-4.3":"a","5.0-5.1":"a","6.0-6.1":"a","7.0-7.1":"a","8":"a"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"a","4.1":"a","4.2-4.3":"a","4.4":"a","4.4.3":"a"},"bb":{"7":"n","10":"a"},"op_mob":{"10":"y","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"a"},"and_chr":{"0":"a"},"and_ff":{"0":"a"},"ie_mob":{"10":"a"}},"notes":"iOS Safari, Android 4, Chrome for Android show number input, but do not use \"step\", \"min\" or \"max\" attributes or show increment/decrement buttons. Internet Explorer 10 and 11 do not show increment/decrement buttons.","usage_perc_y":50.41,"usage_perc_a":28.39,"ucprefix":false,"parent":"forms","keywords":"spinner"},"iframe-sandbox":{"title":"sandbox attribute for iframes","description":"Method of running external site pages with reduced privileges (e.g. no JavaScript) in iframes","spec":"http://www.w3.org/TR/html5/embedded-content-0.html#attr-iframe-sandbox","status":"cr","links":[{"url":"http://msdn.microsoft.com/en-us/hh563496","title":"MSDN article"},{"url":"http://blog.chromium.org/2010/05/security-in-depth-html5s-sandbox.html","title":"Chromium blog article"},{"url":"http://docs.webplatform.org/wiki/html/attributes/sandbox","title":"WebPlatform Docs"}],"categories":["HTML5"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"y","11":"y"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"a","18":"a","19":"a","20":"a","21":"a","22":"a","23":"a","24":"a","25":"a","26":"a","27":"a","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"y","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"y","2.3":"y","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"","usage_perc_y":79.82,"usage_perc_a":1.34,"ucprefix":false,"parent":"","keywords":""},"css-counters":{"title":"CSS Counters","description":"Method of controlling number values in generated content, using the counter-reset and counter-increment properties.","spec":"http://www.w3.org/TR/CSS21/generate.html#counters","status":"wd","links":[{"url":"http://docs.webplatform.org/wiki/css/properties/counter-reset","title":"WebPlatform Docs"},{"url":"https://developer.mozilla.org/en/CSS_Counters","title":"MDN article"},{"url":"http://onwebdev.blogspot.com/2012/02/css-counters-tutorial.html","title":"Tutorial and information"}],"categories":["CSS2"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"y","9":"y","10":"y","11":"y"},"firefox":{"2":"y","3":"y","3.5":"y","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"y","3.2":"y","4":"y","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"y","9.5-9.6":"y","10.0-10.1":"y","10.5":"y","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"y","4.0-4.1":"y","4.2-4.3":"y","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"y"},"android":{"2.1":"y","2.2":"y","2.3":"y","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"y","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"","usage_perc_y":93.04,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":""},"css-resize":{"title":"CSS resize property","description":"Method of allowing an element to be resized by the user, with options to limit to a given direction. ","spec":"http://www.w3.org/TR/css3-ui/#resize","status":"wd","links":[{"url":"http://css-tricks.com/almanac/properties/r/resize/","title":"CSS Tricks info"},{"url":"http://davidwalsh.name/textarea-resize","title":"On textarea resizing"}],"categories":["CSS3"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"y x","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"y","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"a","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"n","8":"n"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"n","4.4.3":"n"},"bb":{"7":"n","10":"n"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"n"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"n"}},"notes":"Opera 12.10+ currently only supports the resize property for textarea elements.","usage_perc_y":58.05,"usage_perc_a":0.32,"ucprefix":false,"parent":"","keywords":"horizontal,vertical"},"input-placeholder":{"title":"input placeholder attribute","description":"Method of setting placeholder text for text-like input fields, to suggest the expected inserted information.","spec":"http://dev.w3.org/html5/spec/Overview.html#attr-input-placeholder","status":"cr","links":[{"url":"https://github.com/mathiasbynens/jquery-placeholder","title":"Polyfill"},{"url":"http://www.zachleat.com/web/placeholder/","title":"Article on usage"},{"url":"http://docs.webplatform.org/wiki/html/attributes/placeholder","title":"WebPlatform Docs"},{"url":"https://code.google.com/p/android/issues/detail?id=24626","title":"Issue 24626: Placeholder text for an input type="},{"url":"https://raw.github.com/phiggins42/has.js/master/detect/form.js#input-attr-placeholder","title":"has.js test"}],"categories":["HTML5"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"y","11":"y"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"a","3.2":"a","4":"a","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"a","11.1":"a","11.5":"a","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"y","4.0-4.1":"y","4.2-4.3":"y","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"y","2.2":"y","2.3":"y","3":"y","4":"a","4.1":"a","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"n","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"Partial support in older Safari and Opera versions refers to lacking placeholder support on textarea elements. ","usage_perc_y":79.47,"usage_perc_a":3.02,"ucprefix":false,"parent":"forms","keywords":""},"spdy":{"title":"SPDY networking protocol","description":"Networking protocol for low-latency transport of content over the web.","spec":"http://tools.ietf.org/html/draft-mbelshe-httpbis-spdy-00","status":"unoff","links":[{"url":"http://dev.chromium.org/spdy/spdy-whitepaper","title":"SPDY whitepaper"},{"url":"http://en.wikipedia.org/wiki/SPDY","title":"Wikipedia"}],"categories":["Other"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"a"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"n","6.1":"n","7":"n","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"n","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"n","10":"n"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"n"}},"notes":"","usage_perc_y":60.33,"usage_perc_a":7.18,"ucprefix":false,"parent":"","keywords":""},"css-repeating-gradients":{"title":"CSS Repeating Gradients","description":"Method of defining a repeating linear or radial color gradient as a CSS image.","spec":"http://www.w3.org/TR/css3-images/#repeating-gradients","status":"cr","links":[{"url":"http://docs.webplatform.org/wiki/css/repeating-linear-gradient","title":"WebPlatform Docs"},{"url":"http://www.css3files.com/gradient/#repeatinglineargradient","title":"Information page"},{"url":"https://developer.mozilla.org/en/CSS/repeating-linear-gradient","title":"MDN article"}],"categories":["CSS3"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"y","11":"y"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"y x","4":"y x","5":"y x","6":"y x","7":"y x","8":"y x","9":"y x","10":"y x","11":"y x","12":"y x","13":"y x","14":"y x","15":"y x","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"y x","11":"y x","12":"y x","13":"y x","14":"y x","15":"y x","16":"y x","17":"y x","18":"y x","19":"y x","20":"y x","21":"y x","22":"y x","23":"y x","24":"y x","25":"y x","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"y x","6":"y x","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"a x","11.5":"a x","11.6":"y x","12":"y x","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"y x","6.0-6.1":"y x","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"y x","4.1":"y x","4.2-4.3":"y x","4.4":"y","4.4.3":"y"},"bb":{"7":"n","10":"y x"},"op_mob":{"10":"n","11":"n","11.1":"a x","11.5":"a x","12":"y x","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"Firefox 10+, Chrome 26+ and Opera 11.6+ also support the new \"to (side)\" syntax.","usage_perc_y":80.92,"usage_perc_a":0.02,"ucprefix":false,"parent":"css-gradients","keywords":""},"css-filters":{"title":"CSS Filter Effects","description":"Method of applying filter effects (like blur, grayscale, brightness, contrast and hue) to elements, previously only possible by using SVG.","spec":"http://www.w3.org/TR/filter-effects/","status":"wd","links":[{"url":"http://dl.dropbox.com/u/3260327/angular/CSS3ImageManipulation.html","title":"Filter editor"},{"url":"http://bennettfeely.com/filters/","title":"Filter Playground"},{"url":"http://html5-demos.appspot.com/static/css/filters/index.html","title":"Demo file for WebKit browsers"},{"url":"http://www.html5rocks.com/en/tutorials/filters/understanding-css/","title":"HTML5Rocks article"}],"categories":["CSS","CSS3"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"u","32":"u","33":"u"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"y x","19":"y x","20":"y x","21":"y x","22":"y x","23":"y x","24":"y x","25":"y x","26":"y x","27":"y x","28":"y x","29":"y x","30":"y x","31":"y x","32":"y x","33":"y x","34":"y x","35":"y x","36":"y x","37":"y x","38":"y x"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"y x","6.1":"y x","7":"y x","8":"y x"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"y x","16":"y x","17":"y x","18":"y x","19":"y x","20":"y x","21":"y x","22":"y x","23":"y x","24":"y x"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"y x","7.0-7.1":"y x","8":"y x"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"y x","4.4.3":"y x"},"bb":{"7":"n","10":"y x"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"y x"},"and_chr":{"0":"y x"},"and_ff":{"0":"n"},"ie_mob":{"10":"n"}},"notes":"Note that this property is significantly different from and incompatible with Microsoft's <a href=\"http://msdn.microsoft.com/en-us/library/ie/ms530752%28v=vs.85%29.aspx\">older \"filter\" property</a>.","usage_perc_y":50.09,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":"sepia,hue-rotate,invert,saturate"},"getcomputedstyle":{"title":"getComputedStyle","description":"API to get the current computed CSS styles applied to an element. This may be the current value applied by an animation or as set by a stylesheet.","spec":"http://www.w3.org/TR/cssom/#dom-window-getcomputedstyle","status":"rec","links":[{"url":"http://ie.microsoft.com/testdrive/HTML5/getComputedStyle/","title":"Demo"},{"url":"http://docs.webplatform.org/wiki/css/cssom/methods/getComputedStyle","title":"WebPlatform Docs"},{"url":"http://snipplr.com/view/13523/","title":"Polyfill for IE"},{"url":"https://developer.mozilla.org/en/DOM/window.getComputedStyle","title":"MDN article"}],"categories":["JS API","CSS3","DOM"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"y","10":"y","11":"y"},"firefox":{"2":"n","3":"a","3.5":"a","3.6":"a","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"a","5":"a","6":"a","7":"a","8":"a","9":"a","10":"a","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"a","3.2":"a","4":"a","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"a","9.5-9.6":"a","10.0-10.1":"a","10.5":"a","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"a","4.0-4.1":"a","4.2-4.3":"a","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"a"},"android":{"2.1":"a","2.2":"a","2.3":"a","3":"a","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"a","10":"y"},"op_mob":{"10":"a","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"Partial support in older Firefox versions refers to requiring the second parameter to be included. Partial support in all other browsers refers to not supporting getComputedStyle on pseudo-elements.","usage_perc_y":83.58,"usage_perc_a":4.99,"ucprefix":false,"parent":"","keywords":""},"word-break":{"title":"CSS3 word-break","description":"Property to prevent or allow words to be broken over multiple lines between letters.","spec":"http://www.w3.org/TR/css3-text/#word-break","status":"wd","links":[{"url":"https://developer.mozilla.org/en/CSS/word-break","title":"MDN article"},{"url":"http://docs.webplatform.org/wiki/css/properties/word-break","title":"WebPlatform Docs"}],"categories":["CSS3"],"stats":{"ie":{"5.5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"a","5":"a","6":"a","7":"a","8":"a","9":"a","10":"a","11":"a","12":"a","13":"a","14":"a","15":"a","16":"a","17":"a","18":"a","19":"a","20":"a","21":"a","22":"a","23":"a","24":"a","25":"a","26":"a","27":"a","28":"a","29":"a","30":"a","31":"a","32":"a","33":"a","34":"a","35":"a","36":"a","37":"a","38":"a"},"safari":{"3.1":"a","3.2":"a","4":"a","5":"a","5.1":"a","6":"a","6.1":"a","7":"a","8":"a"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"a","16":"a","17":"a","18":"a","19":"a","20":"a","21":"a","22":"a","23":"a","24":"a"},"ios_saf":{"3.2":"a","4.0-4.1":"a","4.2-4.3":"a","5.0-5.1":"a","6.0-6.1":"a","7.0-7.1":"a","8":"a"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"a","2.2":"a","2.3":"a","3":"a","4":"a","4.1":"a","4.2-4.3":"a","4.4":"a","4.4.3":"a"},"bb":{"7":"a","10":"a"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"a"},"and_chr":{"0":"a"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"Partial support refers to supporting the \"break-all\" value, but not the \"keep-all\" value.","usage_perc_y":31.08,"usage_perc_a":57.88,"ucprefix":false,"parent":"","keywords":"break-all,keep-all"},"viewport-units":{"title":"Viewport units: vw, vh, vmin, vmax","description":"Length units representing 1% of the viewport size for viewport width (vw), height (vh), the smaller of the two (vmin), or the larger of the two (vmax).","spec":"http://www.w3.org/TR/css3-values/#viewport-relative-lengths","status":"cr","links":[{"url":"https://github.com/saabi/vminpoly","title":"Polyfill"},{"url":"http://blog.rodneyrehm.de/archives/34-iOS7-Mobile-Safari-And-Viewport-Units.html","title":"Back-Forward issue blog post"},{"url":"https://github.com/rodneyrehm/viewport-units-buggyfill","title":"Buggyfill - Polyfill that fixes buggy support"},{"url":"http://css-tricks.com/viewport-sized-typography/","title":"Blog post"}],"categories":["CSS3"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"a #2","10":"a #1","11":"a #1"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"a #1","21":"a #1","22":"a #1","23":"a #1","24":"a #1","25":"a #1","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"a #1","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"a #1","7.0-7.1":"a #3","8":"a #3"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"y","4.4.3":"y"},"bb":{"7":"n","10":"a #1"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"a #1"}},"notes":"Partial support in IE9 refers to supporting \"vm\" instead of \"vmin\". Partial support in iOS7 is due to buggy behavior of the \"vh\" unit. All other partial support refers to not supporting the \"vmax\" unit. ","usage_perc_y":55.64,"usage_perc_a":20.28,"ucprefix":false,"parent":"","keywords":"vm,viewport-percentage"},"contentsecuritypolicy":{"title":"Content Security Policy","description":"Mitigate cross-site scripting attacks by whitelisting allowed sources of script, style, and other resources.","spec":"http://www.w3.org/TR/CSP/","status":"cr","links":[{"url":"http://html5rocks.com/en/tutorials/security/content-security-policy/","title":"HTML5Rocks article"},{"url":"http://content-security-policy.com/","title":"CSP Examples & Quick Reference"}],"categories":["Other"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"a x","11":"a x"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"y x","5":"y x","6":"y x","7":"y x","8":"y x","9":"y x","10":"y x","11":"y x","12":"y x","13":"y x","14":"y x","15":"y x","16":"y x","17":"y x","18":"y x","19":"y x","20":"y x","21":"y x","22":"y x","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"y x","15":"y x","16":"y x","17":"y x","18":"y x","19":"y x","20":"y x","21":"y x","22":"y x","23":"y x","24":"y x","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"a x","6":"y x","6.1":"y x","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"a x","6.0-6.1":"y x","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"y","4.4.3":"y"},"bb":{"7":"n","10":"y x"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"a x"}},"notes":"The HTTP header is 'X-Content-Security-Policy' for Firefox until version 23 and IE10&11, and 'X-Webkit-CSP' for Chrome until version 25 and Safari until version 7. 'Content-Security-Policy' is the official W3C defined header, used by Chrome version 25 and later, Firefox version 23 and later, and Safari 7 and later.","usage_perc_y":64.12,"usage_perc_a":11.08,"ucprefix":false,"parent":"","keywords":"csp,security,header"},"pagevisibility":{"title":"Page Visibility","description":"JavaScript API for determining whether a document is visible on the display","spec":"http://www.w3.org/TR/page-visibility/","status":"rec","links":[{"url":"http://www.sitepoint.com/introduction-to-page-visibility-api/","title":"SitePoint article"},{"url":"http://docs.webplatform.org/wiki/apis/timing/properties/visibilityState","title":"WebPlatform Docs"},{"url":"http://aurelio.audero.it/demo/page-visibility-api-demo.html","title":"Demo"},{"url":"https://developer.mozilla.org/en-US/docs/DOM/Using_the_Page_Visibility_API","title":"MDN article"}],"categories":["JS API"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"y","11":"y"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"y x","11":"y x","12":"y x","13":"y x","14":"y x","15":"y x","16":"y x","17":"y x","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"y x","15":"y x","16":"y x","17":"y x","18":"y x","19":"y x","20":"y x","21":"y x","22":"y x","23":"y x","24":"y x","25":"y x","26":"y x","27":"y x","28":"y x","29":"y x","30":"y x","31":"y x","32":"y x","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"n","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"y","15":"y x","16":"y x","17":"y x","18":"y x","19":"y x","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"y x","4.4.3":"y x"},"bb":{"7":"n","10":"y x"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"","usage_perc_y":73.47,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":"visibilitystate"},"stricttransportsecurity":{"title":"Strict Transport Security","description":"Declare that a website is only accessible over a secure connection (HTTPS).","spec":"http://tools.ietf.org/html/rfc6797","status":"other","links":[{"url":"http://dev.chromium.org/sts","title":"Strict Transport Security @ Chromium"},{"url":"https://developer.mozilla.org/en-US/docs/Security/HTTP_Strict_Transport_Security","title":"Strict Transport Security @ Mozilla Developer Network"}],"categories":["Other"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"n","6.1":"n","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"u","8":"u"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"y","4.4.3":"y"},"bb":{"7":"n","10":"n"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"n"}},"notes":"The HTTP header is 'Strict-Transport-Security'.","usage_perc_y":57.46,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":"sts,hsts,security,header"},"style-scoped":{"title":"Scoped CSS","description":"Allows CSS rules to be scoped to part of the document, based on the position of the style element.","spec":"http://www.w3.org/TR/html5/document-metadata.html#attr-style-scoped","status":"cr","links":[{"url":"http://html5doctor.com/the-scoped-attribute/","title":"HTML5 Doctor article"},{"url":"https://github.com/PM5544/scoped-polyfill","title":"Polyfill"},{"url":"http://updates.html5rocks.com/2012/03/A-New-Experimental-Feature-style-scoped","title":"HTML5Rocks article"}],"categories":["CSS","HTML5"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"n","32":"n","33":"n","34":"n","35":"n","36":"n","37":"n","38":"n"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"n","6.1":"n","7":"n","8":"n"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"n","8":"n"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"n","4.4.3":"n"},"bb":{"7":"n","10":"n"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"u","0":"n"},"and_chr":{"0":"n"},"and_ff":{"0":"y"},"ie_mob":{"10":"n"}},"notes":"Supported in Chrome 20-36 by enabling the \"experimental Web Platform features\" flag in chrome://flags.","usage_perc_y":12.95,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":"scope"},"svg-fragment":{"title":"SVG fragment identifiers","description":"Method of displaying only a part of an SVG image by defining a view ID or view box dimensions as the file's fragment identifier.","spec":"http://www.w3.org/TR/SVG/linking.html#SVGFragmentIdentifiers","status":"rec","links":[{"url":"http://www.broken-links.com/2012/08/14/better-svg-sprites-with-fragment-identifiers/","title":"Blog post"}],"categories":["SVG"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"y","11":"y"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"n","32":"n","33":"n","34":"n","35":"n","36":"u","37":"u","38":"u"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"n","6.1":"n","7":"n","8":"a"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"n","8":"a"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"n","4.4.3":"n"},"bb":{"7":"n","10":"y"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"u","0":"n"},"and_chr":{"0":"n"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"Partial support in Safari refers to supporting viewBox dimensions but not a view ID.","usage_perc_y":23.59,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":"fragments,sprite"},"outline":{"title":"CSS outline","description":"The CSS outline property is a shorthand property for setting one or more of the individual outline properties outline-style, outline-width and outline-color in a single rule. In most cases the use of this shortcut is preferable and more convenient.","spec":"http://www.w3.org/TR/CSS2/ui.html#propdef-outline","status":"rec","links":[{"url":"http://dev.w3.org/csswg/css3-ui/#outline","title":"CSS Basic User Interface Module Level 3"},{"url":"https://developer.mozilla.org/en-US/docs/CSS/outline","title":"Mozilla Developer Network: outline"}],"categories":["CSS2"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"y","9":"y","10":"y","11":"y"},"firefox":{"2":"y","3":"y","3.5":"y","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"y","3.2":"y","4":"y","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"y","9.5-9.6":"y","10.0-10.1":"y","10.5":"y","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"y","4.0-4.1":"y","4.2-4.3":"y","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"y","2.2":"y","2.3":"y","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"y","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"","usage_perc_y":89.84,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":"-moz-outline,outline-width,outline-style,outline-color"},"download":{"title":"Download attribute","description":"When used on an anchor, this attribute signifies that the resource it points to should be downloaded by the browser rather than navigate to it.","spec":"http://www.whatwg.org/specs/web-apps/current-work/multipage/links.html#downloading-resources","status":"wd","links":[{"url":"http://html5-demos.appspot.com/static/a.download.html","title":"Demo: creating a text file and downloading it."},{"url":"http://updates.html5rocks.com/2011/08/Downloading-resources-in-HTML5-a-download","title":"HTML5Rocks post"}],"categories":["HTML5"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"n","6.1":"n","7":"n","8":"n"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"n","8":"n"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"y","4.4.3":"y"},"bb":{"7":"n","10":"y"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"n"}},"notes":"","usage_perc_y":54.26,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":"download,a.download,a[download],download attribute"},"pointer":{"title":"Pointer events","description":"This specification integrates various inputs from mice, touchscreens, and pens, making separate implementations no longer necessary and authoring for cross-device pointers easier. Not to be mistaken with the unrelated \"pointer-events\" CSS property.","spec":"http://www.w3.org/TR/pointerevents/","status":"cr","links":[{"url":"http://blogs.msdn.com/b/ie/archive/2011/09/20/touch-input-for-ie10-and-metro-style-apps.aspx","title":"Implementation of Pointer Events in IE10"},{"url":"http://blogs.msdn.com/b/davrous/archive/2013/02/20/handling-touch-in-your-html5-apps-thanks-to-the-pointer-events-of-ie10-and-windows-8.aspx","title":"Article & tutorial"},{"url":"http://blogs.msdn.com/b/eternalcoding/archive/2013/01/16/hand-js-a-polyfill-for-supporting-pointer-events-on-every-browser.aspx","title":"Hand.js, the polyfill for browsers only supporting Touch Events"}],"categories":["JS API","DOM"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"a x","11":"y"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"p","7":"p","8":"p","9":"p","10":"p","11":"p","12":"p","13":"p","14":"p","15":"p","16":"p","17":"p","18":"p","19":"p","20":"p","21":"p","22":"p","23":"p","24":"p","25":"p","26":"p","27":"p","28":"p","29":"p","30":"p","31":"p","32":"p","33":"p"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"p","23":"p","24":"p","25":"p","26":"p","27":"p","28":"p","29":"p","30":"p","31":"p","32":"p","33":"p","34":"p","35":"p","36":"p","37":"p","38":"p"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"n","6.1":"u","7":"u","8":"u"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"p","16":"p","17":"p","18":"p","19":"p","20":"p","21":"p","22":"p","23":"p","24":"p"},"ios_saf":{"3.2":"p","4.0-4.1":"p","4.2-4.3":"p","5.0-5.1":"p","6.0-6.1":"p","7.0-7.1":"p","8":"p"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"p","2.2":"p","2.3":"p","3":"p","4":"p","4.1":"p","4.2-4.3":"p","4.4":"p","4.4.3":"p"},"bb":{"7":"p","10":"p"},"op_mob":{"10":"n","11":"p","11.1":"p","11.5":"p","12":"p","12.1":"p","0":"p"},"and_chr":{"0":"p"},"and_ff":{"0":"p"},"ie_mob":{"10":"a x"}},"notes":"Partial support in IE10 refers the lack of pointerenter and pointerleave events. Firefox Nightly provides 'dom.w3c_pointer_events.enabled' option to support this specification starting with version 28.","usage_perc_y":7.18,"usage_perc_a":3.04,"ucprefix":false,"parent":"","keywords":"pointerdown,pointermove,pointerup,pointercancel,pointerover,pointerout,pointerenter,pointerleave"},"user-select-none":{"title":"CSS user-select: none","description":"Method of preventing text/element selection using CSS. ","spec":"https://developer.mozilla.org/en-US/docs/CSS/user-select","status":"unoff","links":[{"url":"http://css-tricks.com/almanac/properties/u/user-select/","title":"CSS Tricks article"},{"url":"http://msdn.microsoft.com/en-us/library/ie/hh781492(v=vs.85).aspx","title":"MSDN Documentation"},{"url":"https://developer.mozilla.org/en-US/docs/CSS/user-select","title":"MDN article"}],"categories":["CSS"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"y x","11":"y x"},"firefox":{"2":"y x","3":"y x","3.5":"y x","3.6":"y x","4":"y x","5":"y x","6":"y x","7":"y x","8":"y x","9":"y x","10":"y x","11":"y x","12":"y x","13":"y x","14":"y x","15":"y x","16":"y x","17":"y x","18":"y x","19":"y x","20":"y x","21":"y x","22":"y x","23":"y x","24":"y x","25":"y x","26":"y x","27":"y x","28":"y x","29":"y x","30":"y x","31":"y x","32":"y x","33":"y x"},"chrome":{"4":"u","5":"u","6":"y x","7":"y x","8":"y x","9":"y x","10":"y x","11":"y x","12":"y x","13":"y x","14":"y x","15":"y x","16":"y x","17":"y x","18":"y x","19":"y x","20":"y x","21":"y x","22":"y x","23":"y x","24":"y x","25":"y x","26":"y x","27":"y x","28":"y x","29":"y x","30":"y x","31":"y x","32":"y x","33":"y x","34":"y x","35":"y x","36":"y x","37":"y x","38":"y x"},"safari":{"3.1":"y x","3.2":"y x","4":"y x","5":"y x","5.1":"y x","6":"y x","6.1":"y x","7":"y x","8":"y x"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"y x","16":"y x","17":"y x","18":"y x","19":"y x","20":"y x","21":"y x","22":"y x","23":"y x","24":"y x"},"ios_saf":{"3.2":"y x","4.0-4.1":"y x","4.2-4.3":"y x","5.0-5.1":"y x","6.0-6.1":"y x","7.0-7.1":"y x","8":"y x"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"y x","2.2":"y x","2.3":"y x","3":"y x","4":"y x","4.1":"y x","4.2-4.3":"y x","4.4":"y x","4.4.3":"y x"},"bb":{"7":"y x","10":"y x"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"y x"},"and_chr":{"0":"y x"},"and_ff":{"0":"y x"},"ie_mob":{"10":"y x"}},"notes":"Currently the user-select property does not appear in any W3C specification. Support information here is only for \"none\" value, not others.","usage_perc_y":82.23,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":""},"webp":{"title":"WebP image format","description":"Image format that supports lossy and lossless compression, as well as animation and alpha transparency.","spec":"https://developers.google.com/speed/webp/","status":"other","links":[{"url":"https://developers.google.com/speed/webp/faq#which_web_browsers_natively_support_webp","title":"Official website FAQ - Which web browsers natively support WebP?"},{"url":"http://webpjs.appspot.com/","title":"Polyfill for browsers with or without WebM support (i.e. IE6-IE9, Safari/iOS version 6.1 and below; Firefox versions 24 and bel"},{"url":"https://developers.google.com/speed/webp/","title":"Official website"},{"url":"http://antimatter15.github.io/weppy/demo.html","title":"Polyfill for browsers with WebM support"},{"url":"http://libwebpjs.appspot.com/","title":"Decoder in JS"}],"categories":["Other"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"p","5":"p","6":"p","7":"p","8":"p","9":"p","10":"p","11":"p","12":"p","13":"p","14":"p","15":"p","16":"p","17":"p","18":"p","19":"p","20":"p","21":"p","22":"p","23":"p","24":"p","25":"p","26":"p","27":"p","28":"p","29":"p","30":"p","31":"p","32":"p","33":"p"},"chrome":{"4":"n","5":"n","6":"p","7":"p","8":"p","9":"a","10":"a","11":"a","12":"a","13":"a","14":"a","15":"a","16":"a","17":"a","18":"a","19":"a","20":"a","21":"a","22":"a","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"n","6.1":"n","7":"n","8":"n"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"p","11":"p","11.1":"a","11.5":"a","11.6":"a","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"n","8":"n"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"a","4.1":"a","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"n","10":"n"},"op_mob":{"10":"n","11":"a","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"n"},"ie_mob":{"10":"n"}},"notes":"Partial support in older Chrome, Opera and Android refers to browser not supporting lossless and alpha versions of WebP. Animated webp images are supported in Chrome 32+ and Opera 19+.","usage_perc_y":42.98,"usage_perc_a":3.87,"ucprefix":false,"parent":"","keywords":""},"intrinsic-width":{"title":"Intrinsic & Extrinsic Sizing","description":"Allows for the heights and widths to be specified in intrinsic values using the fill-available, max-content, min-content, and fit-content properties.","spec":"http://www.w3.org/TR/css3-sizing/","status":"wd","links":[{"url":"http://demosthenes.info/blog/662/Design-From-the-Inside-Out-With-CSS-MinContent","title":"Min-Content tutorial"}],"categories":["CSS3"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"y x","5":"y x","6":"y x","7":"y x","8":"y x","9":"y x","10":"y x","11":"y x","12":"y x","13":"y x","14":"y x","15":"y x","16":"y x","17":"y x","18":"y x","19":"y x","20":"y x","21":"y x","22":"y x","23":"y x","24":"y x","25":"y x","26":"y x","27":"y x","28":"y x","29":"y x","30":"y x","31":"y x","32":"y x","33":"y x"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"y x","23":"y x","24":"y x","25":"y x","26":"y x","27":"y x","28":"y x","29":"y x","30":"y x","31":"y x","32":"y x","33":"y x","34":"y x","35":"y x","36":"y x","37":"y x","38":"y x"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"n","6.1":"y x","7":"y x","8":"y x"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"y x","16":"y x","17":"y x","18":"y x","19":"y x","20":"y x","21":"y x","22":"y x","23":"y x","24":"y x"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"y x","8":"y x"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"y x","4.4.3":"y x"},"bb":{"7":"n","10":"y x"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"y x"},"and_chr":{"0":"y x"},"and_ff":{"0":"y x"},"ie_mob":{"10":"n"}},"notes":"Prefixes are on the values, not the property names (e.g. -webkit-min-content) Firefox currently supports the \"-moz-available\" property rather than \"-moz-fill-available\".","usage_perc_y":62.45,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":"fill-available,max-content,min-content,fit-content,contain-floats"},"template":{"title":"HTML templates","description":"Method of declaring a portion of reusable markup that is parsed but not rendered until cloned.","spec":"http://www.w3.org/TR/html-templates/","status":"wd","links":[{"url":"http://polymer-project.org","title":"Polymer project (polyfill & web components framework)"},{"url":"http://www.html5rocks.com/en/tutorials/webcomponents/template/","title":"HTML5Rocks - HTML's New template Tag"}],"categories":["HTML5","DOM"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"n","6.1":"n","7":"n","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"n","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"y","4.4.3":"y"},"bb":{"7":"n","10":"n"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"n"}},"notes":"","usage_perc_y":53.04,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":"web components, template"},"opus":{"title":"Opus","description":"Royalty-free open audio codec by IETF, which incorporated SILK from Skype and CELT from Xiph.org, to serve higher sound quality and lower latency at the same bitrate.","spec":"http://tools.ietf.org/html/rfc6716","status":"other","links":[{"url":"https://hacks.mozilla.org/2012/07/firefox-beta-15-supports-the-new-opus-audio-format/","title":"Introduction of Opus by Mozilla"},{"url":"http://www.ietf.org/mail-archive/web/rtcweb/current/msg04953.html","title":"Google's statement about the use of VP8 and Opus codec for WebRTC standard"}],"categories":["Other"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"n","32":"n","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"n","6.1":"n","7":"n","8":"n"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"n","8":"n"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"n","4.4.3":"n"},"bb":{"7":"n","10":"n"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"n"},"and_chr":{"0":"n"},"and_ff":{"0":"y"},"ie_mob":{"10":"n"}},"notes":"For Opera the Linux version may be able to play it when the GStreamer module is up to date and the served mime-type is 'audio/ogg'.","usage_perc_y":44.75,"usage_perc_a":0,"ucprefix":false,"parent":"audio","keywords":""},"jpegxr":{"title":"JPEG XR image format","description":"The latest JPEG image format of Joint Photographic Experts Group which boasts better compression and supports lossless compression, alpha channel, and 48-bit deep color over normal jpg format.","spec":"http://www.itu.int/rec/T-REC-T.832","status":"other","links":[{"url":"http://msdn.microsoft.com/en-us/library/windows/desktop/hh707223(v=vs.85).aspx","title":"Microsoft JPEG XR Codec Overview"}],"categories":["Other"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"y","10":"y","11":"y"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"n","32":"n","33":"n"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"n","32":"n","33":"n","34":"n","35":"n","36":"n","37":"n","38":"n"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"n","6.1":"n","7":"n","8":"n"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"n","8":"n"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"n","4.4.3":"n"},"bb":{"7":"n","10":"n"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"n"},"and_chr":{"0":"n"},"and_ff":{"0":"n"},"ie_mob":{"10":"y"}},"notes":"","usage_perc_y":12.82,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":""},"channel-messaging":{"title":"Channel messaging","description":"Method for having two-way communication between browsing contexts (using MessageChannel)","spec":"http://www.w3.org/TR/webmessaging/#channel-messaging","status":"cr","links":[{"url":"http://dev.opera.com/articles/view/window-postmessage-messagechannel/#channel","title":"An Introduction to HTML5 web messaging"}],"categories":["JS API"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"y","11":"y"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"n","32":"n","33":"n"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"u","10.0-10.1":"u","10.5":"u","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"u","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"n"},"ie_mob":{"10":"y"}},"notes":"","usage_perc_y":62.39,"usage_perc_a":0,"ucprefix":false,"parent":"x-doc-messaging","keywords":""},"css3-tabsize":{"title":"CSS3 tab-size","description":"Method of customizing the width of the tab character. Only effective using 'white-space: pre' or 'white-space: pre-wrap'.","spec":"http://www.w3.org/TR/css3-text/#tab-size1","status":"wd","links":[{"url":"https://developer.mozilla.org/en-US/docs/Web/CSS/tab-size","title":"MDN article"}],"categories":["CSS3"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"y x","5":"y x","6":"y x","7":"y x","8":"y x","9":"y x","10":"y x","11":"y x","12":"y x","13":"y x","14":"y x","15":"y x","16":"y x","17":"y x","18":"y x","19":"y x","20":"y x","21":"y x","22":"y x","23":"y x","24":"y x","25":"y x","26":"y x","27":"y x","28":"y x","29":"y x","30":"y x","31":"y x","32":"y x","33":"y x"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"n","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"y x","11":"y x","11.1":"y x","11.5":"y x","11.6":"y x","12":"y x","12.1":"y x","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"n","11":"y x","11.1":"y x","11.5":"y x","12":"y x","12.1":"y x","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y x"},"ie_mob":{"10":"n"}},"notes":"","usage_perc_y":63.43,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":"tab-size,tab-width"},"mutationobserver":{"title":"Mutation Observer","description":"Method for observing and reacting to changes to the DOM. Replaces MutationEvents, which is deprecated.","spec":"http://www.w3.org/TR/dom/","status":"wd","links":[{"url":"https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver","title":"MutationObserver from MDN"},{"url":"https://github.com/Polymer/MutationObservers","title":"Polyfill"}],"categories":["JS API","DOM"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"p","10":"p","11":"y"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"y x","19":"y x","20":"y x","21":"y x","22":"y x","23":"y x","24":"y x","25":"y x","26":"y x","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"y x","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"y x","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"p","4.1":"p","4.2-4.3":"p","4.4":"y","4.4.3":"y"},"bb":{"7":"n","10":"y x"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"p"}},"notes":"When the content of a node with a single CharacterData child node is changed by innerHTML attribute and the node have a single different one as a result, WebKit browsers consider it as a characterData mutation of the child CharacterData node, while other browsers think it as a childList mutation of the parent node.","usage_perc_y":70.7,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":"MutationObserver"},"css-selection":{"title":"::selection CSS pseudo-element","description":"The ::selection CSS pseudo-element applies rules to the portion of a document that has been highlighted (e.g., selected with the mouse or another pointing device) by the user.","spec":"https://developer.mozilla.org/en-US/docs/Web/CSS/::selection","status":"unoff","links":[{"url":"http://docs.webplatform.org/wiki/css/selectors/pseudo-elements/::selection","title":"WebPlatform Docs"},{"url":"http://quirksmode.org/css/selectors/selection.html","title":"::selection test"}],"categories":["CSS"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"y","10":"y","11":"y"},"firefox":{"2":"y x","3":"y x","3.5":"y x","3.6":"y x","4":"y x","5":"y x","6":"y x","7":"y x","8":"y x","9":"y x","10":"y x","11":"y x","12":"y x","13":"y x","14":"y x","15":"y x","16":"y x","17":"y x","18":"y x","19":"y x","20":"y x","21":"y x","22":"y x","23":"y x","24":"y x","25":"y x","26":"y x","27":"y x","28":"y x","29":"y x","30":"y x","31":"y x","32":"y x","33":"y x"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"y","3.2":"y","4":"y","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"y","10.0-10.1":"y","10.5":"y","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"n","8":"n"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"y","4.4.3":"y"},"bb":{"7":"n","10":"n"},"op_mob":{"10":"u","11":"u","11.1":"u","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"n"},"ie_mob":{"10":"y"}},"notes":"","usage_perc_y":72.46,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":"::selection,selection"},"css-placeholder":{"title":":placeholder-shown CSS pseudo-class","description":"The :placeholder-shown pseudo-class represents the placeholder contents of a form field with placeholder text.","spec":"http://dev.w3.org/csswg/selectors/#placeholder","status":"unoff","links":[{"url":"http://msdn.microsoft.com/en-us/library/ie/hh772745(v=vs.85).aspx","title":"MSDN article"},{"url":"http://wiki.csswg.org/ideas/placeholder-styling","title":"CSSWG discussion"},{"url":"http://css-tricks.com/snippets/css/style-placeholder-text/","title":"CSS-Tricks article with all prefixes"}],"categories":["CSS"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"a x","11":"a x"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"a x","5":"a x","6":"a x","7":"a x","8":"a x","9":"a x","10":"a x","11":"a x","12":"a x","13":"a x","14":"a x","15":"a x","16":"a x","17":"a x","18":"a x","19":"a x","20":"a x","21":"a x","22":"a x","23":"a x","24":"a x","25":"a x","26":"a x","27":"a x","28":"a x","29":"a x","30":"a x","31":"a x","32":"a x","33":"a x"},"chrome":{"4":"a x","5":"a x","6":"a x","7":"a x","8":"a x","9":"a x","10":"a x","11":"a x","12":"a x","13":"a x","14":"a x","15":"a x","16":"a x","17":"a x","18":"a x","19":"a x","20":"a x","21":"a x","22":"a x","23":"a x","24":"a x","25":"a x","26":"a x","27":"a x","28":"a x","29":"a x","30":"a x","31":"a x","32":"a x","33":"a x","34":"a x","35":"a x","36":"a x","37":"a x","38":"a x"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"a x","5.1":"a x","6":"a x","6.1":"a x","7":"a x","8":"a x"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"a x","16":"a x","17":"a x","18":"a x","19":"a x","20":"a x","21":"a x","22":"a x","23":"a x","24":"a x"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"a x","5.0-5.1":"a x","6.0-6.1":"a x","7.0-7.1":"a x","8":"a x"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"a x","2.2":"a x","2.3":"a x","3":"a x","4":"a x","4.1":"a x","4.2-4.3":"a x","4.4":"a x","4.4.3":"a x"},"bb":{"7":"u","10":"a x"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"a x"},"and_chr":{"0":"a x"},"and_ff":{"0":"a x"},"ie_mob":{"10":"a x"}},"notes":"Partial support refers to support for alternative syntax: ::-webkit-input-placeholder (Chrome/Safari/Opera),\r\n::-moz-placeholder (Firefox) and \r\n:-ms-input-placeholder (IE). ","usage_perc_y":0,"usage_perc_a":81.79,"ucprefix":false,"parent":"","keywords":"::placeholder,placeholder"},"canvas-blending":{"title":"Canvas blend modes","description":"Method of defining the effect resulting from overlaying two layers on a Canvas element. ","spec":"http://www.w3.org/TR/compositing-1/#blending","status":"wd","links":[{"url":"http://blogs.adobe.com/webplatform/2013/01/28/blending-features-in-canvas/","title":"Blog post"}],"categories":["Canvas"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"n","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"n","16":"n","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"y","4.4.3":"y"},"bb":{"7":"n","10":"n"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"n"}},"notes":"","usage_perc_y":60.08,"usage_perc_a":0,"ucprefix":false,"parent":"canvas","keywords":""},"clipboard":{"title":"Clipboard API","description":"API to provide copy, cut and paste functionality using the OS clipboard.","spec":"http://www.w3.org/TR/clipboard-apis/","status":"wd","links":[{"url":"https://developer.mozilla.org/en-US/docs/Web/API/ClipboardEvent","title":"MDN page on ClipboardEvent"},{"url":"http://www.deluxeblogtips.com/2010/06/javascript-copy-to-clipboard.html","title":"Blog post on cross-browser usage"}],"categories":["JS API"],"stats":{"ie":{"5.5":"a #1","6":"a #1","7":"a #1","8":"a #1","9":"a #1","10":"a #1","11":"a #1"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"a","14":"a","15":"a","16":"a","17":"a","18":"a","19":"a","20":"a","21":"a","22":"a","23":"a","24":"a","25":"a","26":"a","27":"a","28":"a","29":"a","30":"a","31":"a","32":"a","33":"a","34":"a","35":"a","36":"a","37":"a","38":"a"},"safari":{"3.1":"u","3.2":"u","4":"a","5":"a","5.1":"a","6":"a","6.1":"a","7":"a","8":"a"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"n","16":"a","17":"a","18":"a","19":"a","20":"a","21":"a","22":"a","23":"a","24":"a"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"a","6.0-6.1":"a","7.0-7.1":"a","8":"a"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"a","4.4.3":"a"},"bb":{"7":"n","10":"a"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"a"},"and_chr":{"0":"a"},"and_ff":{"0":"y"},"ie_mob":{"10":"n"}},"notes":"Partial support in IE refers using <a href=\"http://msdn.microsoft.com/en-us/library/ie/ms535220%28v=vs.85%29.aspx\">a non-standard method</a> of interacting with the clipboard. For other browsers it refers to not supporting the ClipboardEvent constructor.","usage_perc_y":12.69,"usage_perc_a":68.69,"ucprefix":false,"parent":"","keywords":"cut,copy,paste,clipboarddata"},"rtcpeerconnection":{"title":"WebRTC Peer-to-peer connections","description":"Method of allowing two users to communicate directly, browser to browser using the RTCPeerConnection API.","spec":"http://www.w3.org/TR/webrtc/#peer-to-peer-connections","status":"wd","links":[{"url":"http://www.webrtc.org/","title":"WebRTC Project site"}],"categories":["JS API"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"y x","23":"y x","24":"y x","25":"y x","26":"y x","27":"y x","28":"y x","29":"y x","30":"y x","31":"y x","32":"y x","33":"y x"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"y x","24":"y x","25":"y x","26":"y x","27":"y x","28":"y x","29":"y x","30":"y x","31":"y x","32":"y x","33":"y x","34":"y x","35":"y x","36":"y x","37":"y x","38":"y x"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"n","6.1":"n","7":"n","8":"n"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"n","16":"n","17":"n","18":"y x","19":"y x","20":"y x","21":"y x","22":"y x","23":"y x","24":"y x"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"n","8":"n"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"n","4.4.3":"n"},"bb":{"7":"n","10":"n"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"y x"},"and_chr":{"0":"y x"},"and_ff":{"0":"y x"},"ie_mob":{"10":"n"}},"notes":"BlackBerry 10 recognizes RTCPeerConnection but real support is unconfirmed.","usage_perc_y":52.23,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":""},"css3-cursors":{"title":"CSS3 Cursors (original values)","description":"CSS3 cursor values added in the 2004 spec, including none, context-menu, cell, vertical-text, alias, copy, no-drop, not-allowed, nesw-resize, nwse-resize, col-resize, row-resize and all-scroll. ","spec":"http://www.w3.org/TR/css3-ui/#cursor","status":"wd","links":[{"url":"https://developer.mozilla.org/en-US/docs/Web/CSS/cursor","title":"MDN Documentation"}],"categories":["CSS3"],"stats":{"ie":{"5.5":"a","6":"a","7":"a","8":"a","9":"a","10":"a","11":"a"},"firefox":{"2":"a","3":"a","3.5":"a","3.6":"a","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"a","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"a","3.2":"a","4":"a","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"a","9.5-9.6":"a","10.0-10.1":"a","10.5":"a","10.6":"a","11":"a","11.1":"a","11.5":"a","11.6":"a","12":"a","12.1":"a","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"n","8":"n"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"n","4.4.3":"n"},"bb":{"7":"n","10":"u"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"n"},"and_chr":{"0":"n"},"and_ff":{"0":"n"},"ie_mob":{"10":"n"}},"notes":"Internet Explorer does not support the alias, cell, copy, ew-resize, ns-resize, nesw-resize, nwse-resize or context-menu cursors. Opera 12.10- does not support 'none' or a URI.","usage_perc_y":52.27,"usage_perc_a":18.12,"ucprefix":false,"parent":"","keywords":"cursors, pointers"},"webvtt":{"title":"WebVTT - Web Video Text Tracks","description":"Format for marking up text captions for multimedia resources.","spec":"http://dev.w3.org/html5/webvtt/","status":"unoff","links":[{"url":"http://dev.opera.com/articles/view/an-introduction-to-webvtt-and-track/","title":"An Introduction to WebVTT and track"},{"url":"http://www.html5rocks.com/en/tutorials/track/basics/","title":"Getting Started With the Track Element"}],"categories":["Other"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"y","11":"y"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"y","32":"y","33":"y"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"y","4.4.3":"y"},"bb":{"7":"n","10":"y"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"n"},"ie_mob":{"10":"n"}},"notes":"Partial support coming to Firefox 27, enabled behind the media.webvtt.enabled flag, with no support for the for ::cue pseudoelement. WebVTT must be used with the &lt;track> element.","usage_perc_y":59.39,"usage_perc_a":0,"ucprefix":false,"parent":"video","keywords":"captions,track"},"promises":{"title":"Promises","description":"A promise represents the eventual result of an asynchronous operation.","spec":"https://people.mozilla.org/~jorendorff/es6-draft.html#sec-promise-objects","status":"other","links":[{"url":"http://www.chromestatus.com/features/5681726336532480","title":"Chromium dashboard - ES6 Promises"},{"url":"http://promises-aplus.github.io/promises-spec/","title":"Promises/A+ spec"},{"url":"https://github.com/jakearchibald/ES6-Promises","title":"A polyfill for ES6-style Promises"},{"url":"http://www.html5rocks.com/en/tutorials/es6/promises/","title":"JavaScript Promises: There and back again - HTML5 Rocks"}],"categories":["DOM","JS API"],"stats":{"ie":{"5.5":"p","6":"p","7":"p","8":"p","9":"p","10":"p","11":"p"},"firefox":{"2":"p","3":"p","3.5":"p","3.6":"p","4":"p","5":"p","6":"p","7":"p","8":"p","9":"p","10":"p","11":"p","12":"p","13":"p","14":"p","15":"p","16":"p","17":"p","18":"p","19":"p","20":"p","21":"p","22":"p","23":"p","24":"p","25":"p","26":"p","27":"a","28":"a","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"p","5":"p","6":"p","7":"p","8":"p","9":"p","10":"p","11":"p","12":"p","13":"p","14":"p","15":"p","16":"p","17":"p","18":"p","19":"p","20":"p","21":"p","22":"p","23":"p","24":"p","25":"p","26":"p","27":"p","28":"p","29":"p","30":"p","31":"p","32":"a","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"p","3.2":"p","4":"p","5":"p","5.1":"p","6":"p","6.1":"p","7":"p","8":"y"},"opera":{"9":"p","9.5-9.6":"p","10.0-10.1":"p","10.5":"p","10.6":"p","11":"p","11.1":"p","11.5":"p","11.6":"p","12":"p","12.1":"p","15":"p","16":"p","17":"p","18":"p","19":"a","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"p","4.0-4.1":"p","4.2-4.3":"p","5.0-5.1":"p","6.0-6.1":"p","7.0-7.1":"p","8":"y"},"op_mini":{"5.0-7.0":"p"},"android":{"2.1":"p","2.2":"p","2.3":"p","3":"p","4":"p","4.1":"p","4.2-4.3":"p","4.4":"p","4.4.3":"p"},"bb":{"7":"p","10":"p"},"op_mob":{"10":"p","11":"p","11.1":"p","11.5":"p","12":"p","12.1":"p","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"p"}},"notes":"","usage_perc_y":48.46,"usage_perc_a":0.98,"ucprefix":false,"parent":"","keywords":"futures"},"css-sticky":{"title":"CSS position:sticky","description":"Keeps elements positioned as \"fixed\" or \"relative\" depending on how it appears in the viewport. As a result the element is \"stuck\" when necessary while scrolling.","spec":"http://dev.w3.org/csswg/css-position/#sticky-positioning","status":"unoff","links":[{"url":"http://updates.html5rocks.com/2012/08/Stick-your-landings-position-sticky-lands-in-WebKit","title":"HTML5Rocks"},{"url":"https://github.com/filamentgroup/fixed-sticky","title":"Polyfill"},{"url":"http://docs.webplatform.org/wiki/css/properties/position","title":"WebPlatform Docs"},{"url":"https://developer.mozilla.org/en-US/docs/Web/CSS/position","title":"MDN article"}],"categories":["CSS"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"y","32":"y","33":"y"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"n","32":"n","33":"n","34":"n","35":"n","36":"n","37":"n","38":"n"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"n","6.1":"y x","7":"y x","8":"y x"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"y x","7.0-7.1":"y x","8":"y x"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"n","4.4.3":"n"},"bb":{"7":"n","10":"n"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"n"},"and_chr":{"0":"n"},"and_ff":{"0":"n"},"ie_mob":{"10":"n"}},"notes":"Can be enabled in Firefox 26+ by setting the about:config preference layout.css.sticky.enabled to true and in Chrome 23 by enabling the #enable-experimental-web-platform-features flag.","usage_perc_y":8.85,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":""},"css-variables":{"title":"CSS Variables","description":"Permits the declaration and usage of cascading variables in stylesheets.","spec":"http://www.w3.org/TR/css-variables/","status":"wd","links":[{"url":"https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_variables","title":"MDN article"},{"url":"https://hacks.mozilla.org/2013/12/css-variables-in-firefox-nightly/","title":"Mozilla hacks article"}],"categories":["CSS3"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"y","32":"y","33":"y"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"n","32":"n","33":"n","34":"n","35":"n","36":"u","37":"u","38":"u"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"n","6.1":"n","7":"n","8":"n"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"n","8":"n"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"n","4.4.3":"n"},"bb":{"7":"n","10":"n"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"n"},"and_chr":{"0":"n"},"and_ff":{"0":"n"},"ie_mob":{"10":"n"}},"notes":"","usage_perc_y":0.21,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":"css variables"},"vibration":{"title":"Vibration API","description":"Method to access the vibration mechanism of the hosting device.","spec":"http://www.w3.org/TR/vibration/","status":"wd","links":[{"url":"https://developer.mozilla.org/en-US/docs/Web/Guide/API/Vibration","title":"MDN article"},{"url":"http://aurelio.audero.it/demo/vibration-api-demo.html","title":"Demo"},{"url":"http://davidwalsh.name/vibration-api","title":"Vibration API sample code & demo"},{"url":"http://code.tutsplus.com/tutorials/html5-vibration-api--mobile-22585","title":"Tuts+ article"}],"categories":["JS API"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"y x","12":"y x","13":"y x","14":"y x","15":"y x","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"n","6.1":"n","7":"n","8":"n"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"n","16":"n","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"n","8":"n"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"y","4.4.3":"y"},"bb":{"7":"n","10":"y"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"n"}},"notes":"In Chrome before version 32 and Opera before version 19 to use this API the activation of the flag \"Experimental Web Platform features\" is required.","usage_perc_y":52.81,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":"vibration,mobile,device"},"css-backgroundblendmode":{"title":"CSS background-blend-mode","description":"Allows blending between CSS background images, gradients, and colors.","spec":"http://www.w3.org/TR/compositing-1/#background-blend-mode","status":"cr","links":[{"url":"https://medium.com/web-design-technique/6b51bf53743a","title":"Blog post"},{"url":"http://codepen.io/bennettfeely/pen/rxoAc","title":"codepen example"},{"url":"http://bennettfeely.com/gradients","title":"Demo"}],"categories":["CSS"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"n","32":"n","33":"n","34":"n","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"n","6.1":"n","7":"n","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"n","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"n","4.4.3":"n"},"bb":{"7":"n","10":"n"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"n"}},"notes":"","usage_perc_y":39.57,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":"css blend modes,css blending modes,blending,multiply,screen,background"},"css-mixblendmode":{"title":"Blending of HTML and SVG element","description":"Allows blending between arbitrary SVG and HTML elements","spec":"http://www.w3.org/TR/compositing-1/#mix-blend-mode","status":"cr","links":[{"url":"http://css-tricks.com/basics-css-blend-modes/","title":"Blog post"},{"url":"http://codepen.io/bennettfeely/pen/csjzd","title":"codepen example"}],"categories":["CSS"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"n","32":"y","33":"y"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"n","32":"n","33":"n","34":"n","35":"n","36":"n","37":"n","38":"n"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"n","6.1":"n","7":"n","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"n","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"n","4.4.3":"n"},"bb":{"7":"n","10":"n"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"n"},"and_chr":{"0":"n"},"and_ff":{"0":"n"},"ie_mob":{"10":"n"}},"notes":"Also supported behind a flag in current versions of Chrome.","usage_perc_y":0.02,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":"css blend modes,css blending modes"},"web-speech":{"title":"Web Speech API","description":"Method to provide speech input and text-to-speech output features in a web browser.","spec":"https://dvcs.w3.org/hg/speech-api/raw-file/tip/speechapi.html","status":"unoff","links":[{"url":"http://updates.html5rocks.com/2013/01/Voice-Driven-Web-Apps-Introduction-to-the-Web-Speech-API","title":"HTML5Rocks article"},{"url":"http://zenorocha.github.io/voice-elements/","title":"Advanced demo and ressource"},{"url":"http://www.sitepoint.com/introducing-web-speech-api/","title":"SitePoint article"},{"url":"http://aurelio.audero.it/demo/web-speech-api-demo.html","title":"Demo"}],"categories":["JS API"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"n","32":"n","33":"n"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"a x","26":"a x","27":"a x","28":"a x","29":"a x","30":"a x","31":"a x","32":"a x","33":"a x","34":"a x","35":"a x","36":"a x","37":"a x","38":"a x"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"n","6.1":"a x","7":"a x","8":"a x"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"a x","8":"a x"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"n","4.4.3":"n"},"bb":{"7":"n","10":"n"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"n"},"and_chr":{"0":"a x"},"and_ff":{"0":"n"},"ie_mob":{"10":"n"}},"notes":"Partial support in Chrome refers to some attributes missing. Partial support in Safari refers to only Speech Synthesis supported.","usage_perc_y":0,"usage_perc_a":46.77,"ucprefix":false,"parent":"","keywords":"speech,recognition,ASR"},"high-resolution-time":{"title":"High Resolution Time API","description":"Method to provide the current time in sub-millisecond resolution and such that it is not subject to system clock skew or adjustments. Called using performance.now()","spec":"http://www.w3.org/TR/hr-time/","status":"rec","links":[{"url":"http://aurelio.audero.it/demo/high-resolution-time-api-demo.html","title":"Demo"},{"url":"http://updates.html5rocks.com/2012/08/When-milliseconds-are-not-enough-performance-now","title":"HTML5Rocks article"},{"url":"https://developer.mozilla.org/en-US/docs/Web/API/Performance.now()","title":"MDN article"},{"url":"http://www.sitepoint.com/discovering-the-high-resolution-time-api/","title":"SitePoint article"}],"categories":["JS API"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"y","11":"y"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"y x","21":"y x","22":"y x","23":"y x","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"n","6.1":"n","7":"n","8":"n"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"n","8":"n"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"y","4.4.3":"y"},"bb":{"7":"n","10":"y"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"","usage_perc_y":64.65,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":"performance,now,testing"},"battery-status":{"title":"Battery Status API","description":"Method to provide information about the battery status of the hosting device.","spec":"http://www.w3.org/TR/battery-status/","status":"cr","links":[{"url":"https://developer.mozilla.org/en-US/docs/WebAPI/Battery_Status","title":"MDN Docs"},{"url":"http://www.smartjava.org/examples/webapi-battery/","title":"Simple demo"}],"categories":["JS API"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"y x","11":"y x","12":"y x","13":"y x","14":"y x","15":"y x","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"n","32":"n","33":"n","34":"n","35":"n","36":"n","37":"n","38":"n"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"n","6.1":"n","7":"n","8":"n"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"n","8":"n"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"n","4.4.3":"n"},"bb":{"7":"n","10":"n"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"n"},"and_chr":{"0":"n"},"and_ff":{"0":"y"},"ie_mob":{"10":"n"}},"notes":"Support has already landed in Webkit but it is yet to make into Android and Chrome <a href=\"https://code.google.com/p/chromium/issues/detail?id=135863\">android issue</a>  <a href=\"https://code.google.com/p/chromium/issues/detail?id=122593\">chrome issue</a>","usage_perc_y":13.72,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":""},"text-decoration":{"title":"text-decoration styling","description":"Method of defining the type, style and color of lines in the text-decoration property.","spec":"http://www.w3.org/TR/css-text-decor-3/#line-decoration","status":"cr","links":[{"url":"https://developer.mozilla.org/en-US/docs/Web/CSS/text-decoration-color","title":"MDN Documentation for text-decoration-color"},{"url":"https://developer.mozilla.org/en-US/docs/Web/CSS/text-decoration-style","title":"MDN Documentation for text-decoration-style"},{"url":"https://developer.mozilla.org/en-US/docs/Web/CSS/text-decoration-line","title":"MDN Documentation for text-decoration-line"}],"categories":["CSS3"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"y x","7":"y x","8":"y x","9":"y x","10":"y x","11":"y x","12":"y x","13":"y x","14":"y x","15":"y x","16":"y x","17":"y x","18":"y x","19":"y x","20":"y x","21":"y x","22":"y x","23":"y x","24":"y x","25":"y x","26":"y x","27":"y x","28":"y x","29":"y x","30":"y x","31":"y x","32":"y x","33":"y x"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"n","32":"n","33":"n","34":"n","35":"n","36":"n","37":"n","38":"n"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"n","6.1":"n","7":"n","8":"n"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"n","8":"n"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"n","4.4.3":"n"},"bb":{"7":"n","10":"n"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"n"},"and_chr":{"0":"n"},"and_ff":{"0":"y x"},"ie_mob":{"10":"n"}},"notes":"Support for the -webkit-text-decoration-style property can be enabled for Chrome and Opera with the \"Experimental Web Platform features\" flag.  ","usage_perc_y":13.86,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":"text-decoration-line,text-decoration-style,text-decoration-color"},"speech-synthesis":{"title":"Speech Synthesis API","description":"A web API for controlling a text-to-speech output.","spec":"https://dvcs.w3.org/hg/speech-api/raw-file/tip/speechapi.html#tts-section","status":"unoff","links":[{"url":"http://www.sitepoint.com/talking-web-pages-and-the-speech-synthesis-api/","title":"SitePoint article"},{"url":"http://updates.html5rocks.com/2014/01/Web-apps-that-talk---Introduction-to-the-Speech-Synthesis-API","title":"HTML5Rocks article"},{"url":"http://aurelio.audero.it/demo/speech-synthesis-api-demo.html","title":"Demo"}],"categories":["JS API"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"n","32":"n","33":"n"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"n","32":"n","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"n","6.1":"n","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"n","4.4.3":"n"},"bb":{"7":"n","10":"n"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"n"},"and_chr":{"0":"y"},"and_ff":{"0":"n"},"ie_mob":{"10":"n"}},"notes":"","usage_perc_y":43.69,"usage_perc_a":0,"ucprefix":false,"parent":"web-speech","keywords":"speech,synthesis,speechSynthesis,TTS,SpeechSynthesisUtterance,"},"user-timing":{"title":"User Timing API","description":"Method to help web developers measure the performance of their applications by giving them access to high precision timestamps.","spec":"http://www.w3.org/TR/user-timing/","status":"rec","links":[{"url":"http://www.sitepoint.com/discovering-user-timing-api/","title":"SitePoint article"},{"url":"https://gist.github.com/pmeenan/5902672","title":"Polyfill"},{"url":"http://www.html5rocks.com/en/tutorials/webperformance/usertiming/","title":"HTML5Rocks article"},{"url":"http://aurelio.audero.it/demo/user-timing-api-demo.html","title":"Demo"}],"categories":["JS API"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"y","11":"y"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"n","32":"n","33":"n"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"n","6.1":"n","7":"n","8":"n"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"n","8":"n"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"y","4.4.3":"y"},"bb":{"7":"n","10":"n"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"n"},"ie_mob":{"10":"y"}},"notes":"","usage_perc_y":50.63,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":"performance,testing,mark,measure"},"srcset":{"title":"Srcset attribute","description":"Allows authors to specify alternate high-resolution sources on `img` elements","spec":"http://picture.responsiveimages.org/#relationship-to-srcset","status":"other","links":[{"url":"https://www.webkit.org/blog/2910/improved-support-for-high-resolution-displays-with-the-srcset-image-attribute/","title":"Improved support for high-resolution displays with the srcset image attribute"}],"categories":["HTML5"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"n","32":"y","33":"y"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"n","32":"n","33":"n","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"n","6.1":"n","7":"n","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"n","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"n","4.4.3":"n"},"bb":{"7":"n","10":"n"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"n"},"ie_mob":{"10":"n"}},"notes":"This covers the stand-alone `srcset` syntax for resolution switching, not the expanded syntax to be used in concert with `sizes`.","usage_perc_y":36.02,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":""},"ambient-light":{"title":"Ambient Light API","description":"Defines events that provide information about the ambient light level, as measured by a device's light sensor.","spec":"http://www.w3.org/TR/ambient-light/","status":"cr","links":[{"url":"http://flippinawesome.org/2014/05/27/introduction-to-the-ambient-light-api/","title":"Article"},{"url":"http://aurelio.audero.it/demo/ambient-light-api-demo.html","title":"Demo"}],"categories":["JS API"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"a","23":"a","24":"a","25":"a","26":"a","27":"a","28":"a","29":"a","30":"a","31":"a","32":"a","33":"a"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"n","32":"n","33":"n","34":"n","35":"n","36":"n","37":"n","38":"n"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"n","6.1":"n","7":"n","8":"n"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"n","8":"n"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"n","4.4.3":"n"},"bb":{"7":"n","10":"n"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"n"},"and_chr":{"0":"n"},"and_ff":{"0":"a"},"ie_mob":{"10":"n"}},"notes":"Partial support in Firefox refers to the fact that only the <code>devicelight</code> event is supported. In addition, Firefox desktop supports this API only on Mac OS X. <a href=\"https://bugzilla.mozilla.org/show_bug.cgi?id=754199\">Support for Windows 7 is in progress</a>","usage_perc_y":0,"usage_perc_a":12.69,"ucprefix":false,"parent":"","keywords":""},"css-shapes":{"title":"CSS Shapes Level 1","description":"Allows geometric shapes to be set in CSS to define an area for text to flow around.","spec":"http://www.w3.org/TR/css-shapes/","status":"cr","links":[{"url":"http://alistapart.com/article/css-shapes-101","title":"A List Apart article"},{"url":"http://html.adobe.com/webplatform/layout/shapes/browser-support/","title":"CSS shapes support test by Adobe"},{"url":"http://html.adobe.com/webplatform/layout/shapes/","title":"Adobe demos and samples"}],"categories":["CSS3"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"n","32":"n","33":"n"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"n","32":"n","33":"n","34":"n","35":"n","36":"n","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"n","6.1":"n","7":"n","8":"y x"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"n","8":"y x"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"n","4.4.3":"n"},"bb":{"7":"n","10":"n"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"n"},"and_chr":{"0":"n"},"and_ff":{"0":"n"},"ie_mob":{"10":"n"}},"notes":"Can also be enabled in Chrome 34+ by setting the chrome://flags preference \"Enable experimental Web Platform features\" to true.","usage_perc_y":0.15,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":"circle,ellipse,polygon,inset,shape-outside,shape-inside"},"domcontentloaded":{"title":"DOMContentLoaded","description":"JavaScript event, fired when the dom is loaded, but not yet stylesheets or images","spec":"http://www.whatwg.org/specs/web-apps/current-work/multipage/the-end.html","status":"other","links":[{"url":"https://developer.mozilla.org/en-US/docs/Web/Reference/Events/DOMContentLoaded","title":"MDN: DOMContentLoaded"}],"categories":["DOM"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"y","10":"y","11":"y"},"firefox":{"2":"y","3":"y","3.5":"y","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"y","3.2":"y","4":"y","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"y","9.5-9.6":"y","10.0-10.1":"y","10.5":"y","10.6":"y","11":"y","11.1":"y","11.5":"y","11.6":"y","12":"y","12.1":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"y","4.0-4.1":"y","4.2-4.3":"y","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"y"},"android":{"2.1":"y","2.2":"y","2.3":"y","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"y","10":"y"},"op_mob":{"10":"y","11":"y","11.1":"y","11.5":"y","12":"y","12.1":"y","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"y"}},"notes":"","usage_perc_y":88.57,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":"dom,domready,onload,contentloaded,document"},"proximity":{"title":"Proximity API","description":"Defines events that provide information about the distance between a device and an object, as measured by a proximity sensor.","spec":"http://www.w3.org/TR/proximity/","status":"cr","links":[{"url":"http://www.sitepoint.com/introducing-proximity-api/","title":"SitePoint article"},{"url":"http://aurelio.audero.it/demo/proximity-api-demo.html","title":"Demo"}],"categories":["JS API"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"n","32":"n","33":"n","34":"n","35":"n","36":"n","37":"n","38":"n"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"n","6.1":"n","7":"n","8":"n"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"n","8":"n"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"n","4.4.3":"n"},"bb":{"7":"n","10":"n"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"n"},"and_chr":{"0":"n"},"and_ff":{"0":"y"},"ie_mob":{"10":"n"}},"notes":"","usage_perc_y":13.37,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":""},"kerning-pairs-ligatures":{"title":"Improved kerning pairs & ligatures","description":"Currently non-standard method of improving kerning pairs & ligatures using text-rendering: optimizeLegibility.","spec":"http://www.w3.org/TR/SVG11/painting.html#TextRenderingProperty","status":"unoff","links":[{"url":"https://developer.mozilla.org/en-US/docs/Web/CSS/text-rendering","title":"MDN article"},{"url":"http://css-tricks.com/almanac/properties/t/text-rendering/","title":"CSS Tricks article"}],"categories":["CSS"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n"},"firefox":{"2":"n","3":"y","3.5":"y","3.6":"y","4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"y","5":"y","6":"y","7":"y","8":"y","9":"y","10":"y","11":"y","12":"y","13":"y","14":"y","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y","25":"y","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y","34":"y","35":"y","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"y","5.1":"y","6":"y","6.1":"y","7":"y","8":"y"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"y","16":"y","17":"y","18":"y","19":"y","20":"y","21":"y","22":"y","23":"y","24":"y"},"ios_saf":{"3.2":"u","4.0-4.1":"u","4.2-4.3":"y","5.0-5.1":"y","6.0-6.1":"y","7.0-7.1":"y","8":"y"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"y","4":"y","4.1":"y","4.2-4.3":"y","4.4":"y","4.4.3":"y"},"bb":{"7":"n","10":"y"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"y"},"and_chr":{"0":"y"},"and_ff":{"0":"y"},"ie_mob":{"10":"n"}},"notes":"","usage_perc_y":70.7,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":"optimizeLegibility,optimizeSpeed,geometricPrecision"},"css-image-orientation":{"title":"CSS3 image-orientation","description":"CSS property used generally to fix the intended orientation of an image. This can be done using 90 degree increments or based on the image's EXIF data using the \"from-image\" value.","spec":"http://www.w3.org/TR/css3-images/#image-orientation","status":"cr","links":[{"url":"http://sethfowler.org/blog/2013/09/13/new-in-firefox-26-css-image-orientation/","title":"Blog post"},{"url":"http://jsbin.com/EXUTolo/4","title":"Demo (Chinese)"},{"url":"https://developer.mozilla.org/en-US/docs/Web/CSS/image-orientation","title":"MDN article"}],"categories":["CSS3"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"y","27":"y","28":"y","29":"y","30":"y","31":"y","32":"y","33":"y"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"n","32":"n","33":"n","34":"n","35":"n","36":"n","37":"n","38":"n"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"n","6.1":"n","7":"n","8":"n"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n"},"ios_saf":{"3.2":"a","4.0-4.1":"a","4.2-4.3":"a","5.0-5.1":"a","6.0-6.1":"a","7.0-7.1":"a","8":"a"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"n","4.4.3":"n"},"bb":{"7":"n","10":"n"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"n"},"and_chr":{"0":"n"},"and_ff":{"0":"y"},"ie_mob":{"10":"n"}},"notes":"Partial support in iOS refers to the browser using EXIF data by default, though it does not actually support the property. Opening the image in a new tab in Chrome results in the image shown in the orientation according to the EXIF data.","usage_perc_y":12.22,"usage_perc_a":6.66,"ucprefix":false,"parent":"","keywords":"image-orientation,from-image,flip"},"picture":{"title":"Picture element","description":"A responsive images method to control which image resource a user agent presents to a user, based on resolution, media query and/or support for a particular image format","spec":"http://www.w3.org/TR/html-picture-element/","status":"wd","links":[{"url":"http://usecases.responsiveimages.org/","title":"Read about the use cases"},{"url":"http://code.tutsplus.com/tutorials/better-responsive-images-with-the-picture-element--net-36583","title":"Tutorial"},{"url":"http://responsiveimages.org/demos/","title":"Demo"},{"url":"http://responsiveimages.org/","title":"General information about Responsive Images"},{"url":"http://www.w3.org/TR/html-picture-element/","title":"Latest RICG &lt;picture> specification"}],"categories":["DOM","HTML5"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"n","32":"n","33":"y"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"n","32":"n","33":"n","34":"n","35":"n","36":"n","37":"n","38":"u"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"n","6.1":"n","7":"n","8":"n"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"u"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"n","8":"n"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"n","4.4.3":"n"},"bb":{"7":"n","10":"n"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"n"},"and_chr":{"0":"n"},"and_ff":{"0":"n"},"ie_mob":{"10":"n"}},"notes":"Supported in Chrome 37+ under the \"Experimental Web Platform features\" flag. Expected to appear in an early Firefox build soon.","usage_perc_y":0.01,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":""},"text-size-adjust":{"title":"CSS text-size-adjust","description":"On mobile devices, the text-size-adjust CSS property allows Web authors to control if and how the text-inflating algorithm is applied to the textual content of the element it is applied to.","spec":"http://dev.w3.org/csswg/css-size-adjust/","status":"wd","links":[{"url":"https://developer.mozilla.org/en-US/docs/Web/CSS/text-size-adjust","title":"MDN Docs"}],"categories":["CSS3"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"n","32":"n","33":"n"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"n","32":"n","33":"n","34":"n","35":"n","36":"n","37":"n","38":"n"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"n","6.1":"n","7":"n","8":"n"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"y x","6.0-6.1":"y x","7.0-7.1":"y x","8":"y x"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"n","4.4.3":"n"},"bb":{"7":"n","10":"n"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"n"},"and_chr":{"0":"n"},"and_ff":{"0":"y x"},"ie_mob":{"10":"y x"}},"notes":"","usage_perc_y":7.14,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":""},"web-animation":{"title":"Web Animations API","description":"This function lets you create an animation purely in JavaScript and have it run as efficiently as any CSS Animation or Transition.","spec":"http://dev.w3.org/fxtf/web-animations/","status":"wd","links":[{"url":"http://updates.html5rocks.com/2014/05/Web-Animations---element-animate-is-now-in-Chrome-36","title":"HTML5 Rocks"},{"url":"http://updates.html5rocks.com/2013/12/New-Web-Animations-engine-in-Blink-drives-CSS-Animations-Transitions","title":"HTML5 Rocks"}],"categories":["JS API","DOM"],"stats":{"ie":{"5.5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n"},"firefox":{"2":"n","3":"n","3.5":"n","3.6":"n","4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"n","32":"n","33":"n"},"chrome":{"4":"n","5":"n","6":"n","7":"n","8":"n","9":"n","10":"n","11":"n","12":"n","13":"n","14":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n","25":"n","26":"n","27":"n","28":"n","29":"n","30":"n","31":"n","32":"n","33":"n","34":"n","35":"n","36":"y","37":"y","38":"y"},"safari":{"3.1":"n","3.2":"n","4":"n","5":"n","5.1":"n","6":"n","6.1":"n","7":"n","8":"n"},"opera":{"9":"n","9.5-9.6":"n","10.0-10.1":"n","10.5":"n","10.6":"n","11":"n","11.1":"n","11.5":"n","11.6":"n","12":"n","12.1":"n","15":"n","16":"n","17":"n","18":"n","19":"n","20":"n","21":"n","22":"n","23":"n","24":"n"},"ios_saf":{"3.2":"n","4.0-4.1":"n","4.2-4.3":"n","5.0-5.1":"n","6.0-6.1":"n","7.0-7.1":"n","8":"n"},"op_mini":{"5.0-7.0":"n"},"android":{"2.1":"n","2.2":"n","2.3":"n","3":"n","4":"n","4.1":"n","4.2-4.3":"n","4.4":"n","4.4.3":"n"},"bb":{"7":"n","10":"n"},"op_mob":{"10":"n","11":"n","11.1":"n","11.5":"n","12":"n","12.1":"n","0":"n"},"and_chr":{"0":"n"},"and_ff":{"0":"n"},"ie_mob":{"10":"n"}},"notes":"","usage_perc_y":0.26,"usage_perc_a":0,"ucprefix":false,"parent":"","keywords":"js,animation,animate"}}}
},{}],55:[function(require,module,exports){
module.exports={
  "title":"CSS3 Background-image options",
  "description":"New properties to affect background images, including background-clip, background-origin and background-size",
  "spec":"http://www.w3.org/TR/css3-background/#backgrounds",
  "status":"cr",
  "links":[
    {
      "url":"https://github.com/louisremi/background-size-polyfill",
      "title":"Polyfill for IE7-8"
    },
    {
      "url":"http://www.css3files.com/background/",
      "title":"Information page"
    },
    {
      "url":"http://www.standardista.com/css3/css3-background-properties",
      "title":"Detailed compatibility tables and demos"
    }
  ],
  "bugs":[
    {
      "description":"Android 2.1-2.3 doesn't appear to honor background-size, only -webkit-background-size, which requires both width and height to be specified."
    },
    {
      "description":"iOS Safari has buggy behavior with background-size: cover; on a page's body."
    },
    {
      "description":"The CSS3 shorthand background property isn't supported in iOS Safari 6, the CSS2 shorthand however is."
    }
  ],
  "categories":[
    "CSS3"
  ],
  "stats":{
    "ie":{
      "5.5":"n",
      "6":"n",
      "7":"n",
      "8":"n",
      "9":"y",
      "10":"y",
      "11":"y"
    },
    "firefox":{
      "2":"n",
      "3":"n",
      "3.5":"n",
      "3.6":"a x",
      "4":"y",
      "5":"y",
      "6":"y",
      "7":"y",
      "8":"y",
      "9":"y",
      "10":"y",
      "11":"y",
      "12":"y",
      "13":"y",
      "14":"y",
      "15":"y",
      "16":"y",
      "17":"y",
      "18":"y",
      "19":"y",
      "20":"y",
      "21":"y",
      "22":"y",
      "23":"y",
      "24":"y",
      "25":"y",
      "26":"y",
      "27":"y",
      "28":"y",
      "29":"y",
      "30":"y",
      "31":"y",
      "32":"y",
      "33":"y"
    },
    "chrome":{
      "4":"y",
      "5":"y",
      "6":"y",
      "7":"y",
      "8":"y",
      "9":"y",
      "10":"y",
      "11":"y",
      "12":"y",
      "13":"y",
      "14":"y",
      "15":"y",
      "16":"y",
      "17":"y",
      "18":"y",
      "19":"y",
      "20":"y",
      "21":"y",
      "22":"y",
      "23":"y",
      "24":"y",
      "25":"y",
      "26":"y",
      "27":"y",
      "28":"y",
      "29":"y",
      "30":"y",
      "31":"y",
      "32":"y",
      "33":"y",
      "34":"y",
      "35":"y",
      "36":"y",
      "37":"y",
      "38":"y"
    },
    "safari":{
      "3.1":"a",
      "3.2":"a",
      "4":"a",
      "5":"y",
      "5.1":"y",
      "6":"a",
      "6.1":"a",
      "7":"a",
      "8":"a"
    },
    "opera":{
      "9":"n",
      "9.5-9.6":"n",
      "10.0-10.1":"a x",
      "10.5":"y",
      "10.6":"y",
      "11":"y",
      "11.1":"y",
      "11.5":"y",
      "11.6":"y",
      "12":"y",
      "12.1":"y",
      "15":"y",
      "16":"y",
      "17":"y",
      "18":"y",
      "19":"y",
      "20":"y",
      "21":"y",
      "22":"y",
      "23":"y",
      "24":"y"
    },
    "ios_saf":{
      "3.2":"a",
      "4.0-4.1":"y",
      "4.2-4.3":"y",
      "5.0-5.1":"y",
      "6.0-6.1":"y",
      "7.0-7.1":"y",
      "8":"y"
    },
    "op_mini":{
      "5.0-7.0":"a"
    },
    "android":{
      "2.1":"a x",
      "2.2":"y x",
      "2.3":"y x",
      "3":"y",
      "4":"y",
      "4.1":"y",
      "4.2-4.3":"y",
      "4.4":"y",
      "4.4.3":"y"
    },
    "bb":{
      "7":"y",
      "10":"y"
    },
    "op_mob":{
      "10":"y",
      "11":"y",
      "11.1":"y",
      "11.5":"y",
      "12":"y",
      "12.1":"y",
      "0":"y"
    },
    "and_chr":{
      "0":"y"
    },
    "and_ff":{
      "0":"y"
    },
    "ie_mob":{
      "10":"y"
    }
  },
  "notes":"Partial support in Opera Mini refers to not supporting background sizing or background attachments. However Opera Mini 7.5 supports background sizing (including cover and contain values). Partial support in Safari 6 refers to not supporting background sizing offset from edges syntax.",
  "usage_perc_y":82.43,
  "usage_perc_a":6.03,
  "ucprefix":false,
  "parent":"",
  "keywords":"",
  "shown":true
}
},{}],56:[function(require,module,exports){
module.exports={
  "title":"CSS3 Border images",
  "description":"Method of using images for borders",
  "spec":"http://www.w3.org/TR/css3-background/#the-border-image",
  "status":"cr",
  "links":[
    {
      "url":"http://docs.webplatform.org/wiki/css/properties/border-image",
      "title":"WebPlatform Docs"
    },
    {
      "url":"http://www.css3files.com/border/",
      "title":"Information page"
    }
  ],
  "bugs":[
    
  ],
  "categories":[
    "CSS3"
  ],
  "stats":{
    "ie":{
      "5.5":"n",
      "6":"n",
      "7":"n",
      "8":"n",
      "9":"n",
      "10":"n",
      "11":"y"
    },
    "firefox":{
      "2":"n",
      "3":"n",
      "3.5":"a x",
      "3.6":"a x",
      "4":"a x",
      "5":"a x",
      "6":"a x",
      "7":"a x",
      "8":"a x",
      "9":"a x",
      "10":"a x",
      "11":"a x",
      "12":"a x",
      "13":"a x",
      "14":"a x",
      "15":"y",
      "16":"y",
      "17":"y",
      "18":"y",
      "19":"y",
      "20":"y",
      "21":"y",
      "22":"y",
      "23":"y",
      "24":"y",
      "25":"y",
      "26":"y",
      "27":"y",
      "28":"y",
      "29":"y",
      "30":"y",
      "31":"y",
      "32":"y",
      "33":"y"
    },
    "chrome":{
      "4":"a x",
      "5":"a x",
      "6":"a x",
      "7":"a x",
      "8":"a x",
      "9":"a x",
      "10":"a x",
      "11":"a x",
      "12":"a x",
      "13":"a x",
      "14":"a x",
      "15":"y x",
      "16":"y",
      "17":"y",
      "18":"y",
      "19":"y",
      "20":"y",
      "21":"y",
      "22":"y",
      "23":"y",
      "24":"y",
      "25":"y",
      "26":"y",
      "27":"y",
      "28":"y",
      "29":"y",
      "30":"y",
      "31":"y",
      "32":"y",
      "33":"y",
      "34":"y",
      "35":"y",
      "36":"y",
      "37":"y",
      "38":"y"
    },
    "safari":{
      "3.1":"a x",
      "3.2":"a x",
      "4":"a x",
      "5":"a x",
      "5.1":"a x",
      "6":"y",
      "6.1":"y",
      "7":"y",
      "8":"y"
    },
    "opera":{
      "9":"n",
      "9.5-9.6":"n",
      "10.0-10.1":"n",
      "10.5":"a",
      "10.6":"a",
      "11":"a x",
      "11.1":"a x",
      "11.5":"a x",
      "11.6":"a x",
      "12":"a x",
      "12.1":"a x",
      "15":"y",
      "16":"y",
      "17":"y",
      "18":"y",
      "19":"y",
      "20":"y",
      "21":"y",
      "22":"y",
      "23":"y",
      "24":"y"
    },
    "ios_saf":{
      "3.2":"a x",
      "4.0-4.1":"a x",
      "4.2-4.3":"a x",
      "5.0-5.1":"a x",
      "6.0-6.1":"y",
      "7.0-7.1":"y",
      "8":"y"
    },
    "op_mini":{
      "5.0-7.0":"n"
    },
    "android":{
      "2.1":"a x",
      "2.2":"a x",
      "2.3":"a x",
      "3":"a x",
      "4":"a x",
      "4.1":"a x",
      "4.2-4.3":"a x",
      "4.4":"y",
      "4.4.3":"y"
    },
    "bb":{
      "7":"a x",
      "10":"y"
    },
    "op_mob":{
      "10":"n",
      "11":"a x",
      "11.1":"a x",
      "11.5":"a x",
      "12":"a x",
      "12.1":"a x",
      "0":"y"
    },
    "and_chr":{
      "0":"y"
    },
    "and_ff":{
      "0":"y"
    },
    "ie_mob":{
      "10":"n"
    }
  },
  "notes":"Note that both the border-style and border-width must be specified for border-images to work according to spec, though older implementations may not have this requirement. Partial support refers to supporting the shorthand syntax, but not the individual properties (border-image-source, border-image-slice, etc). ",
  "usage_perc_y":70.74,
  "usage_perc_a":8.89,
  "ucprefix":false,
  "parent":"",
  "keywords":"",
  "shown":true
}
},{}],57:[function(require,module,exports){
module.exports={
  "title":"CSS3 Border-radius (rounded corners)",
  "description":"Method of making the border corners round",
  "spec":"http://www.w3.org/TR/css3-background/#the-border-radius",
  "status":"cr",
  "links":[
    {
      "url":"http://muddledramblings.com/table-of-css3-border-radius-compliance",
      "title":"Detailed compliance table"
    },
    {
      "url":"http://border-radius.com",
      "title":"Border-radius CSS Generator"
    },
    {
      "url":"http://docs.webplatform.org/wiki/css/properties/border-radius",
      "title":"WebPlatform Docs"
    },
    {
      "url":"http://css3pie.com/",
      "title":"Polyfill which includes border-radius"
    },
    {
      "url":"http://www.css3files.com/border/#borderradius",
      "title":"Information page"
    }
  ],
  "bugs":[
    {
      "description":"Safari does not apply border-radius correctly to image borders: http://stackoverflow.com/q/17202128"
    },
    {
      "description":"Android Browser 2.3 does not support % value for border-radius."
    },
    {
      "description":"Border-radius does not work on fieldset elements in IE9."
    },
    {
      "description":"The stock browser on the Samsung Galaxy S4 with Android 4.2 does not support the \"border-radius\" shorthand property but does support the long-hand properties for each corner like \"border-top-left-radius\"."
    }
  ],
  "categories":[
    "CSS3"
  ],
  "stats":{
    "ie":{
      "5.5":"n",
      "6":"n",
      "7":"n",
      "8":"n",
      "9":"y",
      "10":"y",
      "11":"y"
    },
    "firefox":{
      "2":"a x",
      "3":"y x",
      "3.5":"y x",
      "3.6":"y x",
      "4":"y",
      "5":"y",
      "6":"y",
      "7":"y",
      "8":"y",
      "9":"y",
      "10":"y",
      "11":"y",
      "12":"y",
      "13":"y",
      "14":"y",
      "15":"y",
      "16":"y",
      "17":"y",
      "18":"y",
      "19":"y",
      "20":"y",
      "21":"y",
      "22":"y",
      "23":"y",
      "24":"y",
      "25":"y",
      "26":"y",
      "27":"y",
      "28":"y",
      "29":"y",
      "30":"y",
      "31":"y",
      "32":"y",
      "33":"y"
    },
    "chrome":{
      "4":"y x",
      "5":"y",
      "6":"y",
      "7":"y",
      "8":"y",
      "9":"y",
      "10":"y",
      "11":"y",
      "12":"y",
      "13":"y",
      "14":"y",
      "15":"y",
      "16":"y",
      "17":"y",
      "18":"y",
      "19":"y",
      "20":"y",
      "21":"y",
      "22":"y",
      "23":"y",
      "24":"y",
      "25":"y",
      "26":"y",
      "27":"y",
      "28":"y",
      "29":"y",
      "30":"y",
      "31":"y",
      "32":"y",
      "33":"y",
      "34":"y",
      "35":"y",
      "36":"y",
      "37":"y",
      "38":"y"
    },
    "safari":{
      "3.1":"y x",
      "3.2":"y x",
      "4":"y x",
      "5":"y",
      "5.1":"y",
      "6":"y",
      "6.1":"y",
      "7":"y",
      "8":"y"
    },
    "opera":{
      "9":"n",
      "9.5-9.6":"n",
      "10.0-10.1":"n",
      "10.5":"y",
      "10.6":"y",
      "11":"y",
      "11.1":"y",
      "11.5":"y",
      "11.6":"y",
      "12":"y",
      "12.1":"y",
      "15":"y",
      "16":"y",
      "17":"y",
      "18":"y",
      "19":"y",
      "20":"y",
      "21":"y",
      "22":"y",
      "23":"y",
      "24":"y"
    },
    "ios_saf":{
      "3.2":"y x",
      "4.0-4.1":"y",
      "4.2-4.3":"y",
      "5.0-5.1":"y",
      "6.0-6.1":"y",
      "7.0-7.1":"y",
      "8":"y"
    },
    "op_mini":{
      "5.0-7.0":"n"
    },
    "android":{
      "2.1":"y x",
      "2.2":"y",
      "2.3":"y",
      "3":"y",
      "4":"y",
      "4.1":"y",
      "4.2-4.3":"y",
      "4.4":"y",
      "4.4.3":"y"
    },
    "bb":{
      "7":"y",
      "10":"y"
    },
    "op_mob":{
      "10":"n",
      "11":"y",
      "11.1":"y",
      "11.5":"y",
      "12":"y",
      "12.1":"y",
      "0":"y"
    },
    "and_chr":{
      "0":"y"
    },
    "and_ff":{
      "0":"y"
    },
    "ie_mob":{
      "10":"y"
    }
  },
  "notes":"",
  "usage_perc_y":85.35,
  "usage_perc_a":0.01,
  "ucprefix":false,
  "parent":"",
  "keywords":"roundedcorners, border radius,-moz-border-radius",
  "shown":true
}
},{}],58:[function(require,module,exports){
module.exports={
  "title":"calc() as CSS unit value",
  "description":"Method of allowing calculated values for length units, i.e. width: calc(100% - 3em)",
  "spec":"http://www.w3.org/TR/css3-values/#calc",
  "status":"cr",
  "links":[
    {
      "url":"http://docs.webplatform.org/wiki/css/functions/calc",
      "title":"WebPlatform Docs"
    },
    {
      "url":"https://developer.mozilla.org/en/CSS/-moz-calc",
      "title":"MDN article"
    },
    {
      "url":"http://hacks.mozilla.org/2010/06/css3-calc/",
      "title":"Mozilla Hacks article"
    }
  ],
  "bugs":[
    {
      "description":"Webkit doesn't support viewport units in calc() expressions: https://bugs.webkit.org/show_bug.cgi?id=94158 and https://code.google.com/p/chromium/issues/detail?id=168840"
    }
  ],
  "categories":[
    "CSS3"
  ],
  "stats":{
    "ie":{
      "5.5":"n",
      "6":"n",
      "7":"n",
      "8":"n",
      "9":"a",
      "10":"y",
      "11":"y"
    },
    "firefox":{
      "2":"n",
      "3":"n",
      "3.5":"n",
      "3.6":"n",
      "4":"y x",
      "5":"y x",
      "6":"y x",
      "7":"y x",
      "8":"y x",
      "9":"y x",
      "10":"y x",
      "11":"y x",
      "12":"y x",
      "13":"y x",
      "14":"y x",
      "15":"y x",
      "16":"y",
      "17":"y",
      "18":"y",
      "19":"y",
      "20":"y",
      "21":"y",
      "22":"y",
      "23":"y",
      "24":"y",
      "25":"y",
      "26":"y",
      "27":"y",
      "28":"y",
      "29":"y",
      "30":"y",
      "31":"y",
      "32":"y",
      "33":"y"
    },
    "chrome":{
      "4":"n",
      "5":"n",
      "6":"n",
      "7":"n",
      "8":"n",
      "9":"n",
      "10":"n",
      "11":"n",
      "12":"n",
      "13":"n",
      "14":"n",
      "15":"n",
      "16":"n",
      "17":"n",
      "18":"n",
      "19":"y x",
      "20":"y x",
      "21":"y x",
      "22":"y x",
      "23":"y x",
      "24":"y x",
      "25":"y x",
      "26":"y",
      "27":"y",
      "28":"y",
      "29":"y",
      "30":"y",
      "31":"y",
      "32":"y",
      "33":"y",
      "34":"y",
      "35":"y",
      "36":"y",
      "37":"y",
      "38":"y"
    },
    "safari":{
      "3.1":"n",
      "3.2":"n",
      "4":"n",
      "5":"n",
      "5.1":"n",
      "6":"y x",
      "6.1":"y",
      "7":"y",
      "8":"y"
    },
    "opera":{
      "9":"n",
      "9.5-9.6":"n",
      "10.0-10.1":"n",
      "10.5":"n",
      "10.6":"n",
      "11":"n",
      "11.1":"n",
      "11.5":"n",
      "11.6":"n",
      "12":"n",
      "12.1":"n",
      "15":"y",
      "16":"y",
      "17":"y",
      "18":"y",
      "19":"y",
      "20":"y",
      "21":"y",
      "22":"y",
      "23":"y",
      "24":"y"
    },
    "ios_saf":{
      "3.2":"n",
      "4.0-4.1":"n",
      "4.2-4.3":"n",
      "5.0-5.1":"n",
      "6.0-6.1":"y x",
      "7.0-7.1":"y",
      "8":"y"
    },
    "op_mini":{
      "5.0-7.0":"n"
    },
    "android":{
      "2.1":"n",
      "2.2":"n",
      "2.3":"n",
      "3":"n",
      "4":"n",
      "4.1":"n",
      "4.2-4.3":"n",
      "4.4":"y",
      "4.4.3":"y"
    },
    "bb":{
      "7":"n",
      "10":"y x"
    },
    "op_mob":{
      "10":"n",
      "11":"n",
      "11.1":"n",
      "11.5":"n",
      "12":"n",
      "12.1":"n",
      "0":"y"
    },
    "and_chr":{
      "0":"y"
    },
    "and_ff":{
      "0":"y"
    },
    "ie_mob":{
      "10":"y"
    }
  },
  "notes":"Support can be somewhat emulated in older versions of IE using the non-standard expression() syntax. Partial support in IE9 refers to the browser crashing when used as a background-position value.",
  "usage_perc_y":74.17,
  "usage_perc_a":2.6,
  "ucprefix":false,
  "parent":"",
  "keywords":"",
  "shown":true
}
},{}],59:[function(require,module,exports){
module.exports={
  "title":"CSS3 Animation",
  "description":"Complex method of animating certain properties of an element",
  "spec":"http://www.w3.org/TR/css3-animations/",
  "status":"wd",
  "links":[
    {
      "url":"http://robertnyman.com/2010/05/06/css3-animations/",
      "title":"Blog post on usage"
    },
    {
      "url":"http://www.css3files.com/animation/",
      "title":"Information page"
    },
    {
      "url":"http://docs.webplatform.org/wiki/css/properties/animations",
      "title":"WebPlatform Docs"
    }
  ],
  "bugs":[
    {
      "description":"'animation-fill-mode' property is not supported in Android browser below 2.3."
    },
    {
      "description":"iOS 6.1 and below do not support animation on pseudo-elements."
    }
  ],
  "categories":[
    "CSS3"
  ],
  "stats":{
    "ie":{
      "5.5":"n",
      "6":"n",
      "7":"n",
      "8":"n",
      "9":"n",
      "10":"y",
      "11":"y"
    },
    "firefox":{
      "2":"n",
      "3":"n",
      "3.5":"n",
      "3.6":"n",
      "4":"n",
      "5":"y x",
      "6":"y x",
      "7":"y x",
      "8":"y x",
      "9":"y x",
      "10":"y x",
      "11":"y x",
      "12":"y x",
      "13":"y x",
      "14":"y x",
      "15":"y x",
      "16":"y",
      "17":"y",
      "18":"y",
      "19":"y",
      "20":"y",
      "21":"y",
      "22":"y",
      "23":"y",
      "24":"y",
      "25":"y",
      "26":"y",
      "27":"y",
      "28":"y",
      "29":"y",
      "30":"y",
      "31":"y",
      "32":"y",
      "33":"y"
    },
    "chrome":{
      "4":"y x",
      "5":"y x",
      "6":"y x",
      "7":"y x",
      "8":"y x",
      "9":"y x",
      "10":"y x",
      "11":"y x",
      "12":"y x",
      "13":"y x",
      "14":"y x",
      "15":"y x",
      "16":"y x",
      "17":"y x",
      "18":"y x",
      "19":"y x",
      "20":"y x",
      "21":"y x",
      "22":"y x",
      "23":"y x",
      "24":"y x",
      "25":"y x",
      "26":"y x",
      "27":"y x",
      "28":"y x",
      "29":"y x",
      "30":"y x",
      "31":"y x",
      "32":"y x",
      "33":"y x",
      "34":"y x",
      "35":"y x",
      "36":"y x",
      "37":"y x",
      "38":"y x"
    },
    "safari":{
      "3.1":"n",
      "3.2":"n",
      "4":"y x",
      "5":"y x",
      "5.1":"y x",
      "6":"y x",
      "6.1":"y x",
      "7":"y x",
      "8":"y x"
    },
    "opera":{
      "9":"n",
      "9.5-9.6":"n",
      "10.0-10.1":"n",
      "10.5":"n",
      "10.6":"n",
      "11":"n",
      "11.1":"n",
      "11.5":"n",
      "11.6":"n",
      "12":"y x",
      "12.1":"y",
      "15":"y x",
      "16":"y x",
      "17":"y x",
      "18":"y x",
      "19":"y x",
      "20":"y x",
      "21":"y x",
      "22":"y x",
      "23":"y x",
      "24":"y x"
    },
    "ios_saf":{
      "3.2":"y x",
      "4.0-4.1":"y x",
      "4.2-4.3":"y x",
      "5.0-5.1":"y x",
      "6.0-6.1":"y x",
      "7.0-7.1":"y x",
      "8":"y x"
    },
    "op_mini":{
      "5.0-7.0":"n"
    },
    "android":{
      "2.1":"a x",
      "2.2":"a x",
      "2.3":"a x",
      "3":"a x",
      "4":"y x",
      "4.1":"y x",
      "4.2-4.3":"y x",
      "4.4":"y x",
      "4.4.3":"y x"
    },
    "bb":{
      "7":"y x",
      "10":"y x"
    },
    "op_mob":{
      "10":"n",
      "11":"n",
      "11.1":"n",
      "11.5":"n",
      "12":"n",
      "12.1":"y",
      "0":"y x"
    },
    "and_chr":{
      "0":"y x"
    },
    "and_ff":{
      "0":"y"
    },
    "ie_mob":{
      "10":"y"
    }
  },
  "notes":"Partial support in Android browser refers to buggy behavior in different scenarios.",
  "usage_perc_y":81.27,
  "usage_perc_a":1.11,
  "ucprefix":false,
  "parent":"",
  "keywords":"animations,css-animations,keyframe,keyframes",
  "shown":true
}
},{}],60:[function(require,module,exports){
module.exports={
  "title":"CSS3 Box-shadow",
  "description":"Method of displaying an inner or outer shadow effect to elements",
  "spec":"http://www.w3.org/TR/css3-background/#box-shadow",
  "status":"cr",
  "links":[
    {
      "url":"http://docs.webplatform.org/wiki/css/properties/box-shadow",
      "title":"WebPlatform Docs"
    },
    {
      "url":"http://www.css3files.com/shadow/",
      "title":"Information page"
    },
    {
      "url":"http://westciv.com/tools/boxshadows/index.html",
      "title":"Live editor"
    },
    {
      "url":"http://tests.themasta.com/blogstuff/boxshadowdemo.html",
      "title":"Demo of various effects"
    },
    {
      "url":"https://developer.mozilla.org/En/CSS/-moz-box-shadow",
      "title":"MDN article"
    }
  ],
  "bugs":[
    {
      "description":"Safari 6, iOS 6 and Android 2.3 default browser don't work with a 0px value for \"spread\".\r\ne.g. -webkit-box-shadow: 5px 1px 0px #f04e29;\r\ndoesn't work, but\r\n-webkit-box-shadow: 5px 1px 1px #f04e29\r\ndoes."
    }
  ],
  "categories":[
    "CSS3"
  ],
  "stats":{
    "ie":{
      "5.5":"n",
      "6":"n",
      "7":"n",
      "8":"n",
      "9":"y",
      "10":"y",
      "11":"y"
    },
    "firefox":{
      "2":"n",
      "3":"n",
      "3.5":"y x",
      "3.6":"y x",
      "4":"y",
      "5":"y",
      "6":"y",
      "7":"y",
      "8":"y",
      "9":"y",
      "10":"y",
      "11":"y",
      "12":"y",
      "13":"y",
      "14":"y",
      "15":"y",
      "16":"y",
      "17":"y",
      "18":"y",
      "19":"y",
      "20":"y",
      "21":"y",
      "22":"y",
      "23":"y",
      "24":"y",
      "25":"y",
      "26":"y",
      "27":"y",
      "28":"y",
      "29":"y",
      "30":"y",
      "31":"y",
      "32":"y",
      "33":"y"
    },
    "chrome":{
      "4":"y x",
      "5":"y x",
      "6":"y x",
      "7":"y x",
      "8":"y x",
      "9":"y x",
      "10":"y",
      "11":"y",
      "12":"y",
      "13":"y",
      "14":"y",
      "15":"y",
      "16":"y",
      "17":"y",
      "18":"y",
      "19":"y",
      "20":"y",
      "21":"y",
      "22":"y",
      "23":"y",
      "24":"y",
      "25":"y",
      "26":"y",
      "27":"y",
      "28":"y",
      "29":"y",
      "30":"y",
      "31":"y",
      "32":"y",
      "33":"y",
      "34":"y",
      "35":"y",
      "36":"y",
      "37":"y",
      "38":"y"
    },
    "safari":{
      "3.1":"a x",
      "3.2":"a x",
      "4":"a x",
      "5":"y x",
      "5.1":"y",
      "6":"y",
      "6.1":"y",
      "7":"y",
      "8":"y"
    },
    "opera":{
      "9":"n",
      "9.5-9.6":"n",
      "10.0-10.1":"n",
      "10.5":"y",
      "10.6":"y",
      "11":"y",
      "11.1":"y",
      "11.5":"y",
      "11.6":"y",
      "12":"y",
      "12.1":"y",
      "15":"y",
      "16":"y",
      "17":"y",
      "18":"y",
      "19":"y",
      "20":"y",
      "21":"y",
      "22":"y",
      "23":"y",
      "24":"y"
    },
    "ios_saf":{
      "3.2":"a x",
      "4.0-4.1":"y x",
      "4.2-4.3":"y x",
      "5.0-5.1":"y",
      "6.0-6.1":"y",
      "7.0-7.1":"y",
      "8":"y"
    },
    "op_mini":{
      "5.0-7.0":"n"
    },
    "android":{
      "2.1":"a x",
      "2.2":"a x",
      "2.3":"a x",
      "3":"a x",
      "4":"y",
      "4.1":"y",
      "4.2-4.3":"y",
      "4.4":"y",
      "4.4.3":"y"
    },
    "bb":{
      "7":"y x",
      "10":"y"
    },
    "op_mob":{
      "10":"n",
      "11":"y",
      "11.1":"y",
      "11.5":"y",
      "12":"y",
      "12.1":"y",
      "0":"y"
    },
    "and_chr":{
      "0":"y"
    },
    "and_ff":{
      "0":"y"
    },
    "ie_mob":{
      "10":"y"
    }
  },
  "notes":"Can be partially emulated in older IE versions using the non-standard \"shadow\" filter. Partial support in Safari, iOS Safari and Android Browser refers to missing \"inset\" and blur radius value support.",
  "usage_perc_y":84.04,
  "usage_perc_a":1.23,
  "ucprefix":false,
  "parent":"",
  "keywords":"box-shadows,boxshadows,box shadow,shaow",
  "shown":true
}
},{}],61:[function(require,module,exports){
module.exports={
  "title":"CSS Filter Effects",
  "description":"Method of applying filter effects (like blur, grayscale, brightness, contrast and hue) to elements, previously only possible by using SVG.",
  "spec":"http://www.w3.org/TR/filter-effects/",
  "status":"wd",
  "links":[
    {
      "url":"http://dl.dropbox.com/u/3260327/angular/CSS3ImageManipulation.html",
      "title":"Filter editor"
    },
    {
      "url":"http://bennettfeely.com/filters/",
      "title":"Filter Playground"
    },
    {
      "url":"http://html5-demos.appspot.com/static/css/filters/index.html",
      "title":"Demo file for WebKit browsers"
    },
    {
      "url":"http://www.html5rocks.com/en/tutorials/filters/understanding-css/",
      "title":"HTML5Rocks article"
    }
  ],
  "bugs":[
    
  ],
  "categories":[
    "CSS",
    "CSS3"
  ],
  "stats":{
    "ie":{
      "5.5":"n",
      "6":"n",
      "7":"n",
      "8":"n",
      "9":"n",
      "10":"n",
      "11":"n"
    },
    "firefox":{
      "2":"n",
      "3":"n",
      "3.5":"n",
      "3.6":"n",
      "4":"n",
      "5":"n",
      "6":"n",
      "7":"n",
      "8":"n",
      "9":"n",
      "10":"n",
      "11":"n",
      "12":"n",
      "13":"n",
      "14":"n",
      "15":"n",
      "16":"n",
      "17":"n",
      "18":"n",
      "19":"n",
      "20":"n",
      "21":"n",
      "22":"n",
      "23":"n",
      "24":"n",
      "25":"n",
      "26":"n",
      "27":"n",
      "28":"n",
      "29":"n",
      "30":"n",
      "31":"u",
      "32":"u",
      "33":"u"
    },
    "chrome":{
      "4":"n",
      "5":"n",
      "6":"n",
      "7":"n",
      "8":"n",
      "9":"n",
      "10":"n",
      "11":"n",
      "12":"n",
      "13":"n",
      "14":"n",
      "15":"n",
      "16":"n",
      "17":"n",
      "18":"y x",
      "19":"y x",
      "20":"y x",
      "21":"y x",
      "22":"y x",
      "23":"y x",
      "24":"y x",
      "25":"y x",
      "26":"y x",
      "27":"y x",
      "28":"y x",
      "29":"y x",
      "30":"y x",
      "31":"y x",
      "32":"y x",
      "33":"y x",
      "34":"y x",
      "35":"y x",
      "36":"y x",
      "37":"y x",
      "38":"y x"
    },
    "safari":{
      "3.1":"n",
      "3.2":"n",
      "4":"n",
      "5":"n",
      "5.1":"n",
      "6":"y x",
      "6.1":"y x",
      "7":"y x",
      "8":"y x"
    },
    "opera":{
      "9":"n",
      "9.5-9.6":"n",
      "10.0-10.1":"n",
      "10.5":"n",
      "10.6":"n",
      "11":"n",
      "11.1":"n",
      "11.5":"n",
      "11.6":"n",
      "12":"n",
      "12.1":"n",
      "15":"y x",
      "16":"y x",
      "17":"y x",
      "18":"y x",
      "19":"y x",
      "20":"y x",
      "21":"y x",
      "22":"y x",
      "23":"y x",
      "24":"y x"
    },
    "ios_saf":{
      "3.2":"n",
      "4.0-4.1":"n",
      "4.2-4.3":"n",
      "5.0-5.1":"n",
      "6.0-6.1":"y x",
      "7.0-7.1":"y x",
      "8":"y x"
    },
    "op_mini":{
      "5.0-7.0":"n"
    },
    "android":{
      "2.1":"n",
      "2.2":"n",
      "2.3":"n",
      "3":"n",
      "4":"n",
      "4.1":"n",
      "4.2-4.3":"n",
      "4.4":"y x",
      "4.4.3":"y x"
    },
    "bb":{
      "7":"n",
      "10":"y x"
    },
    "op_mob":{
      "10":"n",
      "11":"n",
      "11.1":"n",
      "11.5":"n",
      "12":"n",
      "12.1":"n",
      "0":"y x"
    },
    "and_chr":{
      "0":"y x"
    },
    "and_ff":{
      "0":"n"
    },
    "ie_mob":{
      "10":"n"
    }
  },
  "notes":"Note that this property is significantly different from and incompatible with Microsoft's <a href=\"http://msdn.microsoft.com/en-us/library/ie/ms530752%28v=vs.85%29.aspx\">older \"filter\" property</a>.",
  "usage_perc_y":50.09,
  "usage_perc_a":0,
  "ucprefix":false,
  "parent":"",
  "keywords":"sepia,hue-rotate,invert,saturate",
  "shown":true
}
},{}],62:[function(require,module,exports){
module.exports={
  "title":"CSS Gradients",
  "description":"Method of defining a linear or radial color gradient as a CSS image.",
  "spec":"http://www.w3.org/TR/css3-images/",
  "status":"cr",
  "links":[
    {
      "url":"http://css3pie.com/",
      "title":"Tool to emulate support in IE"
    },
    {
      "url":"http://www.css3files.com/gradient/",
      "title":"Information page"
    },
    {
      "url":"http://www.colorzilla.com/gradient-editor/",
      "title":"Cross-browser editor"
    },
    {
      "url":"http://docs.webplatform.org/wiki/css/functions/linear-gradient",
      "title":"WebPlatform Docs"
    }
  ],
  "bugs":[
    
  ],
  "categories":[
    "CSS3"
  ],
  "stats":{
    "ie":{
      "5.5":"n",
      "6":"n",
      "7":"n",
      "8":"n",
      "9":"n",
      "10":"y",
      "11":"y"
    },
    "firefox":{
      "2":"n",
      "3":"n",
      "3.5":"n",
      "3.6":"y x",
      "4":"y x",
      "5":"y x",
      "6":"y x",
      "7":"y x",
      "8":"y x",
      "9":"y x",
      "10":"y x",
      "11":"y x",
      "12":"y x",
      "13":"y x",
      "14":"y x",
      "15":"y x",
      "16":"y",
      "17":"y",
      "18":"y",
      "19":"y",
      "20":"y",
      "21":"y",
      "22":"y",
      "23":"y",
      "24":"y",
      "25":"y",
      "26":"y",
      "27":"y",
      "28":"y",
      "29":"y",
      "30":"y",
      "31":"y",
      "32":"y",
      "33":"y"
    },
    "chrome":{
      "4":"a x",
      "5":"a x",
      "6":"a x",
      "7":"a x",
      "8":"a x",
      "9":"a x",
      "10":"y x",
      "11":"y x",
      "12":"y x",
      "13":"y x",
      "14":"y x",
      "15":"y x",
      "16":"y x",
      "17":"y x",
      "18":"y x",
      "19":"y x",
      "20":"y x",
      "21":"y x",
      "22":"y x",
      "23":"y x",
      "24":"y x",
      "25":"y x",
      "26":"y",
      "27":"y",
      "28":"y",
      "29":"y",
      "30":"y",
      "31":"y",
      "32":"y",
      "33":"y",
      "34":"y",
      "35":"y",
      "36":"y",
      "37":"y",
      "38":"y"
    },
    "safari":{
      "3.1":"n",
      "3.2":"n",
      "4":"a x",
      "5":"a x",
      "5.1":"y x",
      "6":"y x",
      "6.1":"y",
      "7":"y",
      "8":"y"
    },
    "opera":{
      "9":"n",
      "9.5-9.6":"n",
      "10.0-10.1":"n",
      "10.5":"n",
      "10.6":"n",
      "11":"n",
      "11.1":"a x",
      "11.5":"a x",
      "11.6":"y x",
      "12":"y x",
      "12.1":"y",
      "15":"y",
      "16":"y",
      "17":"y",
      "18":"y",
      "19":"y",
      "20":"y",
      "21":"y",
      "22":"y",
      "23":"y",
      "24":"y"
    },
    "ios_saf":{
      "3.2":"a x",
      "4.0-4.1":"a x",
      "4.2-4.3":"a x",
      "5.0-5.1":"y x",
      "6.0-6.1":"y x",
      "7.0-7.1":"y",
      "8":"y"
    },
    "op_mini":{
      "5.0-7.0":"n"
    },
    "android":{
      "2.1":"a x",
      "2.2":"a x",
      "2.3":"a x",
      "3":"a x",
      "4":"y x",
      "4.1":"y x",
      "4.2-4.3":"y x",
      "4.4":"y",
      "4.4.3":"y"
    },
    "bb":{
      "7":"a x",
      "10":"y x"
    },
    "op_mob":{
      "10":"n",
      "11":"n",
      "11.1":"a x",
      "11.5":"a x",
      "12":"y x",
      "12.1":"y",
      "0":"y"
    },
    "and_chr":{
      "0":"y"
    },
    "and_ff":{
      "0":"y"
    },
    "ie_mob":{
      "10":"y"
    }
  },
  "notes":"Partial support in Opera 11.10 and 11.50 also refers to only having support for linear gradients. Support can be somewhat emulated in older IE versions using the non-standard \"gradient\" filter. Firefox 10+, Opera 11.6+, Chrome 26+ and IE10 also support the new \"to (side)\" syntax.",
  "usage_perc_y":80.92,
  "usage_perc_a":1.69,
  "ucprefix":false,
  "parent":"",
  "keywords":"linear,linear-gradient,gradiant",
  "shown":true
}
},{}],63:[function(require,module,exports){
module.exports={
  "title":"CSS Hyphenation",
  "description":"Method of controlling when words at the end of lines should be hyphenated using the \"hyphens\" property.",
  "spec":"http://www.w3.org/TR/css3-text/#hyphenation",
  "status":"wd",
  "links":[
    {
      "url":"http://blog.fontdeck.com/post/9037028497/hyphens",
      "title":"Blog post"
    },
    {
      "url":"http://docs.webplatform.org/wiki/css/properties/hyphens",
      "title":"WebPlatform Docs"
    },
    {
      "url":"https://developer.mozilla.org/en/CSS/hyphens",
      "title":"MDN article"
    }
  ],
  "bugs":[
    
  ],
  "categories":[
    "CSS3"
  ],
  "stats":{
    "ie":{
      "5.5":"n",
      "6":"n",
      "7":"n",
      "8":"n",
      "9":"n",
      "10":"y x",
      "11":"y x"
    },
    "firefox":{
      "2":"n",
      "3":"n",
      "3.5":"n",
      "3.6":"n",
      "4":"n",
      "5":"n",
      "6":"y x",
      "7":"y x",
      "8":"y x",
      "9":"y x",
      "10":"y x",
      "11":"y x",
      "12":"y x",
      "13":"y x",
      "14":"y x",
      "15":"y x",
      "16":"y x",
      "17":"y x",
      "18":"y x",
      "19":"y x",
      "20":"y x",
      "21":"y x",
      "22":"y x",
      "23":"y x",
      "24":"y x",
      "25":"y x",
      "26":"y x",
      "27":"y x",
      "28":"y x",
      "29":"y x",
      "30":"y x",
      "31":"y x",
      "32":"y x",
      "33":"y x"
    },
    "chrome":{
      "4":"n",
      "5":"n",
      "6":"n",
      "7":"n",
      "8":"n",
      "9":"n",
      "10":"n",
      "11":"n",
      "12":"n",
      "13":"n",
      "14":"n",
      "15":"n",
      "16":"n",
      "17":"n",
      "18":"n",
      "19":"n",
      "20":"n",
      "21":"n",
      "22":"n",
      "23":"n",
      "24":"n",
      "25":"n",
      "26":"n",
      "27":"n",
      "28":"n",
      "29":"n",
      "30":"n",
      "31":"n",
      "32":"n",
      "33":"n",
      "34":"n",
      "35":"n",
      "36":"n",
      "37":"n",
      "38":"n"
    },
    "safari":{
      "3.1":"n",
      "3.2":"n",
      "4":"n",
      "5":"n",
      "5.1":"y x",
      "6":"y x",
      "6.1":"y x",
      "7":"y x",
      "8":"y x"
    },
    "opera":{
      "9":"n",
      "9.5-9.6":"n",
      "10.0-10.1":"n",
      "10.5":"n",
      "10.6":"n",
      "11":"n",
      "11.1":"n",
      "11.5":"n",
      "11.6":"n",
      "12":"n",
      "12.1":"n",
      "15":"n",
      "16":"n",
      "17":"n",
      "18":"n",
      "19":"n",
      "20":"n",
      "21":"n",
      "22":"n",
      "23":"n",
      "24":"n"
    },
    "ios_saf":{
      "3.2":"n",
      "4.0-4.1":"n",
      "4.2-4.3":"y x",
      "5.0-5.1":"y x",
      "6.0-6.1":"y x",
      "7.0-7.1":"y x",
      "8":"y x"
    },
    "op_mini":{
      "5.0-7.0":"n"
    },
    "android":{
      "2.1":"n",
      "2.2":"n",
      "2.3":"n",
      "3":"n",
      "4":"n",
      "4.1":"n",
      "4.2-4.3":"n",
      "4.4":"n",
      "4.4.3":"n"
    },
    "bb":{
      "7":"n",
      "10":"n"
    },
    "op_mob":{
      "10":"n",
      "11":"n",
      "11.1":"n",
      "11.5":"n",
      "12":"n",
      "12.1":"n",
      "0":"n"
    },
    "and_chr":{
      "0":"n"
    },
    "and_ff":{
      "0":"y x"
    },
    "ie_mob":{
      "10":"n"
    }
  },
  "notes":"Chrome 29- and Android 4.0 Browser support \"-webkit-hyphens: none\", but not the \"auto\" property. Chrome 30+ doesn't support it either.",
  "usage_perc_y":33.54,
  "usage_perc_a":0,
  "ucprefix":false,
  "parent":"",
  "keywords":"hyphen,shy",
  "shown":true
}
},{}],64:[function(require,module,exports){
module.exports={
  "title":"CSS Masks",
  "description":"Method of displaying part of an element, using a selected image as a mask",
  "spec":"http://www.w3.org/TR/css-masking/",
  "status":"wd",
  "links":[
    {
      "url":"http://www.html5rocks.com/en/tutorials/masking/adobe/",
      "title":"HTML5 Rocks article"
    },
    {
      "url":"http://docs.webplatform.org/wiki/css/properties/mask",
      "title":"WebPlatform Docs"
    },
    {
      "url":"http://thenittygritty.co/css-masking",
      "title":"Detailed blog post"
    }
  ],
  "bugs":[
    
  ],
  "categories":[
    "CSS"
  ],
  "stats":{
    "ie":{
      "5.5":"n",
      "6":"n",
      "7":"n",
      "8":"n",
      "9":"n",
      "10":"n",
      "11":"n"
    },
    "firefox":{
      "2":"n",
      "3":"n",
      "3.5":"a",
      "3.6":"a",
      "4":"a",
      "5":"a",
      "6":"a",
      "7":"a",
      "8":"a",
      "9":"a",
      "10":"a",
      "11":"a",
      "12":"a",
      "13":"a",
      "14":"a",
      "15":"a",
      "16":"a",
      "17":"a",
      "18":"a",
      "19":"a",
      "20":"a",
      "21":"a",
      "22":"a",
      "23":"a",
      "24":"a",
      "25":"a",
      "26":"a",
      "27":"a",
      "28":"a",
      "29":"a",
      "30":"a",
      "31":"a",
      "32":"a",
      "33":"a"
    },
    "chrome":{
      "4":"a x",
      "5":"a x",
      "6":"a x",
      "7":"a x",
      "8":"a x",
      "9":"a x",
      "10":"a x",
      "11":"a x",
      "12":"a x",
      "13":"a x",
      "14":"a x",
      "15":"a x",
      "16":"a x",
      "17":"a x",
      "18":"a x",
      "19":"a x",
      "20":"a x",
      "21":"a x",
      "22":"a x",
      "23":"a x",
      "24":"a x",
      "25":"a x",
      "26":"a x",
      "27":"a x",
      "28":"a x",
      "29":"a x",
      "30":"a x",
      "31":"a x",
      "32":"a x",
      "33":"a x",
      "34":"a x",
      "35":"a x",
      "36":"a x",
      "37":"a x",
      "38":"a x"
    },
    "safari":{
      "3.1":"n",
      "3.2":"n",
      "4":"a x",
      "5":"a x",
      "5.1":"a x",
      "6":"a x",
      "6.1":"a x",
      "7":"a x",
      "8":"a x"
    },
    "opera":{
      "9":"n",
      "9.5-9.6":"n",
      "10.0-10.1":"n",
      "10.5":"n",
      "10.6":"n",
      "11":"n",
      "11.1":"n",
      "11.5":"n",
      "11.6":"n",
      "12":"n",
      "12.1":"n",
      "15":"a x",
      "16":"a x",
      "17":"a x",
      "18":"a x",
      "19":"a x",
      "20":"a x",
      "21":"a x",
      "22":"a x",
      "23":"a x",
      "24":"a x"
    },
    "ios_saf":{
      "3.2":"a x",
      "4.0-4.1":"a x",
      "4.2-4.3":"a x",
      "5.0-5.1":"a x",
      "6.0-6.1":"a x",
      "7.0-7.1":"a x",
      "8":"a x"
    },
    "op_mini":{
      "5.0-7.0":"n"
    },
    "android":{
      "2.1":"a x",
      "2.2":"a x",
      "2.3":"a x",
      "3":"a x",
      "4":"a x",
      "4.1":"a x",
      "4.2-4.3":"a x",
      "4.4":"a x",
      "4.4.3":"a x"
    },
    "bb":{
      "7":"a x",
      "10":"a x"
    },
    "op_mob":{
      "10":"n",
      "11":"n",
      "11.1":"n",
      "11.5":"n",
      "12":"n",
      "12.1":"n",
      "0":"a x"
    },
    "and_chr":{
      "0":"a x"
    },
    "and_ff":{
      "0":"a"
    },
    "ie_mob":{
      "10":"n"
    }
  },
  "notes":"Partial support in WebKit/Blink browsers refers to supporting the mask-image and mask-box-image properties, but lacks support for othe parts of the spec. Partial support in Firefox refers to only support for inline SVG mask elements i.e. mask: url(#foo).",
  "usage_perc_y":0,
  "usage_perc_a":71.95,
  "ucprefix":false,
  "parent":"",
  "keywords":"",
  "shown":true
}
},{}],65:[function(require,module,exports){
module.exports={
  "title":":placeholder-shown CSS pseudo-class",
  "description":"The :placeholder-shown pseudo-class represents the placeholder contents of a form field with placeholder text.",
  "spec":"http://dev.w3.org/csswg/selectors/#placeholder",
  "status":"unoff",
  "links":[
    {
      "url":"http://msdn.microsoft.com/en-us/library/ie/hh772745(v=vs.85).aspx",
      "title":"MSDN article"
    },
    {
      "url":"http://wiki.csswg.org/ideas/placeholder-styling",
      "title":"CSSWG discussion"
    },
    {
      "url":"http://css-tricks.com/snippets/css/style-placeholder-text/",
      "title":"CSS-Tricks article with all prefixes"
    }
  ],
  "bugs":[
    
  ],
  "categories":[
    "CSS"
  ],
  "stats":{
    "ie":{
      "5.5":"n",
      "6":"n",
      "7":"n",
      "8":"n",
      "9":"n",
      "10":"a x",
      "11":"a x"
    },
    "firefox":{
      "2":"n",
      "3":"n",
      "3.5":"n",
      "3.6":"n",
      "4":"a x",
      "5":"a x",
      "6":"a x",
      "7":"a x",
      "8":"a x",
      "9":"a x",
      "10":"a x",
      "11":"a x",
      "12":"a x",
      "13":"a x",
      "14":"a x",
      "15":"a x",
      "16":"a x",
      "17":"a x",
      "18":"a x",
      "19":"a x",
      "20":"a x",
      "21":"a x",
      "22":"a x",
      "23":"a x",
      "24":"a x",
      "25":"a x",
      "26":"a x",
      "27":"a x",
      "28":"a x",
      "29":"a x",
      "30":"a x",
      "31":"a x",
      "32":"a x",
      "33":"a x"
    },
    "chrome":{
      "4":"a x",
      "5":"a x",
      "6":"a x",
      "7":"a x",
      "8":"a x",
      "9":"a x",
      "10":"a x",
      "11":"a x",
      "12":"a x",
      "13":"a x",
      "14":"a x",
      "15":"a x",
      "16":"a x",
      "17":"a x",
      "18":"a x",
      "19":"a x",
      "20":"a x",
      "21":"a x",
      "22":"a x",
      "23":"a x",
      "24":"a x",
      "25":"a x",
      "26":"a x",
      "27":"a x",
      "28":"a x",
      "29":"a x",
      "30":"a x",
      "31":"a x",
      "32":"a x",
      "33":"a x",
      "34":"a x",
      "35":"a x",
      "36":"a x",
      "37":"a x",
      "38":"a x"
    },
    "safari":{
      "3.1":"n",
      "3.2":"n",
      "4":"n",
      "5":"a x",
      "5.1":"a x",
      "6":"a x",
      "6.1":"a x",
      "7":"a x",
      "8":"a x"
    },
    "opera":{
      "9":"n",
      "9.5-9.6":"n",
      "10.0-10.1":"n",
      "10.5":"n",
      "10.6":"n",
      "11":"n",
      "11.1":"n",
      "11.5":"n",
      "11.6":"n",
      "12":"n",
      "12.1":"n",
      "15":"a x",
      "16":"a x",
      "17":"a x",
      "18":"a x",
      "19":"a x",
      "20":"a x",
      "21":"a x",
      "22":"a x",
      "23":"a x",
      "24":"a x"
    },
    "ios_saf":{
      "3.2":"n",
      "4.0-4.1":"n",
      "4.2-4.3":"a x",
      "5.0-5.1":"a x",
      "6.0-6.1":"a x",
      "7.0-7.1":"a x",
      "8":"a x"
    },
    "op_mini":{
      "5.0-7.0":"n"
    },
    "android":{
      "2.1":"a x",
      "2.2":"a x",
      "2.3":"a x",
      "3":"a x",
      "4":"a x",
      "4.1":"a x",
      "4.2-4.3":"a x",
      "4.4":"a x",
      "4.4.3":"a x"
    },
    "bb":{
      "7":"u",
      "10":"a x"
    },
    "op_mob":{
      "10":"n",
      "11":"n",
      "11.1":"n",
      "11.5":"n",
      "12":"n",
      "12.1":"n",
      "0":"a x"
    },
    "and_chr":{
      "0":"a x"
    },
    "and_ff":{
      "0":"a x"
    },
    "ie_mob":{
      "10":"a x"
    }
  },
  "notes":"Partial support refers to support for alternative syntax: ::-webkit-input-placeholder (Chrome/Safari/Opera),\r\n::-moz-placeholder (Firefox) and \r\n:-ms-input-placeholder (IE). ",
  "usage_perc_y":0,
  "usage_perc_a":81.79,
  "ucprefix":false,
  "parent":"",
  "keywords":"::placeholder,placeholder",
  "shown":true
}
},{}],66:[function(require,module,exports){
module.exports={
  "title":"::selection CSS pseudo-element",
  "description":"The ::selection CSS pseudo-element applies rules to the portion of a document that has been highlighted (e.g., selected with the mouse or another pointing device) by the user.",
  "spec":"https://developer.mozilla.org/en-US/docs/Web/CSS/::selection",
  "status":"unoff",
  "links":[
    {
      "url":"http://docs.webplatform.org/wiki/css/selectors/pseudo-elements/::selection",
      "title":"WebPlatform Docs"
    },
    {
      "url":"http://quirksmode.org/css/selectors/selection.html",
      "title":"::selection test"
    }
  ],
  "bugs":[
    {
      "description":"::selection does not work on input elements in Chrome (tested on OS X and Windows XP)"
    }
  ],
  "categories":[
    "CSS"
  ],
  "stats":{
    "ie":{
      "5.5":"n",
      "6":"n",
      "7":"n",
      "8":"n",
      "9":"y",
      "10":"y",
      "11":"y"
    },
    "firefox":{
      "2":"y x",
      "3":"y x",
      "3.5":"y x",
      "3.6":"y x",
      "4":"y x",
      "5":"y x",
      "6":"y x",
      "7":"y x",
      "8":"y x",
      "9":"y x",
      "10":"y x",
      "11":"y x",
      "12":"y x",
      "13":"y x",
      "14":"y x",
      "15":"y x",
      "16":"y x",
      "17":"y x",
      "18":"y x",
      "19":"y x",
      "20":"y x",
      "21":"y x",
      "22":"y x",
      "23":"y x",
      "24":"y x",
      "25":"y x",
      "26":"y x",
      "27":"y x",
      "28":"y x",
      "29":"y x",
      "30":"y x",
      "31":"y x",
      "32":"y x",
      "33":"y x"
    },
    "chrome":{
      "4":"y",
      "5":"y",
      "6":"y",
      "7":"y",
      "8":"y",
      "9":"y",
      "10":"y",
      "11":"y",
      "12":"y",
      "13":"y",
      "14":"y",
      "15":"y",
      "16":"y",
      "17":"y",
      "18":"y",
      "19":"y",
      "20":"y",
      "21":"y",
      "22":"y",
      "23":"y",
      "24":"y",
      "25":"y",
      "26":"y",
      "27":"y",
      "28":"y",
      "29":"y",
      "30":"y",
      "31":"y",
      "32":"y",
      "33":"y",
      "34":"y",
      "35":"y",
      "36":"y",
      "37":"y",
      "38":"y"
    },
    "safari":{
      "3.1":"y",
      "3.2":"y",
      "4":"y",
      "5":"y",
      "5.1":"y",
      "6":"y",
      "6.1":"y",
      "7":"y",
      "8":"y"
    },
    "opera":{
      "9":"n",
      "9.5-9.6":"y",
      "10.0-10.1":"y",
      "10.5":"y",
      "10.6":"y",
      "11":"y",
      "11.1":"y",
      "11.5":"y",
      "11.6":"y",
      "12":"y",
      "12.1":"y",
      "15":"y",
      "16":"y",
      "17":"y",
      "18":"y",
      "19":"y",
      "20":"y",
      "21":"y",
      "22":"y",
      "23":"y",
      "24":"y"
    },
    "ios_saf":{
      "3.2":"n",
      "4.0-4.1":"n",
      "4.2-4.3":"n",
      "5.0-5.1":"n",
      "6.0-6.1":"n",
      "7.0-7.1":"n",
      "8":"n"
    },
    "op_mini":{
      "5.0-7.0":"n"
    },
    "android":{
      "2.1":"n",
      "2.2":"n",
      "2.3":"n",
      "3":"n",
      "4":"n",
      "4.1":"n",
      "4.2-4.3":"n",
      "4.4":"y",
      "4.4.3":"y"
    },
    "bb":{
      "7":"n",
      "10":"n"
    },
    "op_mob":{
      "10":"u",
      "11":"u",
      "11.1":"u",
      "11.5":"y",
      "12":"y",
      "12.1":"y",
      "0":"y"
    },
    "and_chr":{
      "0":"y"
    },
    "and_ff":{
      "0":"n"
    },
    "ie_mob":{
      "10":"y"
    }
  },
  "notes":"",
  "usage_perc_y":72.46,
  "usage_perc_a":0,
  "ucprefix":false,
  "parent":"",
  "keywords":"::selection,selection",
  "shown":true
}
},{}],67:[function(require,module,exports){
module.exports={
  "title":"CSS position:sticky",
  "description":"Keeps elements positioned as \"fixed\" or \"relative\" depending on how it appears in the viewport. As a result the element is \"stuck\" when necessary while scrolling.",
  "spec":"http://dev.w3.org/csswg/css-position/#sticky-positioning",
  "status":"unoff",
  "links":[
    {
      "url":"http://updates.html5rocks.com/2012/08/Stick-your-landings-position-sticky-lands-in-WebKit",
      "title":"HTML5Rocks"
    },
    {
      "url":"https://github.com/filamentgroup/fixed-sticky",
      "title":"Polyfill"
    },
    {
      "url":"http://docs.webplatform.org/wiki/css/properties/position",
      "title":"WebPlatform Docs"
    },
    {
      "url":"https://developer.mozilla.org/en-US/docs/Web/CSS/position",
      "title":"MDN article"
    }
  ],
  "bugs":[
    
  ],
  "categories":[
    "CSS"
  ],
  "stats":{
    "ie":{
      "5.5":"n",
      "6":"n",
      "7":"n",
      "8":"n",
      "9":"n",
      "10":"n",
      "11":"n"
    },
    "firefox":{
      "2":"n",
      "3":"n",
      "3.5":"n",
      "3.6":"n",
      "4":"n",
      "5":"n",
      "6":"n",
      "7":"n",
      "8":"n",
      "9":"n",
      "10":"n",
      "11":"n",
      "12":"n",
      "13":"n",
      "14":"n",
      "15":"n",
      "16":"n",
      "17":"n",
      "18":"n",
      "19":"n",
      "20":"n",
      "21":"n",
      "22":"n",
      "23":"n",
      "24":"n",
      "25":"n",
      "26":"n",
      "27":"n",
      "28":"n",
      "29":"n",
      "30":"n",
      "31":"y",
      "32":"y",
      "33":"y"
    },
    "chrome":{
      "4":"n",
      "5":"n",
      "6":"n",
      "7":"n",
      "8":"n",
      "9":"n",
      "10":"n",
      "11":"n",
      "12":"n",
      "13":"n",
      "14":"n",
      "15":"n",
      "16":"n",
      "17":"n",
      "18":"n",
      "19":"n",
      "20":"n",
      "21":"n",
      "22":"n",
      "23":"n",
      "24":"n",
      "25":"n",
      "26":"n",
      "27":"n",
      "28":"n",
      "29":"n",
      "30":"n",
      "31":"n",
      "32":"n",
      "33":"n",
      "34":"n",
      "35":"n",
      "36":"n",
      "37":"n",
      "38":"n"
    },
    "safari":{
      "3.1":"n",
      "3.2":"n",
      "4":"n",
      "5":"n",
      "5.1":"n",
      "6":"n",
      "6.1":"y x",
      "7":"y x",
      "8":"y x"
    },
    "opera":{
      "9":"n",
      "9.5-9.6":"n",
      "10.0-10.1":"n",
      "10.5":"n",
      "10.6":"n",
      "11":"n",
      "11.1":"n",
      "11.5":"n",
      "11.6":"n",
      "12":"n",
      "12.1":"n",
      "15":"n",
      "16":"n",
      "17":"n",
      "18":"n",
      "19":"n",
      "20":"n",
      "21":"n",
      "22":"n",
      "23":"n",
      "24":"n"
    },
    "ios_saf":{
      "3.2":"n",
      "4.0-4.1":"n",
      "4.2-4.3":"n",
      "5.0-5.1":"n",
      "6.0-6.1":"y x",
      "7.0-7.1":"y x",
      "8":"y x"
    },
    "op_mini":{
      "5.0-7.0":"n"
    },
    "android":{
      "2.1":"n",
      "2.2":"n",
      "2.3":"n",
      "3":"n",
      "4":"n",
      "4.1":"n",
      "4.2-4.3":"n",
      "4.4":"n",
      "4.4.3":"n"
    },
    "bb":{
      "7":"n",
      "10":"n"
    },
    "op_mob":{
      "10":"n",
      "11":"n",
      "11.1":"n",
      "11.5":"n",
      "12":"n",
      "12.1":"n",
      "0":"n"
    },
    "and_chr":{
      "0":"n"
    },
    "and_ff":{
      "0":"n"
    },
    "ie_mob":{
      "10":"n"
    }
  },
  "notes":"Can be enabled in Firefox 26+ by setting the about:config preference layout.css.sticky.enabled to true and in Chrome 23 by enabling the #enable-experimental-web-platform-features flag.",
  "usage_perc_y":8.85,
  "usage_perc_a":0,
  "ucprefix":false,
  "parent":"",
  "keywords":"",
  "shown":true
}
},{}],68:[function(require,module,exports){
module.exports={
  "title":"CSS3 Transitions",
  "description":"Simple method of animating certain properties of an element",
  "spec":"http://www.w3.org/TR/css3-transitions/",
  "status":"wd",
  "links":[
    {
      "url":"http://www.webdesignerdepot.com/2010/01/css-transitions-101/",
      "title":"Article on usage"
    },
    {
      "url":"http://www.the-art-of-web.com/css/timing-function/",
      "title":"Examples on timing functions"
    },
    {
      "url":"http://www.opera.com/docs/specs/presto2.12/css/transitions/#anima",
      "title":"Animation of property types support in Opera"
    },
    {
      "url":"http://www.css3files.com/transition/",
      "title":"Information page"
    },
    {
      "url":"http://docs.webplatform.org/wiki/css/properties/transition",
      "title":"WebPlatform Docs"
    }
  ],
  "bugs":[
    {
      "description":"Not supported on any pseudo-elements besides ::before and ::after for Firefox, Chrome 26+ and IE10+."
    }
  ],
  "categories":[
    "CSS3"
  ],
  "stats":{
    "ie":{
      "5.5":"n",
      "6":"n",
      "7":"n",
      "8":"n",
      "9":"n",
      "10":"y",
      "11":"y"
    },
    "firefox":{
      "2":"n",
      "3":"n",
      "3.5":"n",
      "3.6":"n",
      "4":"y x",
      "5":"y x",
      "6":"y x",
      "7":"y x",
      "8":"y x",
      "9":"y x",
      "10":"y x",
      "11":"y x",
      "12":"y x",
      "13":"y x",
      "14":"y x",
      "15":"y x",
      "16":"y",
      "17":"y",
      "18":"y",
      "19":"y",
      "20":"y",
      "21":"y",
      "22":"y",
      "23":"y",
      "24":"y",
      "25":"y",
      "26":"y",
      "27":"y",
      "28":"y",
      "29":"y",
      "30":"y",
      "31":"y",
      "32":"y",
      "33":"y"
    },
    "chrome":{
      "4":"y x",
      "5":"y x",
      "6":"y x",
      "7":"y x",
      "8":"y x",
      "9":"y x",
      "10":"y x",
      "11":"y x",
      "12":"y x",
      "13":"y x",
      "14":"y x",
      "15":"y x",
      "16":"y x",
      "17":"y x",
      "18":"y x",
      "19":"y x",
      "20":"y x",
      "21":"y x",
      "22":"y x",
      "23":"y x",
      "24":"y x",
      "25":"y x",
      "26":"y",
      "27":"y",
      "28":"y",
      "29":"y",
      "30":"y",
      "31":"y",
      "32":"y",
      "33":"y",
      "34":"y",
      "35":"y",
      "36":"y",
      "37":"y",
      "38":"y"
    },
    "safari":{
      "3.1":"y x",
      "3.2":"y x",
      "4":"y x",
      "5":"y x",
      "5.1":"y x",
      "6":"y x",
      "6.1":"y",
      "7":"y",
      "8":"y"
    },
    "opera":{
      "9":"n",
      "9.5-9.6":"n",
      "10.0-10.1":"n",
      "10.5":"y x",
      "10.6":"y x",
      "11":"y x",
      "11.1":"y x",
      "11.5":"y x",
      "11.6":"y x",
      "12":"y x",
      "12.1":"y",
      "15":"y",
      "16":"y",
      "17":"y",
      "18":"y",
      "19":"y",
      "20":"y",
      "21":"y",
      "22":"y",
      "23":"y",
      "24":"y"
    },
    "ios_saf":{
      "3.2":"y x",
      "4.0-4.1":"y x",
      "4.2-4.3":"y x",
      "5.0-5.1":"y x",
      "6.0-6.1":"y x",
      "7.0-7.1":"y",
      "8":"y"
    },
    "op_mini":{
      "5.0-7.0":"n"
    },
    "android":{
      "2.1":"y x",
      "2.2":"y x",
      "2.3":"y x",
      "3":"y x",
      "4":"y x",
      "4.1":"y x",
      "4.2-4.3":"y x",
      "4.4":"y",
      "4.4.3":"y"
    },
    "bb":{
      "7":"y x",
      "10":"y x"
    },
    "op_mob":{
      "10":"y x",
      "11":"y x",
      "11.1":"y x",
      "11.5":"y x",
      "12":"y x",
      "12.1":"y",
      "0":"y"
    },
    "and_chr":{
      "0":"y"
    },
    "and_ff":{
      "0":"y"
    },
    "ie_mob":{
      "10":"y"
    }
  },
  "notes":"",
  "usage_perc_y":82.5,
  "usage_perc_a":0,
  "ucprefix":false,
  "parent":"",
  "keywords":"css transition",
  "shown":true
}
},{}],69:[function(require,module,exports){
module.exports={
  "title":"CSS3 Box-sizing",
  "description":"Method of specifying whether or not an element's borders and padding should be included in size units",
  "spec":"http://www.w3.org/TR/css3-ui/#box-sizing",
  "status":"wd",
  "links":[
    {
      "url":"http://css-tricks.com/box-sizing/",
      "title":"CSS Tricks"
    },
    {
      "url":"http://docs.webplatform.org/wiki/css/properties/box-sizing",
      "title":"WebPlatform Docs"
    },
    {
      "url":"https://github.com/Schepp/box-sizing-polyfill",
      "title":"Polyfill for IE"
    },
    {
      "url":"https://developer.mozilla.org/En/CSS/Box-sizing",
      "title":"MDN article"
    },
    {
      "url":"http://www.456bereastreet.com/archive/201104/controlling_width_with_css3_box-sizing/",
      "title":"Blog post"
    }
  ],
  "bugs":[
    {
      "description":"Android browsers do not calculate correctly the dimensions (width and height) of the HTML select element."
    },
    {
      "description":"Safari 6.0.x does not use box-sizing on elements with display: table;"
    },
    {
      "description":"IE9 will subtract the width of the scrollbar to the width of the element when set to position: absolute, overflow: auto / overflow-y: scroll"
    }
  ],
  "categories":[
    "CSS3"
  ],
  "stats":{
    "ie":{
      "5.5":"p",
      "6":"p",
      "7":"p",
      "8":"a",
      "9":"a",
      "10":"a",
      "11":"a"
    },
    "firefox":{
      "2":"y x",
      "3":"y x",
      "3.5":"y x",
      "3.6":"y x",
      "4":"y x",
      "5":"y x",
      "6":"y x",
      "7":"y x",
      "8":"y x",
      "9":"y x",
      "10":"y x",
      "11":"y x",
      "12":"y x",
      "13":"y x",
      "14":"y x",
      "15":"y x",
      "16":"y x",
      "17":"y x",
      "18":"y x",
      "19":"y x",
      "20":"y x",
      "21":"y x",
      "22":"y x",
      "23":"y x",
      "24":"y x",
      "25":"y x",
      "26":"y x",
      "27":"y x",
      "28":"y x",
      "29":"y",
      "30":"y",
      "31":"y",
      "32":"y",
      "33":"y"
    },
    "chrome":{
      "4":"a x",
      "5":"a x",
      "6":"a x",
      "7":"a x",
      "8":"a x",
      "9":"a x",
      "10":"a",
      "11":"a",
      "12":"a",
      "13":"a",
      "14":"a",
      "15":"a",
      "16":"a",
      "17":"a",
      "18":"a",
      "19":"a",
      "20":"a",
      "21":"a",
      "22":"a",
      "23":"a",
      "24":"a",
      "25":"a",
      "26":"a",
      "27":"a",
      "28":"a",
      "29":"a",
      "30":"a",
      "31":"a",
      "32":"a",
      "33":"a",
      "34":"a",
      "35":"a",
      "36":"a",
      "37":"a",
      "38":"a"
    },
    "safari":{
      "3.1":"a x",
      "3.2":"a x",
      "4":"a x",
      "5":"a x",
      "5.1":"a",
      "6":"a",
      "6.1":"a",
      "7":"a",
      "8":"a"
    },
    "opera":{
      "9":"n",
      "9.5-9.6":"a",
      "10.0-10.1":"a",
      "10.5":"a",
      "10.6":"a",
      "11":"a",
      "11.1":"a",
      "11.5":"a",
      "11.6":"a",
      "12":"a",
      "12.1":"a",
      "15":"a",
      "16":"a",
      "17":"a",
      "18":"a",
      "19":"a",
      "20":"a",
      "21":"a",
      "22":"a",
      "23":"a",
      "24":"a"
    },
    "ios_saf":{
      "3.2":"a x",
      "4.0-4.1":"a x",
      "4.2-4.3":"a x",
      "5.0-5.1":"a",
      "6.0-6.1":"a",
      "7.0-7.1":"a",
      "8":"a"
    },
    "op_mini":{
      "5.0-7.0":"a"
    },
    "android":{
      "2.1":"a x",
      "2.2":"a x",
      "2.3":"a x",
      "3":"a x",
      "4":"a",
      "4.1":"a",
      "4.2-4.3":"a",
      "4.4":"a",
      "4.4.3":"a"
    },
    "bb":{
      "7":"a x",
      "10":"a"
    },
    "op_mob":{
      "10":"a",
      "11":"a",
      "11.1":"a",
      "11.5":"a",
      "12":"a",
      "12.1":"a",
      "0":"a"
    },
    "and_chr":{
      "0":"a"
    },
    "and_ff":{
      "0":"y"
    },
    "ie_mob":{
      "10":"a"
    }
  },
  "notes":"Partial support refers to supporting only the \"border-box\" value, not \"padding-box\" (which was added to the spec later).",
  "usage_perc_y":14.17,
  "usage_perc_a":78.86,
  "ucprefix":false,
  "parent":"",
  "keywords":"border-box,content-box,padding-box",
  "shown":true
}
},{}],70:[function(require,module,exports){
module.exports={
  "title":"CSS3 Cursors (new values)",
  "description":"Support for zoom-in and zoom-out values for the CSS3 cursor property.",
  "spec":"http://www.w3.org/TR/css3-ui/#cursor",
  "status":"wd",
  "links":[
    {
      "url":"https://developer.mozilla.org/en-US/docs/Web/CSS/cursor",
      "title":"MDN Documentation"
    }
  ],
  "bugs":[
    
  ],
  "categories":[
    "CSS3"
  ],
  "stats":{
    "ie":{
      "5.5":"n",
      "6":"n",
      "7":"n",
      "8":"n",
      "9":"n",
      "10":"n",
      "11":"n"
    },
    "firefox":{
      "2":"y x",
      "3":"y x",
      "3.5":"y x",
      "3.6":"y x",
      "4":"y x",
      "5":"y x",
      "6":"y x",
      "7":"y x",
      "8":"y x",
      "9":"y x",
      "10":"y x",
      "11":"y x",
      "12":"y x",
      "13":"y x",
      "14":"y x",
      "15":"y x",
      "16":"y x",
      "17":"y x",
      "18":"y x",
      "19":"y x",
      "20":"y x",
      "21":"y x",
      "22":"y x",
      "23":"y x",
      "24":"y",
      "25":"y",
      "26":"y",
      "27":"y",
      "28":"y",
      "29":"y",
      "30":"y",
      "31":"y",
      "32":"y",
      "33":"y"
    },
    "chrome":{
      "4":"y x",
      "5":"y x",
      "6":"y x",
      "7":"y x",
      "8":"y x",
      "9":"y x",
      "10":"y x",
      "11":"y x",
      "12":"y x",
      "13":"y x",
      "14":"y x",
      "15":"y x",
      "16":"y x",
      "17":"y x",
      "18":"y x",
      "19":"y x",
      "20":"y x",
      "21":"y x",
      "22":"y x",
      "23":"y x",
      "24":"y x",
      "25":"y x",
      "26":"y x",
      "27":"y x",
      "28":"y x",
      "29":"y x",
      "30":"y x",
      "31":"y x",
      "32":"y x",
      "33":"y x",
      "34":"y x",
      "35":"y x",
      "36":"y x",
      "37":"y x",
      "38":"y x"
    },
    "safari":{
      "3.1":"y x",
      "3.2":"y x",
      "4":"y x",
      "5":"y x",
      "5.1":"y x",
      "6":"y x",
      "6.1":"y x",
      "7":"y x",
      "8":"y x"
    },
    "opera":{
      "9":"n",
      "9.5-9.6":"n",
      "10.0-10.1":"n",
      "10.5":"n",
      "10.6":"n",
      "11":"n",
      "11.1":"n",
      "11.5":"n",
      "11.6":"y",
      "12":"y",
      "12.1":"y",
      "15":"y x",
      "16":"y x",
      "17":"y x",
      "18":"y x",
      "19":"y x",
      "20":"y x",
      "21":"y x",
      "22":"y x",
      "23":"y x",
      "24":"y x"
    },
    "ios_saf":{
      "3.2":"n",
      "4.0-4.1":"n",
      "4.2-4.3":"n",
      "5.0-5.1":"n",
      "6.0-6.1":"n",
      "7.0-7.1":"n",
      "8":"n"
    },
    "op_mini":{
      "5.0-7.0":"n"
    },
    "android":{
      "2.1":"n",
      "2.2":"n",
      "2.3":"n",
      "3":"n",
      "4":"n",
      "4.1":"n",
      "4.2-4.3":"n",
      "4.4":"n",
      "4.4.3":"n"
    },
    "bb":{
      "7":"y x",
      "10":"y x"
    },
    "op_mob":{
      "10":"n",
      "11":"n",
      "11.1":"n",
      "11.5":"n",
      "12":"n",
      "12.1":"n",
      "0":"n"
    },
    "and_chr":{
      "0":"n"
    },
    "and_ff":{
      "0":"n"
    },
    "ie_mob":{
      "10":"n"
    }
  },
  "notes":"Chrome, Safari and Firefox also support the unofficial 'grab' and 'grabbing' values (with prefix)",
  "usage_perc_y":53.13,
  "usage_perc_a":0,
  "ucprefix":false,
  "parent":"",
  "keywords":"cursors, pointers",
  "shown":false
}
},{}],71:[function(require,module,exports){
module.exports={
  "title":"CSS3 tab-size",
  "description":"Method of customizing the width of the tab character. Only effective using 'white-space: pre' or 'white-space: pre-wrap'.",
  "spec":"http://www.w3.org/TR/css3-text/#tab-size1",
  "status":"wd",
  "links":[
    {
      "url":"https://developer.mozilla.org/en-US/docs/Web/CSS/tab-size",
      "title":"MDN article"
    }
  ],
  "bugs":[
    
  ],
  "categories":[
    "CSS3"
  ],
  "stats":{
    "ie":{
      "5.5":"n",
      "6":"n",
      "7":"n",
      "8":"n",
      "9":"n",
      "10":"n",
      "11":"n"
    },
    "firefox":{
      "2":"n",
      "3":"n",
      "3.5":"n",
      "3.6":"n",
      "4":"y x",
      "5":"y x",
      "6":"y x",
      "7":"y x",
      "8":"y x",
      "9":"y x",
      "10":"y x",
      "11":"y x",
      "12":"y x",
      "13":"y x",
      "14":"y x",
      "15":"y x",
      "16":"y x",
      "17":"y x",
      "18":"y x",
      "19":"y x",
      "20":"y x",
      "21":"y x",
      "22":"y x",
      "23":"y x",
      "24":"y x",
      "25":"y x",
      "26":"y x",
      "27":"y x",
      "28":"y x",
      "29":"y x",
      "30":"y x",
      "31":"y x",
      "32":"y x",
      "33":"y x"
    },
    "chrome":{
      "4":"n",
      "5":"n",
      "6":"n",
      "7":"n",
      "8":"n",
      "9":"n",
      "10":"n",
      "11":"n",
      "12":"n",
      "13":"n",
      "14":"n",
      "15":"n",
      "16":"n",
      "17":"n",
      "18":"n",
      "19":"n",
      "20":"n",
      "21":"y",
      "22":"y",
      "23":"y",
      "24":"y",
      "25":"y",
      "26":"y",
      "27":"y",
      "28":"y",
      "29":"y",
      "30":"y",
      "31":"y",
      "32":"y",
      "33":"y",
      "34":"y",
      "35":"y",
      "36":"y",
      "37":"y",
      "38":"y"
    },
    "safari":{
      "3.1":"n",
      "3.2":"n",
      "4":"n",
      "5":"n",
      "5.1":"n",
      "6":"n",
      "6.1":"y",
      "7":"y",
      "8":"y"
    },
    "opera":{
      "9":"n",
      "9.5-9.6":"n",
      "10.0-10.1":"n",
      "10.5":"n",
      "10.6":"y x",
      "11":"y x",
      "11.1":"y x",
      "11.5":"y x",
      "11.6":"y x",
      "12":"y x",
      "12.1":"y x",
      "15":"y",
      "16":"y",
      "17":"y",
      "18":"y",
      "19":"y",
      "20":"y",
      "21":"y",
      "22":"y",
      "23":"y",
      "24":"y"
    },
    "ios_saf":{
      "3.2":"n",
      "4.0-4.1":"n",
      "4.2-4.3":"n",
      "5.0-5.1":"n",
      "6.0-6.1":"n",
      "7.0-7.1":"y",
      "8":"y"
    },
    "op_mini":{
      "5.0-7.0":"n"
    },
    "android":{
      "2.1":"n",
      "2.2":"n",
      "2.3":"n",
      "3":"n",
      "4":"n",
      "4.1":"n",
      "4.2-4.3":"n",
      "4.4":"y",
      "4.4.3":"y"
    },
    "bb":{
      "7":"y",
      "10":"y"
    },
    "op_mob":{
      "10":"n",
      "11":"y x",
      "11.1":"y x",
      "11.5":"y x",
      "12":"y x",
      "12.1":"y x",
      "0":"y"
    },
    "and_chr":{
      "0":"y"
    },
    "and_ff":{
      "0":"y x"
    },
    "ie_mob":{
      "10":"n"
    }
  },
  "notes":"",
  "usage_perc_y":63.43,
  "usage_perc_a":0,
  "ucprefix":false,
  "parent":"",
  "keywords":"tab-size,tab-width",
  "shown":true
}
},{}],72:[function(require,module,exports){
module.exports={
  "title":"Flexible Box Layout Module",
  "description":"Method of positioning elements in horizontal or vertical stacks.",
  "spec":"http://www.w3.org/TR/css3-flexbox/",
  "status":"cr",
  "links":[
    {
      "url":"http://bennettfeely.com/flexplorer/",
      "title":"Flexbox CSS generator"
    },
    {
      "url":"http://philipwalton.github.io/solved-by-flexbox/",
      "title":"Examples on how to solve common layout problems with flexbox"
    },
    {
      "url":"http://dev.opera.com/articles/view/advanced-cross-browser-flexbox/",
      "title":"Tutorial on cross-browser support"
    },
    {
      "url":"http://css-tricks.com/snippets/css/a-guide-to-flexbox/",
      "title":"A Complete Guide to Flexbox"
    },
    {
      "url":"http://the-echoplex.net/flexyboxes/",
      "title":"Flexbox playground and code generator"
    },
    {
      "url":"http://www.adobe.com/devnet/html5/articles/working-with-flexbox-the-new-spec.html",
      "title":"Article on using the latest spec"
    }
  ],
  "bugs":[
    {
      "description":"Firefox does not support specifying widths in percentages. <a href=\"https://bugzilla.mozilla.org/show_bug.cgi?id=529761\">See bug</a>."
    },
    {
      "description":"IE10 and IE11 default values for `flex` are `0 0 auto` rather than `0 1 auto`, as per the draft spec, as of September 2013."
    },
    {
      "description":"In IE10 and IE11, containers with `display: flex` and `flex-direction: column` will not properly calculate their flexed childrens' sizes if the container has `min-height` but no explicit `height` property. <a href=\"https://connect.microsoft.com/IE/feedback/details/802625/min-height-and-flexbox-flex-direction-column-dont-work-together-in-ie-10-11-preview\">See bug</a>."
    },
    {
      "description":"In Chrome and Safari, the height of (non flex) children are not recognized in percentages. However Firefox and IE recognize and scale the children based on percentage heights."
    }
  ],
  "categories":[
    "CSS3"
  ],
  "stats":{
    "ie":{
      "5.5":"n",
      "6":"n",
      "7":"n",
      "8":"n",
      "9":"n",
      "10":"a x #2",
      "11":"y"
    },
    "firefox":{
      "2":"a x #1",
      "3":"a x #1",
      "3.5":"a x #1",
      "3.6":"a x #1",
      "4":"a x #1",
      "5":"a x #1",
      "6":"a x #1",
      "7":"a x #1",
      "8":"a x #1",
      "9":"a x #1",
      "10":"a x #1",
      "11":"a x #1",
      "12":"a x #1",
      "13":"a x #1",
      "14":"a x #1",
      "15":"a x #1",
      "16":"a x #1",
      "17":"a x #1",
      "18":"a x #1",
      "19":"a x #1",
      "20":"a x #1",
      "21":"a x #1",
      "22":"a #3",
      "23":"a #3",
      "24":"a #3",
      "25":"a #3",
      "26":"a #3",
      "27":"a #3",
      "28":"y",
      "29":"y",
      "30":"y",
      "31":"y",
      "32":"y",
      "33":"y"
    },
    "chrome":{
      "4":"a x #1",
      "5":"a x #1",
      "6":"a x #1",
      "7":"a x #1",
      "8":"a x #1",
      "9":"a x #1",
      "10":"a x #1",
      "11":"a x #1",
      "12":"a x #1",
      "13":"a x #1",
      "14":"a x #1",
      "15":"a x #1",
      "16":"a x #1",
      "17":"a x #1",
      "18":"a x #1",
      "19":"a x #1",
      "20":"a x #1",
      "21":"y x",
      "22":"y x",
      "23":"y x",
      "24":"y x",
      "25":"y x",
      "26":"y x",
      "27":"y x",
      "28":"y x",
      "29":"y",
      "30":"y",
      "31":"y",
      "32":"y",
      "33":"y",
      "34":"y",
      "35":"y",
      "36":"y",
      "37":"y",
      "38":"y"
    },
    "safari":{
      "3.1":"a x #1",
      "3.2":"a x #1",
      "4":"a x #1",
      "5":"a x #1",
      "5.1":"a x #1",
      "6":"a x #1",
      "6.1":"y x",
      "7":"y x",
      "8":"y x"
    },
    "opera":{
      "9":"n",
      "9.5-9.6":"n",
      "10.0-10.1":"n",
      "10.5":"n",
      "10.6":"n",
      "11":"n",
      "11.1":"n",
      "11.5":"n",
      "11.6":"n",
      "12":"n",
      "12.1":"y",
      "15":"y x",
      "16":"y x",
      "17":"y",
      "18":"y",
      "19":"y",
      "20":"y",
      "21":"y",
      "22":"y",
      "23":"y",
      "24":"y"
    },
    "ios_saf":{
      "3.2":"a x #1",
      "4.0-4.1":"a x #1",
      "4.2-4.3":"a x #1",
      "5.0-5.1":"a x #1",
      "6.0-6.1":"a x #1",
      "7.0-7.1":"y x",
      "8":"y x"
    },
    "op_mini":{
      "5.0-7.0":"n"
    },
    "android":{
      "2.1":"a x #1",
      "2.2":"a x #1",
      "2.3":"a x #1",
      "3":"a x #1",
      "4":"a x #1",
      "4.1":"a x #1",
      "4.2-4.3":"a x #1",
      "4.4":"y",
      "4.4.3":"y"
    },
    "bb":{
      "7":"a x #1",
      "10":"y x"
    },
    "op_mob":{
      "10":"n",
      "11":"n",
      "11.1":"n",
      "11.5":"n",
      "12":"n",
      "12.1":"y",
      "0":"y"
    },
    "and_chr":{
      "0":"y"
    },
    "and_ff":{
      "0":"y"
    },
    "ie_mob":{
      "10":"a x #2"
    }
  },
  "notes":"Most partial support refers to supporting an <a href=\"http://www.w3.org/TR/2009/WD-css3-flexbox-20090723/\">older version</a> of the specification or an <a href=\"http://www.w3.org/TR/2012/WD-css3-flexbox-20120322/\">older syntax</a>.",
  "usage_perc_y":68.36,
  "usage_perc_a":14.29,
  "ucprefix":false,
  "parent":"",
  "keywords":"flex",
  "shown":true
}
},{}],73:[function(require,module,exports){
module.exports={
  "title":"Font feature settings",
  "description":"Method of applying advanced typographic and language-specific font features to supported OpenType fonts.",
  "spec":"http://w3.org/TR/css3-fonts/#font-rend-props",
  "status":"wd",
  "links":[
    {
      "url":"http://ie.microsoft.com/testdrive/Graphics/opentype/",
      "title":"Demo pages (IE/Firefox only)"
    },
    {
      "url":"http://hacks.mozilla.org/2010/11/firefox-4-font-feature-support/",
      "title":"Mozilla hacks article"
    },
    {
      "url":"http://html5accessibility.com/",
      "title":"Detailed tables on accessability support"
    },
    {
      "url":"http://docs.webplatform.org/wiki/css/properties/font-feature-settings",
      "title":"WebPlatform Docs"
    }
  ],
  "bugs":[
    
  ],
  "categories":[
    "CSS3"
  ],
  "stats":{
    "ie":{
      "5.5":"n",
      "6":"n",
      "7":"n",
      "8":"n",
      "9":"n",
      "10":"y",
      "11":"y"
    },
    "firefox":{
      "2":"n",
      "3":"n",
      "3.5":"n",
      "3.6":"n",
      "4":"a x",
      "5":"a x",
      "6":"a x",
      "7":"a x",
      "8":"a x",
      "9":"a x",
      "10":"a x",
      "11":"a x",
      "12":"a x",
      "13":"a x",
      "14":"a x",
      "15":"y x",
      "16":"y x",
      "17":"y x",
      "18":"y x",
      "19":"y x",
      "20":"y x",
      "21":"y x",
      "22":"y x",
      "23":"y x",
      "24":"y x",
      "25":"y x",
      "26":"y x",
      "27":"y x",
      "28":"y x",
      "29":"y x",
      "30":"y x",
      "31":"y x",
      "32":"y x",
      "33":"y x"
    },
    "chrome":{
      "4":"n",
      "5":"n",
      "6":"n",
      "7":"n",
      "8":"n",
      "9":"n",
      "10":"n",
      "11":"n",
      "12":"n",
      "13":"n",
      "14":"n",
      "15":"n",
      "16":"a x",
      "17":"a x",
      "18":"a x",
      "19":"a x",
      "20":"a x",
      "21":"y x",
      "22":"y x",
      "23":"y x",
      "24":"y x",
      "25":"y x",
      "26":"y x",
      "27":"y x",
      "28":"y x",
      "29":"y x",
      "30":"y x",
      "31":"y x",
      "32":"y x",
      "33":"y x",
      "34":"y x",
      "35":"y x",
      "36":"y x",
      "37":"y x",
      "38":"y x"
    },
    "safari":{
      "3.1":"n",
      "3.2":"n",
      "4":"a",
      "5":"a",
      "5.1":"a",
      "6":"a",
      "6.1":"n",
      "7":"n",
      "8":"n"
    },
    "opera":{
      "9":"n",
      "9.5-9.6":"n",
      "10.0-10.1":"n",
      "10.5":"n",
      "10.6":"n",
      "11":"n",
      "11.1":"n",
      "11.5":"n",
      "11.6":"n",
      "12":"n",
      "12.1":"n",
      "15":"y x",
      "16":"y x",
      "17":"y x",
      "18":"y x",
      "19":"y x",
      "20":"y x",
      "21":"y x",
      "22":"y x",
      "23":"y x",
      "24":"y x"
    },
    "ios_saf":{
      "3.2":"a",
      "4.0-4.1":"a",
      "4.2-4.3":"a",
      "5.0-5.1":"a",
      "6.0-6.1":"a",
      "7.0-7.1":"y x",
      "8":"y x"
    },
    "op_mini":{
      "5.0-7.0":"n"
    },
    "android":{
      "2.1":"n",
      "2.2":"n",
      "2.3":"n",
      "3":"n",
      "4":"n",
      "4.1":"n",
      "4.2-4.3":"n",
      "4.4":"y x",
      "4.4.3":"y x"
    },
    "bb":{
      "7":"n",
      "10":"y x"
    },
    "op_mob":{
      "10":"n",
      "11":"n",
      "11.1":"n",
      "11.5":"n",
      "12":"n",
      "12.1":"n",
      "0":"y x"
    },
    "and_chr":{
      "0":"y x"
    },
    "and_ff":{
      "0":"y x"
    },
    "ie_mob":{
      "10":"n"
    }
  },
  "notes":"Partial support in older Firefox versions refers to using an older syntax. Partial support in older Chrome versions refers to lacking support in Mac OS X. ",
  "usage_perc_y":69.91,
  "usage_perc_a":2.96,
  "ucprefix":false,
  "parent":"",
  "keywords":"font-feature,font-feature-settings,kern,kerning,font-variant-alternates,ligatures,font-variant-ligatures",
  "shown":true
}
},{}],74:[function(require,module,exports){
module.exports={
  "title":"Full Screen API",
  "description":"API for allowing content (like a video or canvas element) to take up the entire screen.",
  "spec":"http://www.w3.org/TR/fullscreen/",
  "status":"wd",
  "links":[
    {
      "url":"http://docs.webplatform.org/wiki/dom/methods/requestFullscreen",
      "title":"WebPlatform Docs"
    },
    {
      "url":"https://developer.mozilla.org/en/DOM/Using_full-screen_mode",
      "title":"MDN article"
    },
    {
      "url":"http://hacks.mozilla.org/2012/01/using-the-fullscreen-api-in-web-browsers/",
      "title":"Mozilla hacks article"
    },
    {
      "url":"http://jlongster.com/2011/11/21/canvas.html",
      "title":"Blog post"
    }
  ],
  "bugs":[
    {
      "description":"Safari blocks access to keyboard events in fullscreen mode (as a security measure)."
    }
  ],
  "categories":[
    "JS API"
  ],
  "stats":{
    "ie":{
      "5.5":"n",
      "6":"n",
      "7":"n",
      "8":"n",
      "9":"n",
      "10":"n",
      "11":"y x"
    },
    "firefox":{
      "2":"n",
      "3":"n",
      "3.5":"n",
      "3.6":"n",
      "4":"n",
      "5":"n",
      "6":"n",
      "7":"n",
      "8":"n",
      "9":"n",
      "10":"a x",
      "11":"a x",
      "12":"a x",
      "13":"a x",
      "14":"a x",
      "15":"a x",
      "16":"a x",
      "17":"a x",
      "18":"a x",
      "19":"a x",
      "20":"a x",
      "21":"a x",
      "22":"a x",
      "23":"a x",
      "24":"a x",
      "25":"a x",
      "26":"a x",
      "27":"a x",
      "28":"a x",
      "29":"a x",
      "30":"a x",
      "31":"a x",
      "32":"a x",
      "33":"a x"
    },
    "chrome":{
      "4":"n",
      "5":"n",
      "6":"n",
      "7":"n",
      "8":"n",
      "9":"n",
      "10":"n",
      "11":"n",
      "12":"n",
      "13":"n",
      "14":"n",
      "15":"a x",
      "16":"a x",
      "17":"a x",
      "18":"a x",
      "19":"a x",
      "20":"y x",
      "21":"y x",
      "22":"y x",
      "23":"y x",
      "24":"y x",
      "25":"y x",
      "26":"y x",
      "27":"y x",
      "28":"y x",
      "29":"y x",
      "30":"y x",
      "31":"y x",
      "32":"y x",
      "33":"y x",
      "34":"y x",
      "35":"y x",
      "36":"y x",
      "37":"y x",
      "38":"y x"
    },
    "safari":{
      "3.1":"n",
      "3.2":"n",
      "4":"n",
      "5":"n",
      "5.1":"a x",
      "6":"y x",
      "6.1":"y x",
      "7":"y x",
      "8":"y x"
    },
    "opera":{
      "9":"n",
      "9.5-9.6":"n",
      "10.0-10.1":"n",
      "10.5":"n",
      "10.6":"n",
      "11":"n",
      "11.1":"n",
      "11.5":"n",
      "11.6":"n",
      "12":"n",
      "12.1":"y",
      "15":"y x",
      "16":"y x",
      "17":"y x",
      "18":"y x",
      "19":"y x",
      "20":"y x",
      "21":"y x",
      "22":"y x",
      "23":"y x",
      "24":"y x"
    },
    "ios_saf":{
      "3.2":"n",
      "4.0-4.1":"n",
      "4.2-4.3":"n",
      "5.0-5.1":"n",
      "6.0-6.1":"n",
      "7.0-7.1":"n",
      "8":"n"
    },
    "op_mini":{
      "5.0-7.0":"n"
    },
    "android":{
      "2.1":"n",
      "2.2":"n",
      "2.3":"n",
      "3":"n",
      "4":"n",
      "4.1":"n",
      "4.2-4.3":"n",
      "4.4":"n",
      "4.4.3":"n"
    },
    "bb":{
      "7":"n",
      "10":"a"
    },
    "op_mob":{
      "10":"n",
      "11":"n",
      "11.1":"n",
      "11.5":"n",
      "12":"n",
      "12.1":"n",
      "0":"y x"
    },
    "and_chr":{
      "0":"y x"
    },
    "and_ff":{
      "0":"a x"
    },
    "ie_mob":{
      "10":"n"
    }
  },
  "notes":"Partial support refers to supporting an earlier draft of the spec.",
  "usage_perc_y":50.15,
  "usage_perc_a":14.55,
  "ucprefix":false,
  "parent":"",
  "keywords":"full-screen",
  "shown":true
}
},{}],75:[function(require,module,exports){
module.exports={
  "title":"Intrinsic & Extrinsic Sizing",
  "description":"Allows for the heights and widths to be specified in intrinsic values using the fill-available, max-content, min-content, and fit-content properties.",
  "spec":"http://www.w3.org/TR/css3-sizing/",
  "status":"wd",
  "links":[
    {
      "url":"http://demosthenes.info/blog/662/Design-From-the-Inside-Out-With-CSS-MinContent",
      "title":"Min-Content tutorial"
    }
  ],
  "bugs":[
    
  ],
  "categories":[
    "CSS3"
  ],
  "stats":{
    "ie":{
      "5.5":"n",
      "6":"n",
      "7":"n",
      "8":"n",
      "9":"n",
      "10":"n",
      "11":"n"
    },
    "firefox":{
      "2":"n",
      "3":"n",
      "3.5":"n",
      "3.6":"n",
      "4":"y x",
      "5":"y x",
      "6":"y x",
      "7":"y x",
      "8":"y x",
      "9":"y x",
      "10":"y x",
      "11":"y x",
      "12":"y x",
      "13":"y x",
      "14":"y x",
      "15":"y x",
      "16":"y x",
      "17":"y x",
      "18":"y x",
      "19":"y x",
      "20":"y x",
      "21":"y x",
      "22":"y x",
      "23":"y x",
      "24":"y x",
      "25":"y x",
      "26":"y x",
      "27":"y x",
      "28":"y x",
      "29":"y x",
      "30":"y x",
      "31":"y x",
      "32":"y x",
      "33":"y x"
    },
    "chrome":{
      "4":"n",
      "5":"n",
      "6":"n",
      "7":"n",
      "8":"n",
      "9":"n",
      "10":"n",
      "11":"n",
      "12":"n",
      "13":"n",
      "14":"n",
      "15":"n",
      "16":"n",
      "17":"n",
      "18":"n",
      "19":"n",
      "20":"n",
      "21":"n",
      "22":"y x",
      "23":"y x",
      "24":"y x",
      "25":"y x",
      "26":"y x",
      "27":"y x",
      "28":"y x",
      "29":"y x",
      "30":"y x",
      "31":"y x",
      "32":"y x",
      "33":"y x",
      "34":"y x",
      "35":"y x",
      "36":"y x",
      "37":"y x",
      "38":"y x"
    },
    "safari":{
      "3.1":"n",
      "3.2":"n",
      "4":"n",
      "5":"n",
      "5.1":"n",
      "6":"n",
      "6.1":"y x",
      "7":"y x",
      "8":"y x"
    },
    "opera":{
      "9":"n",
      "9.5-9.6":"n",
      "10.0-10.1":"n",
      "10.5":"n",
      "10.6":"n",
      "11":"n",
      "11.1":"n",
      "11.5":"n",
      "11.6":"n",
      "12":"n",
      "12.1":"n",
      "15":"y x",
      "16":"y x",
      "17":"y x",
      "18":"y x",
      "19":"y x",
      "20":"y x",
      "21":"y x",
      "22":"y x",
      "23":"y x",
      "24":"y x"
    },
    "ios_saf":{
      "3.2":"n",
      "4.0-4.1":"n",
      "4.2-4.3":"n",
      "5.0-5.1":"n",
      "6.0-6.1":"n",
      "7.0-7.1":"y x",
      "8":"y x"
    },
    "op_mini":{
      "5.0-7.0":"n"
    },
    "android":{
      "2.1":"n",
      "2.2":"n",
      "2.3":"n",
      "3":"n",
      "4":"n",
      "4.1":"n",
      "4.2-4.3":"n",
      "4.4":"y x",
      "4.4.3":"y x"
    },
    "bb":{
      "7":"n",
      "10":"y x"
    },
    "op_mob":{
      "10":"n",
      "11":"n",
      "11.1":"n",
      "11.5":"n",
      "12":"n",
      "12.1":"n",
      "0":"y x"
    },
    "and_chr":{
      "0":"y x"
    },
    "and_ff":{
      "0":"y x"
    },
    "ie_mob":{
      "10":"n"
    }
  },
  "notes":"Prefixes are on the values, not the property names (e.g. -webkit-min-content) Firefox currently supports the \"-moz-available\" property rather than \"-moz-fill-available\".",
  "usage_perc_y":62.45,
  "usage_perc_a":0,
  "ucprefix":false,
  "parent":"",
  "keywords":"fill-available,max-content,min-content,fit-content,contain-floats",
  "shown":true
}
},{}],76:[function(require,module,exports){
module.exports={
  "title":"CSS3 Multiple column layout",
  "description":"Method of flowing information in multiple columns",
  "spec":"http://www.w3.org/TR/css3-multicol/",
  "status":"cr",
  "links":[
    {
      "url":"http://webdesign.tutsplus.com/tutorials/htmlcss-tutorials/an-introduction-to-the-css3-multiple-column-layout-module/",
      "title":"Introduction page"
    },
    {
      "url":"http://docs.webplatform.org/wiki/css/properties/column-width",
      "title":"WebPlatform Docs"
    },
    {
      "url":"http://dev.opera.com/articles/view/css3-multi-column-layout/",
      "title":"Dev.Opera article"
    }
  ],
  "bugs":[
    {
      "description":"In Firefox, the property column-span (or -moz-column-span) does not yet work. See the bug 616436 on Bugzilla: https://bugzilla.mozilla.org/show_bug.cgi?id=616436."
    }
  ],
  "categories":[
    "CSS3"
  ],
  "stats":{
    "ie":{
      "5.5":"n",
      "6":"n",
      "7":"n",
      "8":"n",
      "9":"n",
      "10":"y",
      "11":"y"
    },
    "firefox":{
      "2":"a x",
      "3":"a x",
      "3.5":"a x",
      "3.6":"a x",
      "4":"a x",
      "5":"a x",
      "6":"a x",
      "7":"a x",
      "8":"a x",
      "9":"a x",
      "10":"a x",
      "11":"a x",
      "12":"a x",
      "13":"a x",
      "14":"a x",
      "15":"a x",
      "16":"a x",
      "17":"a x",
      "18":"a x",
      "19":"a x",
      "20":"a x",
      "21":"a x",
      "22":"a x",
      "23":"a x",
      "24":"a x",
      "25":"a x",
      "26":"a x",
      "27":"a x",
      "28":"a x",
      "29":"a x",
      "30":"a x",
      "31":"a x",
      "32":"a x",
      "33":"a x"
    },
    "chrome":{
      "4":"a x",
      "5":"a x",
      "6":"a x",
      "7":"a x",
      "8":"a x",
      "9":"a x",
      "10":"a x",
      "11":"a x",
      "12":"a x",
      "13":"a x",
      "14":"a x",
      "15":"a x",
      "16":"a x",
      "17":"a x",
      "18":"a x",
      "19":"a x",
      "20":"a x",
      "21":"a x",
      "22":"a x",
      "23":"a x",
      "24":"a x",
      "25":"a x",
      "26":"a x",
      "27":"a x",
      "28":"a x",
      "29":"a x",
      "30":"a x",
      "31":"a x",
      "32":"a x",
      "33":"a x",
      "34":"a x",
      "35":"a x",
      "36":"a x",
      "37":"a x",
      "38":"a x"
    },
    "safari":{
      "3.1":"a x",
      "3.2":"a x",
      "4":"a x",
      "5":"a x",
      "5.1":"a x",
      "6":"a x",
      "6.1":"a x",
      "7":"a x",
      "8":"a x"
    },
    "opera":{
      "9":"n",
      "9.5-9.6":"n",
      "10.0-10.1":"n",
      "10.5":"n",
      "10.6":"n",
      "11":"n",
      "11.1":"y",
      "11.5":"y",
      "11.6":"y",
      "12":"y",
      "12.1":"y",
      "15":"a x",
      "16":"a x",
      "17":"a x",
      "18":"a x",
      "19":"a x",
      "20":"a x",
      "21":"a x",
      "22":"a x",
      "23":"a x",
      "24":"a x"
    },
    "ios_saf":{
      "3.2":"a x",
      "4.0-4.1":"a x",
      "4.2-4.3":"a x",
      "5.0-5.1":"a x",
      "6.0-6.1":"a x",
      "7.0-7.1":"a x",
      "8":"a x"
    },
    "op_mini":{
      "5.0-7.0":"y"
    },
    "android":{
      "2.1":"a x",
      "2.2":"a x",
      "2.3":"a x",
      "3":"a x",
      "4":"a x",
      "4.1":"a x",
      "4.2-4.3":"a x",
      "4.4":"a x",
      "4.4.3":"a x"
    },
    "bb":{
      "7":"a x",
      "10":"a x"
    },
    "op_mob":{
      "10":"n",
      "11":"n",
      "11.1":"y",
      "11.5":"y",
      "12":"y",
      "12.1":"y",
      "0":"a x"
    },
    "and_chr":{
      "0":"a x"
    },
    "and_ff":{
      "0":"a x"
    },
    "ie_mob":{
      "10":"y"
    }
  },
  "notes":"Partial support refers to not supporting the break-before, break-after, break-inside properties. Webkit browsers do have equivalent support for the non-standard -webkit-column-break-* properties.",
  "usage_perc_y":13.87,
  "usage_perc_a":72.05,
  "ucprefix":false,
  "parent":"",
  "keywords":"column-count",
  "shown":true
}
},{}],77:[function(require,module,exports){
module.exports={
  "title":"Pointer events",
  "description":"This specification integrates various inputs from mice, touchscreens, and pens, making separate implementations no longer necessary and authoring for cross-device pointers easier. Not to be mistaken with the unrelated \"pointer-events\" CSS property.",
  "spec":"http://www.w3.org/TR/pointerevents/",
  "status":"cr",
  "links":[
    {
      "url":"http://blogs.msdn.com/b/ie/archive/2011/09/20/touch-input-for-ie10-and-metro-style-apps.aspx",
      "title":"Implementation of Pointer Events in IE10"
    },
    {
      "url":"http://blogs.msdn.com/b/davrous/archive/2013/02/20/handling-touch-in-your-html5-apps-thanks-to-the-pointer-events-of-ie10-and-windows-8.aspx",
      "title":"Article & tutorial"
    },
    {
      "url":"http://blogs.msdn.com/b/eternalcoding/archive/2013/01/16/hand-js-a-polyfill-for-supporting-pointer-events-on-every-browser.aspx",
      "title":"Hand.js, the polyfill for browsers only supporting Touch Events"
    }
  ],
  "bugs":[
    
  ],
  "categories":[
    "JS API",
    "DOM"
  ],
  "stats":{
    "ie":{
      "5.5":"n",
      "6":"n",
      "7":"n",
      "8":"n",
      "9":"n",
      "10":"a x",
      "11":"y"
    },
    "firefox":{
      "2":"n",
      "3":"n",
      "3.5":"n",
      "3.6":"n",
      "4":"n",
      "5":"n",
      "6":"p",
      "7":"p",
      "8":"p",
      "9":"p",
      "10":"p",
      "11":"p",
      "12":"p",
      "13":"p",
      "14":"p",
      "15":"p",
      "16":"p",
      "17":"p",
      "18":"p",
      "19":"p",
      "20":"p",
      "21":"p",
      "22":"p",
      "23":"p",
      "24":"p",
      "25":"p",
      "26":"p",
      "27":"p",
      "28":"p",
      "29":"p",
      "30":"p",
      "31":"p",
      "32":"p",
      "33":"p"
    },
    "chrome":{
      "4":"n",
      "5":"n",
      "6":"n",
      "7":"n",
      "8":"n",
      "9":"n",
      "10":"n",
      "11":"n",
      "12":"n",
      "13":"n",
      "14":"n",
      "15":"n",
      "16":"n",
      "17":"n",
      "18":"n",
      "19":"n",
      "20":"n",
      "21":"n",
      "22":"p",
      "23":"p",
      "24":"p",
      "25":"p",
      "26":"p",
      "27":"p",
      "28":"p",
      "29":"p",
      "30":"p",
      "31":"p",
      "32":"p",
      "33":"p",
      "34":"p",
      "35":"p",
      "36":"p",
      "37":"p",
      "38":"p"
    },
    "safari":{
      "3.1":"n",
      "3.2":"n",
      "4":"n",
      "5":"n",
      "5.1":"n",
      "6":"n",
      "6.1":"u",
      "7":"u",
      "8":"u"
    },
    "opera":{
      "9":"n",
      "9.5-9.6":"n",
      "10.0-10.1":"n",
      "10.5":"n",
      "10.6":"n",
      "11":"n",
      "11.1":"n",
      "11.5":"n",
      "11.6":"n",
      "12":"n",
      "12.1":"n",
      "15":"p",
      "16":"p",
      "17":"p",
      "18":"p",
      "19":"p",
      "20":"p",
      "21":"p",
      "22":"p",
      "23":"p",
      "24":"p"
    },
    "ios_saf":{
      "3.2":"p",
      "4.0-4.1":"p",
      "4.2-4.3":"p",
      "5.0-5.1":"p",
      "6.0-6.1":"p",
      "7.0-7.1":"p",
      "8":"p"
    },
    "op_mini":{
      "5.0-7.0":"n"
    },
    "android":{
      "2.1":"p",
      "2.2":"p",
      "2.3":"p",
      "3":"p",
      "4":"p",
      "4.1":"p",
      "4.2-4.3":"p",
      "4.4":"p",
      "4.4.3":"p"
    },
    "bb":{
      "7":"p",
      "10":"p"
    },
    "op_mob":{
      "10":"n",
      "11":"p",
      "11.1":"p",
      "11.5":"p",
      "12":"p",
      "12.1":"p",
      "0":"p"
    },
    "and_chr":{
      "0":"p"
    },
    "and_ff":{
      "0":"p"
    },
    "ie_mob":{
      "10":"a x"
    }
  },
  "notes":"Partial support in IE10 refers the lack of pointerenter and pointerleave events. Firefox Nightly provides 'dom.w3c_pointer_events.enabled' option to support this specification starting with version 28.",
  "usage_perc_y":7.18,
  "usage_perc_a":3.04,
  "ucprefix":false,
  "parent":"",
  "keywords":"pointerdown,pointermove,pointerup,pointercancel,pointerover,pointerout,pointerenter,pointerleave",
  "shown":true
}
},{}],78:[function(require,module,exports){
module.exports={
  "title":"text-decoration styling",
  "description":"Method of defining the type, style and color of lines in the text-decoration property.",
  "spec":"http://www.w3.org/TR/css-text-decor-3/#line-decoration",
  "status":"cr",
  "links":[
    {
      "url":"https://developer.mozilla.org/en-US/docs/Web/CSS/text-decoration-color",
      "title":"MDN Documentation for text-decoration-color"
    },
    {
      "url":"https://developer.mozilla.org/en-US/docs/Web/CSS/text-decoration-style",
      "title":"MDN Documentation for text-decoration-style"
    },
    {
      "url":"https://developer.mozilla.org/en-US/docs/Web/CSS/text-decoration-line",
      "title":"MDN Documentation for text-decoration-line"
    }
  ],
  "bugs":[
    
  ],
  "categories":[
    "CSS3"
  ],
  "stats":{
    "ie":{
      "5.5":"n",
      "6":"n",
      "7":"n",
      "8":"n",
      "9":"n",
      "10":"n",
      "11":"n"
    },
    "firefox":{
      "2":"n",
      "3":"n",
      "3.5":"n",
      "3.6":"n",
      "4":"n",
      "5":"n",
      "6":"y x",
      "7":"y x",
      "8":"y x",
      "9":"y x",
      "10":"y x",
      "11":"y x",
      "12":"y x",
      "13":"y x",
      "14":"y x",
      "15":"y x",
      "16":"y x",
      "17":"y x",
      "18":"y x",
      "19":"y x",
      "20":"y x",
      "21":"y x",
      "22":"y x",
      "23":"y x",
      "24":"y x",
      "25":"y x",
      "26":"y x",
      "27":"y x",
      "28":"y x",
      "29":"y x",
      "30":"y x",
      "31":"y x",
      "32":"y x",
      "33":"y x"
    },
    "chrome":{
      "4":"n",
      "5":"n",
      "6":"n",
      "7":"n",
      "8":"n",
      "9":"n",
      "10":"n",
      "11":"n",
      "12":"n",
      "13":"n",
      "14":"n",
      "15":"n",
      "16":"n",
      "17":"n",
      "18":"n",
      "19":"n",
      "20":"n",
      "21":"n",
      "22":"n",
      "23":"n",
      "24":"n",
      "25":"n",
      "26":"n",
      "27":"n",
      "28":"n",
      "29":"n",
      "30":"n",
      "31":"n",
      "32":"n",
      "33":"n",
      "34":"n",
      "35":"n",
      "36":"n",
      "37":"n",
      "38":"n"
    },
    "safari":{
      "3.1":"n",
      "3.2":"n",
      "4":"n",
      "5":"n",
      "5.1":"n",
      "6":"n",
      "6.1":"n",
      "7":"n",
      "8":"n"
    },
    "opera":{
      "9":"n",
      "9.5-9.6":"n",
      "10.0-10.1":"n",
      "10.5":"n",
      "10.6":"n",
      "11":"n",
      "11.1":"n",
      "11.5":"n",
      "11.6":"n",
      "12":"n",
      "12.1":"n",
      "15":"n",
      "16":"n",
      "17":"n",
      "18":"n",
      "19":"n",
      "20":"n",
      "21":"n",
      "22":"n",
      "23":"n",
      "24":"n"
    },
    "ios_saf":{
      "3.2":"n",
      "4.0-4.1":"n",
      "4.2-4.3":"n",
      "5.0-5.1":"n",
      "6.0-6.1":"n",
      "7.0-7.1":"n",
      "8":"n"
    },
    "op_mini":{
      "5.0-7.0":"n"
    },
    "android":{
      "2.1":"n",
      "2.2":"n",
      "2.3":"n",
      "3":"n",
      "4":"n",
      "4.1":"n",
      "4.2-4.3":"n",
      "4.4":"n",
      "4.4.3":"n"
    },
    "bb":{
      "7":"n",
      "10":"n"
    },
    "op_mob":{
      "10":"n",
      "11":"n",
      "11.1":"n",
      "11.5":"n",
      "12":"n",
      "12.1":"n",
      "0":"n"
    },
    "and_chr":{
      "0":"n"
    },
    "and_ff":{
      "0":"y x"
    },
    "ie_mob":{
      "10":"n"
    }
  },
  "notes":"Support for the -webkit-text-decoration-style property can be enabled for Chrome and Opera with the \"Experimental Web Platform features\" flag.  ",
  "usage_perc_y":13.86,
  "usage_perc_a":0,
  "ucprefix":false,
  "parent":"",
  "keywords":"text-decoration-line,text-decoration-style,text-decoration-color",
  "shown":true
}
},{}],79:[function(require,module,exports){
module.exports={
  "title":"CSS text-size-adjust",
  "description":"On mobile devices, the text-size-adjust CSS property allows Web authors to control if and how the text-inflating algorithm is applied to the textual content of the element it is applied to.",
  "spec":"http://dev.w3.org/csswg/css-size-adjust/",
  "status":"wd",
  "links":[
    {
      "url":"https://developer.mozilla.org/en-US/docs/Web/CSS/text-size-adjust",
      "title":"MDN Docs"
    }
  ],
  "bugs":[
    {
      "description":"There is a bug in Webkit-based desktop browsers. If -webkit-text-size-adjust is explicitely set to none, Webkit-based desktop browsers, like Chrome or Safari, instead of ignoring the property, will prevent the user to zoom in or out the Web page."
    },
    {
      "description":"If the viewport in IE Phone is set using &lt;meta> element, the value of the CSS text-size-adjust property is ignored."
    }
  ],
  "categories":[
    "CSS3"
  ],
  "stats":{
    "ie":{
      "5.5":"n",
      "6":"n",
      "7":"n",
      "8":"n",
      "9":"n",
      "10":"n",
      "11":"n"
    },
    "firefox":{
      "2":"n",
      "3":"n",
      "3.5":"n",
      "3.6":"n",
      "4":"n",
      "5":"n",
      "6":"n",
      "7":"n",
      "8":"n",
      "9":"n",
      "10":"n",
      "11":"n",
      "12":"n",
      "13":"n",
      "14":"n",
      "15":"n",
      "16":"n",
      "17":"n",
      "18":"n",
      "19":"n",
      "20":"n",
      "21":"n",
      "22":"n",
      "23":"n",
      "24":"n",
      "25":"n",
      "26":"n",
      "27":"n",
      "28":"n",
      "29":"n",
      "30":"n",
      "31":"n",
      "32":"n",
      "33":"n"
    },
    "chrome":{
      "4":"n",
      "5":"n",
      "6":"n",
      "7":"n",
      "8":"n",
      "9":"n",
      "10":"n",
      "11":"n",
      "12":"n",
      "13":"n",
      "14":"n",
      "15":"n",
      "16":"n",
      "17":"n",
      "18":"n",
      "19":"n",
      "20":"n",
      "21":"n",
      "22":"n",
      "23":"n",
      "24":"n",
      "25":"n",
      "26":"n",
      "27":"n",
      "28":"n",
      "29":"n",
      "30":"n",
      "31":"n",
      "32":"n",
      "33":"n",
      "34":"n",
      "35":"n",
      "36":"n",
      "37":"n",
      "38":"n"
    },
    "safari":{
      "3.1":"n",
      "3.2":"n",
      "4":"n",
      "5":"n",
      "5.1":"n",
      "6":"n",
      "6.1":"n",
      "7":"n",
      "8":"n"
    },
    "opera":{
      "9":"n",
      "9.5-9.6":"n",
      "10.0-10.1":"n",
      "10.5":"n",
      "10.6":"n",
      "11":"n",
      "11.1":"n",
      "11.5":"n",
      "11.6":"n",
      "12":"n",
      "12.1":"n",
      "15":"n",
      "16":"n",
      "17":"n",
      "18":"n",
      "19":"n",
      "20":"n",
      "21":"n",
      "22":"n",
      "23":"n",
      "24":"n"
    },
    "ios_saf":{
      "3.2":"n",
      "4.0-4.1":"n",
      "4.2-4.3":"n",
      "5.0-5.1":"y x",
      "6.0-6.1":"y x",
      "7.0-7.1":"y x",
      "8":"y x"
    },
    "op_mini":{
      "5.0-7.0":"n"
    },
    "android":{
      "2.1":"n",
      "2.2":"n",
      "2.3":"n",
      "3":"n",
      "4":"n",
      "4.1":"n",
      "4.2-4.3":"n",
      "4.4":"n",
      "4.4.3":"n"
    },
    "bb":{
      "7":"n",
      "10":"n"
    },
    "op_mob":{
      "10":"n",
      "11":"n",
      "11.1":"n",
      "11.5":"n",
      "12":"n",
      "12.1":"n",
      "0":"n"
    },
    "and_chr":{
      "0":"n"
    },
    "and_ff":{
      "0":"y x"
    },
    "ie_mob":{
      "10":"y x"
    }
  },
  "notes":"",
  "usage_perc_y":7.14,
  "usage_perc_a":0,
  "ucprefix":false,
  "parent":"",
  "keywords":"",
  "shown":true
}
},{}],80:[function(require,module,exports){
module.exports={
  "title":"CSS3 Transforms",
  "description":"Method of transforming an element including rotating, scaling, etc.",
  "spec":"http://www.w3.org/TR/css3-2d-transforms/",
  "status":"wd",
  "links":[
    {
      "url":"https://raw.github.com/phiggins42/has.js/master/detect/css.js#css-transform",
      "title":"has.js test"
    },
    {
      "url":"https://developer.mozilla.org/en/CSS/-moz-transform",
      "title":"MDN article"
    },
    {
      "url":"http://www.westciv.com/tools/transforms/",
      "title":"Live editor"
    },
    {
      "url":"http://www.webresourcesdepot.com/cross-browser-css-transforms-csssandpaper/",
      "title":"Workaround script for IE"
    },
    {
      "url":"http://www.css3files.com/transform/",
      "title":"Information page"
    },
    {
      "url":"http://www.useragentman.com/IETransformsTranslator/",
      "title":"Converter for IE"
    },
    {
      "url":"http://docs.webplatform.org/wiki/css/transforms/transform",
      "title":"WebPlatform Docs"
    }
  ],
  "bugs":[
    {
      "description":"Scaling transforms in Android 2.3 fails to scale element background images."
    },
    {
      "description":"IE doesn't support CSS transforms on SVG elements (version 11 or prior)."
    },
    {
      "description":"Transforms may break position:fixed styles of contained elements"
    }
  ],
  "categories":[
    "CSS3"
  ],
  "stats":{
    "ie":{
      "5.5":"n",
      "6":"p",
      "7":"p",
      "8":"p",
      "9":"y x",
      "10":"y",
      "11":"y"
    },
    "firefox":{
      "2":"n",
      "3":"n",
      "3.5":"y x",
      "3.6":"y x",
      "4":"y x",
      "5":"y x",
      "6":"y x",
      "7":"y x",
      "8":"y x",
      "9":"y x",
      "10":"y x",
      "11":"y x",
      "12":"y x",
      "13":"y x",
      "14":"y x",
      "15":"y x",
      "16":"y",
      "17":"y",
      "18":"y",
      "19":"y",
      "20":"y",
      "21":"y",
      "22":"y",
      "23":"y",
      "24":"y",
      "25":"y",
      "26":"y",
      "27":"y",
      "28":"y",
      "29":"y",
      "30":"y",
      "31":"y",
      "32":"y",
      "33":"y"
    },
    "chrome":{
      "4":"y x",
      "5":"y x",
      "6":"y x",
      "7":"y x",
      "8":"y x",
      "9":"y x",
      "10":"y x",
      "11":"y x",
      "12":"y x",
      "13":"y x",
      "14":"y x",
      "15":"y x",
      "16":"y x",
      "17":"y x",
      "18":"y x",
      "19":"y x",
      "20":"y x",
      "21":"y x",
      "22":"y x",
      "23":"y x",
      "24":"y x",
      "25":"y x",
      "26":"y x",
      "27":"y x",
      "28":"y x",
      "29":"y x",
      "30":"y x",
      "31":"y x",
      "32":"y x",
      "33":"y x",
      "34":"y x",
      "35":"y x",
      "36":"y",
      "37":"y",
      "38":"y"
    },
    "safari":{
      "3.1":"y x",
      "3.2":"y x",
      "4":"y x",
      "5":"y x",
      "5.1":"y x",
      "6":"y x",
      "6.1":"y x",
      "7":"y x",
      "8":"y x"
    },
    "opera":{
      "9":"n",
      "9.5-9.6":"n",
      "10.0-10.1":"n",
      "10.5":"y x",
      "10.6":"y x",
      "11":"y x",
      "11.1":"y x",
      "11.5":"y x",
      "11.6":"y x",
      "12":"y x",
      "12.1":"y",
      "15":"y x",
      "16":"y x",
      "17":"y x",
      "18":"y x",
      "19":"y x",
      "20":"y x",
      "21":"y x",
      "22":"y x",
      "23":"y",
      "24":"y"
    },
    "ios_saf":{
      "3.2":"y x",
      "4.0-4.1":"y x",
      "4.2-4.3":"y x",
      "5.0-5.1":"y x",
      "6.0-6.1":"y x",
      "7.0-7.1":"y x",
      "8":"y x"
    },
    "op_mini":{
      "5.0-7.0":"n"
    },
    "android":{
      "2.1":"y x",
      "2.2":"y x",
      "2.3":"y x",
      "3":"y x",
      "4":"y x",
      "4.1":"y x",
      "4.2-4.3":"y x",
      "4.4":"y x",
      "4.4.3":"y x"
    },
    "bb":{
      "7":"y x",
      "10":"y x"
    },
    "op_mob":{
      "10":"n",
      "11":"y",
      "11.1":"y",
      "11.5":"y",
      "12":"y",
      "12.1":"y",
      "0":"y x"
    },
    "and_chr":{
      "0":"y x"
    },
    "and_ff":{
      "0":"y"
    },
    "ie_mob":{
      "10":"y"
    }
  },
  "notes":"The scale transform can be emulated in IE < 9 using Microsoft's \"zoom\" extension, others are (not easily) possible using the MS Matrix filter",
  "usage_perc_y":85.27,
  "usage_perc_a":0,
  "ucprefix":false,
  "parent":"",
  "keywords":"transformation,translate,rotation,rotate,scale,css-transforms",
  "shown":true
}
},{}],81:[function(require,module,exports){
module.exports={
  "title":"CSS3 3D Transforms",
  "description":"Method of transforming an element in the third dimension",
  "spec":"http://www.w3.org/TR/css3-3d-transforms/",
  "status":"wd",
  "links":[
    {
      "url":"http://css3.bradshawenterprises.com/flip/",
      "title":"Multi-browser demo"
    },
    {
      "url":"http://thewebrocks.com/demos/3D-css-tester/",
      "title":"3D CSS Tester"
    },
    {
      "url":"http://hacks.mozilla.org/2011/10/css-3d-transformations-in-firefox-nightly/",
      "title":"Mozilla hacks article"
    },
    {
      "url":"https://raw.github.com/phiggins42/has.js/master/detect/css.js#css-transform",
      "title":"has.js test"
    },
    {
      "url":"http://docs.webplatform.org/wiki/css/transforms/transform",
      "title":"WebPlatform Docs"
    }
  ],
  "bugs":[
    {
      "description":"Some configurations of Linux (those without WebGL support) have trouble with 3D transforms and will treat them as if \"perspective\" was set as \"none\" using Chrome."
    }
  ],
  "categories":[
    "CSS3"
  ],
  "stats":{
    "ie":{
      "5.5":"n",
      "6":"n",
      "7":"n",
      "8":"n",
      "9":"n",
      "10":"a",
      "11":"a"
    },
    "firefox":{
      "2":"n",
      "3":"n",
      "3.5":"n",
      "3.6":"n",
      "4":"n",
      "5":"n",
      "6":"n",
      "7":"n",
      "8":"n",
      "9":"n",
      "10":"y x",
      "11":"y x",
      "12":"y x",
      "13":"y x",
      "14":"y x",
      "15":"y x",
      "16":"y",
      "17":"y",
      "18":"y",
      "19":"y",
      "20":"y",
      "21":"y",
      "22":"y",
      "23":"y",
      "24":"y",
      "25":"y",
      "26":"y",
      "27":"y",
      "28":"y",
      "29":"y",
      "30":"y",
      "31":"y",
      "32":"y",
      "33":"y"
    },
    "chrome":{
      "4":"n",
      "5":"n",
      "6":"n",
      "7":"n",
      "8":"n",
      "9":"n",
      "10":"n",
      "11":"n",
      "12":"y x",
      "13":"y x",
      "14":"y x",
      "15":"y x",
      "16":"y x",
      "17":"y x",
      "18":"y x",
      "19":"y x",
      "20":"y x",
      "21":"y x",
      "22":"y x",
      "23":"y x",
      "24":"y x",
      "25":"y x",
      "26":"y x",
      "27":"y x",
      "28":"y x",
      "29":"y x",
      "30":"y x",
      "31":"y x",
      "32":"y x",
      "33":"y x",
      "34":"y x",
      "35":"y x",
      "36":"y",
      "37":"y",
      "38":"y"
    },
    "safari":{
      "3.1":"n",
      "3.2":"n",
      "4":"y x",
      "5":"y x",
      "5.1":"y x",
      "6":"y x",
      "6.1":"y x",
      "7":"y x",
      "8":"y x"
    },
    "opera":{
      "9":"n",
      "9.5-9.6":"n",
      "10.0-10.1":"n",
      "10.5":"n",
      "10.6":"n",
      "11":"n",
      "11.1":"n",
      "11.5":"n",
      "11.6":"n",
      "12":"n",
      "12.1":"n",
      "15":"y x",
      "16":"y x",
      "17":"y x",
      "18":"y x",
      "19":"y x",
      "20":"y x",
      "21":"y x",
      "22":"y x",
      "23":"y",
      "24":"y"
    },
    "ios_saf":{
      "3.2":"y x",
      "4.0-4.1":"y x",
      "4.2-4.3":"y x",
      "5.0-5.1":"y x",
      "6.0-6.1":"y x",
      "7.0-7.1":"y x",
      "8":"y x"
    },
    "op_mini":{
      "5.0-7.0":"n"
    },
    "android":{
      "2.1":"n",
      "2.2":"n",
      "2.3":"n",
      "3":"y x",
      "4":"y x",
      "4.1":"y x",
      "4.2-4.3":"y x",
      "4.4":"y x",
      "4.4.3":"y x"
    },
    "bb":{
      "7":"y x",
      "10":"y x"
    },
    "op_mob":{
      "10":"n",
      "11":"n",
      "11.1":"n",
      "11.5":"n",
      "12":"n",
      "12.1":"n",
      "0":"y x"
    },
    "and_chr":{
      "0":"y x"
    },
    "and_ff":{
      "0":"y"
    },
    "ie_mob":{
      "10":"a"
    }
  },
  "notes":"Partial support in IE refers to not supporting <a href=\"http://msdn.microsoft.com/en-us/library/ie/hh673529%28v=vs.85%29.aspx#the_ms_transform_style_property\">the transform-style: preserve-3d property</a>. This prevents nesting 3D transformed elements.",
  "usage_perc_y":70.24,
  "usage_perc_a":10.22,
  "ucprefix":false,
  "parent":"",
  "keywords":"css 3d,3dtransforms,translate3d,transform3d",
  "shown":true
}
},{}],82:[function(require,module,exports){
module.exports={
  "title":"CSS user-select: none",
  "description":"Method of preventing text/element selection using CSS. ",
  "spec":"https://developer.mozilla.org/en-US/docs/CSS/user-select",
  "status":"unoff",
  "links":[
    {
      "url":"http://css-tricks.com/almanac/properties/u/user-select/",
      "title":"CSS Tricks article"
    },
    {
      "url":"http://msdn.microsoft.com/en-us/library/ie/hh781492(v=vs.85).aspx",
      "title":"MSDN Documentation"
    },
    {
      "url":"https://developer.mozilla.org/en-US/docs/CSS/user-select",
      "title":"MDN article"
    }
  ],
  "bugs":[
    
  ],
  "categories":[
    "CSS"
  ],
  "stats":{
    "ie":{
      "5.5":"n",
      "6":"n",
      "7":"n",
      "8":"n",
      "9":"n",
      "10":"y x",
      "11":"y x"
    },
    "firefox":{
      "2":"y x",
      "3":"y x",
      "3.5":"y x",
      "3.6":"y x",
      "4":"y x",
      "5":"y x",
      "6":"y x",
      "7":"y x",
      "8":"y x",
      "9":"y x",
      "10":"y x",
      "11":"y x",
      "12":"y x",
      "13":"y x",
      "14":"y x",
      "15":"y x",
      "16":"y x",
      "17":"y x",
      "18":"y x",
      "19":"y x",
      "20":"y x",
      "21":"y x",
      "22":"y x",
      "23":"y x",
      "24":"y x",
      "25":"y x",
      "26":"y x",
      "27":"y x",
      "28":"y x",
      "29":"y x",
      "30":"y x",
      "31":"y x",
      "32":"y x",
      "33":"y x"
    },
    "chrome":{
      "4":"u",
      "5":"u",
      "6":"y x",
      "7":"y x",
      "8":"y x",
      "9":"y x",
      "10":"y x",
      "11":"y x",
      "12":"y x",
      "13":"y x",
      "14":"y x",
      "15":"y x",
      "16":"y x",
      "17":"y x",
      "18":"y x",
      "19":"y x",
      "20":"y x",
      "21":"y x",
      "22":"y x",
      "23":"y x",
      "24":"y x",
      "25":"y x",
      "26":"y x",
      "27":"y x",
      "28":"y x",
      "29":"y x",
      "30":"y x",
      "31":"y x",
      "32":"y x",
      "33":"y x",
      "34":"y x",
      "35":"y x",
      "36":"y x",
      "37":"y x",
      "38":"y x"
    },
    "safari":{
      "3.1":"y x",
      "3.2":"y x",
      "4":"y x",
      "5":"y x",
      "5.1":"y x",
      "6":"y x",
      "6.1":"y x",
      "7":"y x",
      "8":"y x"
    },
    "opera":{
      "9":"n",
      "9.5-9.6":"n",
      "10.0-10.1":"n",
      "10.5":"n",
      "10.6":"n",
      "11":"n",
      "11.1":"n",
      "11.5":"n",
      "11.6":"n",
      "12":"n",
      "12.1":"n",
      "15":"y x",
      "16":"y x",
      "17":"y x",
      "18":"y x",
      "19":"y x",
      "20":"y x",
      "21":"y x",
      "22":"y x",
      "23":"y x",
      "24":"y x"
    },
    "ios_saf":{
      "3.2":"y x",
      "4.0-4.1":"y x",
      "4.2-4.3":"y x",
      "5.0-5.1":"y x",
      "6.0-6.1":"y x",
      "7.0-7.1":"y x",
      "8":"y x"
    },
    "op_mini":{
      "5.0-7.0":"n"
    },
    "android":{
      "2.1":"y x",
      "2.2":"y x",
      "2.3":"y x",
      "3":"y x",
      "4":"y x",
      "4.1":"y x",
      "4.2-4.3":"y x",
      "4.4":"y x",
      "4.4.3":"y x"
    },
    "bb":{
      "7":"y x",
      "10":"y x"
    },
    "op_mob":{
      "10":"n",
      "11":"n",
      "11.1":"n",
      "11.5":"n",
      "12":"n",
      "12.1":"n",
      "0":"y x"
    },
    "and_chr":{
      "0":"y x"
    },
    "and_ff":{
      "0":"y x"
    },
    "ie_mob":{
      "10":"y x"
    }
  },
  "notes":"Currently the user-select property does not appear in any W3C specification. Support information here is only for \"none\" value, not others.",
  "usage_perc_y":82.23,
  "usage_perc_a":0,
  "ucprefix":false,
  "parent":"",
  "keywords":"",
  "shown":true
}
},{}],83:[function(require,module,exports){
module.exports = require('./lib/css-mqpacker');

},{"./lib/css-mqpacker":84}],84:[function(require,module,exports){
/* jshint node: true */
'use strict';

var postcss = require('postcss');

var _process = function (css) {
  var queries = {};
  var params = [];

  css.each(function (rule, i) {
    if (rule.type !== 'atrule' || rule.name !== 'media') {
      return true;
    }

    var query = rule.params;
    var past = queries[query];

    if (typeof past === 'object') {
      rule.each(function (r) {
        past.append(r);
      });
    } else {
      queries[query] = rule;
      params.push(query);
    }

    rule.removeSelf();
  });

  params.forEach(function (param) {
    css.append(queries[param]);
  });

  return css;
};

var _pack = function (css, opts) {
  return postcss().use(this.processor).process(css, opts);
};

exports.processor = _process;
exports.pack = _pack;

},{"postcss":129}],85:[function(require,module,exports){
module.exports = require('./lib/csswring');

},{"./lib/csswring":86}],86:[function(require,module,exports){
/* jshint node: true */
'use strict';

var postcss = require('postcss');
var onecolor = require('onecolor');

// Declaration
var _rePropString = /^(content|font-family)$/i;
var _rePropTwoZeros = /^(background-position|(-(moz|webkit|o|ms)-)?transform-origin)$/i;
var _reValueZero = /(^|\s)(0)(%|em|ex|ch|rem|vw|vh|vmin|vmax|cm|mm|in|pt|pc|px|deg|grad|rad|turn|s|ms|Hz|kHz|dpi|dpcm|dppx)/gi;
var _reValueSeriesOfZeros = /^0(\s0){1,3}$/;
var _reValueFloatWithZero = /(^|\s)0+\.(\d+)/g;
var _reValueColorFunction = /(^|\s)((?:rgb|hsl)\s*\(\s*(?:[\d.]+%?(?:\s*,\s*|\s*\))){3})/g;
var _reValueColorHex = /(^|\s)#([0-9a-f])([0-9a-f])([0-9a-f])([0-9a-f])([0-9a-f])([0-9a-f])/g;
var _toHex = function (m, space, color) {
  return space + onecolor(color).hex();
};
var _wringHex = function (m, space, r1, r2, g1, g2, b1, b2) {
  if (r1 === r2 && g1 === g2 && b1 === b2) {
    m = space + '#' + r1 + g1 + b1;
  }

  return m;
};

var _wringDecl = function (decl) {
  decl.before = '';
  decl.between = ':';
  var value = decl.value;

  if (!_rePropString.test(decl.prop)) {
    value = value.replace(_reValueZero, '$1$2');

    if (!_rePropTwoZeros.test(decl.prop)) {
      value = value.replace(_reValueSeriesOfZeros, '0');
    }

    value = value.replace(_reValueFloatWithZero, '$1.$2');
  }

  value = value.replace(_reValueColorFunction, _toHex);
  value = value.replace(_reValueColorHex, _wringHex);
  decl.value = value;
};

// Ruleset
var _isDecl = function (decl) {
  return (decl.type === 'decl');
};

var _wringRule = function (rule) {
  if (rule.decls.length === 0 || !rule.decls.some(_isDecl)) {
    rule.removeSelf();

    return;
  }

  rule.before = '';
  rule.selector = rule.selectors.join(',');
  rule.between = '';
  rule.semicolon = false;
  rule.after = '';
};

// At-Rule
var _metCharset = false;

var _wringAtRule = function (atRule) {
  if (atRule.name === 'charset') {
    if (_metCharset) {
      atRule.removeSelf();

      return;
    }

    _metCharset = true;
  }

  atRule.before = '';
  atRule.between = '';
  atRule.after = '';
};

// Comment
var _wringComment = function (comment) {
  if (comment.text.indexOf('!') !== 0 && comment.text.indexOf('#') !== 0) {
    comment.removeSelf();

    return;
  }

  comment.before = '';
};

// PostCSS Processor
exports.processor = function (css) {
  css.eachDecl(_wringDecl);
  css.eachRule(_wringRule);
  _metCharset = false;
  css.eachAtRule(_wringAtRule);
  css.eachComment(_wringComment);
  css.after = '';

  return css;
};

// Wring CSS codes
exports.wring = function (css, opts) {
  return postcss().use(this.processor).process(css, opts);
};

},{"onecolor":87,"postcss":129}],87:[function(require,module,exports){
/*jshint evil:true, onevar:false*/
/*global define*/
var installedColorSpaces = [],
    namedColors = {},
    undef = function (obj) {
        return typeof obj === 'undefined';
    },
    channelRegExp = /\s*(\.\d+|\d+(?:\.\d+)?)(%)?\s*/,
    alphaChannelRegExp = /\s*(\.\d+|\d+(?:\.\d+)?)\s*/,
    cssColorRegExp = new RegExp(
                         "^(rgb|hsl|hsv)a?" +
                         "\\(" +
                             channelRegExp.source + "," +
                             channelRegExp.source + "," +
                             channelRegExp.source +
                             "(?:," + alphaChannelRegExp.source + ")?" +
                         "\\)$", "i");

function ONECOLOR(obj) {
    if (Object.prototype.toString.apply(obj) === '[object Array]') {
        if (typeof obj[0] === 'string' && typeof ONECOLOR[obj[0]] === 'function') {
            // Assumed array from .toJSON()
            return new ONECOLOR[obj[0]](obj.slice(1, obj.length));
        } else if (obj.length === 4) {
            // Assumed 4 element int RGB array from canvas with all channels [0;255]
            return new ONECOLOR.RGB(obj[0] / 255, obj[1] / 255, obj[2] / 255, obj[3] / 255);
        }
    } else if (typeof obj === 'string') {
        var lowerCased = obj.toLowerCase();
        if (namedColors[lowerCased]) {
            obj = '#' + namedColors[lowerCased];
        }
        if (lowerCased === 'transparent') {
            obj = 'rgba(0,0,0,0)';
        }
        // Test for CSS rgb(....) string
        var matchCssSyntax = obj.match(cssColorRegExp);
        if (matchCssSyntax) {
            var colorSpaceName = matchCssSyntax[1].toUpperCase(),
                alpha = undef(matchCssSyntax[8]) ? matchCssSyntax[8] : parseFloat(matchCssSyntax[8]),
                hasHue = colorSpaceName[0] === 'H',
                firstChannelDivisor = matchCssSyntax[3] ? 100 : (hasHue ? 360 : 255),
                secondChannelDivisor = (matchCssSyntax[5] || hasHue) ? 100 : 255,
                thirdChannelDivisor = (matchCssSyntax[7] || hasHue) ? 100 : 255;
            if (undef(ONECOLOR[colorSpaceName])) {
                throw new Error("one.color." + colorSpaceName + " is not installed.");
            }
            return new ONECOLOR[colorSpaceName](
                parseFloat(matchCssSyntax[2]) / firstChannelDivisor,
                parseFloat(matchCssSyntax[4]) / secondChannelDivisor,
                parseFloat(matchCssSyntax[6]) / thirdChannelDivisor,
                alpha
            );
        }
        // Assume hex syntax
        if (obj.length < 6) {
            // Allow CSS shorthand
            obj = obj.replace(/^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i, '$1$1$2$2$3$3');
        }
        // Split obj into red, green, and blue components
        var hexMatch = obj.match(/^#?([0-9a-f][0-9a-f])([0-9a-f][0-9a-f])([0-9a-f][0-9a-f])$/i);
        if (hexMatch) {
            return new ONECOLOR.RGB(
                parseInt(hexMatch[1], 16) / 255,
                parseInt(hexMatch[2], 16) / 255,
                parseInt(hexMatch[3], 16) / 255
            );
        }
    } else if (typeof obj === 'object' && obj.isColor) {
        return obj;
    }
    return false;
}

function installColorSpace(colorSpaceName, propertyNames, config) {
    ONECOLOR[colorSpaceName] = new Function(propertyNames.join(","),
        // Allow passing an array to the constructor:
        "if (Object.prototype.toString.apply(" + propertyNames[0] + ") === '[object Array]') {" +
            propertyNames.map(function (propertyName, i) {
                return propertyName + "=" + propertyNames[0] + "[" + i + "];";
            }).reverse().join("") +
        "}" +
        "if (" + propertyNames.filter(function (propertyName) {
            return propertyName !== 'alpha';
        }).map(function (propertyName) {
            return "isNaN(" + propertyName + ")";
        }).join("||") + "){" + "throw new Error(\"[" + colorSpaceName + "]: Invalid color: (\"+" + propertyNames.join("+\",\"+") + "+\")\");}" +
        propertyNames.map(function (propertyName) {
            if (propertyName === 'hue') {
                return "this._hue=hue<0?hue-Math.floor(hue):hue%1"; // Wrap
            } else if (propertyName === 'alpha') {
                return "this._alpha=(isNaN(alpha)||alpha>1)?1:(alpha<0?0:alpha);";
            } else {
                return "this._" + propertyName + "=" + propertyName + "<0?0:(" + propertyName + ">1?1:" + propertyName + ")";
            }
        }).join(";") + ";"
    );
    ONECOLOR[colorSpaceName].propertyNames = propertyNames;

    var prototype = ONECOLOR[colorSpaceName].prototype;

    ['valueOf', 'hex', 'hexa', 'css', 'cssa'].forEach(function (methodName) {
        prototype[methodName] = prototype[methodName] || (colorSpaceName === 'RGB' ? prototype.hex : new Function("return this.rgb()." + methodName + "();"));
    });

    prototype.isColor = true;

    prototype.equals = function (otherColor, epsilon) {
        if (undef(epsilon)) {
            epsilon = 1e-10;
        }

        otherColor = otherColor[colorSpaceName.toLowerCase()]();

        for (var i = 0; i < propertyNames.length; i = i + 1) {
            if (Math.abs(this['_' + propertyNames[i]] - otherColor['_' + propertyNames[i]]) > epsilon) {
                return false;
            }
        }

        return true;
    };

    prototype.toJSON = new Function(
        "return ['" + colorSpaceName + "', " +
            propertyNames.map(function (propertyName) {
                return "this._" + propertyName;
            }, this).join(", ") +
        "];"
    );

    for (var propertyName in config) {
        if (config.hasOwnProperty(propertyName)) {
            var matchFromColorSpace = propertyName.match(/^from(.*)$/);
            if (matchFromColorSpace) {
                ONECOLOR[matchFromColorSpace[1].toUpperCase()].prototype[colorSpaceName.toLowerCase()] = config[propertyName];
            } else {
                prototype[propertyName] = config[propertyName];
            }
        }
    }

    // It is pretty easy to implement the conversion to the same color space:
    prototype[colorSpaceName.toLowerCase()] = function () {
        return this;
    };
    prototype.toString = new Function("return \"[one.color." + colorSpaceName + ":\"+" + propertyNames.map(function (propertyName, i) {
        return "\" " + propertyNames[i] + "=\"+this._" + propertyName;
    }).join("+") + "+\"]\";");

    // Generate getters and setters
    propertyNames.forEach(function (propertyName, i) {
        prototype[propertyName] = prototype[propertyName === 'black' ? 'k' : propertyName[0]] = new Function("value", "isDelta",
            // Simple getter mode: color.red()
            "if (typeof value === 'undefined') {" +
                "return this._" + propertyName + ";" +
            "}" +
            // Adjuster: color.red(+.2, true)
            "if (isDelta) {" +
                "return new this.constructor(" + propertyNames.map(function (otherPropertyName, i) {
                    return "this._" + otherPropertyName + (propertyName === otherPropertyName ? "+value" : "");
                }).join(", ") + ");" +
            "}" +
            // Setter: color.red(.2);
            "return new this.constructor(" + propertyNames.map(function (otherPropertyName, i) {
                return propertyName === otherPropertyName ? "value" : "this._" + otherPropertyName;
            }).join(", ") + ");");
    });

    function installForeignMethods(targetColorSpaceName, sourceColorSpaceName) {
        var obj = {};
        obj[sourceColorSpaceName.toLowerCase()] = new Function("return this.rgb()." + sourceColorSpaceName.toLowerCase() + "();"); // Fallback
        ONECOLOR[sourceColorSpaceName].propertyNames.forEach(function (propertyName, i) {
            obj[propertyName] = obj[propertyName === 'black' ? 'k' : propertyName[0]] = new Function("value", "isDelta", "return this." + sourceColorSpaceName.toLowerCase() + "()." + propertyName + "(value, isDelta);");
        });
        for (var prop in obj) {
            if (obj.hasOwnProperty(prop) && ONECOLOR[targetColorSpaceName].prototype[prop] === undefined) {
                ONECOLOR[targetColorSpaceName].prototype[prop] = obj[prop];
            }
        }
    }

    installedColorSpaces.forEach(function (otherColorSpaceName) {
        installForeignMethods(colorSpaceName, otherColorSpaceName);
        installForeignMethods(otherColorSpaceName, colorSpaceName);
    });

    installedColorSpaces.push(colorSpaceName);
}

ONECOLOR.installMethod = function (name, fn) {
    installedColorSpaces.forEach(function (colorSpace) {
        ONECOLOR[colorSpace].prototype[name] = fn;
    });
};

installColorSpace('RGB', ['red', 'green', 'blue', 'alpha'], {
    hex: function () {
        var hexString = (Math.round(255 * this._red) * 0x10000 + Math.round(255 * this._green) * 0x100 + Math.round(255 * this._blue)).toString(16);
        return '#' + ('00000'.substr(0, 6 - hexString.length)) + hexString;
    },

    hexa: function () {
        var alphaString = Math.round(this._alpha * 255).toString(16);
        return '#' + '00'.substr(0, 2 - alphaString.length) + alphaString + this.hex().substr(1, 6);
    },

    css: function () {
        return "rgb(" + Math.round(255 * this._red) + "," + Math.round(255 * this._green) + "," + Math.round(255 * this._blue) + ")";
    },

    cssa: function () {
        return "rgba(" + Math.round(255 * this._red) + "," + Math.round(255 * this._green) + "," + Math.round(255 * this._blue) + "," + this._alpha + ")";
    }
});

if (typeof module !== 'undefined') {
    // Node module export
    module.exports = ONECOLOR;
} else if (typeof define === 'function' && !undef(define.amd)) {
    define([], function () {
        return ONECOLOR;
    });
} else {
    one = window.one || {};
    one.color = ONECOLOR;
}

if (typeof jQuery !== 'undefined' && undef(jQuery.color)) {
    jQuery.color = ONECOLOR;
}

/*global namedColors*/
namedColors = {
    aliceblue: 'f0f8ff',
    antiquewhite: 'faebd7',
    aqua: '0ff',
    aquamarine: '7fffd4',
    azure: 'f0ffff',
    beige: 'f5f5dc',
    bisque: 'ffe4c4',
    black: '000',
    blanchedalmond: 'ffebcd',
    blue: '00f',
    blueviolet: '8a2be2',
    brown: 'a52a2a',
    burlywood: 'deb887',
    cadetblue: '5f9ea0',
    chartreuse: '7fff00',
    chocolate: 'd2691e',
    coral: 'ff7f50',
    cornflowerblue: '6495ed',
    cornsilk: 'fff8dc',
    crimson: 'dc143c',
    cyan: '0ff',
    darkblue: '00008b',
    darkcyan: '008b8b',
    darkgoldenrod: 'b8860b',
    darkgray: 'a9a9a9',
    darkgrey: 'a9a9a9',
    darkgreen: '006400',
    darkkhaki: 'bdb76b',
    darkmagenta: '8b008b',
    darkolivegreen: '556b2f',
    darkorange: 'ff8c00',
    darkorchid: '9932cc',
    darkred: '8b0000',
    darksalmon: 'e9967a',
    darkseagreen: '8fbc8f',
    darkslateblue: '483d8b',
    darkslategray: '2f4f4f',
    darkslategrey: '2f4f4f',
    darkturquoise: '00ced1',
    darkviolet: '9400d3',
    deeppink: 'ff1493',
    deepskyblue: '00bfff',
    dimgray: '696969',
    dimgrey: '696969',
    dodgerblue: '1e90ff',
    firebrick: 'b22222',
    floralwhite: 'fffaf0',
    forestgreen: '228b22',
    fuchsia: 'f0f',
    gainsboro: 'dcdcdc',
    ghostwhite: 'f8f8ff',
    gold: 'ffd700',
    goldenrod: 'daa520',
    gray: '808080',
    grey: '808080',
    green: '008000',
    greenyellow: 'adff2f',
    honeydew: 'f0fff0',
    hotpink: 'ff69b4',
    indianred: 'cd5c5c',
    indigo: '4b0082',
    ivory: 'fffff0',
    khaki: 'f0e68c',
    lavender: 'e6e6fa',
    lavenderblush: 'fff0f5',
    lawngreen: '7cfc00',
    lemonchiffon: 'fffacd',
    lightblue: 'add8e6',
    lightcoral: 'f08080',
    lightcyan: 'e0ffff',
    lightgoldenrodyellow: 'fafad2',
    lightgray: 'd3d3d3',
    lightgrey: 'd3d3d3',
    lightgreen: '90ee90',
    lightpink: 'ffb6c1',
    lightsalmon: 'ffa07a',
    lightseagreen: '20b2aa',
    lightskyblue: '87cefa',
    lightslategray: '789',
    lightslategrey: '789',
    lightsteelblue: 'b0c4de',
    lightyellow: 'ffffe0',
    lime: '0f0',
    limegreen: '32cd32',
    linen: 'faf0e6',
    magenta: 'f0f',
    maroon: '800000',
    mediumaquamarine: '66cdaa',
    mediumblue: '0000cd',
    mediumorchid: 'ba55d3',
    mediumpurple: '9370d8',
    mediumseagreen: '3cb371',
    mediumslateblue: '7b68ee',
    mediumspringgreen: '00fa9a',
    mediumturquoise: '48d1cc',
    mediumvioletred: 'c71585',
    midnightblue: '191970',
    mintcream: 'f5fffa',
    mistyrose: 'ffe4e1',
    moccasin: 'ffe4b5',
    navajowhite: 'ffdead',
    navy: '000080',
    oldlace: 'fdf5e6',
    olive: '808000',
    olivedrab: '6b8e23',
    orange: 'ffa500',
    orangered: 'ff4500',
    orchid: 'da70d6',
    palegoldenrod: 'eee8aa',
    palegreen: '98fb98',
    paleturquoise: 'afeeee',
    palevioletred: 'd87093',
    papayawhip: 'ffefd5',
    peachpuff: 'ffdab9',
    peru: 'cd853f',
    pink: 'ffc0cb',
    plum: 'dda0dd',
    powderblue: 'b0e0e6',
    purple: '800080',
    red: 'f00',
    rosybrown: 'bc8f8f',
    royalblue: '4169e1',
    saddlebrown: '8b4513',
    salmon: 'fa8072',
    sandybrown: 'f4a460',
    seagreen: '2e8b57',
    seashell: 'fff5ee',
    sienna: 'a0522d',
    silver: 'c0c0c0',
    skyblue: '87ceeb',
    slateblue: '6a5acd',
    slategray: '708090',
    slategrey: '708090',
    snow: 'fffafa',
    springgreen: '00ff7f',
    steelblue: '4682b4',
    tan: 'd2b48c',
    teal: '008080',
    thistle: 'd8bfd8',
    tomato: 'ff6347',
    turquoise: '40e0d0',
    violet: 'ee82ee',
    wheat: 'f5deb3',
    white: 'fff',
    whitesmoke: 'f5f5f5',
    yellow: 'ff0',
    yellowgreen: '9acd32'
};

/*global INCLUDE, installColorSpace, ONECOLOR*/

installColorSpace('XYZ', ['x', 'y', 'z', 'alpha'], {
    fromRgb: function () {
        // http://www.easyrgb.com/index.php?X=MATH&H=02#text2
        var convert = function (channel) {
                return channel > 0.04045 ?
                    Math.pow((channel + 0.055) / 1.055, 2.4) :
                    channel / 12.92;
            },
            r = convert(this._red),
            g = convert(this._green),
            b = convert(this._blue);

        // Reference white point sRGB D65:
        // http://www.brucelindbloom.com/index.html?Eqn_RGB_XYZ_Matrix.html
        return new ONECOLOR.XYZ(
            r * 0.4124564 + g * 0.3575761 + b * 0.1804375,
            r * 0.2126729 + g * 0.7151522 + b * 0.0721750,
            r * 0.0193339 + g * 0.1191920 + b * 0.9503041,
            this._alpha
        );
    },

    rgb: function () {
        // http://www.easyrgb.com/index.php?X=MATH&H=01#text1
        var x = this._x,
            y = this._y,
            z = this._z,
            convert = function (channel) {
                return channel > 0.0031308 ?
                    1.055 * Math.pow(channel, 1 / 2.4) - 0.055 :
                    12.92 * channel;
            };

        // Reference white point sRGB D65:
        // http://www.brucelindbloom.com/index.html?Eqn_RGB_XYZ_Matrix.html
        return new ONECOLOR.RGB(
            convert(x *  3.2404542 + y * -1.5371385 + z * -0.4985314),
            convert(x * -0.9692660 + y *  1.8760108 + z *  0.0415560),
            convert(x *  0.0556434 + y * -0.2040259 + z *  1.0572252),
            this._alpha
        );
    },

    lab: function () {
        // http://www.easyrgb.com/index.php?X=MATH&H=07#text7
        var convert = function (channel) {
                return channel > 0.008856 ?
                    Math.pow(channel, 1 / 3) :
                    7.787037 * channel + 4 / 29;
            },
            x = convert(this._x /  95.047),
            y = convert(this._y / 100.000),
            z = convert(this._z / 108.883);

        return new ONECOLOR.LAB(
            (116 * y) - 16,
            500 * (x - y),
            200 * (y - z),
            this._alpha
        );
    }
});

/*global INCLUDE, installColorSpace, ONECOLOR*/

installColorSpace('LAB', ['l', 'a', 'b', 'alpha'], {
    fromRgb: function () {
        return this.xyz().lab();
    },

    rgb: function () {
        return this.xyz().rgb();
    },

    xyz: function () {
        // http://www.easyrgb.com/index.php?X=MATH&H=08#text8
        var convert = function (channel) {
                var pow = Math.pow(channel, 3);
                return pow > 0.008856 ?
                    pow :
                    (channel - 16 / 116) / 7.87;
            },
            y = (this._l + 16) / 116,
            x = this._a / 500 + y,
            z = y - this._b / 200;

        return new ONECOLOR.XYZ(
            convert(x) *  95.047,
            convert(y) * 100.000,
            convert(z) * 108.883,
            this._alpha
        );
    }
});

/*global one*/

installColorSpace('HSV', ['hue', 'saturation', 'value', 'alpha'], {
    rgb: function () {
        var hue = this._hue,
            saturation = this._saturation,
            value = this._value,
            i = Math.min(5, Math.floor(hue * 6)),
            f = hue * 6 - i,
            p = value * (1 - saturation),
            q = value * (1 - f * saturation),
            t = value * (1 - (1 - f) * saturation),
            red,
            green,
            blue;
        switch (i) {
        case 0:
            red = value;
            green = t;
            blue = p;
            break;
        case 1:
            red = q;
            green = value;
            blue = p;
            break;
        case 2:
            red = p;
            green = value;
            blue = t;
            break;
        case 3:
            red = p;
            green = q;
            blue = value;
            break;
        case 4:
            red = t;
            green = p;
            blue = value;
            break;
        case 5:
            red = value;
            green = p;
            blue = q;
            break;
        }
        return new ONECOLOR.RGB(red, green, blue, this._alpha);
    },

    hsl: function () {
        var l = (2 - this._saturation) * this._value,
            sv = this._saturation * this._value,
            svDivisor = l <= 1 ? l : (2 - l),
            saturation;

        // Avoid division by zero when lightness approaches zero:
        if (svDivisor < 1e-9) {
            saturation = 0;
        } else {
            saturation = sv / svDivisor;
        }
        return new ONECOLOR.HSL(this._hue, saturation, l / 2, this._alpha);
    },

    fromRgb: function () { // Becomes one.color.RGB.prototype.hsv
        var red = this._red,
            green = this._green,
            blue = this._blue,
            max = Math.max(red, green, blue),
            min = Math.min(red, green, blue),
            delta = max - min,
            hue,
            saturation = (max === 0) ? 0 : (delta / max),
            value = max;
        if (delta === 0) {
            hue = 0;
        } else {
            switch (max) {
            case red:
                hue = (green - blue) / delta / 6 + (green < blue ? 1 : 0);
                break;
            case green:
                hue = (blue - red) / delta / 6 + 1 / 3;
                break;
            case blue:
                hue = (red - green) / delta / 6 + 2 / 3;
                break;
            }
        }
        return new ONECOLOR.HSV(hue, saturation, value, this._alpha);
    }
});

/*global one*/


installColorSpace('HSL', ['hue', 'saturation', 'lightness', 'alpha'], {
    hsv: function () {
        // Algorithm adapted from http://wiki.secondlife.com/wiki/Color_conversion_scripts
        var l = this._lightness * 2,
            s = this._saturation * ((l <= 1) ? l : 2 - l),
            saturation;

        // Avoid division by zero when l + s is very small (approaching black):
        if (l + s < 1e-9) {
            saturation = 0;
        } else {
            saturation = (2 * s) / (l + s);
        }

        return new ONECOLOR.HSV(this._hue, saturation, (l + s) / 2, this._alpha);
    },

    rgb: function () {
        return this.hsv().rgb();
    },

    fromRgb: function () { // Becomes one.color.RGB.prototype.hsv
        return this.hsv().hsl();
    }
});

/*global one*/

installColorSpace('CMYK', ['cyan', 'magenta', 'yellow', 'black', 'alpha'], {
    rgb: function () {
        return new ONECOLOR.RGB((1 - this._cyan * (1 - this._black) - this._black),
                                 (1 - this._magenta * (1 - this._black) - this._black),
                                 (1 - this._yellow * (1 - this._black) - this._black),
                                 this._alpha);
    },

    fromRgb: function () { // Becomes one.color.RGB.prototype.cmyk
        // Adapted from http://www.javascripter.net/faq/rgb2cmyk.htm
        var red = this._red,
            green = this._green,
            blue = this._blue,
            cyan = 1 - red,
            magenta = 1 - green,
            yellow = 1 - blue,
            black = 1;
        if (red || green || blue) {
            black = Math.min(cyan, Math.min(magenta, yellow));
            cyan = (cyan - black) / (1 - black);
            magenta = (magenta - black) / (1 - black);
            yellow = (yellow - black) / (1 - black);
        } else {
            black = 1;
        }
        return new ONECOLOR.CMYK(cyan, magenta, yellow, black, this._alpha);
    }
});

ONECOLOR.installMethod('clearer', function (amount) {
    return this.alpha(isNaN(amount) ? -0.1 : -amount, true);
});


ONECOLOR.installMethod('darken', function (amount) {
    return this.lightness(isNaN(amount) ? -0.1 : -amount, true);
});


ONECOLOR.installMethod('desaturate', function (amount) {
    return this.saturation(isNaN(amount) ? -0.1 : -amount, true);
});

function gs () {
    var rgb = this.rgb(),
        val = rgb._red * 0.3 + rgb._green * 0.59 + rgb._blue * 0.11;

    return new ONECOLOR.RGB(val, val, val, this._alpha);
};

ONECOLOR.installMethod('greyscale', gs);
ONECOLOR.installMethod('grayscale', gs);


ONECOLOR.installMethod('lighten', function (amount) {
    return this.lightness(isNaN(amount) ? 0.1 : amount, true);
});

ONECOLOR.installMethod('mix', function (otherColor, weight) {
    otherColor = ONECOLOR(otherColor).rgb();
    weight = 1 - (isNaN(weight) ? 0.5 : weight);

    var w = weight * 2 - 1,
        a = this._alpha - otherColor._alpha,
        weight1 = (((w * a === -1) ? w : (w + a) / (1 + w * a)) + 1) / 2,
        weight2 = 1 - weight1,
        rgb = this.rgb();

    return new ONECOLOR.RGB(
        rgb._red * weight1 + otherColor._red * weight2,
        rgb._green * weight1 + otherColor._green * weight2,
        rgb._blue * weight1 + otherColor._blue * weight2,
        rgb._alpha * weight + otherColor._alpha * (1 - weight)
    );
});

ONECOLOR.installMethod('negate', function () {
    var rgb = this.rgb();
    return new ONECOLOR.RGB(1 - rgb._red, 1 - rgb._green, 1 - rgb._blue, this._alpha);
});

ONECOLOR.installMethod('opaquer', function (amount) {
    return this.alpha(isNaN(amount) ? 0.1 : amount, true);
});

ONECOLOR.installMethod('rotate', function (degrees) {
    return this.hue((degrees || 0) / 360, true);
});


ONECOLOR.installMethod('saturate', function (amount) {
    return this.saturation(isNaN(amount) ? 0.1 : amount, true);
});

// Adapted from http://gimp.sourcearchive.com/documentation/2.6.6-1ubuntu1/color-to-alpha_8c-source.html
/*
    toAlpha returns a color where the values of the argument have been converted to alpha
*/
ONECOLOR.installMethod('toAlpha', function (color) {
    var me = this.rgb(),
        other = ONECOLOR(color).rgb(),
        epsilon = 1e-10,
        a = new ONECOLOR.RGB(0, 0, 0, me._alpha),
        channels = ['_red', '_green', '_blue'];

    channels.forEach(function (channel) {
        if (me[channel] < epsilon) {
            a[channel] = me[channel];
        } else if (me[channel] > other[channel]) {
            a[channel] = (me[channel] - other[channel]) / (1 - other[channel]);
        } else if (me[channel] > other[channel]) {
            a[channel] = (other[channel] - me[channel]) / other[channel];
        } else {
            a[channel] = 0;
        }
    });

    if (a._red > a._green) {
        if (a._red > a._blue) {
            me._alpha = a._red;
        } else {
            me._alpha = a._blue;
        }
    } else if (a._green > a._blue) {
        me._alpha = a._green;
    } else {
        me._alpha = a._blue;
    }

    if (me._alpha < epsilon) {
        return me;
    }

    channels.forEach(function (channel) {
        me[channel] = (me[channel] - other[channel]) / me._alpha + other[channel];
    });
    me._alpha *= a._alpha;

    return me;
});

/*global one*/

// This file is purely for the build system

// Order is important to prevent channel name clashes. Lab <-> hsL

// Convenience functions


},{}],88:[function(require,module,exports){
(function (Buffer){
/*!
 * Node.JS module "Deep Extend"
 * @description Recursive object extending.
 * @author Viacheslav Lotsmanov (unclechu) <lotsmanov89@gmail.com>
 * @license MIT
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2013 Viacheslav Lotsmanov
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

/**
 * Extening object that entered in first argument.
 * Returns extended object or false if have no target object or incorrect type.
 * If you wish to clone object, simply use that:
 *  deepExtend({}, yourObj_1, [yourObj_N]) - first arg is new empty object
 */
var deepExtend = module.exports = function (/*obj_1, [obj_2], [obj_N]*/) {
    if (arguments.length < 1 || typeof arguments[0] !== 'object') {
        return false;
    }

    if (arguments.length < 2) return arguments[0];

    var target = arguments[0];

    // convert arguments to array and cut off target object
    var args = Array.prototype.slice.call(arguments, 1);

    var key, val, src, clone, tmpBuf;

    args.forEach(function (obj) {
        if (typeof obj !== 'object') return;

        for (key in obj) {
            if ( ! (key in obj)) continue;

            src = target[key];
            val = obj[key];

            if (val === target) continue;

            if (typeof val !== 'object' || val === null) {
                target[key] = val;
                continue;
            } else if (val instanceof Buffer) {
                tmpBuf = new Buffer(val.length);
                val.copy(tmpBuf);
                target[key] = tmpBuf;
                continue;
            }

            if (typeof src !== 'object' || src === null) {
                clone = (Array.isArray(val)) ? [] : {};
                target[key] = deepExtend(clone, val);
                continue;
            }

            if (Array.isArray(val)) {
                clone = (Array.isArray(src)) ? src : [];
            } else {
                clone = (!Array.isArray(src)) ? src : {};
            }

            target[key] = deepExtend(clone, val);
        }
    });

    return target;
}

}).call(this,require("buffer").Buffer)
},{"buffer":2}],89:[function(require,module,exports){
'use strict';
var postcss, _remgex, _rootvalue, _options;

// Add pixel fallbacks for rem units to a string of CSS
// - css `String`: the contents of a CSS file.
// - rootvalue `String | Null`: The root element font size. Default = 16px.
// - options `Object`
//     - replace `Boolean`: Replace rems with pixels instead of providing
//       fallbacks. Default = false.

function Pixrem (rootvalue, options) {
  postcss = require('postcss');
  _remgex = /(\d*\.?\d+)rem/ig;
  _rootvalue = typeof rootvalue !== 'undefined' ? rootvalue : 16;
  _options = typeof options !== 'undefined' ? options : {
    replace: false
  };
}

Pixrem.prototype.process = function (css) {
  return postcss(this.postcss).process(css).css;
}

Pixrem.prototype.postcss = function (css) {
  css.eachDecl(function (decl, i) {
    var rule = decl.parent;
    var value = decl.value;

    if (value.indexOf('rem') != -1) {

      value = value.replace(_remgex, function ($1) {
        // Round decimal pixels down to match webkit and opera behavior:
        // http://tylertate.com/blog/2012/01/05/subpixel-rounding.html
        return Math.floor(parseFloat($1) * toPx(_rootvalue)) + 'px';
      });

      if (_options.replace) {
        decl.value = value;
      } else {
        rule.insertBefore(i, decl.clone({ value: value }));
      }
    }
  });
}

// Return a unitless pixel value from any root font-size value.
function toPx(value) {
  var parts = /^(\d+\.?\d*)([a-zA-Z%]*)$/.exec(value);
  var number = parts[1];
  var unit = parts[2];

  if (unit === 'px' || unit === '') {
    return parseFloat(number);
  }
  else if (unit === 'em' || unit === 'rem') {
    return parseFloat(number) * 16;
  }
  else if (unit === '%') {
    return (parseFloat(number) / 100) * 16;
  }

  // TODO: Should we throw an error here?
  return false;
}

var pixrem = function (rootvalue, options) {
  return new Pixrem(rootvalue, options);
};
pixrem.process = function(css, rootvalue, options) {
  return new Pixrem(rootvalue, options).process(css);
}

module.exports = pixrem;
},{"postcss":129}],90:[function(require,module,exports){
var postcss  = require('postcss');
var oneColor = require('onecolor');

// SVG
var createSVG = function (filterElements) {

	var xmlns = 'http://www.w3.org/2000/svg';
	var svg  = '<svg xmlns="' + xmlns + '">';

	var svgFilter  = '<filter id="filter">';

	for(var i = 0; i < filterElements.length; i++) {
		svgFilter += filterElements[i];
	}

		svgFilter += '</filter>';

		svg += svgFilter;
		svg += '</svg>';

	return svg;

};
var createSVGElement = function (tagname, attributes, subElements) {

	var elem = '<' + tagname;
	for(var key in attributes){
		elem += ' ' + key + '="' + attributes[key] + '"';
	}
	if (subElements !== undefined) {
		elem += '>';
		for (var i = 0; i < subElements.length; i++) {
			elem += subElements[i];
		}
		elem += '</' + tagname + '>';
	} else {
		elem += ' />';
	}
	return elem;

};

// Filter object
function Filter (opts) {

	opts = opts || {};
	this.options = {
		oldIE: opts.oldIE || false
	};
	this.postcss = this.postcss.bind(this);

	this.filters = {

		// None
		none: function () {
			var properties = {};

			// CSS
			properties.filtersCSS = ['none'];

			// SVG
			properties.filtersSVG = ['none'];

			// IE
			// properties.filtersIE = ['none'];

			return properties;
		},

		// Grayscale
		grayscale: function (amount, unit) {
			amount = amount || 0;

			if (typeof unit !== 'undefined') {
				amount /= 100;
			}

			var properties = {};

			// CSS
			properties.filtersCSS = ['grayscale(' + amount + ')'];

			// SVG
			var svg = createSVGElement('feColorMatrix', {
				type: 'matrix',
				'color-interpolation-filters': 'sRGB',
				values: (0.2126 + 0.7874 * (1 - amount)) + ' ' +
						(0.7152 - 0.7152 * (1 - amount)) + ' ' +
						(0.0722 - 0.0722 * (1 - amount)) + ' 0 0 ' +
						(0.2126 - 0.2126 * (1 - amount)) + ' ' +
						(0.7152 + 0.2848 * (1 - amount)) + ' ' +
						(0.0722 - 0.0722 * (1 - amount)) + ' 0 0 ' +
						(0.2126 - 0.2126 * (1 - amount)) + ' ' +
						(0.7152 - 0.7152 * (1 - amount)) + ' ' +
						(0.0722 + 0.9278 * (1 - amount)) + ' 0 0 0 0 0 1 0'
			});
			properties.filtersSVG = [svg];

			// IE
			properties.filtersIE = amount >= 0.5 ? ['gray'] : [];

			return properties;
		},

		// Sepia
		sepia: function (amount, unit) {
			amount = amount || 0;

			if (typeof unit !== 'undefined') {
				amount /= 100;
			}

			var properties = {};

			// CSS
			properties.filtersCSS = ['sepia(' + amount + ')'];

			// SVG
			var svg = createSVGElement('feColorMatrix', {
				type: 'matrix',
				'color-interpolation-filters': 'sRGB',
				values: (0.393 + 0.607 * (1 - amount)) + ' ' +
						(0.769 - 0.769 * (1 - amount)) + ' ' +
						(0.189 - 0.189 * (1 - amount)) + ' 0 0 ' +
						(0.349 - 0.349 * (1 - amount)) + ' ' +
						(0.686 + 0.314 * (1 - amount)) + ' ' +
						(0.168 - 0.168 * (1 - amount)) + ' 0 0 ' +
						(0.272 - 0.272 * (1 - amount)) + ' ' +
						(0.534 - 0.534 * (1 - amount)) + ' ' +
						(0.131 + 0.869 * (1 - amount)) + ' 0 0 0 0 0 1 0'
			});
			properties.filtersSVG = [svg];

			// IE
			properties.filtersIE = amount >= 0.5 ? ['gray','progid:DXImageTransform.Microsoft.Light()'] : [];

			return properties;
		},

		// Saturate
		saturate: function (amount, unit) {
			amount = amount || 1;

			var properties = {};

			if (typeof unit !== 'undefined') {
				amount /= 100;
			}

			// CSS
			properties.filtersCSS = ['saturate(' + amount + ')'];

			// SVG
			var svg = createSVGElement('feColorMatrix', {
				type: 'matrix',
				'color-interpolation-filters': 'sRGB',
				values: (0.213 + 0.787 * (amount)) + ' ' +
						(0.715 - 0.715 * (amount)) + ' ' +
						(0.072 - 0.072 * (amount)) + ' 0 0 ' +
						(0.213 - 0.213 * (amount)) + ' ' +
						(0.715 + 0.295 * (amount)) + ' '+
						(0.072 - 0.072 * (amount)) + ' 0 0 '+
						(0.213 - 0.213 * (amount)) + ' ' +
						(0.715 - 0.715 * (amount)) + ' ' +
						(0.072 + 0.928 * (amount)) + ' 0 0 0 0 0 1 0'
			});
			properties.filtersSVG = [svg];

			// IE
			// no filter

			return properties;
		},

		// Hue-rotate
		hueRotate: function (angle, unit) {
			angle = angle || 0;

			angle = helpers.angle(angle, unit);

			var properties = {};

			// CSS
			properties.filtersCSS = ['hue-rotate(' + angle + 'deg)'];

			// SVG
			var svg = createSVGElement('feColorMatrix', {
				type: 'hueRotate',
				'color-interpolation-filters': 'sRGB',
				values: angle
			});
			properties.filtersSVG = [svg];

			// IE
			// no filter

			return properties;
		},

		// Invert
		invert: function (amount, unit) {
			amount = amount || 0;

			if (typeof unit !== 'undefined') {
				amount /= 100;
			}

			var properties = {};

			// CSS
			properties.filtersCSS = ['invert(' + amount + ')'];

			// SVG
			var svgSub1 = createSVGElement('feFuncR', {
				type: 'table',
				tableValues: amount + ' ' + (1 - amount)
			});
			var svgSub2 = createSVGElement('feFuncG', {
				type: 'table',
				tableValues: amount + ' ' + (1 - amount)
			});
			var svgSub3 = createSVGElement('feFuncB', {
				type: 'table',
				tableValues: amount + ' ' + (1 - amount)
			});
			var svg = createSVGElement('feComponentTransfer', {
				'color-interpolation-filters': 'sRGB'
			}, [svgSub1, svgSub2, svgSub3]);
			properties.filtersSVG = [svg];

			// IE
			properties.filtersIE = amount >= 0.5 ? ['invert'] : [];

			return properties;
		},

		// Opacity
		opacity: function (amount, unit) {
			amount = amount || 1;

			if (typeof unit !== 'undefined') {
				amount /= 100;
			}

			var properties = {};

			// CSS
			properties.filtersCSS = ['opacity(' + amount + ')'];

			// SVG
			var svgSub1 = createSVGElement('feFuncA', {
				type: 'table',
				tableValues: '0 ' + amount
			});
			var svg = createSVGElement('feComponentTransfer', {
				'color-interpolation-filters': 'sRGB'
			}, [svgSub1]);
			properties.filtersSVG = [svg];

			// IE
			// no filter

			return properties;
		},

		// Brightness
		brightness: function (amount, unit) {
			amount = amount || 1;

			if (typeof unit !== 'undefined') {
				amount /= 100;
			}

			var properties = {};

			// CSS
			properties.filtersCSS = ['brightness(' + amount + ')'];

			// SVG
			var svgSub1 = createSVGElement('feFuncR', {
				type: 'linear',
				slope: amount
			});
			var svgSub2 = createSVGElement('feFuncG', {
				type: 'linear',
				slope: amount
			});
			var svgSub3 = createSVGElement('feFuncB', {
				type: 'linear',
				slope: amount
			});
			var svg = createSVGElement('feComponentTransfer', {
				'color-interpolation-filters': 'sRGB'
			}, [svgSub1, svgSub2, svgSub3]);
			properties.filtersSVG = [svg];

			// IE
			properties.filtersIE = ['progid:DXImageTransform.Microsoft.Light()'];

			return properties;
		},

		// Contrast
		contrast: function (amount, unit) {
			amount = amount || 1;

			if (typeof unit !== 'undefined') {
				amount /= 100;
			}

			var properties = {};

			// CSS
			properties.filtersCSS = ['contrast(' + amount + ')'];

			// SVG
			var svgSub1 = createSVGElement('feFuncR', {
				type: 'linear',
				slope: amount,
				intercept: -(0.5 * amount) + 0.5
			});
			var svgSub2 = createSVGElement('feFuncG', {
				type: 'linear',
				slope: amount,
				intercept: -(0.5 * amount) + 0.5
			});
			var svgSub3 = createSVGElement('feFuncB', {
				type: 'linear',
				slope: amount,
				intercept: -(0.5 * amount) + 0.5
			});
			var svg = createSVGElement('feComponentTransfer', {
				'color-interpolation-filters': 'sRGB'
			}, [svgSub1, svgSub2, svgSub3]);
			properties.filtersSVG = [svg];

			// IE
			// no filter

			return properties;
		},

		// Blur
		blur: function (amount, unit) {
			amount = amount || 0;

			var properties = {};

			if (unit === '' && amount !== 0) {
				return properties;
			}

			amount = helpers.length(amount, unit);

			// CSS
			properties.filtersCSS = ['blur(' + amount + 'px)'];

			// SVG
			var svg = createSVGElement('feGaussianBlur', {
				stdDeviation: amount
			});
			properties.filtersSVG = [svg];

			// IE
			properties.filtersIE = ['progid:DXImageTransform.Microsoft.Blur(pixelradius=' + amount + ')'];

			return properties;
		},

		// Drop Shadow
		dropShadow: function (offsetX, unitX, offsetY, unitY, radius, unitRadius, color) {
			offsetX = Math.round(offsetX) || 0;
			offsetY = Math.round(offsetY) || 0;
			radius = Math.round(radius) || 0;
			color = color || '#000000';

			var properties = {};

			if ((unitX === ' ' && offsetX !== 0) || (unitY === ' ' && offsetY !== 0) || (unitRadius === ' ' && radius !== 0)) {
				return properties;
			}

			offsetX = helpers.length(offsetX, unitX);
			offsetY = helpers.length(offsetY, unitY);
			radius  = helpers.length(radius, unitRadius);

			// CSS
			properties.filtersCSS = ['drop-shadow(' + offsetX + 'px ' + offsetY + 'px ' + radius + 'px ' + color + ')'];

			// SVG
			var svg1 = createSVGElement('feGaussianBlur', {
				'in': 'SourceAlpha',
				stdDeviation: radius
			});
			var svg2 = createSVGElement('feOffset', {
				dx: offsetX + 1,
				dy: offsetY + 1,
				result: 'offsetblur'
			});
			var svg3 = createSVGElement('feFlood', {
				'flood-color': oneColor(color).cssa()
			});
			var svg4 = createSVGElement('feComposite', {
				in2: 'offsetblur',
				operator: 'in'
			});
			var svg5Sub1 = createSVGElement('feMergeNode', {});
			var svg5Sub2 = createSVGElement('feMergeNode', {
				'in': 'SourceGraphic'
			});
			var svg5 = createSVGElement('feMerge', {}, [svg5Sub1, svg5Sub2]);
			properties.filtersSVG = [svg1,svg2,svg3,svg4,svg5];

			// IE
			properties.filtersIE = ['progid:DXImageTransform.Microsoft.Glow(color=' + color + ',strength=0)','progid:DXImageTransform.Microsoft.Shadow(color=' + color + ',strength=0)'];

			return properties;
		}
	};

	var helpers = {

		length: function (amount, unit) {
			switch (unit) {
				case 'px':
					break;
				case 'em':
				case 'rem':
					amount *= 16;
					break;
			}
			return amount;
		},

		angle: function (amount, unit) {
			switch (unit) {
				case 'deg':
					break;
				case 'grad':
					amount = 180 * amount / 200;
					break;
				case 'rad':
					amount = 180 * amount / Math.PI;
					break;
				case 'turn':
					amount = 360 * amount;
					break;
			}
			return amount;
		}

	};

}

Filter.prototype.convert = function (value) {

	var fmatch,
		amount,
		unit,
		properties;

	// None
	fmatch = value.match(/none/i);
	if(fmatch !== null){
		properties = this.filters.none();
	}
	// Grayscale
	fmatch = value.match(/(grayscale)\(\s*([0-9\.]+)(%)*\s*\)/i);
	if (fmatch !== null) {
		amount = parseFloat(fmatch[2], 10);
		unit   = fmatch[3];
		properties = this.filters.grayscale(amount, unit);
	}
	// Sepia
	fmatch = value.match(/(sepia)\(\s*([0-9\.]+)(%)*\s*\)/i);
	if (fmatch !== null) {
		amount = parseFloat(fmatch[2], 10);
		unit   = fmatch[3];
		properties = this.filters.sepia(amount, unit);
	}
	// Saturate
	fmatch = value.match(/(saturate)\(\s*([0-9\.]+)(%)*\s*\)/i);
	if (fmatch !== null) {
		amount = parseFloat(fmatch[2], 10);
		unit   = fmatch[3];
		properties = this.filters.saturate(amount, unit);
	}
	// Hue-rotate
	fmatch = value.match(/(hue\-rotate)\((\s*[0-9\.]+)(deg|grad|rad|turn)\s*\)/i);
	if (fmatch !== null) {
		var angle = parseFloat(fmatch[2], 10);
			unit = fmatch[3];
			properties = this.filters.hueRotate(angle, unit);
	}
	// Invert
	fmatch = value.match(/(invert)\((\s*[0-9\.]+)(%)*\s*\)/i);
	if (fmatch !== null) {
		amount = parseFloat(fmatch[2], 10);
		unit   = fmatch[3];
		properties = this.filters.invert(amount, unit);
	}
	// Opacity
	fmatch = value.match(/(opacity)\((\s*[0-9\.]+)(%)*\s*\)/i);
	if (fmatch !== null) {
		amount = parseFloat(fmatch[2], 10);
		unit   = fmatch[3];
		properties = this.filters.opacity(amount, unit);
	}
	// Brightness
	fmatch = value.match(/(brightness)\((\s*[0-9\.]+)(%)*\s*\)/i);
	if (fmatch !== null) {
		amount = parseFloat(fmatch[2], 10);
		unit   = fmatch[3];
		properties = this.filters.brightness(amount, unit);
	}
	// Contrast
	fmatch = value.match(/(contrast)\((\s*[0-9\.]+)(%)*\s*\)/i);
	if (fmatch !== null) {
		amount = parseFloat(fmatch[2], 10);
		unit   = fmatch[3];
		properties = this.filters.contrast(amount, unit);
	}
	// Blur
	fmatch = value.match(/(blur)\((\s*[0-9\.]+)(px|em|rem|)\s*\)/i);
	if (fmatch !== null) {
		amount = parseFloat(fmatch[2], 10);
		unit   = fmatch[3];
		properties = this.filters.blur(amount, unit);
	}
	// Drop Shadow
	fmatch = value.match(/(drop\-shadow)\((\s*[0-9\.]+)(px|em|rem| )\s*([0-9\.]+)(px|em|rem| )\s*([0-9\.]+)(px|em|rem| )\s*([a-z0-9#%,.\s]+)\s*\)/i);
	if (fmatch !== null) {
		var offsetX    = parseFloat(fmatch[2], 10),
			unitX      = fmatch[3],
			offsetY    = parseFloat(fmatch[4], 10),
			unitY      = fmatch[5],
			radius     = parseFloat(fmatch[6], 10),
			unitRadius = fmatch[7],
			color      = fmatch[8];
			properties = this.filters.dropShadow(offsetX, unitX, offsetY, unitY, radius, unitRadius, color);
	}

	return properties;

};

Filter.prototype.postcss = function (css) {

	var _this = this;

	css.eachRule(function (rule) {

		rule.eachDecl(function (decl, idx) {

			// find filter declaration
			if (decl.prop === 'filter') {

				// get values
				var values = decl.value.split(/\)\s+/);
				var properties = {
					filtersCSS: [],
					filtersSVG: [],
					filtersIE:  []
				};

				for (var key in values) {
					var value = values[key] + ')';
					var currentProperties = _this.convert(value);
					for (var j in currentProperties){
						if (typeof properties[j] !== 'undefined') {
							properties[j] = properties[j].concat(currentProperties[j]);
						}
					}
				}

				if (properties.filtersCSS.length > 0) {
					var filtersCSS = properties.filtersCSS.join(' ');

					// set new value?
					// decl.value = filtersCSS;
				}

				if (_this.options.oldIE && properties.filtersIE.length > 0) {
					var filtersIE = properties.filtersIE.join(' ');

					// insert IE filters, only if it's not already present
					var newDecl = { prop: 'filter', value: filtersIE};
					var add = true;
					rule.eachDecl(function (d) {
						if (newDecl.value === d.value) {
							add = false;
							return false;
						}
					});
					if (add) {
						rule.insertAfter(decl, newDecl);
					}
				}

				if (properties.filtersSVG.length > 0) {
					var none = false;
					for (var i = 0; i < properties.filtersSVG.length; i++) {
						if (properties.filtersSVG[i] === 'none') {
							none = true;
							break;
						}
					}
					if (!none) {
						var svgString = createSVG(properties.filtersSVG);
						var filtersSVG = 'url(\'data:image/svg+xml;charset=utf-8,' + svgString + '#filter\')';

						// insert SVG filters, only if it's not already present
						var newDecl = { prop: 'filter', value: filtersSVG};
						var add = true;
						rule.eachDecl(function (d) {
							if (newDecl.value === d.value) {
								add = false;
								return false;
							}
						});
						if (add) {
							rule.insertBefore(decl, newDecl);
						}
					}
				}

			}

		});

	});

};

Filter.prototype.process = function (css) {
	return postcss().use(this.postcss).process(css).css;
};

var filter = function (options) {
	return new Filter(options);
};
filter.process = function (css, options) {
	return new Filter(options).process(css);
};

module.exports = filter;
},{"onecolor":91,"postcss":129}],91:[function(require,module,exports){
module.exports=require(87)
},{}],92:[function(require,module,exports){
var postcss = require('postcss');
var variables = [];
var varStartIdentifier = '--';
var refStartIdentifier = 'var(';

var _process = function (css) {

	// for each rules
	css.eachRule(function (rule) {

		// if selector is :root
		if (rule.selectors.length === 1 && rule.selectors[0] === ':root' && rule.parent.type === 'root') {

			rule.each(function (decl) {
				if (decl.type === 'decl' && decl.prop.indexOf(varStartIdentifier) === 0) {
					// store all variables
					variables[decl.prop] = decl.value;
				}
			});

		// else, it's not :root
		} else {

			rule.each(function (decl) {
				if (decl.type === 'decl' && decl.value.indexOf(refStartIdentifier) !== -1) {
					decl.value = _replaceValue(decl.value);
				}
			});

		}

	});

	return css;

};

var _replaceValue = function (value) {

	// matches `var(name[, fallback])`, captures 'name' and 'fallback'
	var regexpVar = /\bvar\(([\w-]+)(?:\s*,\s*)?(.*)?\)/;
	// matches `var()`
	var regexpEmptyVar = /\bvar\(\s*\)/;

	var valueLen = value.length;
	var beginSlice = value.indexOf(refStartIdentifier);
	var endSlice = beginSlice + refStartIdentifier.length;
	var depth = 1;
	var currentChar;
	var cssVariable;

	// find the closing `)` of the CSS variable function,
	// accounting for nested functions
	while (endSlice < valueLen && depth > 0) {
		currentChar = value.charAt(endSlice);
		if (currentChar == '(') depth += 1;
		if (currentChar == ')') depth -= 1;
		endSlice += 1;
	}

	if (depth > 0) throw new Error('postcss-vars: missing closing ")" in the value "' + value + '"');

	cssVariable = value.slice(beginSlice, endSlice);

	if (regexpEmptyVar.test(cssVariable)) throw new Error('postcss-vars: var() must contain a non-whitespace string');

	cssReplacement = cssVariable.replace(regexpVar, function(_, name, fallback){
		var replacement = variables[name];
		if (!replacement && !fallback) throw new Error('postcss-vars: variable "' + name + '" is undefined');
		if (!replacement && fallback) return fallback;
		return replacement;
	});

	// resolve the variable
	value = value.split(cssVariable).join(cssReplacement);

	// recursively resolve any remaining variables
	if (/\bvar\(/.test(value)) {
		value = _replaceValue(value);
	}

	return value;

};

var _postcss = function (css, opts) {
	return postcss().use(this.processor).process(css, opts);
};

exports.processor = _process;
exports.postcss = _postcss;
},{"postcss":102}],93:[function(require,module,exports){
(function() {
  var AtRule, Container, name, _fn, _i, _len, _ref,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  Container = require('./container');

  AtRule = (function(_super) {
    __extends(AtRule, _super);

    function AtRule() {
      this.type = 'atrule';
      AtRule.__super__.constructor.apply(this, arguments);
    }

    AtRule.prototype.styleType = function() {
      return this.type + ((this.rules != null) || (this.decls != null) ? '-body' : '-bodiless');
    };

    AtRule.prototype.defaultStyle = function(type) {
      if (type === 'atrule-body') {
        return {
          between: ' ',
          after: this.defaultAfter()
        };
      } else {
        return {
          between: ''
        };
      }
    };

    AtRule.prototype.addMixin = function(type) {
      var container, detector, mixin, name, value, _ref;
      mixin = type === 'rules' ? Container.WithRules : Container.WithDecls;
      if (!mixin) {
        return;
      }
      _ref = mixin.prototype;
      for (name in _ref) {
        value = _ref[name];
        if (name === 'constructor') {
          continue;
        }
        container = Container.prototype[name] === value;
        detector = name === 'append' || name === 'prepend';
        if (container && !detector) {
          continue;
        }
        this[name] = value;
      }
      return mixin.apply(this);
    };

    AtRule.raw('params');

    AtRule.prototype.stringify = function(builder, last) {
      var name, params, semicolon, style;
      style = this.style();
      name = '@' + this.name;
      params = this._params ? this._params.toString() : '';
      name += this.afterName != null ? this.afterName : params ? ' ' : '';
      if ((this.rules != null) || (this.decls != null)) {
        return this.stringifyBlock(builder, name + params + style.between + '{');
      } else {
        if (this.before) {
          builder(this.before);
        }
        semicolon = !last || this.semicolon ? ';' : '';
        return builder(name + params + style.between + semicolon, this);
      }
    };

    return AtRule;

  })(Container);

  _ref = ['append', 'prepend'];
  _fn = function(name) {
    return AtRule.prototype[name] = function(child) {
      var mixin;
      mixin = child.type === 'decl' ? 'decls' : 'rules';
      this.addMixin(mixin);
      return this[name](child);
    };
  };
  for (_i = 0, _len = _ref.length; _i < _len; _i++) {
    name = _ref[_i];
    _fn(name);
  }

  module.exports = AtRule;

}).call(this);

},{"./container":95}],94:[function(require,module,exports){
(function() {
  var Comment, Node,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  Node = require('./node');

  Comment = (function(_super) {
    __extends(Comment, _super);

    function Comment() {
      this.type = 'comment';
      Comment.__super__.constructor.apply(this, arguments);
    }

    Comment.prototype.defaultStyle = function() {
      return {
        left: ' ',
        right: ' '
      };
    };

    Comment.prototype.stringify = function(builder) {
      var style;
      if (this.before) {
        builder(this.before);
      }
      style = this.style();
      return builder("/*" + (style.left + this.text + style.right) + "*/", this);
    };

    return Comment;

  })(Node);

  module.exports = Comment;

}).call(this);

},{"./node":100}],95:[function(require,module,exports){
(function() {
  var Container, Declaration, Node,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  Node = require('./node');

  Declaration = require('./declaration');

  Container = (function(_super) {
    __extends(Container, _super);

    function Container() {
      return Container.__super__.constructor.apply(this, arguments);
    }

    Container.prototype.stringifyContent = function(builder) {
      var last;
      if (!this.rules && !this.decls) {
        return;
      }
      if (this.rules) {
        last = this.rules.length - 1;
        return this.rules.map(function(rule, i) {
          return rule.stringify(builder, last === i);
        });
      } else if (this.decls) {
        last = this.decls.length - 1;
        return this.decls.map((function(_this) {
          return function(decl, i) {
            return decl.stringify(builder, last !== i || _this.semicolon);
          };
        })(this));
      }
    };

    Container.prototype.defaultAfter = function() {
      var _ref;
      if (this.list.length === 0) {
        return '';
      } else if (((_ref = this.list[0].before) != null ? _ref.indexOf("\n") : void 0) === -1) {
        return this.list[0].before;
      } else {
        return "\n";
      }
    };

    Container.prototype.stringifyBlock = function(builder, start) {
      var style;
      style = this.style();
      if (this.before) {
        builder(this.before);
      }
      builder(start, this, 'start');
      this.stringifyContent(builder);
      if (style.after) {
        builder(style.after);
      }
      return builder('}', this, 'end');
    };

    Container.prototype.push = function(child) {
      child.parent = this;
      this.list.push(child);
      return this;
    };

    Container.prototype.each = function(callback) {
      var id, index, list, result;
      this.lastEach || (this.lastEach = 0);
      this.indexes || (this.indexes = {});
      this.lastEach += 1;
      id = this.lastEach;
      this.indexes[id] = 0;
      list = this.list;
      if (!list) {
        return;
      }
      while (this.indexes[id] < list.length) {
        index = this.indexes[id];
        result = callback(list[index], index);
        if (result === false) {
          break;
        }
        this.indexes[id] += 1;
      }
      delete this.indexes[id];
      if (result === false) {
        return false;
      }
    };

    Container.prototype.eachInside = function(callback) {
      return this.each((function(_this) {
        return function(child, i) {
          var result;
          result = callback(child, i);
          if (result !== false && child.eachInside) {
            result = child.eachInside(callback);
          }
          if (result === false) {
            return result;
          }
        };
      })(this));
    };

    Container.prototype.eachDecl = function(callback) {};

    Container.prototype.eachComment = function(callback) {
      return this.eachInside((function(_this) {
        return function(child, i) {
          var result;
          result = child.type === 'comment' ? callback(child, i) : void 0;
          if (result === false) {
            return result;
          }
        };
      })(this));
    };

    Container.prototype.append = function(child) {
      child = this.normalize(child, this.list[this.list.length - 1]);
      this.list.push(child);
      return this;
    };

    Container.prototype.prepend = function(child) {
      var id, index, _ref;
      child = this.normalize(child, this.list[0], 'prepend');
      this.list.unshift(child);
      _ref = this.indexes;
      for (id in _ref) {
        index = _ref[id];
        this.indexes[id] = index + 1;
      }
      return this;
    };

    Container.prototype.insertBefore = function(exist, add) {
      var id, index, _ref;
      exist = this.index(exist);
      add = this.normalize(add, this.list[exist], exist === 0 ? 'prepend' : void 0);
      this.list.splice(exist, 0, add);
      _ref = this.indexes;
      for (id in _ref) {
        index = _ref[id];
        if (index >= exist) {
          this.indexes[id] = index + 1;
        }
      }
      return this;
    };

    Container.prototype.insertAfter = function(exist, add) {
      var id, index, _ref;
      exist = this.index(exist);
      add = this.normalize(add, this.list[exist]);
      this.list.splice(exist + 1, 0, add);
      _ref = this.indexes;
      for (id in _ref) {
        index = _ref[id];
        if (index > exist) {
          this.indexes[id] = index + 1;
        }
      }
      return this;
    };

    Container.prototype.remove = function(child) {
      var id, index, _ref;
      child = this.index(child);
      this.list.splice(child, 1);
      _ref = this.indexes;
      for (id in _ref) {
        index = _ref[id];
        if (index >= child) {
          this.indexes[id] = index - 1;
        }
      }
      return this;
    };

    Container.prototype.every = function(condition) {
      return this.list.every(condition);
    };

    Container.prototype.some = function(condition) {
      return this.list.some(condition);
    };

    Container.prototype.index = function(child) {
      if (typeof child === 'number') {
        return child;
      } else {
        return this.list.indexOf(child);
      }
    };

    Container.prop('first', {
      get: function() {
        return this.list[0];
      }
    });

    Container.prop('last', {
      get: function() {
        return this.list[this.list.length - 1];
      }
    });

    Container.prop('list', {
      get: function() {
        return this.rules || this.decls;
      }
    });

    Container.prototype.normalize = function(child, sample) {
      child.parent = this;
      if ((child.before == null) && sample) {
        child.before = sample.before;
      }
      return child;
    };

    return Container;

  })(Node);

  Container.WithRules = (function(_super) {
    __extends(WithRules, _super);

    function WithRules() {
      this.rules = [];
      WithRules.__super__.constructor.apply(this, arguments);
    }

    WithRules.prototype.eachDecl = function(callback) {
      return this.each(function(child) {
        var result;
        if (!child.eachDecl) {
          return;
        }
        result = child.eachDecl(callback);
        if (result === false) {
          return result;
        }
      });
    };

    WithRules.prototype.eachRule = function(callback) {
      return this.each((function(_this) {
        return function(child, i) {
          var result;
          result = child.type === 'rule' ? callback(child, i) : child.eachRule ? child.eachRule(callback) : void 0;
          if (result === false) {
            return result;
          }
        };
      })(this));
    };

    WithRules.prototype.eachAtRule = function(callback) {
      return this.eachInside((function(_this) {
        return function(child, i) {
          var result;
          result = child.type === 'atrule' ? callback(child, i) : void 0;
          if (result === false) {
            return result;
          }
        };
      })(this));
    };

    return WithRules;

  })(Container);

  Container.WithDecls = (function(_super) {
    __extends(WithDecls, _super);

    function WithDecls() {
      this.decls = [];
      WithDecls.__super__.constructor.apply(this, arguments);
    }

    WithDecls.prototype.normalize = function(child, sample) {
      if (!child.type) {
        child = new Declaration(child);
      }
      return WithDecls.__super__.normalize.call(this, child, sample);
    };

    WithDecls.prototype.eachDecl = function(callback) {
      return this.each((function(_this) {
        return function(node, i) {
          var result;
          if (node.type !== 'decl') {
            return;
          }
          result = callback(node, i);
          if (result === false) {
            return result;
          }
        };
      })(this));
    };

    return WithDecls;

  })(Container);

  module.exports = Container;

}).call(this);

},{"./declaration":96,"./node":100}],96:[function(require,module,exports){
(function() {
  var Declaration, Node, vendor,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  Node = require('./node');

  vendor = require('./vendor');

  Declaration = (function(_super) {
    __extends(Declaration, _super);

    function Declaration() {
      this.type = 'decl';
      Declaration.__super__.constructor.apply(this, arguments);
    }

    Declaration.prototype.defaultStyle = function() {
      return {
        before: "\n    ",
        between: ': '
      };
    };

    Declaration.raw('value');

    Declaration.prop('important', {
      get: function() {
        return !!this._important;
      },
      set: function(value) {
        if (typeof value === 'string' && value !== '') {
          return this._important = value;
        } else if (value) {
          return this._important = ' !important';
        } else {
          return this._important = false;
        }
      }
    });

    Declaration.prototype.stringify = function(builder, semicolon) {
      var string, style;
      style = this.style();
      if (style.before) {
        builder(style.before);
      }
      string = this.prop + style.between + this._value.toString();
      string += this._important || '';
      if (semicolon) {
        string += ';';
      }
      return builder(string, this);
    };

    Declaration.prototype.clone = function(obj) {
      var cloned;
      cloned = Declaration.__super__.clone.apply(this, arguments);
      delete cloned.before;
      return cloned;
    };

    return Declaration;

  })(Node);

  module.exports = Declaration;

}).call(this);

},{"./node":100,"./vendor":108}],97:[function(require,module,exports){
(function() {
  var lazy;

  lazy = function(klass, name, callback) {
    var cache;
    cache = name + 'Cache';
    return klass.prototype[name] = function() {
      if (this[cache] != null) {
        return this[cache];
      } else {
        return this[cache] = callback.apply(this, arguments);
      }
    };
  };

  module.exports = lazy;

}).call(this);

},{}],98:[function(require,module,exports){
(function() {
  var list;

  list = {
    split: function(string, separators, last) {
      var array, current, escape, func, letter, quote, separator, split, _i, _j, _len, _len1;
      array = [];
      current = '';
      split = false;
      func = 0;
      quote = false;
      escape = false;
      for (_i = 0, _len = string.length; _i < _len; _i++) {
        letter = string[_i];
        if (quote) {
          if (escape) {
            escape = false;
          } else if (letter === '\\') {
            escape = true;
          } else if (letter === quote) {
            quote = false;
          }
        } else if (letter === '"' || letter === "'") {
          quote = letter;
        } else if (letter === '(') {
          func += 1;
        } else if (letter === ')') {
          if (func > 0) {
            func -= 1;
          }
        } else if (func === 0) {
          for (_j = 0, _len1 = separators.length; _j < _len1; _j++) {
            separator = separators[_j];
            if (letter === separator) {
              split = true;
            }
          }
        }
        if (split) {
          if (current !== '') {
            array.push(current.trim());
          }
          current = '';
          split = false;
        } else {
          current += letter;
        }
      }
      if (last || current !== '') {
        array.push(current.trim());
      }
      return array;
    },
    space: function(string) {
      return this.split(string, [' ', "\n", "\t"]);
    },
    comma: function(string) {
      return this.split(string, [','], true);
    }
  };

  module.exports = list;

}).call(this);

},{}],99:[function(require,module,exports){
(function() {
  var MapGenerator, Result, base64js, fs, lazy, mozilla, path;

  base64js = require('base64-js');

  mozilla = require('source-map');

  Result = require('./result');

  lazy = require('./lazy');

  path = require('path');

  fs = require('fs');

  MapGenerator = (function() {
    function MapGenerator(root, opts) {
      this.root = root;
      this.opts = opts;
    }

    MapGenerator.prototype.startWith = function(string, start) {
      return string.slice(0, +(start.length - 1) + 1 || 9e9) === start;
    };

    MapGenerator.prototype.isMap = function() {
      if (typeof this.opts.map === 'boolean') {
        return this.opts.map;
      }
      return !!this.opts.inlineMap || !!this.prevMap();
    };

    lazy(MapGenerator, 'isInline', function() {
      if (this.opts.inlineMap != null) {
        return this.opts.inlineMap;
      }
      return this.isPrevInline();
    });

    lazy(MapGenerator, 'isPrevInline', function() {
      var text;
      if (!this.prevAnnotation()) {
        return false;
      }
      text = this.prevAnnotation().text;
      return this.startWith(text, '# sourceMappingURL=data:');
    });

    lazy(MapGenerator, 'prevMap', function() {
      var file, map;
      if (this.opts.map && typeof this.opts.map !== 'boolean') {
        return this.opts.map;
      }
      if (this.isPrevInline()) {
        return this.encodeInline(this.prevAnnotation().text);
      } else if (this.opts.from) {
        map = this.opts.from + '.map';
        if (this.prevAnnotation()) {
          file = this.prevAnnotation().text.replace('# sourceMappingURL=', '');
          map = path.join(path.dirname(this.opts.from), file);
        }
        if (typeof fs.existsSync === "function" ? fs.existsSync(map) : void 0) {
          return fs.readFileSync(map).toString();
        } else {
          return false;
        }
      }
    });

    lazy(MapGenerator, 'prevAnnotation', function() {
      var last;
      last = this.root.last;
      if (!last) {
        return null;
      }
      if (last.type === 'comment' && this.startWith(last.text, '# sourceMappingURL=')) {
        return last;
      } else {
        return null;
      }
    });

    MapGenerator.prototype.encodeInline = function(text) {
      var base64, byte, bytes, uri;
      uri = '# sourceMappingURL=data:application/json,';
      base64 = '# sourceMappingURL=data:application/json;base64,';
      if (this.startWith(text, uri)) {
        return decodeURIComponent(text.slice(uri.length));
      } else if (this.startWith(text, base64)) {
        text = text.slice(base64.length);
        bytes = base64js.toByteArray(text);
        return ((function() {
          var _i, _len, _results;
          _results = [];
          for (_i = 0, _len = bytes.length; _i < _len; _i++) {
            byte = bytes[_i];
            _results.push(String.fromCharCode(byte));
          }
          return _results;
        })()).join('');
      } else {
        throw new Error('Unknown source map encoding');
      }
    };

    MapGenerator.prototype.clearAnnotation = function() {
      var _ref;
      return (_ref = this.prevAnnotation()) != null ? _ref.removeSelf() : void 0;
    };

    MapGenerator.prototype.applyPrevMap = function() {
      var from, prev;
      if (this.prevMap()) {
        prev = this.prevMap();
        prev = typeof prev === 'string' ? JSON.parse(prev) : prev instanceof mozilla.SourceMapConsumer ? mozilla.SourceMapGenerator.fromSourceMap(prev).toJSON() : typeof prev === 'object' && prev.toJSON ? prev.toJSON() : prev;
        prev = new mozilla.SourceMapConsumer(prev);
        from = this.relative(this.opts.from);
        return this.map.applySourceMap(prev, from, path.dirname(from));
      }
    };

    MapGenerator.prototype.addAnnotation = function() {
      var bytes, char, content;
      if (this.opts.mapAnnotation === false) {
        return;
      }
      if (this.prevMap() && !this.prevAnnotation()) {
        return;
      }
      content = this.isInline() ? (bytes = (function() {
        var _i, _len, _ref, _results;
        _ref = this.map.toString();
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          char = _ref[_i];
          _results.push(char.charCodeAt(0));
        }
        return _results;
      }).call(this), "data:application/json;base64," + base64js.fromByteArray(bytes)) : this.outputFile() + '.map';
      return this.css += "\n/*# sourceMappingURL=" + content + " */";
    };

    MapGenerator.prototype.outputFile = function() {
      if (this.opts.to) {
        return path.basename(this.opts.to);
      } else {
        return 'to.css';
      }
    };

    MapGenerator.prototype.generateMap = function() {
      this.stringify();
      this.applyPrevMap();
      this.addAnnotation();
      if (this.isInline()) {
        return new Result(this.css);
      } else {
        return new Result(this.css, this.map.toString());
      }
    };

    MapGenerator.prototype.relative = function(file) {
      var from;
      from = this.opts.to ? path.dirname(this.opts.to) : '.';
      file = path.relative(from, file);
      if (path.sep === '\\') {
        file = file.replace('\\', '/');
      }
      return file;
    };

    MapGenerator.prototype.sourcePath = function(node) {
      return this.relative(node.source.file || 'from.css');
    };

    MapGenerator.prototype.stringify = function() {
      var builder, column, line;
      this.css = '';
      this.map = new mozilla.SourceMapGenerator({
        file: this.outputFile()
      });
      line = 1;
      column = 1;
      builder = (function(_this) {
        return function(str, node, type) {
          var last, lines, _ref, _ref1;
          _this.css += str;
          if ((node != null ? (_ref = node.source) != null ? _ref.start : void 0 : void 0) && type !== 'end') {
            _this.map.addMapping({
              source: _this.sourcePath(node),
              original: {
                line: node.source.start.line,
                column: node.source.start.column - 1
              },
              generated: {
                line: line,
                column: column - 1
              }
            });
          }
          lines = str.match(/\n/g);
          if (lines) {
            line += lines.length;
            last = str.lastIndexOf("\n");
            column = str.length - last;
          } else {
            column = column + str.length;
          }
          if ((node != null ? (_ref1 = node.source) != null ? _ref1.end : void 0 : void 0) && type !== 'start') {
            return _this.map.addMapping({
              source: _this.sourcePath(node),
              original: {
                line: node.source.end.line,
                column: node.source.end.column
              },
              generated: {
                line: line,
                column: column
              }
            });
          }
        };
      })(this);
      return this.root.stringify(builder);
    };

    MapGenerator.prototype.getResult = function() {
      this.clearAnnotation();
      if (this.isMap()) {
        return this.generateMap();
      } else {
        return new Result(this.root.toString());
      }
    };

    return MapGenerator;

  })();

  module.exports = MapGenerator;

}).call(this);

},{"./lazy":97,"./result":104,"base64-js":109,"fs":1,"path":5,"source-map":110}],100:[function(require,module,exports){
(function() {
  var Node, Raw, clone, keys,
    __hasProp = {}.hasOwnProperty;

  Raw = require('./raw');

  clone = function(obj, parent) {
    var cloned, name, value;
    if (typeof obj !== 'object') {
      return obj;
    }
    cloned = new obj.constructor();
    for (name in obj) {
      if (!__hasProp.call(obj, name)) continue;
      value = obj[name];
      if (name === 'parent' && typeof value === 'object') {
        if (parent) {
          cloned[name] = parent;
        }
      } else if (value instanceof Array) {
        cloned[name] = value.map(function(i) {
          return clone(i, cloned);
        });
      } else {
        cloned[name] = clone(value, cloned);
      }
    }
    return cloned;
  };

  keys = function(obj, keys) {
    var all, key;
    all = {};
    for (key in keys) {
      if (obj[key] != null) {
        all[key] = obj[key];
      } else {
        return false;
      }
    }
    return all;
  };

  Node = (function() {
    function Node(defaults) {
      var name, value;
      if (defaults == null) {
        defaults = {};
      }
      for (name in defaults) {
        value = defaults[name];
        this[name] = value;
      }
    }

    Node.prop = function(name, params) {
      return Object.defineProperty(this.prototype, name, params);
    };

    Node.raw = function(name) {
      var hidden;
      hidden = '_' + name;
      return this.prop(name, {
        get: function() {
          var prop;
          prop = this[hidden];
          if (prop instanceof Raw) {
            return prop.value;
          } else {
            return prop;
          }
        },
        set: function(value) {
          if (value instanceof Raw) {
            return this[hidden] = value;
          } else {
            return this[hidden] = value;
          }
        }
      });
    };

    Node.prototype.removeSelf = function() {
      if (!this.parent) {
        return;
      }
      this.parent.remove(this);
      return this;
    };

    Node.prototype.toString = function() {
      var builder, result;
      result = '';
      builder = function(str) {
        return result += str;
      };
      this.stringify(builder);
      return result;
    };

    Node.prototype.clone = function(overrides) {
      var cloned, name, value;
      if (overrides == null) {
        overrides = {};
      }
      cloned = clone(this);
      for (name in overrides) {
        value = overrides[name];
        cloned[name] = value;
      }
      return cloned;
    };

    Node.prototype.toJSON = function() {
      var fixed, name, value;
      fixed = {};
      for (name in this) {
        if (!__hasProp.call(this, name)) continue;
        value = this[name];
        if (name === 'parent') {
          continue;
        }
        fixed[name] = value instanceof Array ? value.map(function(i) {
          if (typeof i === 'object' && i.toJSON) {
            return i.toJSON();
          } else {
            return i;
          }
        }) : typeof value === 'object' && value.toJSON ? value.toJSON() : value;
      }
      return fixed;
    };

    Node.prototype.defaultStyle = function() {
      return {};
    };

    Node.prototype.styleType = function() {
      return this.type;
    };

    Node.prototype.style = function() {
      var all, defaults, key, merge, root, style, type;
      type = this.styleType();
      defaults = this.defaultStyle(type);
      all = keys(this, defaults);
      if (all) {
        return all;
      }
      style = defaults;
      if (this.parent) {
        root = this;
        while (root.parent) {
          root = root.parent;
        }
        root.styleCache || (root.styleCache = {});
        if (root.styleCache[type]) {
          style = root.styleCache[type];
        } else {
          root.eachInside(function(another) {
            if (another.styleType() !== type) {
              return;
            }
            if (this === another) {
              return;
            }
            all = keys(another, style);
            if (all) {
              style = all;
              return false;
            }
          });
          root.styleCache[type] = style;
        }
      }
      merge = {};
      for (key in style) {
        merge[key] = this[key] != null ? this[key] : style[key];
      }
      return merge;
    };

    return Node;

  })();

  module.exports = Node;

}).call(this);

},{"./raw":103}],101:[function(require,module,exports){
(function() {
  var AtRule, Comment, Declaration, Parser, Raw, Root, Rule, SyntexError;

  SyntexError = require('./syntax-error');

  Declaration = require('./declaration');

  Comment = require('./comment');

  AtRule = require('./at-rule');

  Root = require('./root');

  Rule = require('./rule');

  Raw = require('./raw');

  Parser = (function() {
    function Parser(source, opts) {
      this.opts = opts;
      this.source = source.toString();
      this.root = new Root();
      this.current = this.root;
      this.parents = [this.current];
      this.type = 'rules';
      this.types = [this.type];
      this.pos = -1;
      this.line = 1;
      this.lines = [];
      this.column = 0;
      this.buffer = '';
    }

    Parser.prototype.loop = function() {
      while (this.pos < this.source.length - 1) {
        this.move();
        this.nextLetter();
      }
      return this.endFile();
    };

    Parser.prototype.nextLetter = function() {
      this.inString() || this.inComment() || this.isComment() || this.isString() || this.isWrong() || this.inAtrule() || this.isAtrule() || this.isBlockEnd() || this.inSelector() || this.isSelector() || this.inProperty() || this.isProperty() || this.inValue();
      return this.unknown();
    };

    Parser.prototype.inString = function() {
      if (this.quote) {
        if (this.escape) {
          this.escape = false;
        } else if (this.letter === '\\') {
          this.escape = true;
        } else if (this.letter === this.quote) {
          this.quote = void 0;
        }
        this.trimmed += this.letter;
        return true;
      }
    };

    Parser.prototype.isString = function() {
      if (this.letter === '"' || this.letter === "'") {
        this.quote = this.letter;
        this.quotePos = {
          line: this.line,
          column: this.column
        };
        this.trimmed += this.letter;
        return true;
      }
    };

    Parser.prototype.inComment = function() {
      var left, right, text, _ref, _ref1;
      if (this.inside('comment')) {
        if (this.next('*/')) {
          _ref = this.startSpaces(this.prevBuffer()), text = _ref[0], left = _ref[1];
          _ref1 = this.endSpaces(text), text = _ref1[0], right = _ref1[1];
          this.current.text = text;
          this.current.left = left;
          this.current.right = right;
          this.move();
          this.pop();
        }
        return true;
      } else if (this.inside('value-comment')) {
        if (this.next('*/')) {
          this.popType();
          this.move();
        }
        return true;
      }
    };

    Parser.prototype.isComment = function() {
      if (this.next('/*')) {
        if (this.inside('rules') || this.inside('decls')) {
          this.init(new Comment());
          this.addType('comment');
          this.move();
          return this.buffer = '';
        } else {
          this.commentPos = {
            line: this.line,
            column: this.column
          };
          this.addType('value-comment');
          this.move();
          return true;
        }
      }
    };

    Parser.prototype.isWrong = function() {
      if (this.letter === '{' && (this.inside('decls') || this.inside('value'))) {
        this.error("Unexpected {");
      }
      if (this.inside('prop') && (this.letter === '}' || this.letter === ';')) {
        return this.error('Missing property value');
      }
    };

    Parser.prototype.isAtrule = function() {
      if (this.letter === '@' && this.inside('rules')) {
        this.init(new AtRule());
        this.current.name = '';
        this.addType('atrule-name');
        return true;
      }
    };

    Parser.prototype.inAtrule = function(close) {
      var left, raw, right, _ref, _ref1;
      if (this.inside('atrule-name')) {
        if (this.space()) {
          this.checkAtruleName();
          this.buffer = this.buffer.slice(this.current.name.length);
          this.trimmed = '';
          this.setType('atrule-param');
        } else if (this.letter === ';' || this.letter === '{' || close) {
          this.current.between = '';
          this.checkAtruleName();
          this.endAtruleParams();
        } else {
          this.current.name += this.letter;
        }
        return true;
      } else if (this.inside('atrule-param')) {
        if (this.letter === ';' || this.letter === '{' || close) {
          _ref = this.startSpaces(this.prevBuffer()), raw = _ref[0], left = _ref[1];
          _ref1 = this.endSpaces(raw), raw = _ref1[0], right = _ref1[1];
          this.current.params = this.raw(this.trimmed.trim(), raw);
          if (this.current.params) {
            this.current.afterName = left;
            this.current.between = right;
          } else {
            this.current.afterName = '';
            this.current.between = left + right;
          }
          this.endAtruleParams();
        } else {
          this.trimmed += this.letter;
        }
        return true;
      }
    };

    Parser.prototype.inSelector = function() {
      var raw, spaces, _ref;
      if (this.inside('selector')) {
        if (this.letter === '{') {
          _ref = this.endSpaces(this.prevBuffer()), raw = _ref[0], spaces = _ref[1];
          this.current.selector = this.raw(this.trimmed.trim(), raw);
          this.current.between = spaces;
          this.semicolon = false;
          this.buffer = '';
          this.setType('decls');
        } else {
          this.trimmed += this.letter;
        }
        return true;
      }
    };

    Parser.prototype.isSelector = function() {
      if (!this.space() && this.inside('rules')) {
        this.init(new Rule());
        if (this.letter === '{') {
          this.addType('decls');
          this.current.selector = '';
          this.current.between = '';
          this.semicolon = false;
          this.buffer = '';
        } else {
          this.addType('selector');
          this.buffer = this.letter;
          this.trimmed = this.letter;
        }
        return true;
      }
    };

    Parser.prototype.isBlockEnd = function() {
      if (this.letter === '}') {
        if (this.parents.length === 1) {
          this.error('Unexpected }');
        } else {
          if (this.inside('value')) {
            this.fixEnd(function() {
              return this.inValue('close');
            });
          } else {
            if (this.semicolon) {
              this.current.semicolon = true;
            }
            this.current.after = this.prevBuffer();
          }
          this.pop();
        }
        return true;
      }
    };

    Parser.prototype.inProperty = function() {
      if (this.inside('prop')) {
        if (this.letter === ':') {
          if (this.buffer[0] === '*' || this.buffer[0] === '_') {
            this.current.before += this.buffer[0];
            this.trimmed = this.trimmed.slice(1);
            this.buffer = this.buffer.slice(1);
          }
          this.current.prop = this.trimmed.trim();
          this.current.between = this.prevBuffer().slice(this.current.prop.length);
          this.buffer = '';
          this.setType('value');
          this.trimmed = '';
        } else if (this.letter === '{') {
          this.error('Unexpected { in decls');
        } else {
          this.trimmed += this.letter;
        }
        return true;
      }
    };

    Parser.prototype.isProperty = function() {
      if (this.inside('decls') && !this.space() && this.letter !== ';') {
        this.init(new Declaration());
        this.addType('prop');
        this.buffer = this.letter;
        this.trimmed = this.letter;
        this.semicolon = false;
        return true;
      }
    };

    Parser.prototype.inValue = function(close) {
      var end, match, raw, spaces, trim, _ref;
      if (this.inside('value')) {
        if (this.letter === '(') {
          this.inBrackets = true;
        } else if (this.inBrackets && this.letter === ')') {
          this.inBrackets = false;
        }
        if ((this.letter === ';' && !this.inBrackets) || close) {
          if (this.letter === ';') {
            this.semicolon = true;
          }
          _ref = this.startSpaces(this.prevBuffer()), raw = _ref[0], spaces = _ref[1];
          trim = this.trimmed.trim();
          if (match = raw.match(/\s+!important\s*$/)) {
            this.current._important = match[0];
            end = -match[0].length - 1;
            raw = raw.slice(0, +end + 1 || 9e9);
            trim = trim.replace(/\s+!important$/, '');
          }
          this.current.value = this.raw(trim, raw);
          this.current.between += ':' + spaces;
          this.pop();
        } else {
          this.trimmed += this.letter;
        }
        return true;
      }
    };

    Parser.prototype.unknown = function() {
      if (!this.space) {
        return this.error("Unexpected symbol " + this.letter);
      }
    };

    Parser.prototype.endFile = function() {
      if (this.inside('atrule-param') || this.inside('atrule-name')) {
        this.fixEnd(function() {
          return this.inAtrule('close');
        });
      }
      if (this.inside('comment')) {
        return this.error('Unclosed comment', this.current.source.start);
      } else if (this.parents.length > 1) {
        return this.error('Unclosed block', this.current.source.start);
      } else if (this.inside('value-comment')) {
        return this.error('Unclosed comment', this.commentPos);
      } else if (this.quote) {
        return this.error('Unclosed quote', this.quotePos);
      } else {
        return this.root.after = this.buffer;
      }
    };

    Parser.prototype.error = function(message, position) {
      if (position == null) {
        position = {
          line: this.line,
          column: this.column
        };
      }
      throw new SyntexError(message, this.source, position, this.opts.from);
    };

    Parser.prototype.move = function() {
      this.pos += 1;
      this.column += 1;
      this.letter = this.source[this.pos];
      this.buffer += this.letter;
      if (this.letter === "\n") {
        this.lines[this.line] = this.column - 1;
        this.line += 1;
        return this.column = 0;
      }
    };

    Parser.prototype.prevBuffer = function() {
      return this.buffer.slice(0, -1);
    };

    Parser.prototype.inside = function(type) {
      return this.type === type;
    };

    Parser.prototype.next = function(string) {
      return this.source.slice(this.pos, +(this.pos + string.length - 1) + 1 || 9e9) === string;
    };

    Parser.prototype.space = function() {
      return this.letter.match(/\s/);
    };

    Parser.prototype.init = function(node) {
      this.current.push(node);
      this.parents.push(node);
      this.current = node;
      this.current.source = {
        start: {
          line: this.line,
          column: this.column
        }
      };
      if (this.opts.from) {
        this.current.source.file = this.opts.from;
      }
      this.current.before = this.buffer.slice(0, -1);
      return this.buffer = '';
    };

    Parser.prototype.raw = function(value, raw) {
      if (value !== raw) {
        return new Raw(value, raw);
      } else {
        return value;
      }
    };

    Parser.prototype.fixEnd = function(callback) {
      var after, all, el, last, lines, start;
      if (this.letter === '}') {
        start = this.buffer.search(/\s*\}$/);
        after = this.buffer.slice(start, -1);
      } else {
        start = this.buffer.search(/\s*$/);
        after = this.buffer.slice(start);
      }
      this.buffer = this.buffer.slice(0, +start + 1 || 9e9);
      el = this.current;
      callback.apply(this);
      lines = after.match(/\n/g);
      if (lines) {
        el.source.end.line -= lines.length;
        all = this.lines[el.source.end.line];
        last = after.indexOf("\n");
        if (last === -1) {
          last = after.length;
        }
        el.source.end.column = all - last;
      } else {
        el.source.end.column -= after.length;
      }
      this.current.after = after;
      return this.buffer = after;
    };

    Parser.prototype.pop = function() {
      this.current.source.end = {
        line: this.line,
        column: this.column
      };
      this.popType();
      this.parents.pop();
      this.current = this.parents[this.parents.length - 1];
      return this.buffer = '';
    };

    Parser.prototype.addType = function(type) {
      this.types.push(type);
      return this.type = type;
    };

    Parser.prototype.setType = function(type) {
      this.types[this.types.length - 1] = type;
      return this.type = type;
    };

    Parser.prototype.popType = function() {
      this.types.pop();
      return this.type = this.types[this.types.length - 1];
    };

    Parser.prototype.atruleType = function() {
      var name;
      name = this.current.name.toLowerCase();
      if (name === 'page' || name === 'font-face' || name.slice(-8) === 'viewport') {
        return 'decls';
      } else {
        return 'rules';
      }
    };

    Parser.prototype.endAtruleParams = function() {
      var type;
      if (this.letter === '{') {
        type = this.atruleType();
        this.current.addMixin(type);
        this.setType(type);
        return this.buffer = '';
      } else {
        if (this.letter === ';') {
          this.current.semicolon = true;
        }
        return this.pop();
      }
    };

    Parser.prototype.checkAtruleName = function() {
      if (this.current.name === '') {
        return this.error('At-rule without name');
      }
    };

    Parser.prototype.startSpaces = function(string) {
      var match, pos;
      match = string.match(/^\s*/);
      if (match) {
        pos = match[0].length;
        return [string.slice(pos), match[0]];
      } else {
        return [string, ''];
      }
    };

    Parser.prototype.endSpaces = function(string) {
      var match, pos;
      match = string.match(/\s*$/);
      if (match) {
        pos = match[0].length + 1;
        return [string.slice(0, +(-pos) + 1 || 9e9), match[0]];
      } else {
        return [string, ''];
      }
    };

    return Parser;

  })();

  module.exports = function(source, opts) {
    var parser;
    if (opts == null) {
      opts = {};
    }
    parser = new Parser(source, opts);
    parser.loop();
    return parser.root;
  };

}).call(this);

},{"./at-rule":93,"./comment":94,"./declaration":96,"./raw":103,"./root":105,"./rule":106,"./syntax-error":107}],102:[function(require,module,exports){
(function() {
  var AtRule, Comment, Declaration, PostCSS, Root, Rule, postcss,
    __slice = [].slice;

  Declaration = require('./declaration');

  Comment = require('./comment');

  AtRule = require('./at-rule');

  Rule = require('./rule');

  Root = require('./root');

  PostCSS = (function() {
    function PostCSS(processors) {
      this.processors = processors != null ? processors : [];
    }

    PostCSS.prototype.use = function(processor) {
      this.processors.push(processor);
      return this;
    };

    PostCSS.prototype.process = function(css, opts) {
      var parsed, processor, returned, _i, _len, _ref;
      if (opts == null) {
        opts = {};
      }
      parsed = postcss.parse(css, opts);
      _ref = this.processors;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        processor = _ref[_i];
        returned = processor(parsed);
        if (returned instanceof Root) {
          parsed = returned;
        }
      }
      return parsed.toResult(opts);
    };

    return PostCSS;

  })();

  postcss = function() {
    var processors;
    processors = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    return new PostCSS(processors);
  };

  postcss.parse = require('./parse');

  postcss.comment = function(defaults) {
    return new Comment(defaults);
  };

  postcss.atRule = function(defaults) {
    return new AtRule(defaults);
  };

  postcss.decl = function(defaults) {
    return new Declaration(defaults);
  };

  postcss.rule = function(defaults) {
    return new Rule(defaults);
  };

  postcss.root = function(defaults) {
    return new Root(defaults);
  };

  module.exports = postcss;

}).call(this);

},{"./at-rule":93,"./comment":94,"./declaration":96,"./parse":101,"./root":105,"./rule":106}],103:[function(require,module,exports){
(function() {
  var Raw;

  Raw = (function() {
    Raw.load = function(value, raw) {
      if ((raw != null) && value !== raw) {
        return new Raw(value, raw);
      } else {
        return value;
      }
    };

    function Raw(value, raw) {
      this.value = value;
      this.raw = raw;
    }

    Raw.prototype.toString = function() {
      if (this.changed) {
        return this.value || '';
      } else {
        return this.raw || this.value || '';
      }
    };

    return Raw;

  })();

  module.exports = Raw;

}).call(this);

},{}],104:[function(require,module,exports){
(function() {
  var Result;

  Result = (function() {
    function Result(css, map) {
      this.css = css;
      if (map) {
        this.map = map;
      }
    }

    Result.prototype.toString = function() {
      return this.css;
    };

    return Result;

  })();

  module.exports = Result;

}).call(this);

},{}],105:[function(require,module,exports){
(function() {
  var AtRule, Comment, Container, Declaration, MapGenerator, Root, Rule,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  MapGenerator = require('./map-generator');

  Declaration = require('./declaration');

  Container = require('./container');

  Comment = require('./comment');

  AtRule = require('./at-rule');

  Rule = require('./rule');

  Root = (function(_super) {
    __extends(Root, _super);

    function Root() {
      this.type = 'root';
      this.rules = [];
      Root.__super__.constructor.apply(this, arguments);
    }

    Root.prototype.normalize = function(child, sample, type) {
      child = Root.__super__.normalize.apply(this, arguments);
      if (type === 'prepend') {
        sample.before = this.rules.length > 1 ? this.rules[1].before : this.after;
      }
      return child;
    };

    Root.prototype.stringify = function(builder) {
      this.stringifyContent(builder);
      if (this.after) {
        return builder(this.after);
      }
    };

    Root.prototype.toResult = function(opts) {
      var map;
      if (opts == null) {
        opts = {};
      }
      map = new MapGenerator(this, opts);
      return map.getResult();
    };

    return Root;

  })(Container.WithRules);

  module.exports = Root;

}).call(this);

},{"./at-rule":93,"./comment":94,"./container":95,"./declaration":96,"./map-generator":99,"./rule":106}],106:[function(require,module,exports){
(function() {
  var Container, Declaration, Rule, list,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  Container = require('./container');

  Declaration = require('./declaration');

  list = require('./list');

  Rule = (function(_super) {
    __extends(Rule, _super);

    function Rule() {
      this.type = 'rule';
      Rule.__super__.constructor.apply(this, arguments);
    }

    Rule.prototype.styleType = function() {
      return this.type + (this.decls.length ? '-body' : '-empty');
    };

    Rule.prototype.defaultStyle = function(type) {
      if (type === 'rule-body') {
        return {
          between: ' ',
          after: this.defaultAfter()
        };
      } else {
        return {
          between: ' ',
          after: ''
        };
      }
    };

    Rule.raw('selector');

    Rule.prop('selectors', {
      get: function() {
        return list.comma(this.selector);
      },
      set: function(values) {
        return this.selector = values.join(', ');
      }
    });

    Rule.prototype.stringify = function(builder) {
      return this.stringifyBlock(builder, this._selector + this.style().between + '{');
    };

    return Rule;

  })(Container.WithDecls);

  module.exports = Rule;

}).call(this);

},{"./container":95,"./declaration":96,"./list":98}],107:[function(require,module,exports){
(function() {
  var SyntaxError,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  SyntaxError = (function(_super) {
    __extends(SyntaxError, _super);

    function SyntaxError(text, source, pos, file) {
      this.source = source;
      this.file = file;
      this.line = pos.line;
      this.column = pos.column;
      this.message = "Can't parse CSS: " + text;
      this.message += " at line " + pos.line + ":" + pos.column;
      if (this.file) {
        this.message += " in " + this.file;
      }
    }

    return SyntaxError;

  })(Error);

  module.exports = SyntaxError;

}).call(this);

},{}],108:[function(require,module,exports){
(function() {
  var vendor;

  vendor = {
    prefix: function(prop) {
      var separator;
      if (prop[0] === '-') {
        separator = prop.indexOf('-', 1) + 1;
        return prop.slice(0, separator);
      } else {
        return '';
      }
    },
    unprefixed: function(prop) {
      var separator;
      if (prop[0] === '-') {
        separator = prop.indexOf('-', 1) + 1;
        return prop.slice(separator);
      } else {
        return prop;
      }
    }
  };

  module.exports = vendor;

}).call(this);

},{}],109:[function(require,module,exports){
module.exports=require(3)
},{}],110:[function(require,module,exports){
/*
 * Copyright 2009-2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE.txt or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
exports.SourceMapGenerator = require('./source-map/source-map-generator').SourceMapGenerator;
exports.SourceMapConsumer = require('./source-map/source-map-consumer').SourceMapConsumer;
exports.SourceNode = require('./source-map/source-node').SourceNode;

},{"./source-map/source-map-consumer":115,"./source-map/source-map-generator":116,"./source-map/source-node":117}],111:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  var util = require('./util');

  /**
   * A data structure which is a combination of an array and a set. Adding a new
   * member is O(1), testing for membership is O(1), and finding the index of an
   * element is O(1). Removing elements from the set is not supported. Only
   * strings are supported for membership.
   */
  function ArraySet() {
    this._array = [];
    this._set = {};
  }

  /**
   * Static method for creating ArraySet instances from an existing array.
   */
  ArraySet.fromArray = function ArraySet_fromArray(aArray, aAllowDuplicates) {
    var set = new ArraySet();
    for (var i = 0, len = aArray.length; i < len; i++) {
      set.add(aArray[i], aAllowDuplicates);
    }
    return set;
  };

  /**
   * Add the given string to this set.
   *
   * @param String aStr
   */
  ArraySet.prototype.add = function ArraySet_add(aStr, aAllowDuplicates) {
    var isDuplicate = this.has(aStr);
    var idx = this._array.length;
    if (!isDuplicate || aAllowDuplicates) {
      this._array.push(aStr);
    }
    if (!isDuplicate) {
      this._set[util.toSetString(aStr)] = idx;
    }
  };

  /**
   * Is the given string a member of this set?
   *
   * @param String aStr
   */
  ArraySet.prototype.has = function ArraySet_has(aStr) {
    return Object.prototype.hasOwnProperty.call(this._set,
                                                util.toSetString(aStr));
  };

  /**
   * What is the index of the given string in the array?
   *
   * @param String aStr
   */
  ArraySet.prototype.indexOf = function ArraySet_indexOf(aStr) {
    if (this.has(aStr)) {
      return this._set[util.toSetString(aStr)];
    }
    throw new Error('"' + aStr + '" is not in the set.');
  };

  /**
   * What is the element at the given index?
   *
   * @param Number aIdx
   */
  ArraySet.prototype.at = function ArraySet_at(aIdx) {
    if (aIdx >= 0 && aIdx < this._array.length) {
      return this._array[aIdx];
    }
    throw new Error('No element indexed by ' + aIdx);
  };

  /**
   * Returns the array representation of this set (which has the proper indices
   * indicated by indexOf). Note that this is a copy of the internal array used
   * for storing the members so that no one can mess with internal state.
   */
  ArraySet.prototype.toArray = function ArraySet_toArray() {
    return this._array.slice();
  };

  exports.ArraySet = ArraySet;

});

},{"./util":118,"amdefine":119}],112:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 *
 * Based on the Base 64 VLQ implementation in Closure Compiler:
 * https://code.google.com/p/closure-compiler/source/browse/trunk/src/com/google/debugging/sourcemap/Base64VLQ.java
 *
 * Copyright 2011 The Closure Compiler Authors. All rights reserved.
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *  * Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 *  * Redistributions in binary form must reproduce the above
 *    copyright notice, this list of conditions and the following
 *    disclaimer in the documentation and/or other materials provided
 *    with the distribution.
 *  * Neither the name of Google Inc. nor the names of its
 *    contributors may be used to endorse or promote products derived
 *    from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  var base64 = require('./base64');

  // A single base 64 digit can contain 6 bits of data. For the base 64 variable
  // length quantities we use in the source map spec, the first bit is the sign,
  // the next four bits are the actual value, and the 6th bit is the
  // continuation bit. The continuation bit tells us whether there are more
  // digits in this value following this digit.
  //
  //   Continuation
  //   |    Sign
  //   |    |
  //   V    V
  //   101011

  var VLQ_BASE_SHIFT = 5;

  // binary: 100000
  var VLQ_BASE = 1 << VLQ_BASE_SHIFT;

  // binary: 011111
  var VLQ_BASE_MASK = VLQ_BASE - 1;

  // binary: 100000
  var VLQ_CONTINUATION_BIT = VLQ_BASE;

  /**
   * Converts from a two-complement value to a value where the sign bit is
   * is placed in the least significant bit.  For example, as decimals:
   *   1 becomes 2 (10 binary), -1 becomes 3 (11 binary)
   *   2 becomes 4 (100 binary), -2 becomes 5 (101 binary)
   */
  function toVLQSigned(aValue) {
    return aValue < 0
      ? ((-aValue) << 1) + 1
      : (aValue << 1) + 0;
  }

  /**
   * Converts to a two-complement value from a value where the sign bit is
   * is placed in the least significant bit.  For example, as decimals:
   *   2 (10 binary) becomes 1, 3 (11 binary) becomes -1
   *   4 (100 binary) becomes 2, 5 (101 binary) becomes -2
   */
  function fromVLQSigned(aValue) {
    var isNegative = (aValue & 1) === 1;
    var shifted = aValue >> 1;
    return isNegative
      ? -shifted
      : shifted;
  }

  /**
   * Returns the base 64 VLQ encoded value.
   */
  exports.encode = function base64VLQ_encode(aValue) {
    var encoded = "";
    var digit;

    var vlq = toVLQSigned(aValue);

    do {
      digit = vlq & VLQ_BASE_MASK;
      vlq >>>= VLQ_BASE_SHIFT;
      if (vlq > 0) {
        // There are still more digits in this value, so we must make sure the
        // continuation bit is marked.
        digit |= VLQ_CONTINUATION_BIT;
      }
      encoded += base64.encode(digit);
    } while (vlq > 0);

    return encoded;
  };

  /**
   * Decodes the next base 64 VLQ value from the given string and returns the
   * value and the rest of the string.
   */
  exports.decode = function base64VLQ_decode(aStr) {
    var i = 0;
    var strLen = aStr.length;
    var result = 0;
    var shift = 0;
    var continuation, digit;

    do {
      if (i >= strLen) {
        throw new Error("Expected more digits in base 64 VLQ value.");
      }
      digit = base64.decode(aStr.charAt(i++));
      continuation = !!(digit & VLQ_CONTINUATION_BIT);
      digit &= VLQ_BASE_MASK;
      result = result + (digit << shift);
      shift += VLQ_BASE_SHIFT;
    } while (continuation);

    return {
      value: fromVLQSigned(result),
      rest: aStr.slice(i)
    };
  };

});

},{"./base64":113,"amdefine":119}],113:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  var charToIntMap = {};
  var intToCharMap = {};

  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    .split('')
    .forEach(function (ch, index) {
      charToIntMap[ch] = index;
      intToCharMap[index] = ch;
    });

  /**
   * Encode an integer in the range of 0 to 63 to a single base 64 digit.
   */
  exports.encode = function base64_encode(aNumber) {
    if (aNumber in intToCharMap) {
      return intToCharMap[aNumber];
    }
    throw new TypeError("Must be between 0 and 63: " + aNumber);
  };

  /**
   * Decode a single base 64 digit to an integer.
   */
  exports.decode = function base64_decode(aChar) {
    if (aChar in charToIntMap) {
      return charToIntMap[aChar];
    }
    throw new TypeError("Not a valid base 64 digit: " + aChar);
  };

});

},{"amdefine":119}],114:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  /**
   * Recursive implementation of binary search.
   *
   * @param aLow Indices here and lower do not contain the needle.
   * @param aHigh Indices here and higher do not contain the needle.
   * @param aNeedle The element being searched for.
   * @param aHaystack The non-empty array being searched.
   * @param aCompare Function which takes two elements and returns -1, 0, or 1.
   */
  function recursiveSearch(aLow, aHigh, aNeedle, aHaystack, aCompare) {
    // This function terminates when one of the following is true:
    //
    //   1. We find the exact element we are looking for.
    //
    //   2. We did not find the exact element, but we can return the next
    //      closest element that is less than that element.
    //
    //   3. We did not find the exact element, and there is no next-closest
    //      element which is less than the one we are searching for, so we
    //      return null.
    var mid = Math.floor((aHigh - aLow) / 2) + aLow;
    var cmp = aCompare(aNeedle, aHaystack[mid], true);
    if (cmp === 0) {
      // Found the element we are looking for.
      return aHaystack[mid];
    }
    else if (cmp > 0) {
      // aHaystack[mid] is greater than our needle.
      if (aHigh - mid > 1) {
        // The element is in the upper half.
        return recursiveSearch(mid, aHigh, aNeedle, aHaystack, aCompare);
      }
      // We did not find an exact match, return the next closest one
      // (termination case 2).
      return aHaystack[mid];
    }
    else {
      // aHaystack[mid] is less than our needle.
      if (mid - aLow > 1) {
        // The element is in the lower half.
        return recursiveSearch(aLow, mid, aNeedle, aHaystack, aCompare);
      }
      // The exact needle element was not found in this haystack. Determine if
      // we are in termination case (2) or (3) and return the appropriate thing.
      return aLow < 0
        ? null
        : aHaystack[aLow];
    }
  }

  /**
   * This is an implementation of binary search which will always try and return
   * the next lowest value checked if there is no exact hit. This is because
   * mappings between original and generated line/col pairs are single points,
   * and there is an implicit region between each of them, so a miss just means
   * that you aren't on the very start of a region.
   *
   * @param aNeedle The element you are looking for.
   * @param aHaystack The array that is being searched.
   * @param aCompare A function which takes the needle and an element in the
   *     array and returns -1, 0, or 1 depending on whether the needle is less
   *     than, equal to, or greater than the element, respectively.
   */
  exports.search = function search(aNeedle, aHaystack, aCompare) {
    return aHaystack.length > 0
      ? recursiveSearch(-1, aHaystack.length, aNeedle, aHaystack, aCompare)
      : null;
  };

});

},{"amdefine":119}],115:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  var util = require('./util');
  var binarySearch = require('./binary-search');
  var ArraySet = require('./array-set').ArraySet;
  var base64VLQ = require('./base64-vlq');

  /**
   * A SourceMapConsumer instance represents a parsed source map which we can
   * query for information about the original file positions by giving it a file
   * position in the generated source.
   *
   * The only parameter is the raw source map (either as a JSON string, or
   * already parsed to an object). According to the spec, source maps have the
   * following attributes:
   *
   *   - version: Which version of the source map spec this map is following.
   *   - sources: An array of URLs to the original source files.
   *   - names: An array of identifiers which can be referrenced by individual mappings.
   *   - sourceRoot: Optional. The URL root from which all sources are relative.
   *   - sourcesContent: Optional. An array of contents of the original source files.
   *   - mappings: A string of base64 VLQs which contain the actual mappings.
   *   - file: Optional. The generated file this source map is associated with.
   *
   * Here is an example source map, taken from the source map spec[0]:
   *
   *     {
   *       version : 3,
   *       file: "out.js",
   *       sourceRoot : "",
   *       sources: ["foo.js", "bar.js"],
   *       names: ["src", "maps", "are", "fun"],
   *       mappings: "AA,AB;;ABCDE;"
   *     }
   *
   * [0]: https://docs.google.com/document/d/1U1RGAehQwRypUTovF1KRlpiOFze0b-_2gc6fAH0KY0k/edit?pli=1#
   */
  function SourceMapConsumer(aSourceMap) {
    var sourceMap = aSourceMap;
    if (typeof aSourceMap === 'string') {
      sourceMap = JSON.parse(aSourceMap.replace(/^\)\]\}'/, ''));
    }

    var version = util.getArg(sourceMap, 'version');
    var sources = util.getArg(sourceMap, 'sources');
    // Sass 3.3 leaves out the 'names' array, so we deviate from the spec (which
    // requires the array) to play nice here.
    var names = util.getArg(sourceMap, 'names', []);
    var sourceRoot = util.getArg(sourceMap, 'sourceRoot', null);
    var sourcesContent = util.getArg(sourceMap, 'sourcesContent', null);
    var mappings = util.getArg(sourceMap, 'mappings');
    var file = util.getArg(sourceMap, 'file', null);

    // Once again, Sass deviates from the spec and supplies the version as a
    // string rather than a number, so we use loose equality checking here.
    if (version != this._version) {
      throw new Error('Unsupported version: ' + version);
    }

    // Pass `true` below to allow duplicate names and sources. While source maps
    // are intended to be compressed and deduplicated, the TypeScript compiler
    // sometimes generates source maps with duplicates in them. See Github issue
    // #72 and bugzil.la/889492.
    this._names = ArraySet.fromArray(names, true);
    this._sources = ArraySet.fromArray(sources, true);

    this.sourceRoot = sourceRoot;
    this.sourcesContent = sourcesContent;
    this._mappings = mappings;
    this.file = file;
  }

  /**
   * Create a SourceMapConsumer from a SourceMapGenerator.
   *
   * @param SourceMapGenerator aSourceMap
   *        The source map that will be consumed.
   * @returns SourceMapConsumer
   */
  SourceMapConsumer.fromSourceMap =
    function SourceMapConsumer_fromSourceMap(aSourceMap) {
      var smc = Object.create(SourceMapConsumer.prototype);

      smc._names = ArraySet.fromArray(aSourceMap._names.toArray(), true);
      smc._sources = ArraySet.fromArray(aSourceMap._sources.toArray(), true);
      smc.sourceRoot = aSourceMap._sourceRoot;
      smc.sourcesContent = aSourceMap._generateSourcesContent(smc._sources.toArray(),
                                                              smc.sourceRoot);
      smc.file = aSourceMap._file;

      smc.__generatedMappings = aSourceMap._mappings.slice()
        .sort(util.compareByGeneratedPositions);
      smc.__originalMappings = aSourceMap._mappings.slice()
        .sort(util.compareByOriginalPositions);

      return smc;
    };

  /**
   * The version of the source mapping spec that we are consuming.
   */
  SourceMapConsumer.prototype._version = 3;

  /**
   * The list of original sources.
   */
  Object.defineProperty(SourceMapConsumer.prototype, 'sources', {
    get: function () {
      return this._sources.toArray().map(function (s) {
        return this.sourceRoot != null ? util.join(this.sourceRoot, s) : s;
      }, this);
    }
  });

  // `__generatedMappings` and `__originalMappings` are arrays that hold the
  // parsed mapping coordinates from the source map's "mappings" attribute. They
  // are lazily instantiated, accessed via the `_generatedMappings` and
  // `_originalMappings` getters respectively, and we only parse the mappings
  // and create these arrays once queried for a source location. We jump through
  // these hoops because there can be many thousands of mappings, and parsing
  // them is expensive, so we only want to do it if we must.
  //
  // Each object in the arrays is of the form:
  //
  //     {
  //       generatedLine: The line number in the generated code,
  //       generatedColumn: The column number in the generated code,
  //       source: The path to the original source file that generated this
  //               chunk of code,
  //       originalLine: The line number in the original source that
  //                     corresponds to this chunk of generated code,
  //       originalColumn: The column number in the original source that
  //                       corresponds to this chunk of generated code,
  //       name: The name of the original symbol which generated this chunk of
  //             code.
  //     }
  //
  // All properties except for `generatedLine` and `generatedColumn` can be
  // `null`.
  //
  // `_generatedMappings` is ordered by the generated positions.
  //
  // `_originalMappings` is ordered by the original positions.

  SourceMapConsumer.prototype.__generatedMappings = null;
  Object.defineProperty(SourceMapConsumer.prototype, '_generatedMappings', {
    get: function () {
      if (!this.__generatedMappings) {
        this.__generatedMappings = [];
        this.__originalMappings = [];
        this._parseMappings(this._mappings, this.sourceRoot);
      }

      return this.__generatedMappings;
    }
  });

  SourceMapConsumer.prototype.__originalMappings = null;
  Object.defineProperty(SourceMapConsumer.prototype, '_originalMappings', {
    get: function () {
      if (!this.__originalMappings) {
        this.__generatedMappings = [];
        this.__originalMappings = [];
        this._parseMappings(this._mappings, this.sourceRoot);
      }

      return this.__originalMappings;
    }
  });

  /**
   * Parse the mappings in a string in to a data structure which we can easily
   * query (the ordered arrays in the `this.__generatedMappings` and
   * `this.__originalMappings` properties).
   */
  SourceMapConsumer.prototype._parseMappings =
    function SourceMapConsumer_parseMappings(aStr, aSourceRoot) {
      var generatedLine = 1;
      var previousGeneratedColumn = 0;
      var previousOriginalLine = 0;
      var previousOriginalColumn = 0;
      var previousSource = 0;
      var previousName = 0;
      var mappingSeparator = /^[,;]/;
      var str = aStr;
      var mapping;
      var temp;

      while (str.length > 0) {
        if (str.charAt(0) === ';') {
          generatedLine++;
          str = str.slice(1);
          previousGeneratedColumn = 0;
        }
        else if (str.charAt(0) === ',') {
          str = str.slice(1);
        }
        else {
          mapping = {};
          mapping.generatedLine = generatedLine;

          // Generated column.
          temp = base64VLQ.decode(str);
          mapping.generatedColumn = previousGeneratedColumn + temp.value;
          previousGeneratedColumn = mapping.generatedColumn;
          str = temp.rest;

          if (str.length > 0 && !mappingSeparator.test(str.charAt(0))) {
            // Original source.
            temp = base64VLQ.decode(str);
            mapping.source = this._sources.at(previousSource + temp.value);
            previousSource += temp.value;
            str = temp.rest;
            if (str.length === 0 || mappingSeparator.test(str.charAt(0))) {
              throw new Error('Found a source, but no line and column');
            }

            // Original line.
            temp = base64VLQ.decode(str);
            mapping.originalLine = previousOriginalLine + temp.value;
            previousOriginalLine = mapping.originalLine;
            // Lines are stored 0-based
            mapping.originalLine += 1;
            str = temp.rest;
            if (str.length === 0 || mappingSeparator.test(str.charAt(0))) {
              throw new Error('Found a source and line, but no column');
            }

            // Original column.
            temp = base64VLQ.decode(str);
            mapping.originalColumn = previousOriginalColumn + temp.value;
            previousOriginalColumn = mapping.originalColumn;
            str = temp.rest;

            if (str.length > 0 && !mappingSeparator.test(str.charAt(0))) {
              // Original name.
              temp = base64VLQ.decode(str);
              mapping.name = this._names.at(previousName + temp.value);
              previousName += temp.value;
              str = temp.rest;
            }
          }

          this.__generatedMappings.push(mapping);
          if (typeof mapping.originalLine === 'number') {
            this.__originalMappings.push(mapping);
          }
        }
      }

      this.__generatedMappings.sort(util.compareByGeneratedPositions);
      this.__originalMappings.sort(util.compareByOriginalPositions);
    };

  /**
   * Find the mapping that best matches the hypothetical "needle" mapping that
   * we are searching for in the given "haystack" of mappings.
   */
  SourceMapConsumer.prototype._findMapping =
    function SourceMapConsumer_findMapping(aNeedle, aMappings, aLineName,
                                           aColumnName, aComparator) {
      // To return the position we are searching for, we must first find the
      // mapping for the given position and then return the opposite position it
      // points to. Because the mappings are sorted, we can use binary search to
      // find the best mapping.

      if (aNeedle[aLineName] <= 0) {
        throw new TypeError('Line must be greater than or equal to 1, got '
                            + aNeedle[aLineName]);
      }
      if (aNeedle[aColumnName] < 0) {
        throw new TypeError('Column must be greater than or equal to 0, got '
                            + aNeedle[aColumnName]);
      }

      return binarySearch.search(aNeedle, aMappings, aComparator);
    };

  /**
   * Returns the original source, line, and column information for the generated
   * source's line and column positions provided. The only argument is an object
   * with the following properties:
   *
   *   - line: The line number in the generated source.
   *   - column: The column number in the generated source.
   *
   * and an object is returned with the following properties:
   *
   *   - source: The original source file, or null.
   *   - line: The line number in the original source, or null.
   *   - column: The column number in the original source, or null.
   *   - name: The original identifier, or null.
   */
  SourceMapConsumer.prototype.originalPositionFor =
    function SourceMapConsumer_originalPositionFor(aArgs) {
      var needle = {
        generatedLine: util.getArg(aArgs, 'line'),
        generatedColumn: util.getArg(aArgs, 'column')
      };

      var mapping = this._findMapping(needle,
                                      this._generatedMappings,
                                      "generatedLine",
                                      "generatedColumn",
                                      util.compareByGeneratedPositions);

      if (mapping && mapping.generatedLine === needle.generatedLine) {
        var source = util.getArg(mapping, 'source', null);
        if (source != null && this.sourceRoot != null) {
          source = util.join(this.sourceRoot, source);
        }
        return {
          source: source,
          line: util.getArg(mapping, 'originalLine', null),
          column: util.getArg(mapping, 'originalColumn', null),
          name: util.getArg(mapping, 'name', null)
        };
      }

      return {
        source: null,
        line: null,
        column: null,
        name: null
      };
    };

  /**
   * Returns the original source content. The only argument is the url of the
   * original source file. Returns null if no original source content is
   * availible.
   */
  SourceMapConsumer.prototype.sourceContentFor =
    function SourceMapConsumer_sourceContentFor(aSource) {
      if (!this.sourcesContent) {
        return null;
      }

      if (this.sourceRoot != null) {
        aSource = util.relative(this.sourceRoot, aSource);
      }

      if (this._sources.has(aSource)) {
        return this.sourcesContent[this._sources.indexOf(aSource)];
      }

      var url;
      if (this.sourceRoot != null
          && (url = util.urlParse(this.sourceRoot))) {
        // XXX: file:// URIs and absolute paths lead to unexpected behavior for
        // many users. We can help them out when they expect file:// URIs to
        // behave like it would if they were running a local HTTP server. See
        // https://bugzilla.mozilla.org/show_bug.cgi?id=885597.
        var fileUriAbsPath = aSource.replace(/^file:\/\//, "");
        if (url.scheme == "file"
            && this._sources.has(fileUriAbsPath)) {
          return this.sourcesContent[this._sources.indexOf(fileUriAbsPath)]
        }

        if ((!url.path || url.path == "/")
            && this._sources.has("/" + aSource)) {
          return this.sourcesContent[this._sources.indexOf("/" + aSource)];
        }
      }

      throw new Error('"' + aSource + '" is not in the SourceMap.');
    };

  /**
   * Returns the generated line and column information for the original source,
   * line, and column positions provided. The only argument is an object with
   * the following properties:
   *
   *   - source: The filename of the original source.
   *   - line: The line number in the original source.
   *   - column: The column number in the original source.
   *
   * and an object is returned with the following properties:
   *
   *   - line: The line number in the generated source, or null.
   *   - column: The column number in the generated source, or null.
   */
  SourceMapConsumer.prototype.generatedPositionFor =
    function SourceMapConsumer_generatedPositionFor(aArgs) {
      var needle = {
        source: util.getArg(aArgs, 'source'),
        originalLine: util.getArg(aArgs, 'line'),
        originalColumn: util.getArg(aArgs, 'column')
      };

      if (this.sourceRoot != null) {
        needle.source = util.relative(this.sourceRoot, needle.source);
      }

      var mapping = this._findMapping(needle,
                                      this._originalMappings,
                                      "originalLine",
                                      "originalColumn",
                                      util.compareByOriginalPositions);

      if (mapping) {
        return {
          line: util.getArg(mapping, 'generatedLine', null),
          column: util.getArg(mapping, 'generatedColumn', null)
        };
      }

      return {
        line: null,
        column: null
      };
    };

  SourceMapConsumer.GENERATED_ORDER = 1;
  SourceMapConsumer.ORIGINAL_ORDER = 2;

  /**
   * Iterate over each mapping between an original source/line/column and a
   * generated line/column in this source map.
   *
   * @param Function aCallback
   *        The function that is called with each mapping.
   * @param Object aContext
   *        Optional. If specified, this object will be the value of `this` every
   *        time that `aCallback` is called.
   * @param aOrder
   *        Either `SourceMapConsumer.GENERATED_ORDER` or
   *        `SourceMapConsumer.ORIGINAL_ORDER`. Specifies whether you want to
   *        iterate over the mappings sorted by the generated file's line/column
   *        order or the original's source/line/column order, respectively. Defaults to
   *        `SourceMapConsumer.GENERATED_ORDER`.
   */
  SourceMapConsumer.prototype.eachMapping =
    function SourceMapConsumer_eachMapping(aCallback, aContext, aOrder) {
      var context = aContext || null;
      var order = aOrder || SourceMapConsumer.GENERATED_ORDER;

      var mappings;
      switch (order) {
      case SourceMapConsumer.GENERATED_ORDER:
        mappings = this._generatedMappings;
        break;
      case SourceMapConsumer.ORIGINAL_ORDER:
        mappings = this._originalMappings;
        break;
      default:
        throw new Error("Unknown order of iteration.");
      }

      var sourceRoot = this.sourceRoot;
      mappings.map(function (mapping) {
        var source = mapping.source;
        if (source != null && sourceRoot != null) {
          source = util.join(sourceRoot, source);
        }
        return {
          source: source,
          generatedLine: mapping.generatedLine,
          generatedColumn: mapping.generatedColumn,
          originalLine: mapping.originalLine,
          originalColumn: mapping.originalColumn,
          name: mapping.name
        };
      }).forEach(aCallback, context);
    };

  exports.SourceMapConsumer = SourceMapConsumer;

});

},{"./array-set":111,"./base64-vlq":112,"./binary-search":114,"./util":118,"amdefine":119}],116:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  var base64VLQ = require('./base64-vlq');
  var util = require('./util');
  var ArraySet = require('./array-set').ArraySet;

  /**
   * An instance of the SourceMapGenerator represents a source map which is
   * being built incrementally. You may pass an object with the following
   * properties:
   *
   *   - file: The filename of the generated source.
   *   - sourceRoot: A root for all relative URLs in this source map.
   */
  function SourceMapGenerator(aArgs) {
    if (!aArgs) {
      aArgs = {};
    }
    this._file = util.getArg(aArgs, 'file', null);
    this._sourceRoot = util.getArg(aArgs, 'sourceRoot', null);
    this._sources = new ArraySet();
    this._names = new ArraySet();
    this._mappings = [];
    this._sourcesContents = null;
  }

  SourceMapGenerator.prototype._version = 3;

  /**
   * Creates a new SourceMapGenerator based on a SourceMapConsumer
   *
   * @param aSourceMapConsumer The SourceMap.
   */
  SourceMapGenerator.fromSourceMap =
    function SourceMapGenerator_fromSourceMap(aSourceMapConsumer) {
      var sourceRoot = aSourceMapConsumer.sourceRoot;
      var generator = new SourceMapGenerator({
        file: aSourceMapConsumer.file,
        sourceRoot: sourceRoot
      });
      aSourceMapConsumer.eachMapping(function (mapping) {
        var newMapping = {
          generated: {
            line: mapping.generatedLine,
            column: mapping.generatedColumn
          }
        };

        if (mapping.source != null) {
          newMapping.source = mapping.source;
          if (sourceRoot != null) {
            newMapping.source = util.relative(sourceRoot, newMapping.source);
          }

          newMapping.original = {
            line: mapping.originalLine,
            column: mapping.originalColumn
          };

          if (mapping.name != null) {
            newMapping.name = mapping.name;
          }
        }

        generator.addMapping(newMapping);
      });
      aSourceMapConsumer.sources.forEach(function (sourceFile) {
        var content = aSourceMapConsumer.sourceContentFor(sourceFile);
        if (content != null) {
          generator.setSourceContent(sourceFile, content);
        }
      });
      return generator;
    };

  /**
   * Add a single mapping from original source line and column to the generated
   * source's line and column for this source map being created. The mapping
   * object should have the following properties:
   *
   *   - generated: An object with the generated line and column positions.
   *   - original: An object with the original line and column positions.
   *   - source: The original source file (relative to the sourceRoot).
   *   - name: An optional original token name for this mapping.
   */
  SourceMapGenerator.prototype.addMapping =
    function SourceMapGenerator_addMapping(aArgs) {
      var generated = util.getArg(aArgs, 'generated');
      var original = util.getArg(aArgs, 'original', null);
      var source = util.getArg(aArgs, 'source', null);
      var name = util.getArg(aArgs, 'name', null);

      this._validateMapping(generated, original, source, name);

      if (source && !this._sources.has(source)) {
        this._sources.add(source);
      }

      if (name && !this._names.has(name)) {
        this._names.add(name);
      }

      this._mappings.push({
        generatedLine: generated.line,
        generatedColumn: generated.column,
        originalLine: original != null && original.line,
        originalColumn: original != null && original.column,
        source: source,
        name: name
      });
    };

  /**
   * Set the source content for a source file.
   */
  SourceMapGenerator.prototype.setSourceContent =
    function SourceMapGenerator_setSourceContent(aSourceFile, aSourceContent) {
      var source = aSourceFile;
      if (this._sourceRoot != null) {
        source = util.relative(this._sourceRoot, source);
      }

      if (aSourceContent != null) {
        // Add the source content to the _sourcesContents map.
        // Create a new _sourcesContents map if the property is null.
        if (!this._sourcesContents) {
          this._sourcesContents = {};
        }
        this._sourcesContents[util.toSetString(source)] = aSourceContent;
      } else {
        // Remove the source file from the _sourcesContents map.
        // If the _sourcesContents map is empty, set the property to null.
        delete this._sourcesContents[util.toSetString(source)];
        if (Object.keys(this._sourcesContents).length === 0) {
          this._sourcesContents = null;
        }
      }
    };

  /**
   * Applies the mappings of a sub-source-map for a specific source file to the
   * source map being generated. Each mapping to the supplied source file is
   * rewritten using the supplied source map. Note: The resolution for the
   * resulting mappings is the minimium of this map and the supplied map.
   *
   * @param aSourceMapConsumer The source map to be applied.
   * @param aSourceFile Optional. The filename of the source file.
   *        If omitted, SourceMapConsumer's file property will be used.
   * @param aSourceMapPath Optional. The dirname of the path to the source map
   *        to be applied. If relative, it is relative to the SourceMapConsumer.
   *        This parameter is needed when the two source maps aren't in the same
   *        directory, and the source map to be applied contains relative source
   *        paths. If so, those relative source paths need to be rewritten
   *        relative to the SourceMapGenerator.
   */
  SourceMapGenerator.prototype.applySourceMap =
    function SourceMapGenerator_applySourceMap(aSourceMapConsumer, aSourceFile, aSourceMapPath) {
      var sourceFile = aSourceFile;
      // If aSourceFile is omitted, we will use the file property of the SourceMap
      if (aSourceFile == null) {
        if (aSourceMapConsumer.file == null) {
          throw new Error(
            'SourceMapGenerator.prototype.applySourceMap requires either an explicit source file, ' +
            'or the source map\'s "file" property. Both were omitted.'
          );
        }
        sourceFile = aSourceMapConsumer.file;
      }
      var sourceRoot = this._sourceRoot;
      // Make "sourceFile" relative if an absolute Url is passed.
      if (sourceRoot != null) {
        sourceFile = util.relative(sourceRoot, sourceFile);
      }
      // Applying the SourceMap can add and remove items from the sources and
      // the names array.
      var newSources = new ArraySet();
      var newNames = new ArraySet();

      // Find mappings for the "sourceFile"
      this._mappings.forEach(function (mapping) {
        if (mapping.source === sourceFile && mapping.originalLine != null) {
          // Check if it can be mapped by the source map, then update the mapping.
          var original = aSourceMapConsumer.originalPositionFor({
            line: mapping.originalLine,
            column: mapping.originalColumn
          });
          if (original.source != null) {
            // Copy mapping
            mapping.source = original.source;
            if (aSourceMapPath != null) {
              mapping.source = util.join(aSourceMapPath, mapping.source)
            }
            if (sourceRoot != null) {
              mapping.source = util.relative(sourceRoot, mapping.source);
            }
            mapping.originalLine = original.line;
            mapping.originalColumn = original.column;
            if (original.name != null && mapping.name != null) {
              // Only use the identifier name if it's an identifier
              // in both SourceMaps
              mapping.name = original.name;
            }
          }
        }

        var source = mapping.source;
        if (source != null && !newSources.has(source)) {
          newSources.add(source);
        }

        var name = mapping.name;
        if (name != null && !newNames.has(name)) {
          newNames.add(name);
        }

      }, this);
      this._sources = newSources;
      this._names = newNames;

      // Copy sourcesContents of applied map.
      aSourceMapConsumer.sources.forEach(function (sourceFile) {
        var content = aSourceMapConsumer.sourceContentFor(sourceFile);
        if (content != null) {
          if (aSourceMapPath != null) {
            sourceFile = util.join(aSourceMapPath, sourceFile);
          }
          if (sourceRoot != null) {
            sourceFile = util.relative(sourceRoot, sourceFile);
          }
          this.setSourceContent(sourceFile, content);
        }
      }, this);
    };

  /**
   * A mapping can have one of the three levels of data:
   *
   *   1. Just the generated position.
   *   2. The Generated position, original position, and original source.
   *   3. Generated and original position, original source, as well as a name
   *      token.
   *
   * To maintain consistency, we validate that any new mapping being added falls
   * in to one of these categories.
   */
  SourceMapGenerator.prototype._validateMapping =
    function SourceMapGenerator_validateMapping(aGenerated, aOriginal, aSource,
                                                aName) {
      if (aGenerated && 'line' in aGenerated && 'column' in aGenerated
          && aGenerated.line > 0 && aGenerated.column >= 0
          && !aOriginal && !aSource && !aName) {
        // Case 1.
        return;
      }
      else if (aGenerated && 'line' in aGenerated && 'column' in aGenerated
               && aOriginal && 'line' in aOriginal && 'column' in aOriginal
               && aGenerated.line > 0 && aGenerated.column >= 0
               && aOriginal.line > 0 && aOriginal.column >= 0
               && aSource) {
        // Cases 2 and 3.
        return;
      }
      else {
        throw new Error('Invalid mapping: ' + JSON.stringify({
          generated: aGenerated,
          source: aSource,
          original: aOriginal,
          name: aName
        }));
      }
    };

  /**
   * Serialize the accumulated mappings in to the stream of base 64 VLQs
   * specified by the source map format.
   */
  SourceMapGenerator.prototype._serializeMappings =
    function SourceMapGenerator_serializeMappings() {
      var previousGeneratedColumn = 0;
      var previousGeneratedLine = 1;
      var previousOriginalColumn = 0;
      var previousOriginalLine = 0;
      var previousName = 0;
      var previousSource = 0;
      var result = '';
      var mapping;

      // The mappings must be guaranteed to be in sorted order before we start
      // serializing them or else the generated line numbers (which are defined
      // via the ';' separators) will be all messed up. Note: it might be more
      // performant to maintain the sorting as we insert them, rather than as we
      // serialize them, but the big O is the same either way.
      this._mappings.sort(util.compareByGeneratedPositions);

      for (var i = 0, len = this._mappings.length; i < len; i++) {
        mapping = this._mappings[i];

        if (mapping.generatedLine !== previousGeneratedLine) {
          previousGeneratedColumn = 0;
          while (mapping.generatedLine !== previousGeneratedLine) {
            result += ';';
            previousGeneratedLine++;
          }
        }
        else {
          if (i > 0) {
            if (!util.compareByGeneratedPositions(mapping, this._mappings[i - 1])) {
              continue;
            }
            result += ',';
          }
        }

        result += base64VLQ.encode(mapping.generatedColumn
                                   - previousGeneratedColumn);
        previousGeneratedColumn = mapping.generatedColumn;

        if (mapping.source != null) {
          result += base64VLQ.encode(this._sources.indexOf(mapping.source)
                                     - previousSource);
          previousSource = this._sources.indexOf(mapping.source);

          // lines are stored 0-based in SourceMap spec version 3
          result += base64VLQ.encode(mapping.originalLine - 1
                                     - previousOriginalLine);
          previousOriginalLine = mapping.originalLine - 1;

          result += base64VLQ.encode(mapping.originalColumn
                                     - previousOriginalColumn);
          previousOriginalColumn = mapping.originalColumn;

          if (mapping.name != null) {
            result += base64VLQ.encode(this._names.indexOf(mapping.name)
                                       - previousName);
            previousName = this._names.indexOf(mapping.name);
          }
        }
      }

      return result;
    };

  SourceMapGenerator.prototype._generateSourcesContent =
    function SourceMapGenerator_generateSourcesContent(aSources, aSourceRoot) {
      return aSources.map(function (source) {
        if (!this._sourcesContents) {
          return null;
        }
        if (aSourceRoot != null) {
          source = util.relative(aSourceRoot, source);
        }
        var key = util.toSetString(source);
        return Object.prototype.hasOwnProperty.call(this._sourcesContents,
                                                    key)
          ? this._sourcesContents[key]
          : null;
      }, this);
    };

  /**
   * Externalize the source map.
   */
  SourceMapGenerator.prototype.toJSON =
    function SourceMapGenerator_toJSON() {
      var map = {
        version: this._version,
        sources: this._sources.toArray(),
        names: this._names.toArray(),
        mappings: this._serializeMappings()
      };
      if (this._file != null) {
        map.file = this._file;
      }
      if (this._sourceRoot != null) {
        map.sourceRoot = this._sourceRoot;
      }
      if (this._sourcesContents) {
        map.sourcesContent = this._generateSourcesContent(map.sources, map.sourceRoot);
      }

      return map;
    };

  /**
   * Render the source map being generated to a string.
   */
  SourceMapGenerator.prototype.toString =
    function SourceMapGenerator_toString() {
      return JSON.stringify(this);
    };

  exports.SourceMapGenerator = SourceMapGenerator;

});

},{"./array-set":111,"./base64-vlq":112,"./util":118,"amdefine":119}],117:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  var SourceMapGenerator = require('./source-map-generator').SourceMapGenerator;
  var util = require('./util');

  // Matches a Windows-style `\r\n` newline or a `\n` newline used by all other
  // operating systems these days (capturing the result).
  var REGEX_NEWLINE = /(\r?\n)/;

  // Matches a Windows-style newline, or any character.
  var REGEX_CHARACTER = /\r\n|[\s\S]/g;

  /**
   * SourceNodes provide a way to abstract over interpolating/concatenating
   * snippets of generated JavaScript source code while maintaining the line and
   * column information associated with the original source code.
   *
   * @param aLine The original line number.
   * @param aColumn The original column number.
   * @param aSource The original source's filename.
   * @param aChunks Optional. An array of strings which are snippets of
   *        generated JS, or other SourceNodes.
   * @param aName The original identifier.
   */
  function SourceNode(aLine, aColumn, aSource, aChunks, aName) {
    this.children = [];
    this.sourceContents = {};
    this.line = aLine == null ? null : aLine;
    this.column = aColumn == null ? null : aColumn;
    this.source = aSource == null ? null : aSource;
    this.name = aName == null ? null : aName;
    if (aChunks != null) this.add(aChunks);
  }

  /**
   * Creates a SourceNode from generated code and a SourceMapConsumer.
   *
   * @param aGeneratedCode The generated code
   * @param aSourceMapConsumer The SourceMap for the generated code
   * @param aRelativePath Optional. The path that relative sources in the
   *        SourceMapConsumer should be relative to.
   */
  SourceNode.fromStringWithSourceMap =
    function SourceNode_fromStringWithSourceMap(aGeneratedCode, aSourceMapConsumer, aRelativePath) {
      // The SourceNode we want to fill with the generated code
      // and the SourceMap
      var node = new SourceNode();

      // All even indices of this array are one line of the generated code,
      // while all odd indices are the newlines between two adjacent lines
      // (since `REGEX_NEWLINE` captures its match).
      // Processed fragments are removed from this array, by calling `shiftNextLine`.
      var remainingLines = aGeneratedCode.split(REGEX_NEWLINE);
      var shiftNextLine = function() {
        var lineContents = remainingLines.shift();
        // The last line of a file might not have a newline.
        var newLine = remainingLines.shift() || "";
        return lineContents + newLine;
      };

      // We need to remember the position of "remainingLines"
      var lastGeneratedLine = 1, lastGeneratedColumn = 0;

      // The generate SourceNodes we need a code range.
      // To extract it current and last mapping is used.
      // Here we store the last mapping.
      var lastMapping = null;

      aSourceMapConsumer.eachMapping(function (mapping) {
        if (lastMapping !== null) {
          // We add the code from "lastMapping" to "mapping":
          // First check if there is a new line in between.
          if (lastGeneratedLine < mapping.generatedLine) {
            var code = "";
            // Associate first line with "lastMapping"
            addMappingWithCode(lastMapping, shiftNextLine());
            lastGeneratedLine++;
            lastGeneratedColumn = 0;
            // The remaining code is added without mapping
          } else {
            // There is no new line in between.
            // Associate the code between "lastGeneratedColumn" and
            // "mapping.generatedColumn" with "lastMapping"
            var nextLine = remainingLines[0];
            var code = nextLine.substr(0, mapping.generatedColumn -
                                          lastGeneratedColumn);
            remainingLines[0] = nextLine.substr(mapping.generatedColumn -
                                                lastGeneratedColumn);
            lastGeneratedColumn = mapping.generatedColumn;
            addMappingWithCode(lastMapping, code);
            // No more remaining code, continue
            lastMapping = mapping;
            return;
          }
        }
        // We add the generated code until the first mapping
        // to the SourceNode without any mapping.
        // Each line is added as separate string.
        while (lastGeneratedLine < mapping.generatedLine) {
          node.add(shiftNextLine());
          lastGeneratedLine++;
        }
        if (lastGeneratedColumn < mapping.generatedColumn) {
          var nextLine = remainingLines[0];
          node.add(nextLine.substr(0, mapping.generatedColumn));
          remainingLines[0] = nextLine.substr(mapping.generatedColumn);
          lastGeneratedColumn = mapping.generatedColumn;
        }
        lastMapping = mapping;
      }, this);
      // We have processed all mappings.
      if (remainingLines.length > 0) {
        if (lastMapping) {
          // Associate the remaining code in the current line with "lastMapping"
          addMappingWithCode(lastMapping, shiftNextLine());
        }
        // and add the remaining lines without any mapping
        node.add(remainingLines.join(""));
      }

      // Copy sourcesContent into SourceNode
      aSourceMapConsumer.sources.forEach(function (sourceFile) {
        var content = aSourceMapConsumer.sourceContentFor(sourceFile);
        if (content != null) {
          if (aRelativePath != null) {
            sourceFile = util.join(aRelativePath, sourceFile);
          }
          node.setSourceContent(sourceFile, content);
        }
      });

      return node;

      function addMappingWithCode(mapping, code) {
        if (mapping === null || mapping.source === undefined) {
          node.add(code);
        } else {
          var source = aRelativePath
            ? util.join(aRelativePath, mapping.source)
            : mapping.source;
          node.add(new SourceNode(mapping.originalLine,
                                  mapping.originalColumn,
                                  source,
                                  code,
                                  mapping.name));
        }
      }
    };

  /**
   * Add a chunk of generated JS to this source node.
   *
   * @param aChunk A string snippet of generated JS code, another instance of
   *        SourceNode, or an array where each member is one of those things.
   */
  SourceNode.prototype.add = function SourceNode_add(aChunk) {
    if (Array.isArray(aChunk)) {
      aChunk.forEach(function (chunk) {
        this.add(chunk);
      }, this);
    }
    else if (aChunk instanceof SourceNode || typeof aChunk === "string") {
      if (aChunk) {
        this.children.push(aChunk);
      }
    }
    else {
      throw new TypeError(
        "Expected a SourceNode, string, or an array of SourceNodes and strings. Got " + aChunk
      );
    }
    return this;
  };

  /**
   * Add a chunk of generated JS to the beginning of this source node.
   *
   * @param aChunk A string snippet of generated JS code, another instance of
   *        SourceNode, or an array where each member is one of those things.
   */
  SourceNode.prototype.prepend = function SourceNode_prepend(aChunk) {
    if (Array.isArray(aChunk)) {
      for (var i = aChunk.length-1; i >= 0; i--) {
        this.prepend(aChunk[i]);
      }
    }
    else if (aChunk instanceof SourceNode || typeof aChunk === "string") {
      this.children.unshift(aChunk);
    }
    else {
      throw new TypeError(
        "Expected a SourceNode, string, or an array of SourceNodes and strings. Got " + aChunk
      );
    }
    return this;
  };

  /**
   * Walk over the tree of JS snippets in this node and its children. The
   * walking function is called once for each snippet of JS and is passed that
   * snippet and the its original associated source's line/column location.
   *
   * @param aFn The traversal function.
   */
  SourceNode.prototype.walk = function SourceNode_walk(aFn) {
    var chunk;
    for (var i = 0, len = this.children.length; i < len; i++) {
      chunk = this.children[i];
      if (chunk instanceof SourceNode) {
        chunk.walk(aFn);
      }
      else {
        if (chunk !== '') {
          aFn(chunk, { source: this.source,
                       line: this.line,
                       column: this.column,
                       name: this.name });
        }
      }
    }
  };

  /**
   * Like `String.prototype.join` except for SourceNodes. Inserts `aStr` between
   * each of `this.children`.
   *
   * @param aSep The separator.
   */
  SourceNode.prototype.join = function SourceNode_join(aSep) {
    var newChildren;
    var i;
    var len = this.children.length;
    if (len > 0) {
      newChildren = [];
      for (i = 0; i < len-1; i++) {
        newChildren.push(this.children[i]);
        newChildren.push(aSep);
      }
      newChildren.push(this.children[i]);
      this.children = newChildren;
    }
    return this;
  };

  /**
   * Call String.prototype.replace on the very right-most source snippet. Useful
   * for trimming whitespace from the end of a source node, etc.
   *
   * @param aPattern The pattern to replace.
   * @param aReplacement The thing to replace the pattern with.
   */
  SourceNode.prototype.replaceRight = function SourceNode_replaceRight(aPattern, aReplacement) {
    var lastChild = this.children[this.children.length - 1];
    if (lastChild instanceof SourceNode) {
      lastChild.replaceRight(aPattern, aReplacement);
    }
    else if (typeof lastChild === 'string') {
      this.children[this.children.length - 1] = lastChild.replace(aPattern, aReplacement);
    }
    else {
      this.children.push(''.replace(aPattern, aReplacement));
    }
    return this;
  };

  /**
   * Set the source content for a source file. This will be added to the SourceMapGenerator
   * in the sourcesContent field.
   *
   * @param aSourceFile The filename of the source file
   * @param aSourceContent The content of the source file
   */
  SourceNode.prototype.setSourceContent =
    function SourceNode_setSourceContent(aSourceFile, aSourceContent) {
      this.sourceContents[util.toSetString(aSourceFile)] = aSourceContent;
    };

  /**
   * Walk over the tree of SourceNodes. The walking function is called for each
   * source file content and is passed the filename and source content.
   *
   * @param aFn The traversal function.
   */
  SourceNode.prototype.walkSourceContents =
    function SourceNode_walkSourceContents(aFn) {
      for (var i = 0, len = this.children.length; i < len; i++) {
        if (this.children[i] instanceof SourceNode) {
          this.children[i].walkSourceContents(aFn);
        }
      }

      var sources = Object.keys(this.sourceContents);
      for (var i = 0, len = sources.length; i < len; i++) {
        aFn(util.fromSetString(sources[i]), this.sourceContents[sources[i]]);
      }
    };

  /**
   * Return the string representation of this source node. Walks over the tree
   * and concatenates all the various snippets together to one string.
   */
  SourceNode.prototype.toString = function SourceNode_toString() {
    var str = "";
    this.walk(function (chunk) {
      str += chunk;
    });
    return str;
  };

  /**
   * Returns the string representation of this source node along with a source
   * map.
   */
  SourceNode.prototype.toStringWithSourceMap = function SourceNode_toStringWithSourceMap(aArgs) {
    var generated = {
      code: "",
      line: 1,
      column: 0
    };
    var map = new SourceMapGenerator(aArgs);
    var sourceMappingActive = false;
    var lastOriginalSource = null;
    var lastOriginalLine = null;
    var lastOriginalColumn = null;
    var lastOriginalName = null;
    this.walk(function (chunk, original) {
      generated.code += chunk;
      if (original.source !== null
          && original.line !== null
          && original.column !== null) {
        if(lastOriginalSource !== original.source
           || lastOriginalLine !== original.line
           || lastOriginalColumn !== original.column
           || lastOriginalName !== original.name) {
          map.addMapping({
            source: original.source,
            original: {
              line: original.line,
              column: original.column
            },
            generated: {
              line: generated.line,
              column: generated.column
            },
            name: original.name
          });
        }
        lastOriginalSource = original.source;
        lastOriginalLine = original.line;
        lastOriginalColumn = original.column;
        lastOriginalName = original.name;
        sourceMappingActive = true;
      } else if (sourceMappingActive) {
        map.addMapping({
          generated: {
            line: generated.line,
            column: generated.column
          }
        });
        lastOriginalSource = null;
        sourceMappingActive = false;
      }
      chunk.match(REGEX_CHARACTER).forEach(function (ch, idx, array) {
        if (REGEX_NEWLINE.test(ch)) {
          generated.line++;
          generated.column = 0;
          // Mappings end at eol
          if (idx + 1 === array.length) {
            lastOriginalSource = null;
            sourceMappingActive = false;
          } else if (sourceMappingActive) {
            map.addMapping({
              source: original.source,
              original: {
                line: original.line,
                column: original.column
              },
              generated: {
                line: generated.line,
                column: generated.column
              },
              name: original.name
            });
          }
        } else {
          generated.column += ch.length;
        }
      });
    });
    this.walkSourceContents(function (sourceFile, sourceContent) {
      map.setSourceContent(sourceFile, sourceContent);
    });

    return { code: generated.code, map: map };
  };

  exports.SourceNode = SourceNode;

});

},{"./source-map-generator":116,"./util":118,"amdefine":119}],118:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  /**
   * This is a helper function for getting values from parameter/options
   * objects.
   *
   * @param args The object we are extracting values from
   * @param name The name of the property we are getting.
   * @param defaultValue An optional value to return if the property is missing
   * from the object. If this is not specified and the property is missing, an
   * error will be thrown.
   */
  function getArg(aArgs, aName, aDefaultValue) {
    if (aName in aArgs) {
      return aArgs[aName];
    } else if (arguments.length === 3) {
      return aDefaultValue;
    } else {
      throw new Error('"' + aName + '" is a required argument.');
    }
  }
  exports.getArg = getArg;

  var urlRegexp = /^(?:([\w+\-.]+):)?\/\/(?:(\w+:\w+)@)?([\w.]*)(?::(\d+))?(\S*)$/;
  var dataUrlRegexp = /^data:.+\,.+$/;

  function urlParse(aUrl) {
    var match = aUrl.match(urlRegexp);
    if (!match) {
      return null;
    }
    return {
      scheme: match[1],
      auth: match[2],
      host: match[3],
      port: match[4],
      path: match[5]
    };
  }
  exports.urlParse = urlParse;

  function urlGenerate(aParsedUrl) {
    var url = '';
    if (aParsedUrl.scheme) {
      url += aParsedUrl.scheme + ':';
    }
    url += '//';
    if (aParsedUrl.auth) {
      url += aParsedUrl.auth + '@';
    }
    if (aParsedUrl.host) {
      url += aParsedUrl.host;
    }
    if (aParsedUrl.port) {
      url += ":" + aParsedUrl.port
    }
    if (aParsedUrl.path) {
      url += aParsedUrl.path;
    }
    return url;
  }
  exports.urlGenerate = urlGenerate;

  /**
   * Normalizes a path, or the path portion of a URL:
   *
   * - Replaces consequtive slashes with one slash.
   * - Removes unnecessary '.' parts.
   * - Removes unnecessary '<dir>/..' parts.
   *
   * Based on code in the Node.js 'path' core module.
   *
   * @param aPath The path or url to normalize.
   */
  function normalize(aPath) {
    var path = aPath;
    var url = urlParse(aPath);
    if (url) {
      if (!url.path) {
        return aPath;
      }
      path = url.path;
    }
    var isAbsolute = (path.charAt(0) === '/');

    var parts = path.split(/\/+/);
    for (var part, up = 0, i = parts.length - 1; i >= 0; i--) {
      part = parts[i];
      if (part === '.') {
        parts.splice(i, 1);
      } else if (part === '..') {
        up++;
      } else if (up > 0) {
        if (part === '') {
          // The first part is blank if the path is absolute. Trying to go
          // above the root is a no-op. Therefore we can remove all '..' parts
          // directly after the root.
          parts.splice(i + 1, up);
          up = 0;
        } else {
          parts.splice(i, 2);
          up--;
        }
      }
    }
    path = parts.join('/');

    if (path === '') {
      path = isAbsolute ? '/' : '.';
    }

    if (url) {
      url.path = path;
      return urlGenerate(url);
    }
    return path;
  }
  exports.normalize = normalize;

  /**
   * Joins two paths/URLs.
   *
   * @param aRoot The root path or URL.
   * @param aPath The path or URL to be joined with the root.
   *
   * - If aPath is a URL or a data URI, aPath is returned, unless aPath is a
   *   scheme-relative URL: Then the scheme of aRoot, if any, is prepended
   *   first.
   * - Otherwise aPath is a path. If aRoot is a URL, then its path portion
   *   is updated with the result and aRoot is returned. Otherwise the result
   *   is returned.
   *   - If aPath is absolute, the result is aPath.
   *   - Otherwise the two paths are joined with a slash.
   * - Joining for example 'http://' and 'www.example.com' is also supported.
   */
  function join(aRoot, aPath) {
    var aPathUrl = urlParse(aPath);
    var aRootUrl = urlParse(aRoot);
    if (aRootUrl) {
      aRoot = aRootUrl.path || '/';
    }

    // `join(foo, '//www.example.org')`
    if (aPathUrl && !aPathUrl.scheme) {
      if (aRootUrl) {
        aPathUrl.scheme = aRootUrl.scheme;
      }
      return urlGenerate(aPathUrl);
    }

    if (aPathUrl || aPath.match(dataUrlRegexp)) {
      return aPath;
    }

    // `join('http://', 'www.example.com')`
    if (aRootUrl && !aRootUrl.host && !aRootUrl.path) {
      aRootUrl.host = aPath;
      return urlGenerate(aRootUrl);
    }

    var joined = aPath.charAt(0) === '/'
      ? aPath
      : normalize(aRoot.replace(/\/+$/, '') + '/' + aPath);

    if (aRootUrl) {
      aRootUrl.path = joined;
      return urlGenerate(aRootUrl);
    }
    return joined;
  }
  exports.join = join;

  /**
   * Because behavior goes wacky when you set `__proto__` on objects, we
   * have to prefix all the strings in our set with an arbitrary character.
   *
   * See https://github.com/mozilla/source-map/pull/31 and
   * https://github.com/mozilla/source-map/issues/30
   *
   * @param String aStr
   */
  function toSetString(aStr) {
    return '$' + aStr;
  }
  exports.toSetString = toSetString;

  function fromSetString(aStr) {
    return aStr.substr(1);
  }
  exports.fromSetString = fromSetString;

  function relative(aRoot, aPath) {
    aRoot = aRoot.replace(/\/$/, '');

    var url = urlParse(aRoot);
    if (aPath.charAt(0) == "/" && url && url.path == "/") {
      return aPath.slice(1);
    }

    return aPath.indexOf(aRoot + '/') === 0
      ? aPath.substr(aRoot.length + 1)
      : aPath;
  }
  exports.relative = relative;

  function strcmp(aStr1, aStr2) {
    var s1 = aStr1 || "";
    var s2 = aStr2 || "";
    return (s1 > s2) - (s1 < s2);
  }

  /**
   * Comparator between two mappings where the original positions are compared.
   *
   * Optionally pass in `true` as `onlyCompareGenerated` to consider two
   * mappings with the same original source/line/column, but different generated
   * line and column the same. Useful when searching for a mapping with a
   * stubbed out mapping.
   */
  function compareByOriginalPositions(mappingA, mappingB, onlyCompareOriginal) {
    var cmp;

    cmp = strcmp(mappingA.source, mappingB.source);
    if (cmp) {
      return cmp;
    }

    cmp = mappingA.originalLine - mappingB.originalLine;
    if (cmp) {
      return cmp;
    }

    cmp = mappingA.originalColumn - mappingB.originalColumn;
    if (cmp || onlyCompareOriginal) {
      return cmp;
    }

    cmp = strcmp(mappingA.name, mappingB.name);
    if (cmp) {
      return cmp;
    }

    cmp = mappingA.generatedLine - mappingB.generatedLine;
    if (cmp) {
      return cmp;
    }

    return mappingA.generatedColumn - mappingB.generatedColumn;
  };
  exports.compareByOriginalPositions = compareByOriginalPositions;

  /**
   * Comparator between two mappings where the generated positions are
   * compared.
   *
   * Optionally pass in `true` as `onlyCompareGenerated` to consider two
   * mappings with the same generated line and column, but different
   * source/name/original line and column the same. Useful when searching for a
   * mapping with a stubbed out mapping.
   */
  function compareByGeneratedPositions(mappingA, mappingB, onlyCompareGenerated) {
    var cmp;

    cmp = mappingA.generatedLine - mappingB.generatedLine;
    if (cmp) {
      return cmp;
    }

    cmp = mappingA.generatedColumn - mappingB.generatedColumn;
    if (cmp || onlyCompareGenerated) {
      return cmp;
    }

    cmp = strcmp(mappingA.source, mappingB.source);
    if (cmp) {
      return cmp;
    }

    cmp = mappingA.originalLine - mappingB.originalLine;
    if (cmp) {
      return cmp;
    }

    cmp = mappingA.originalColumn - mappingB.originalColumn;
    if (cmp) {
      return cmp;
    }

    return strcmp(mappingA.name, mappingB.name);
  };
  exports.compareByGeneratedPositions = compareByGeneratedPositions;

});

},{"amdefine":119}],119:[function(require,module,exports){
(function (process,__filename){
/** vim: et:ts=4:sw=4:sts=4
 * @license amdefine 0.1.0 Copyright (c) 2011, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/amdefine for details
 */

/*jslint node: true */
/*global module, process */
'use strict';

/**
 * Creates a define for node.
 * @param {Object} module the "module" object that is defined by Node for the
 * current module.
 * @param {Function} [requireFn]. Node's require function for the current module.
 * It only needs to be passed in Node versions before 0.5, when module.require
 * did not exist.
 * @returns {Function} a define function that is usable for the current node
 * module.
 */
function amdefine(module, requireFn) {
    'use strict';
    var defineCache = {},
        loaderCache = {},
        alreadyCalled = false,
        path = require('path'),
        makeRequire, stringRequire;

    /**
     * Trims the . and .. from an array of path segments.
     * It will keep a leading path segment if a .. will become
     * the first path segment, to help with module name lookups,
     * which act like paths, but can be remapped. But the end result,
     * all paths that use this function should look normalized.
     * NOTE: this method MODIFIES the input array.
     * @param {Array} ary the array of path segments.
     */
    function trimDots(ary) {
        var i, part;
        for (i = 0; ary[i]; i+= 1) {
            part = ary[i];
            if (part === '.') {
                ary.splice(i, 1);
                i -= 1;
            } else if (part === '..') {
                if (i === 1 && (ary[2] === '..' || ary[0] === '..')) {
                    //End of the line. Keep at least one non-dot
                    //path segment at the front so it can be mapped
                    //correctly to disk. Otherwise, there is likely
                    //no path mapping for a path starting with '..'.
                    //This can still fail, but catches the most reasonable
                    //uses of ..
                    break;
                } else if (i > 0) {
                    ary.splice(i - 1, 2);
                    i -= 2;
                }
            }
        }
    }

    function normalize(name, baseName) {
        var baseParts;

        //Adjust any relative paths.
        if (name && name.charAt(0) === '.') {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                baseParts = baseName.split('/');
                baseParts = baseParts.slice(0, baseParts.length - 1);
                baseParts = baseParts.concat(name.split('/'));
                trimDots(baseParts);
                name = baseParts.join('/');
            }
        }

        return name;
    }

    /**
     * Create the normalize() function passed to a loader plugin's
     * normalize method.
     */
    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(id) {
        function load(value) {
            loaderCache[id] = value;
        }

        load.fromText = function (id, text) {
            //This one is difficult because the text can/probably uses
            //define, and any relative paths and requires should be relative
            //to that id was it would be found on disk. But this would require
            //bootstrapping a module/require fairly deeply from node core.
            //Not sure how best to go about that yet.
            throw new Error('amdefine does not implement load.fromText');
        };

        return load;
    }

    makeRequire = function (systemRequire, exports, module, relId) {
        function amdRequire(deps, callback) {
            if (typeof deps === 'string') {
                //Synchronous, single module require('')
                return stringRequire(systemRequire, exports, module, deps, relId);
            } else {
                //Array of dependencies with a callback.

                //Convert the dependencies to modules.
                deps = deps.map(function (depName) {
                    return stringRequire(systemRequire, exports, module, depName, relId);
                });

                //Wait for next tick to call back the require call.
                process.nextTick(function () {
                    callback.apply(null, deps);
                });
            }
        }

        amdRequire.toUrl = function (filePath) {
            if (filePath.indexOf('.') === 0) {
                return normalize(filePath, path.dirname(module.filename));
            } else {
                return filePath;
            }
        };

        return amdRequire;
    };

    //Favor explicit value, passed in if the module wants to support Node 0.4.
    requireFn = requireFn || function req() {
        return module.require.apply(module, arguments);
    };

    function runFactory(id, deps, factory) {
        var r, e, m, result;

        if (id) {
            e = loaderCache[id] = {};
            m = {
                id: id,
                uri: __filename,
                exports: e
            };
            r = makeRequire(requireFn, e, m, id);
        } else {
            //Only support one define call per file
            if (alreadyCalled) {
                throw new Error('amdefine with no module ID cannot be called more than once per file.');
            }
            alreadyCalled = true;

            //Use the real variables from node
            //Use module.exports for exports, since
            //the exports in here is amdefine exports.
            e = module.exports;
            m = module;
            r = makeRequire(requireFn, e, m, module.id);
        }

        //If there are dependencies, they are strings, so need
        //to convert them to dependency values.
        if (deps) {
            deps = deps.map(function (depName) {
                return r(depName);
            });
        }

        //Call the factory with the right dependencies.
        if (typeof factory === 'function') {
            result = factory.apply(m.exports, deps);
        } else {
            result = factory;
        }

        if (result !== undefined) {
            m.exports = result;
            if (id) {
                loaderCache[id] = m.exports;
            }
        }
    }

    stringRequire = function (systemRequire, exports, module, id, relId) {
        //Split the ID by a ! so that
        var index = id.indexOf('!'),
            originalId = id,
            prefix, plugin;

        if (index === -1) {
            id = normalize(id, relId);

            //Straight module lookup. If it is one of the special dependencies,
            //deal with it, otherwise, delegate to node.
            if (id === 'require') {
                return makeRequire(systemRequire, exports, module, relId);
            } else if (id === 'exports') {
                return exports;
            } else if (id === 'module') {
                return module;
            } else if (loaderCache.hasOwnProperty(id)) {
                return loaderCache[id];
            } else if (defineCache[id]) {
                runFactory.apply(null, defineCache[id]);
                return loaderCache[id];
            } else {
                if(systemRequire) {
                    return systemRequire(originalId);
                } else {
                    throw new Error('No module with ID: ' + id);
                }
            }
        } else {
            //There is a plugin in play.
            prefix = id.substring(0, index);
            id = id.substring(index + 1, id.length);

            plugin = stringRequire(systemRequire, exports, module, prefix, relId);

            if (plugin.normalize) {
                id = plugin.normalize(id, makeNormalize(relId));
            } else {
                //Normalize the ID normally.
                id = normalize(id, relId);
            }

            if (loaderCache[id]) {
                return loaderCache[id];
            } else {
                plugin.load(id, makeRequire(systemRequire, exports, module, relId), makeLoad(id), {});

                return loaderCache[id];
            }
        }
    };

    //Create a define function specific to the module asking for amdefine.
    function define(id, deps, factory) {
        if (Array.isArray(id)) {
            factory = deps;
            deps = id;
            id = undefined;
        } else if (typeof id !== 'string') {
            factory = id;
            id = deps = undefined;
        }

        if (deps && !Array.isArray(deps)) {
            factory = deps;
            deps = undefined;
        }

        if (!deps) {
            deps = ['require', 'exports', 'module'];
        }

        //Set up properties for this module. If an ID, then use
        //internal cache. If no ID, then use the external variables
        //for this node module.
        if (id) {
            //Put the module in deep freeze until there is a
            //require call for it.
            defineCache[id] = [id, deps, factory];
        } else {
            runFactory(id, deps, factory);
        }
    }

    //define.require, which has access to all the values in the
    //cache. Useful for AMD modules that all have IDs in the file,
    //but need to finally export a value to node based on one of those
    //IDs.
    define.require = function (id) {
        if (loaderCache[id]) {
            return loaderCache[id];
        }

        if (defineCache[id]) {
            runFactory.apply(null, defineCache[id]);
            return loaderCache[id];
        }
    };

    define.amd = {};

    return define;
}

module.exports = amdefine;

}).call(this,require("MnQM5j"),"/..\\..\\node_modules\\pleeease-brunch\\node_modules\\pleeease\\node_modules\\postcss-vars\\node_modules\\postcss\\node_modules\\source-map\\node_modules\\amdefine\\amdefine.js")
},{"MnQM5j":6,"path":5}],120:[function(require,module,exports){
arguments[4][93][0].apply(exports,arguments)
},{"./container":122}],121:[function(require,module,exports){
arguments[4][94][0].apply(exports,arguments)
},{"./node":127}],122:[function(require,module,exports){
(function() {
  var Container, Declaration, Node,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  Node = require('./node');

  Declaration = require('./declaration');

  Container = (function(_super) {
    __extends(Container, _super);

    function Container() {
      return Container.__super__.constructor.apply(this, arguments);
    }

    Container.prototype.stringifyContent = function(builder) {
      var last;
      if (!this.rules && !this.decls) {
        return;
      }
      if (this.rules) {
        last = this.rules.length - 1;
        return this.rules.map(function(rule, i) {
          return rule.stringify(builder, last === i);
        });
      } else if (this.decls) {
        last = this.decls.length - 1;
        return this.decls.map((function(_this) {
          return function(decl, i) {
            return decl.stringify(builder, last !== i || _this.semicolon);
          };
        })(this));
      }
    };

    Container.prototype.defaultAfter = function() {
      var _ref;
      if (this.list.length === 0) {
        return '';
      } else if (((_ref = this.list[0].before) != null ? _ref.indexOf("\n") : void 0) === -1) {
        return this.list[0].before;
      } else {
        return "\n";
      }
    };

    Container.prototype.stringifyBlock = function(builder, start) {
      var style;
      style = this.style();
      if (this.before) {
        builder(this.before);
      }
      builder(start, this, 'start');
      this.stringifyContent(builder);
      if (style.after) {
        builder(style.after);
      }
      return builder('}', this, 'end');
    };

    Container.prototype.push = function(child) {
      child.parent = this;
      this.list.push(child);
      return this;
    };

    Container.prototype.each = function(callback) {
      var id, index, list, result;
      this.lastEach || (this.lastEach = 0);
      this.indexes || (this.indexes = {});
      this.lastEach += 1;
      id = this.lastEach;
      this.indexes[id] = 0;
      list = this.list;
      if (!list) {
        return;
      }
      while (this.indexes[id] < list.length) {
        index = this.indexes[id];
        result = callback(list[index], index);
        if (result === false) {
          break;
        }
        this.indexes[id] += 1;
      }
      delete this.indexes[id];
      if (result === false) {
        return false;
      }
    };

    Container.prototype.eachInside = function(callback) {
      return this.each((function(_this) {
        return function(child, i) {
          var result;
          result = callback(child, i);
          if (result !== false && child.eachInside) {
            result = child.eachInside(callback);
          }
          if (result === false) {
            return result;
          }
        };
      })(this));
    };

    Container.prototype.eachDecl = function(callback) {};

    Container.prototype.eachComment = function(callback) {
      return this.eachInside((function(_this) {
        return function(child, i) {
          var result;
          result = child.type === 'comment' ? callback(child, i) : void 0;
          if (result === false) {
            return result;
          }
        };
      })(this));
    };

    Container.prototype.append = function(child) {
      var _i, _len, _ref;
      _ref = this.normalize(child, this.list[this.list.length - 1]);
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        child = _ref[_i];
        this.list.push(child);
      }
      return this;
    };

    Container.prototype.prepend = function(child) {
      var childs, id, index, _i, _len, _ref, _ref1;
      childs = this.normalize(child, this.list[0], 'prepend');
      _ref = childs.reverse();
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        child = _ref[_i];
        this.list.unshift(child);
      }
      _ref1 = this.indexes;
      for (id in _ref1) {
        index = _ref1[id];
        this.indexes[id] = index + childs.length;
      }
      return this;
    };

    Container.prototype.insertBefore = function(exist, add) {
      var child, childs, id, index, _i, _len, _ref, _ref1;
      exist = this.index(exist);
      childs = this.normalize(add, this.list[exist], exist === 0 ? 'prepend' : void 0);
      _ref = childs.reverse();
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        child = _ref[_i];
        this.list.splice(exist, 0, child);
      }
      _ref1 = this.indexes;
      for (id in _ref1) {
        index = _ref1[id];
        this.indexes[id] = index + childs.length;
      }
      return this;
    };

    Container.prototype.insertAfter = function(exist, add) {
      var child, childs, id, index, _i, _len, _ref, _ref1;
      exist = this.index(exist);
      childs = this.normalize(add, this.list[exist]);
      _ref = childs.reverse();
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        child = _ref[_i];
        this.list.splice(exist + 1, 0, child);
      }
      _ref1 = this.indexes;
      for (id in _ref1) {
        index = _ref1[id];
        this.indexes[id] = index + childs.length;
      }
      return this;
    };

    Container.prototype.remove = function(child) {
      var id, index, _ref;
      child = this.index(child);
      this.list.splice(child, 1);
      _ref = this.indexes;
      for (id in _ref) {
        index = _ref[id];
        if (index >= child) {
          this.indexes[id] = index - 1;
        }
      }
      return this;
    };

    Container.prototype.every = function(condition) {
      return this.list.every(condition);
    };

    Container.prototype.some = function(condition) {
      return this.list.some(condition);
    };

    Container.prototype.index = function(child) {
      if (typeof child === 'number') {
        return child;
      } else {
        return this.list.indexOf(child);
      }
    };

    Container.prop('first', {
      get: function() {
        return this.list[0];
      }
    });

    Container.prop('last', {
      get: function() {
        return this.list[this.list.length - 1];
      }
    });

    Container.prop('list', {
      get: function() {
        return this.rules || this.decls;
      }
    });

    Container.prototype.normalize = function(child, sample) {
      var childs, i, _i, _len, _results;
      if (child.type === 'root') {
        return this.normalize(child.rules, sample);
      } else {
        childs = (function() {
          var _i, _len, _results;
          if (Array.isArray(child)) {
            _results = [];
            for (_i = 0, _len = child.length; _i < _len; _i++) {
              i = child[_i];
              _results.push(i.clone());
            }
            return _results;
          } else {
            return [child];
          }
        })();
        _results = [];
        for (_i = 0, _len = childs.length; _i < _len; _i++) {
          child = childs[_i];
          child.parent = this;
          if ((child.before == null) && sample) {
            child.before = sample.before;
          }
          _results.push(child);
        }
        return _results;
      }
    };

    return Container;

  })(Node);

  Container.WithRules = (function(_super) {
    __extends(WithRules, _super);

    function WithRules() {
      this.rules = [];
      WithRules.__super__.constructor.apply(this, arguments);
    }

    WithRules.prototype.eachDecl = function(callback) {
      return this.each(function(child) {
        var result;
        if (!child.eachDecl) {
          return;
        }
        result = child.eachDecl(callback);
        if (result === false) {
          return result;
        }
      });
    };

    WithRules.prototype.eachRule = function(callback) {
      return this.each((function(_this) {
        return function(child, i) {
          var result;
          result = child.type === 'rule' ? callback(child, i) : child.eachRule ? child.eachRule(callback) : void 0;
          if (result === false) {
            return result;
          }
        };
      })(this));
    };

    WithRules.prototype.eachAtRule = function(callback) {
      return this.eachInside((function(_this) {
        return function(child, i) {
          var result;
          result = child.type === 'atrule' ? callback(child, i) : void 0;
          if (result === false) {
            return result;
          }
        };
      })(this));
    };

    return WithRules;

  })(Container);

  Container.WithDecls = (function(_super) {
    __extends(WithDecls, _super);

    function WithDecls() {
      this.decls = [];
      WithDecls.__super__.constructor.apply(this, arguments);
    }

    WithDecls.prototype.normalize = function(child, sample) {
      if (!child.type && !Array.isArray(child)) {
        child = new Declaration(child);
      }
      return WithDecls.__super__.normalize.call(this, child, sample);
    };

    WithDecls.prototype.eachDecl = function(callback) {
      return this.each((function(_this) {
        return function(node, i) {
          var result;
          if (node.type !== 'decl') {
            return;
          }
          result = callback(node, i);
          if (result === false) {
            return result;
          }
        };
      })(this));
    };

    return WithDecls;

  })(Container);

  module.exports = Container;

}).call(this);

},{"./declaration":124,"./node":127}],123:[function(require,module,exports){
(function() {
  var deprected, mozilla;

  mozilla = require('source-map');

  deprected = function(from, to) {
    return console.warn(("Option " + from + " is deprected and will be deleted in PostCSS 1.1.\n") + ("Use map: { " + to + " } instead."));
  };

  module.exports = function(old) {
    var map, name, opts, value, _base;
    opts = {};
    map = {};
    for (name in old) {
      value = old[name];
      if (name === 'map') {
        if (value === 'inline') {
          map.inline = true;
        } else if (typeof value === 'string') {
          deprected('map: prevMap', 'prev: prevMap');
          map.prev = value;
        } else if (value instanceof mozilla.SourceMapConsumer) {
          deprected('map: prevMap', 'prev: prevMap');
          map.prev = value;
        } else if (value instanceof mozilla.SourceMapGenerator) {
          deprected('map: prevMap', 'prev: prevMap');
          map.prev = value;
        } else if (typeof value === 'object' && (value.mappings != null)) {
          deprected('map: prevMap', 'prev: prevMap');
          map.prev = value;
        } else if (typeof value === 'object' || typeof value === 'boolean') {
          opts.map = value;
        } else {
          deprected('map: prevMap', 'prev: prevMap');
          map.prev = value;
        }
      } else if (name === 'mapAnnotation') {
        deprected("mapAnnotation", "annotation: " + value);
        map.annotation = value;
      } else if (name === 'inlineMap') {
        deprected("inlineMap", "inline: " + value);
        map.inline = value;
      } else {
        opts[name] = value;
      }
    }
    if (Object.keys(map).length > 0) {
      if (typeof opts.map === 'object') {
        for (name in map) {
          value = map[name];
          (_base = opts.map)[name] || (_base[name] = value);
        }
      } else {
        opts.map = map;
      }
    }
    return opts;
  };

}).call(this);

},{"source-map":138}],124:[function(require,module,exports){
(function() {
  var Declaration, Node, vendor,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  Node = require('./node');

  vendor = require('./vendor');

  Declaration = (function(_super) {
    __extends(Declaration, _super);

    function Declaration() {
      this.type = 'decl';
      Declaration.__super__.constructor.apply(this, arguments);
    }

    Declaration.prototype.defaultStyle = function() {
      return {
        before: "\n    ",
        between: ': '
      };
    };

    Declaration.raw('value');

    Declaration.prop('important', {
      get: function() {
        return !!this._important;
      },
      set: function(value) {
        if (typeof value === 'string' && value !== '') {
          return this._important = value;
        } else if (value) {
          return this._important = ' !important';
        } else {
          return this._important = false;
        }
      }
    });

    Declaration.prototype.stringify = function(builder, semicolon) {
      var string, style;
      style = this.style();
      if (style.before) {
        builder(style.before);
      }
      string = this.prop + style.between + this._value.toString();
      string += this._important || '';
      if (semicolon) {
        string += ';';
      }
      return builder(string, this);
    };

    Declaration.prototype.clone = function(obj) {
      var cloned;
      cloned = Declaration.__super__.clone.apply(this, arguments);
      delete cloned.before;
      delete cloned.between;
      return cloned;
    };

    return Declaration;

  })(Node);

  module.exports = Declaration;

}).call(this);

},{"./node":127,"./vendor":136}],125:[function(require,module,exports){
module.exports=require(98)
},{}],126:[function(require,module,exports){
(function() {
  var MapGenerator, Result, base64js, mozilla, path;

  Result = require('./result');

  base64js = require('base64-js');

  mozilla = require('source-map');

  path = require('path');

  MapGenerator = (function() {
    function MapGenerator(root, opts) {
      this.root = root;
      this.opts = opts;
      this.mapOpts = this.opts.map || {};
    }

    MapGenerator.prototype.isMap = function() {
      if (this.opts.map != null) {
        return !!this.opts.map;
      } else {
        return this.previous().length > 0;
      }
    };

    MapGenerator.prototype.previous = function() {
      if (!this.previousMaps) {
        this.previousMaps = [];
        this.root.eachInside((function(_this) {
          return function(node) {
            var _ref;
            if (((_ref = node.source) != null ? _ref.map : void 0) != null) {
              if (_this.previousMaps.indexOf(node.source.map) === -1) {
                return _this.previousMaps.push(node.source.map);
              }
            }
          };
        })(this));
      }
      return this.previousMaps;
    };

    MapGenerator.prototype.isInline = function() {
      if (this.mapOpts.inline != null) {
        return this.mapOpts.inline;
      }
      return this.previous().some(function(i) {
        return i.inline;
      });
    };

    MapGenerator.prototype.isSourcesContent = function() {
      if (this.mapOpts.sourcesContent != null) {
        return this.mapOpts.sourcesContent;
      }
      return this.previous().some(function(i) {
        return i.withContent();
      });
    };

    MapGenerator.prototype.clearAnnotation = function() {
      var last;
      last = this.root.last;
      if (!last) {
        return null;
      }
      if (last.type === 'comment' && last.text.match(/^# sourceMappingURL=/)) {
        return last.removeSelf();
      }
    };

    MapGenerator.prototype.setSourcesContent = function() {
      var already;
      already = {};
      return this.root.eachInside((function(_this) {
        return function(node) {
          if (node.source && !already[node.source.file]) {
            already[node.source.file] = true;
            return _this.map.setSourceContent(_this.relative(node.source.file), node.source.content);
          }
        };
      })(this));
    };

    MapGenerator.prototype.applyPrevMaps = function() {
      var from, i, map, prev, root, _i, _len, _ref, _results;
      _ref = this.previous();
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        prev = _ref[_i];
        from = prev.file;
        root = prev.root || path.dirname(from);
        if (this.mapOpts.sourcesContent === false) {
          map = new mozilla.SourceMapConsumer(prev.text);
          map.sourcesContent = (function() {
            var _j, _len1, _ref1, _results1;
            _ref1 = map.sourcesContent;
            _results1 = [];
            for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
              i = _ref1[_j];
              _results1.push(null);
            }
            return _results1;
          })();
        } else {
          map = prev.consumer();
        }
        _results.push(this.map.applySourceMap(map, this.relative(from), this.relative(root)));
      }
      return _results;
    };

    MapGenerator.prototype.isAnnotation = function() {
      if (this.isInline()) {
        return true;
      }
      if (this.mapOpts.annotation != null) {
        return this.mapOpts.annotation;
      }
      if (this.previous().length) {
        return this.previous().some(function(i) {
          return i.annotation;
        });
      } else {
        return true;
      }
    };

    MapGenerator.prototype.addAnnotation = function() {
      var bytes, char, content;
      content = this.isInline() ? (bytes = (function() {
        var _i, _len, _ref, _results;
        _ref = this.map.toString();
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          char = _ref[_i];
          _results.push(char.charCodeAt(0));
        }
        return _results;
      }).call(this), "data:application/json;base64," + base64js.fromByteArray(bytes)) : typeof this.mapOpts.annotation === 'string' ? this.mapOpts.annotation : this.outputFile() + '.map';
      return this.css += "\n/*# sourceMappingURL=" + content + " */";
    };

    MapGenerator.prototype.outputFile = function() {
      if (this.opts.to) {
        return this.relative(this.opts.to);
      } else {
        return 'to.css';
      }
    };

    MapGenerator.prototype.generateMap = function() {
      this.stringify();
      if (this.isSourcesContent()) {
        this.setSourcesContent();
      }
      if (this.previous().length > 0) {
        this.applyPrevMaps();
      }
      if (this.isAnnotation()) {
        this.addAnnotation();
      }
      if (this.isInline()) {
        return [this.css];
      } else {
        return [this.css, this.map];
      }
    };

    MapGenerator.prototype.relative = function(file) {
      var from;
      from = this.opts.to ? path.dirname(this.opts.to) : '.';
      if (typeof this.mapOpts.annotation === 'string') {
        from = path.dirname(path.resolve(from, this.mapOpts.annotation));
      }
      file = path.relative(from, file);
      if (path.sep === '\\') {
        file = file.replace('\\', '/');
      }
      return file;
    };

    MapGenerator.prototype.sourcePath = function(node) {
      return this.relative(node.source.file || 'from.css');
    };

    MapGenerator.prototype.stringify = function() {
      var builder, column, line;
      this.css = '';
      this.map = new mozilla.SourceMapGenerator({
        file: this.outputFile()
      });
      line = 1;
      column = 1;
      builder = (function(_this) {
        return function(str, node, type) {
          var last, lines, _ref, _ref1;
          _this.css += str;
          if ((node != null ? (_ref = node.source) != null ? _ref.start : void 0 : void 0) && type !== 'end') {
            _this.map.addMapping({
              source: _this.sourcePath(node),
              original: {
                line: node.source.start.line,
                column: node.source.start.column - 1
              },
              generated: {
                line: line,
                column: column - 1
              }
            });
          }
          lines = str.match(/\n/g);
          if (lines) {
            line += lines.length;
            last = str.lastIndexOf("\n");
            column = str.length - last;
          } else {
            column = column + str.length;
          }
          if ((node != null ? (_ref1 = node.source) != null ? _ref1.end : void 0 : void 0) && type !== 'start') {
            return _this.map.addMapping({
              source: _this.sourcePath(node),
              original: {
                line: node.source.end.line,
                column: node.source.end.column
              },
              generated: {
                line: line,
                column: column
              }
            });
          }
        };
      })(this);
      return this.root.stringify(builder);
    };

    MapGenerator.prototype.generate = function() {
      this.clearAnnotation();
      if (this.isMap()) {
        return this.generateMap();
      } else {
        return [this.root.toString()];
      }
    };

    return MapGenerator;

  })();

  module.exports = MapGenerator;

}).call(this);

},{"./result":132,"base64-js":137,"path":5,"source-map":138}],127:[function(require,module,exports){
(function() {
  var Node, Raw, clone, keys,
    __hasProp = {}.hasOwnProperty;

  Raw = require('./raw');

  clone = function(obj, parent) {
    var cloned, name, value;
    if (typeof obj !== 'object') {
      return obj;
    }
    cloned = new obj.constructor();
    for (name in obj) {
      if (!__hasProp.call(obj, name)) continue;
      value = obj[name];
      if (name === 'parent' && typeof value === 'object') {
        if (parent) {
          cloned[name] = parent;
        }
      } else if (name === 'source') {
        cloned[name] = value;
      } else if (value instanceof Array) {
        cloned[name] = value.map(function(i) {
          return clone(i, cloned);
        });
      } else {
        cloned[name] = clone(value, cloned);
      }
    }
    return cloned;
  };

  keys = function(obj, keys) {
    var all, key;
    all = {};
    for (key in keys) {
      if (obj[key] != null) {
        all[key] = obj[key];
      } else {
        return false;
      }
    }
    return all;
  };

  Node = (function() {
    function Node(defaults) {
      var name, value;
      if (defaults == null) {
        defaults = {};
      }
      for (name in defaults) {
        value = defaults[name];
        this[name] = value;
      }
    }

    Node.prop = function(name, params) {
      return Object.defineProperty(this.prototype, name, params);
    };

    Node.raw = function(name) {
      var hidden;
      hidden = '_' + name;
      return this.prop(name, {
        get: function() {
          var prop;
          prop = this[hidden];
          if (prop instanceof Raw) {
            return prop.value;
          } else {
            return prop;
          }
        },
        set: function(value) {
          if (value instanceof Raw) {
            return this[hidden] = value;
          } else {
            return this[hidden] = value;
          }
        }
      });
    };

    Node.prototype.removeSelf = function() {
      if (!this.parent) {
        return;
      }
      this.parent.remove(this);
      return this;
    };

    Node.prototype.toString = function() {
      var builder, result;
      result = '';
      builder = function(str) {
        return result += str;
      };
      this.stringify(builder);
      return result;
    };

    Node.prototype.clone = function(overrides) {
      var cloned, name, value;
      if (overrides == null) {
        overrides = {};
      }
      cloned = clone(this);
      for (name in overrides) {
        value = overrides[name];
        cloned[name] = value;
      }
      return cloned;
    };

    Node.prototype.toJSON = function() {
      var fixed, name, value;
      fixed = {};
      for (name in this) {
        if (!__hasProp.call(this, name)) continue;
        value = this[name];
        if (name === 'parent') {
          continue;
        }
        fixed[name] = value instanceof Array ? value.map(function(i) {
          if (typeof i === 'object' && i.toJSON) {
            return i.toJSON();
          } else {
            return i;
          }
        }) : typeof value === 'object' && value.toJSON ? value.toJSON() : value;
      }
      return fixed;
    };

    Node.prototype.defaultStyle = function() {
      return {};
    };

    Node.prototype.styleType = function() {
      return this.type;
    };

    Node.prototype.style = function() {
      var all, defaults, key, merge, root, style, type;
      type = this.styleType();
      defaults = this.defaultStyle(type);
      all = keys(this, defaults);
      if (all) {
        return all;
      }
      style = defaults;
      if (this.parent) {
        root = this;
        while (root.parent) {
          root = root.parent;
        }
        root.styleCache || (root.styleCache = {});
        if (root.styleCache[type]) {
          style = root.styleCache[type];
        } else {
          root.eachInside(function(another) {
            if (another.styleType() !== type) {
              return;
            }
            if (this === another) {
              return;
            }
            all = keys(another, style);
            if (all) {
              style = all;
              return false;
            }
          });
          root.styleCache[type] = style;
        }
      }
      merge = {};
      for (key in style) {
        merge[key] = this[key] != null ? this[key] : style[key];
      }
      return merge;
    };

    return Node;

  })();

  module.exports = Node;

}).call(this);

},{"./raw":131}],128:[function(require,module,exports){
(function() {
  var AtRule, Comment, Declaration, Parser, PreviousMap, Raw, Root, Rule, SyntaxError, convertOptions, isSpace, path;

  convertOptions = require('./convert-options');

  SyntaxError = require('./syntax-error');

  PreviousMap = require('./previous-map');

  Declaration = require('./declaration');

  Comment = require('./comment');

  AtRule = require('./at-rule');

  Root = require('./root');

  Rule = require('./rule');

  Raw = require('./raw');

  path = require('path');

  isSpace = /\s/;

  Parser = (function() {
    function Parser(source, opts) {
      this.opts = opts;
      this.source = source.toString();
      this.root = new Root();
      this.current = this.root;
      this.parents = [this.current];
      this.type = 'rules';
      this.types = [this.type];
      this.pos = -1;
      this.line = 1;
      this.lines = [];
      this.column = 0;
      this.buffer = '';
    }

    Parser.prototype.loop = function() {
      var length;
      length = this.source.length - 1;
      while (this.pos < length) {
        this.move();
        this.nextLetter();
      }
      return this.endFile();
    };

    Parser.prototype.setMap = function() {
      var map;
      map = new PreviousMap(this.root, this.opts);
      if (map.text) {
        this.root.prevMap = map;
        return this.root.eachInside(function(i) {
          return i.source.map = map;
        });
      }
    };

    Parser.prototype.nextLetter = function() {
      this.inString() || this.inComment() || this.isComment() || this.isString() || this.isWrong() || this.inAtrule() || this.isAtrule() || this.isBlockEnd() || this.inSelector() || this.isSelector() || this.inProperty() || this.isProperty() || this.inValue();
      return this.unknown();
    };

    Parser.prototype.inString = function() {
      if (this.quote) {
        if (this.escape) {
          this.escape = false;
        } else if (this.letter === '\\') {
          this.escape = true;
        } else if (this.letter === this.quote) {
          this.quote = void 0;
        }
        this.trimmed += this.letter;
        return true;
      }
    };

    Parser.prototype.isString = function() {
      if (this.letter === '"' || this.letter === "'") {
        this.quote = this.letter;
        this.quotePos = {
          line: this.line,
          column: this.column
        };
        this.trimmed += this.letter;
        return true;
      }
    };

    Parser.prototype.inComment = function() {
      var left, right, text, _ref, _ref1;
      if (this.inside('comment')) {
        if (this.next('*/')) {
          _ref = this.startSpaces(this.prevBuffer()), text = _ref[0], left = _ref[1];
          _ref1 = this.endSpaces(text), text = _ref1[0], right = _ref1[1];
          this.current.text = text;
          this.current.left = left;
          this.current.right = right;
          this.move();
          this.pop();
        }
        return true;
      } else if (this.inside('value-comment')) {
        if (this.next('*/')) {
          this.popType();
          this.move();
        }
        return true;
      }
    };

    Parser.prototype.isComment = function() {
      if (this.next('/*')) {
        if (this.inside('rules') || this.inside('decls')) {
          this.init(new Comment());
          this.addType('comment');
          this.move();
          return this.buffer = '';
        } else {
          this.commentPos = {
            line: this.line,
            column: this.column
          };
          this.addType('value-comment');
          this.move();
          return true;
        }
      }
    };

    Parser.prototype.isWrong = function() {
      if (this.letter === '{' && (this.inside('decls') || this.inside('value'))) {
        this.error("Unexpected {");
      }
      if (this.inside('prop') && (this.letter === '}' || this.letter === ';')) {
        return this.error('Missing property value');
      }
    };

    Parser.prototype.isAtrule = function() {
      if (this.letter === '@' && this.inside('rules')) {
        this.init(new AtRule());
        this.current.name = '';
        this.addType('atrule-name');
        return true;
      }
    };

    Parser.prototype.inAtrule = function(close) {
      var left, raw, right, _ref, _ref1;
      if (this.inside('atrule-name')) {
        if (this.space()) {
          this.checkAtruleName();
          this.buffer = this.buffer.slice(this.current.name.length);
          this.trimmed = '';
          this.setType('atrule-param');
        } else if (this.letter === ';' || this.letter === '{' || close) {
          this.current.between = '';
          this.checkAtruleName();
          this.endAtruleParams();
        } else {
          this.current.name += this.letter;
        }
        return true;
      } else if (this.inside('atrule-param')) {
        if (this.letter === ';' || this.letter === '{' || close) {
          _ref = this.startSpaces(this.prevBuffer()), raw = _ref[0], left = _ref[1];
          _ref1 = this.endSpaces(raw), raw = _ref1[0], right = _ref1[1];
          this.current.params = this.raw(this.trimmed.trim(), raw);
          if (this.current.params) {
            this.current.afterName = left;
            this.current.between = right;
          } else {
            this.current.afterName = '';
            this.current.between = left + right;
          }
          this.endAtruleParams();
        } else {
          this.trimmed += this.letter;
        }
        return true;
      }
    };

    Parser.prototype.inSelector = function() {
      var raw, spaces, _ref;
      if (this.inside('selector')) {
        if (this.letter === '{') {
          _ref = this.endSpaces(this.prevBuffer()), raw = _ref[0], spaces = _ref[1];
          this.current.selector = this.raw(this.trimmed.trim(), raw);
          this.current.between = spaces;
          this.semicolon = false;
          this.buffer = '';
          this.setType('decls');
        } else {
          this.trimmed += this.letter;
        }
        return true;
      }
    };

    Parser.prototype.isSelector = function() {
      if (!this.space() && this.inside('rules')) {
        this.init(new Rule());
        if (this.letter === '{') {
          this.addType('decls');
          this.current.selector = '';
          this.current.between = '';
          this.semicolon = false;
          this.buffer = '';
        } else {
          this.addType('selector');
          this.buffer = this.letter;
          this.trimmed = this.letter;
        }
        return true;
      }
    };

    Parser.prototype.isBlockEnd = function() {
      if (this.letter === '}') {
        if (this.parents.length === 1) {
          this.error('Unexpected }');
        } else {
          if (this.inside('value')) {
            this.fixEnd(function() {
              return this.inValue('close');
            });
          } else {
            if (this.semicolon) {
              this.current.semicolon = true;
            }
            this.current.after = this.prevBuffer();
          }
          this.pop();
        }
        return true;
      }
    };

    Parser.prototype.inProperty = function() {
      if (this.inside('prop')) {
        if (this.letter === ':') {
          if (this.buffer[0] === '*' || this.buffer[0] === '_') {
            this.current.before += this.buffer[0];
            this.trimmed = this.trimmed.slice(1);
            this.buffer = this.buffer.slice(1);
          }
          this.current.prop = this.trimmed.trim();
          this.current.between = this.prevBuffer().slice(this.current.prop.length);
          this.buffer = '';
          this.setType('value');
          this.trimmed = '';
        } else if (this.letter === '{') {
          this.error('Unexpected { in decls');
        } else {
          this.trimmed += this.letter;
        }
        return true;
      }
    };

    Parser.prototype.isProperty = function() {
      if (this.inside('decls') && !this.space() && this.letter !== ';') {
        this.init(new Declaration());
        this.addType('prop');
        this.buffer = this.letter;
        this.trimmed = this.letter;
        this.semicolon = false;
        return true;
      }
    };

    Parser.prototype.inValue = function(close) {
      var end, match, raw, spaces, trim, _ref;
      if (this.inside('value')) {
        if (this.letter === '(') {
          this.inBrackets = true;
        } else if (this.inBrackets && this.letter === ')') {
          this.inBrackets = false;
        }
        if ((this.letter === ';' && !this.inBrackets) || close) {
          if (this.letter === ';') {
            this.semicolon = true;
          }
          _ref = this.startSpaces(this.prevBuffer()), raw = _ref[0], spaces = _ref[1];
          trim = this.trimmed.trim();
          if (match = raw.match(/\s+!important\s*$/)) {
            this.current._important = match[0];
            end = -match[0].length - 1;
            raw = raw.slice(0, +end + 1 || 9e9);
            trim = trim.replace(/\s+!important$/, '');
          }
          this.current.value = this.raw(trim, raw);
          this.current.between += ':' + spaces;
          this.pop();
        } else {
          this.trimmed += this.letter;
        }
        return true;
      }
    };

    Parser.prototype.unknown = function() {
      if (!this.space) {
        return this.error("Unexpected symbol " + this.letter);
      }
    };

    Parser.prototype.endFile = function() {
      if (this.inside('atrule-param') || this.inside('atrule-name')) {
        this.fixEnd(function() {
          return this.inAtrule('close');
        });
      }
      if (this.inside('comment')) {
        return this.error('Unclosed comment', this.current.source.start);
      } else if (this.parents.length > 1) {
        return this.error('Unclosed block', this.current.source.start);
      } else if (this.inside('value-comment')) {
        return this.error('Unclosed comment', this.commentPos);
      } else if (this.quote) {
        return this.error('Unclosed quote', this.quotePos);
      } else {
        return this.root.after = this.buffer;
      }
    };

    Parser.prototype.error = function(message, position) {
      if (position == null) {
        position = {
          line: this.line,
          column: this.column
        };
      }
      throw new SyntaxError(message, this.source, position, this.opts.from);
    };

    Parser.prototype.move = function() {
      this.pos += 1;
      this.column += 1;
      this.letter = this.source[this.pos];
      this.buffer += this.letter;
      if (this.letter === "\n") {
        this.lines[this.line] = this.column - 1;
        this.line += 1;
        return this.column = 0;
      }
    };

    Parser.prototype.prevBuffer = function() {
      return this.buffer.slice(0, -1);
    };

    Parser.prototype.inside = function(type) {
      return this.type === type;
    };

    Parser.prototype.next = function(string) {
      return this.source.slice(this.pos, +(this.pos + string.length - 1) + 1 || 9e9) === string;
    };

    Parser.prototype.space = function() {
      return this.letter === ' ' || this.letter === "\n" || this.letter.match(isSpace);
    };

    Parser.prototype.init = function(node) {
      this.current.push(node);
      this.parents.push(node);
      this.current = node;
      this.current.source = {
        start: {
          line: this.line,
          column: this.column
        },
        content: this.source
      };
      if (this.opts.from) {
        this.current.source.file = path.resolve(this.opts.from);
      }
      this.current.before = this.buffer.slice(0, -1);
      return this.buffer = '';
    };

    Parser.prototype.raw = function(value, raw) {
      if (value !== raw) {
        return new Raw(value, raw);
      } else {
        return value;
      }
    };

    Parser.prototype.fixEnd = function(callback) {
      var after, all, el, last, lines, start;
      if (this.letter === '}') {
        start = this.buffer.search(/\s*\}$/);
        after = this.buffer.slice(start, -1);
      } else {
        start = this.buffer.search(/\s*$/);
        after = this.buffer.slice(start);
      }
      this.buffer = this.buffer.slice(0, +start + 1 || 9e9);
      el = this.current;
      callback.apply(this);
      lines = after.match(/\n/g);
      if (lines) {
        el.source.end.line -= lines.length;
        all = this.lines[el.source.end.line];
        last = after.indexOf("\n");
        if (last === -1) {
          last = after.length;
        }
        el.source.end.column = all - last;
      } else {
        el.source.end.column -= after.length;
      }
      this.current.after = after;
      return this.buffer = after;
    };

    Parser.prototype.pop = function() {
      this.current.source.end = {
        line: this.line,
        column: this.column
      };
      this.popType();
      this.parents.pop();
      this.current = this.parents[this.parents.length - 1];
      return this.buffer = '';
    };

    Parser.prototype.addType = function(type) {
      this.types.push(type);
      return this.type = type;
    };

    Parser.prototype.setType = function(type) {
      this.types[this.types.length - 1] = type;
      return this.type = type;
    };

    Parser.prototype.popType = function() {
      this.types.pop();
      return this.type = this.types[this.types.length - 1];
    };

    Parser.prototype.atruleType = function() {
      var name;
      name = this.current.name.toLowerCase();
      if (name === 'page' || name === 'font-face' || name.slice(-8) === 'viewport') {
        return 'decls';
      } else {
        return 'rules';
      }
    };

    Parser.prototype.endAtruleParams = function() {
      var type;
      if (this.letter === '{') {
        type = this.atruleType();
        this.current.addMixin(type);
        this.setType(type);
        return this.buffer = '';
      } else {
        if (this.letter === ';') {
          this.current.semicolon = true;
        }
        return this.pop();
      }
    };

    Parser.prototype.checkAtruleName = function() {
      if (this.current.name === '') {
        return this.error('At-rule without name');
      }
    };

    Parser.prototype.startSpaces = function(string) {
      var match, pos;
      match = string.match(/^\s*/);
      if (match) {
        pos = match[0].length;
        return [string.slice(pos), match[0]];
      } else {
        return [string, ''];
      }
    };

    Parser.prototype.endSpaces = function(string) {
      var match, pos;
      match = string.match(/\s*$/);
      if (match) {
        pos = match[0].length + 1;
        return [string.slice(0, +(-pos) + 1 || 9e9), match[0]];
      } else {
        return [string, ''];
      }
    };

    return Parser;

  })();

  module.exports = function(source, opts) {
    var parser;
    if (opts == null) {
      opts = {};
    }
    opts = convertOptions(opts);
    parser = new Parser(source, opts);
    parser.loop();
    parser.setMap();
    return parser.root;
  };

}).call(this);

},{"./at-rule":120,"./comment":121,"./convert-options":123,"./declaration":124,"./previous-map":130,"./raw":131,"./root":133,"./rule":134,"./syntax-error":135,"path":5}],129:[function(require,module,exports){
(function() {
  var AtRule, Comment, Declaration, PostCSS, Result, Root, Rule, convertOptions, postcss,
    __slice = [].slice;

  convertOptions = require('./convert-options');

  Declaration = require('./declaration');

  Comment = require('./comment');

  AtRule = require('./at-rule');

  Result = require('./result');

  Rule = require('./rule');

  Root = require('./root');

  PostCSS = (function() {
    function PostCSS(processors) {
      this.processors = processors != null ? processors : [];
    }

    PostCSS.prototype.use = function(processor) {
      this.processors.push(processor);
      return this;
    };

    PostCSS.prototype.process = function(css, opts) {
      var parsed, processor, returned, _i, _len, _ref;
      if (opts == null) {
        opts = {};
      }
      opts = convertOptions(opts);
      parsed = css instanceof Root ? css : css instanceof Result ? parsed = css.root : postcss.parse(css, opts);
      _ref = this.processors;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        processor = _ref[_i];
        returned = processor(parsed);
        if (returned instanceof Root) {
          parsed = returned;
        }
      }
      return parsed.toResult(opts);
    };

    return PostCSS;

  })();

  postcss = function() {
    var processors;
    processors = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    return new PostCSS(processors);
  };

  postcss.parse = require('./parse');

  postcss.comment = function(defaults) {
    return new Comment(defaults);
  };

  postcss.atRule = function(defaults) {
    return new AtRule(defaults);
  };

  postcss.decl = function(defaults) {
    return new Declaration(defaults);
  };

  postcss.rule = function(defaults) {
    return new Rule(defaults);
  };

  postcss.root = function(defaults) {
    return new Root(defaults);
  };

  module.exports = postcss;

}).call(this);

},{"./at-rule":120,"./comment":121,"./convert-options":123,"./declaration":124,"./parse":128,"./result":132,"./root":133,"./rule":134}],130:[function(require,module,exports){
(function() {
  var PreviousMap, base64js, fs, mozilla, path;

  base64js = require('base64-js');

  mozilla = require('source-map');

  path = require('path');

  fs = require('fs');

  PreviousMap = (function() {
    function PreviousMap(root, opts) {
      var text, _ref;
      this.file = opts.from;
      this.loadAnnotation(root);
      this.inline = this.startWith(this.annotation, '# sourceMappingURL=data:');
      text = this.loadMap((_ref = opts.map) != null ? _ref.prev : void 0);
      if (text) {
        this.text = text;
      }
    }

    PreviousMap.prototype.consumer = function() {
      return this.consumerCache || (this.consumerCache = new mozilla.SourceMapConsumer(this.text));
    };

    PreviousMap.prototype.withContent = function() {
      var _ref;
      return ((_ref = this.consumer().sourcesContent) != null ? _ref.length : void 0) > 0;
    };

    PreviousMap.prototype.startWith = function(string, start) {
      if (!string) {
        return false;
      }
      return string.slice(0, +(start.length - 1) + 1 || 9e9) === start;
    };

    PreviousMap.prototype.loadAnnotation = function(root) {
      var last;
      last = root.last;
      if (!last) {
        return;
      }
      if (last.type === 'comment' && this.startWith(last.text, '# sourceMappingURL=')) {
        return this.annotation = last.text;
      }
    };

    PreviousMap.prototype.decodeInline = function(text) {
      var base64, byte, bytes, encoding, uri, _ref;
      uri = '# sourceMappingURL=data:application/json,';
      base64 = '# sourceMappingURL=data:application/json;base64,';
      if (this.startWith(text, uri)) {
        return decodeURIComponent(text.slice(uri.length));
      } else if (this.startWith(text, base64)) {
        text = text.slice(base64.length);
        bytes = base64js.toByteArray(text);
        return ((function() {
          var _i, _len, _results;
          _results = [];
          for (_i = 0, _len = bytes.length; _i < _len; _i++) {
            byte = bytes[_i];
            _results.push(String.fromCharCode(byte));
          }
          return _results;
        })()).join('');
      } else {
        encoding = (_ref = text.match(/ata:application\/json;([^,]+),/)) != null ? _ref[1] : void 0;
        throw new Error("Unsupported source map encoding " + encoding);
      }
    };

    PreviousMap.prototype.loadMap = function(prev) {
      var map;
      if (prev === false) {
        return;
      }
      if (prev) {
        if (typeof prev === 'string') {
          return prev;
        } else if (prev instanceof mozilla.SourceMapConsumer) {
          return mozilla.SourceMapGenerator.fromSourceMap(prev).toString();
        } else if (prev instanceof mozilla.SourceMapGenerator) {
          return prev.toString();
        } else if (typeof prev === 'object' && (prev.mappings != null)) {
          return JSON.stringify(prev);
        } else {
          throw new Error("Unsupported previous source map format: " + prev);
        }
      } else if (this.inline) {
        return this.decodeInline(this.annotation);
      } else if (this.annotation) {
        map = this.annotation.replace('# sourceMappingURL=', '');
        if (this.file) {
          map = path.join(path.dirname(this.file), map);
        }
        this.root = path.dirname(map);
        if (typeof fs.existsSync === "function" ? fs.existsSync(map) : void 0) {
          return fs.readFileSync(map).toString();
        }
      }
    };

    return PreviousMap;

  })();

  module.exports = PreviousMap;

}).call(this);

},{"base64-js":137,"fs":1,"path":5,"source-map":138}],131:[function(require,module,exports){
module.exports=require(103)
},{}],132:[function(require,module,exports){
(function() {
  var MapGenerator, Result;

  MapGenerator = require('./map-generator');

  Result = (function() {
    function Result(root, opts) {
      this.root = root;
      this.opts = opts != null ? opts : {};
    }

    Result.prototype.stringify = function() {
      var map, _ref;
      map = new MapGenerator(this.root, this.opts);
      return _ref = map.generate(), this.cssCached = _ref[0], this.mapCached = _ref[1], _ref;
    };

    Result.prototype.toString = function() {
      return this.css;
    };

    return Result;

  })();

  Object.defineProperty(Result.prototype, 'map', {
    get: function() {
      if (!this.cssCached) {
        this.stringify();
      }
      return this.mapCached;
    }
  });

  Object.defineProperty(Result.prototype, 'css', {
    get: function() {
      if (!this.cssCached) {
        this.stringify();
      }
      return this.cssCached;
    }
  });

  module.exports = Result;

}).call(this);

},{"./map-generator":126}],133:[function(require,module,exports){
(function() {
  var AtRule, Comment, Container, Declaration, Result, Root, Rule,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  Declaration = require('./declaration');

  Container = require('./container');

  Comment = require('./comment');

  AtRule = require('./at-rule');

  Result = require('./result');

  Rule = require('./rule');

  Root = (function(_super) {
    __extends(Root, _super);

    function Root() {
      this.type = 'root';
      this.rules = [];
      Root.__super__.constructor.apply(this, arguments);
    }

    Root.prototype.normalize = function(child, sample, type) {
      child = Root.__super__.normalize.apply(this, arguments);
      if (type === 'prepend') {
        sample.before = this.rules.length > 1 ? this.rules[1].before : this.after;
      }
      return child;
    };

    Root.prototype.stringify = function(builder) {
      this.stringifyContent(builder);
      if (this.after) {
        return builder(this.after);
      }
    };

    Root.prototype.toResult = function(opts) {
      if (opts == null) {
        opts = {};
      }
      return new Result(this, opts);
    };

    return Root;

  })(Container.WithRules);

  module.exports = Root;

}).call(this);

},{"./at-rule":120,"./comment":121,"./container":122,"./declaration":124,"./result":132,"./rule":134}],134:[function(require,module,exports){
arguments[4][106][0].apply(exports,arguments)
},{"./container":122,"./declaration":124,"./list":125}],135:[function(require,module,exports){
module.exports=require(107)
},{}],136:[function(require,module,exports){
module.exports=require(108)
},{}],137:[function(require,module,exports){
module.exports=require(3)
},{}],138:[function(require,module,exports){
arguments[4][110][0].apply(exports,arguments)
},{"./source-map/source-map-consumer":143,"./source-map/source-map-generator":144,"./source-map/source-node":145}],139:[function(require,module,exports){
arguments[4][111][0].apply(exports,arguments)
},{"./util":146,"amdefine":147}],140:[function(require,module,exports){
arguments[4][112][0].apply(exports,arguments)
},{"./base64":141,"amdefine":147}],141:[function(require,module,exports){
arguments[4][113][0].apply(exports,arguments)
},{"amdefine":147}],142:[function(require,module,exports){
arguments[4][114][0].apply(exports,arguments)
},{"amdefine":147}],143:[function(require,module,exports){
arguments[4][115][0].apply(exports,arguments)
},{"./array-set":139,"./base64-vlq":140,"./binary-search":142,"./util":146,"amdefine":147}],144:[function(require,module,exports){
arguments[4][116][0].apply(exports,arguments)
},{"./array-set":139,"./base64-vlq":140,"./util":146,"amdefine":147}],145:[function(require,module,exports){
arguments[4][117][0].apply(exports,arguments)
},{"./source-map-generator":144,"./util":146,"amdefine":147}],146:[function(require,module,exports){
arguments[4][118][0].apply(exports,arguments)
},{"amdefine":147}],147:[function(require,module,exports){
(function (process,__filename){
/** vim: et:ts=4:sw=4:sts=4
 * @license amdefine 0.1.0 Copyright (c) 2011, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/amdefine for details
 */

/*jslint node: true */
/*global module, process */
'use strict';

/**
 * Creates a define for node.
 * @param {Object} module the "module" object that is defined by Node for the
 * current module.
 * @param {Function} [requireFn]. Node's require function for the current module.
 * It only needs to be passed in Node versions before 0.5, when module.require
 * did not exist.
 * @returns {Function} a define function that is usable for the current node
 * module.
 */
function amdefine(module, requireFn) {
    'use strict';
    var defineCache = {},
        loaderCache = {},
        alreadyCalled = false,
        path = require('path'),
        makeRequire, stringRequire;

    /**
     * Trims the . and .. from an array of path segments.
     * It will keep a leading path segment if a .. will become
     * the first path segment, to help with module name lookups,
     * which act like paths, but can be remapped. But the end result,
     * all paths that use this function should look normalized.
     * NOTE: this method MODIFIES the input array.
     * @param {Array} ary the array of path segments.
     */
    function trimDots(ary) {
        var i, part;
        for (i = 0; ary[i]; i+= 1) {
            part = ary[i];
            if (part === '.') {
                ary.splice(i, 1);
                i -= 1;
            } else if (part === '..') {
                if (i === 1 && (ary[2] === '..' || ary[0] === '..')) {
                    //End of the line. Keep at least one non-dot
                    //path segment at the front so it can be mapped
                    //correctly to disk. Otherwise, there is likely
                    //no path mapping for a path starting with '..'.
                    //This can still fail, but catches the most reasonable
                    //uses of ..
                    break;
                } else if (i > 0) {
                    ary.splice(i - 1, 2);
                    i -= 2;
                }
            }
        }
    }

    function normalize(name, baseName) {
        var baseParts;

        //Adjust any relative paths.
        if (name && name.charAt(0) === '.') {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                baseParts = baseName.split('/');
                baseParts = baseParts.slice(0, baseParts.length - 1);
                baseParts = baseParts.concat(name.split('/'));
                trimDots(baseParts);
                name = baseParts.join('/');
            }
        }

        return name;
    }

    /**
     * Create the normalize() function passed to a loader plugin's
     * normalize method.
     */
    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(id) {
        function load(value) {
            loaderCache[id] = value;
        }

        load.fromText = function (id, text) {
            //This one is difficult because the text can/probably uses
            //define, and any relative paths and requires should be relative
            //to that id was it would be found on disk. But this would require
            //bootstrapping a module/require fairly deeply from node core.
            //Not sure how best to go about that yet.
            throw new Error('amdefine does not implement load.fromText');
        };

        return load;
    }

    makeRequire = function (systemRequire, exports, module, relId) {
        function amdRequire(deps, callback) {
            if (typeof deps === 'string') {
                //Synchronous, single module require('')
                return stringRequire(systemRequire, exports, module, deps, relId);
            } else {
                //Array of dependencies with a callback.

                //Convert the dependencies to modules.
                deps = deps.map(function (depName) {
                    return stringRequire(systemRequire, exports, module, depName, relId);
                });

                //Wait for next tick to call back the require call.
                process.nextTick(function () {
                    callback.apply(null, deps);
                });
            }
        }

        amdRequire.toUrl = function (filePath) {
            if (filePath.indexOf('.') === 0) {
                return normalize(filePath, path.dirname(module.filename));
            } else {
                return filePath;
            }
        };

        return amdRequire;
    };

    //Favor explicit value, passed in if the module wants to support Node 0.4.
    requireFn = requireFn || function req() {
        return module.require.apply(module, arguments);
    };

    function runFactory(id, deps, factory) {
        var r, e, m, result;

        if (id) {
            e = loaderCache[id] = {};
            m = {
                id: id,
                uri: __filename,
                exports: e
            };
            r = makeRequire(requireFn, e, m, id);
        } else {
            //Only support one define call per file
            if (alreadyCalled) {
                throw new Error('amdefine with no module ID cannot be called more than once per file.');
            }
            alreadyCalled = true;

            //Use the real variables from node
            //Use module.exports for exports, since
            //the exports in here is amdefine exports.
            e = module.exports;
            m = module;
            r = makeRequire(requireFn, e, m, module.id);
        }

        //If there are dependencies, they are strings, so need
        //to convert them to dependency values.
        if (deps) {
            deps = deps.map(function (depName) {
                return r(depName);
            });
        }

        //Call the factory with the right dependencies.
        if (typeof factory === 'function') {
            result = factory.apply(m.exports, deps);
        } else {
            result = factory;
        }

        if (result !== undefined) {
            m.exports = result;
            if (id) {
                loaderCache[id] = m.exports;
            }
        }
    }

    stringRequire = function (systemRequire, exports, module, id, relId) {
        //Split the ID by a ! so that
        var index = id.indexOf('!'),
            originalId = id,
            prefix, plugin;

        if (index === -1) {
            id = normalize(id, relId);

            //Straight module lookup. If it is one of the special dependencies,
            //deal with it, otherwise, delegate to node.
            if (id === 'require') {
                return makeRequire(systemRequire, exports, module, relId);
            } else if (id === 'exports') {
                return exports;
            } else if (id === 'module') {
                return module;
            } else if (loaderCache.hasOwnProperty(id)) {
                return loaderCache[id];
            } else if (defineCache[id]) {
                runFactory.apply(null, defineCache[id]);
                return loaderCache[id];
            } else {
                if(systemRequire) {
                    return systemRequire(originalId);
                } else {
                    throw new Error('No module with ID: ' + id);
                }
            }
        } else {
            //There is a plugin in play.
            prefix = id.substring(0, index);
            id = id.substring(index + 1, id.length);

            plugin = stringRequire(systemRequire, exports, module, prefix, relId);

            if (plugin.normalize) {
                id = plugin.normalize(id, makeNormalize(relId));
            } else {
                //Normalize the ID normally.
                id = normalize(id, relId);
            }

            if (loaderCache[id]) {
                return loaderCache[id];
            } else {
                plugin.load(id, makeRequire(systemRequire, exports, module, relId), makeLoad(id), {});

                return loaderCache[id];
            }
        }
    };

    //Create a define function specific to the module asking for amdefine.
    function define(id, deps, factory) {
        if (Array.isArray(id)) {
            factory = deps;
            deps = id;
            id = undefined;
        } else if (typeof id !== 'string') {
            factory = id;
            id = deps = undefined;
        }

        if (deps && !Array.isArray(deps)) {
            factory = deps;
            deps = undefined;
        }

        if (!deps) {
            deps = ['require', 'exports', 'module'];
        }

        //Set up properties for this module. If an ID, then use
        //internal cache. If no ID, then use the external variables
        //for this node module.
        if (id) {
            //Put the module in deep freeze until there is a
            //require call for it.
            defineCache[id] = [id, deps, factory];
        } else {
            runFactory(id, deps, factory);
        }
    }

    //define.require, which has access to all the values in the
    //cache. Useful for AMD modules that all have IDs in the file,
    //but need to finally export a value to node based on one of those
    //IDs.
    define.require = function (id) {
        if (loaderCache[id]) {
            return loaderCache[id];
        }

        if (defineCache[id]) {
            runFactory.apply(null, defineCache[id]);
            return loaderCache[id];
        }
    };

    define.amd = {};

    return define;
}

module.exports = amdefine;

}).call(this,require("MnQM5j"),"/..\\..\\node_modules\\pleeease-brunch\\node_modules\\pleeease\\node_modules\\postcss\\node_modules\\source-map\\node_modules\\amdefine\\amdefine.js")
},{"MnQM5j":6,"path":5}]},{},[7])
