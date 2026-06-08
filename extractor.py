from PIL import Image
from sklearn.cluster import KMeans
import numpy


def resize_image(img):
    new_width = 700
    if int(img.size[0]) > 700:
        ratio = int(img.size[0] / 700)
        new_height = int(img.size[1] / ratio)
        return img.resize((new_width, new_height)).convert("RGB")
    else:
        return img.convert("RGB")


def get_pixel_data(img):
    data = list(img.getdata())
    return numpy.array(data)


def cluster_rgb(rgb, k=5):
    kmeans = KMeans(n_clusters=k, random_state=0).fit(rgb)
    data = kmeans.cluster_centers_
    return numpy.round(data, decimals=0).astype(int)


def rgb_to_hex(rgbs):
    hex_colors = [f'#{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}' for rgb in rgbs]
    return hex_colors