import struct


def write_ase(hex_colors):
    """
    Takes a list of hex colors, converts them to rgb values (between 0.0 and 1.0),
    and writes a new ase file.
    """

    SIGNATURE = "ASEF"
    block_count = len(hex_colors)
    header = SIGNATURE.encode() + struct.pack('>HH', 1, 0) + struct.pack('>I', block_count)
    color_blocks = b""
    i = 1
    for hex_color in hex_colors:
        rgb = hex_to_rgb(hex_color)
        name = f"Color {i}\0"
        encoded_name = name.encode("UTF-16BE")
        color_type = 2
        block = struct.pack('>H', len(name)) + encoded_name + \
            "RGB ".encode("ascii") + \
            struct.pack('>f', rgb[0]) + struct.pack('>f', rgb[1]) + struct.pack('>f', rgb[2]) + \
            struct.pack('>H', 2)
        block = struct.pack('>H', 0x0001) + struct.pack('>I', len(block)) + block
        color_blocks = color_blocks + block
        i += 1

    ase = header + color_blocks
    return ase


def hex_to_rgb(hex_color):
    hex = hex_color.strip("#")
    r = int(hex[0:2], 16) / 255.0
    g = int(hex[2:4], 16) / 255.0
    b = int(hex[4:6], 16) / 255.0

    return (r, g, b)