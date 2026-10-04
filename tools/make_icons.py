import os
import struct
import zlib

BG = (59, 111, 212)
FG = (255, 255, 255)


def chunk(tag, data):
    return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)


def make_png(size, path):
    c = size // 2
    thick = size // 10
    arm = size * 3 // 10
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            plus = (abs(x - c) <= thick // 2 and abs(y - c) <= arm) or (abs(y - c) <= thick // 2 and abs(x - c) <= arm)
            row += bytes(FG if plus else BG)
        rows.append(bytes(row))
    data = (
        b'\x89PNG\r\n\x1a\n'
        + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0))
        + chunk(b'IDAT', zlib.compress(b''.join(rows), 9))
        + chunk(b'IEND', b'')
    )
    with open(path, 'wb') as f:
        f.write(data)


os.makedirs('public/assets', exist_ok=True)
make_png(192, 'public/assets/icon-192.png')
make_png(512, 'public/assets/icon-512.png')
print('icons written')
