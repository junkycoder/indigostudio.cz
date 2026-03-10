#!/usr/bin/env python3
"""
gen-icons.py — generate solid-color PNG icons using Python stdlib only (no Pillow).
Usage: python3 scripts/gen-icons.py <hex_color> <output_dir>
Generates: icon16.png, icon48.png, icon128.png
"""
import sys
import os
import struct
import zlib

def hex_to_rgb(hex_color):
    h = hex_color.lstrip('#')
    if len(h) == 3:
        h = ''.join(c * 2 for c in h)
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def make_png(width, height, r, g, b):
    """Build a minimal valid PNG with a solid color, using stdlib only."""
    def chunk(ctype, data):
        c = ctype + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)

    # PNG signature
    sig = b'\x89PNG\r\n\x1a\n'

    # IHDR
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)  # 8-bit RGB
    ihdr = chunk(b'IHDR', ihdr_data)

    # IDAT — raw scanlines: filter byte 0 + RGB pixels per row
    raw = b''
    row = b'\x00' + bytes([r, g, b] * width)
    raw = row * height
    idat = chunk(b'IDAT', zlib.compress(raw, 9))

    # IEND
    iend = chunk(b'IEND', b'')

    return sig + ihdr + idat + iend

def main():
    if len(sys.argv) < 3:
        print('Usage: gen-icons.py <hex_color> <output_dir>', file=sys.stderr)
        sys.exit(1)

    color = sys.argv[1]
    out_dir = sys.argv[2]

    try:
        r, g, b = hex_to_rgb(color)
    except (ValueError, IndexError):
        print('Error: invalid hex color: ' + color, file=sys.stderr)
        sys.exit(1)

    os.makedirs(out_dir, exist_ok=True)

    sizes = [16, 48, 128]
    for size in sizes:
        png_data = make_png(size, size, r, g, b)
        filename = os.path.join(out_dir, 'icon{}.png'.format(size))
        with open(filename, 'wb') as f:
            f.write(png_data)
        print('[gen-icons] Wrote {} ({}x{} px, color={})'.format(filename, size, size, color))

if __name__ == '__main__':
    main()
