from flask import Flask, request, jsonify, send_from_directory, send_file
from Pylette import extract_colors
from PIL import Image
import extractor
from ase_writer import write_ase
from psd_writer import write_psd
from io import BytesIO



app = Flask(__name__)


@app.route("/", methods=["GET"])
def index():
    return send_from_directory("static", "index.html")


@app.route("/api/extract-colors", methods = ["POST"])
def extract_colors_api():
    file = request.files["image"]
    if not file:
            return jsonify({"message": "Please provide the image file"}), 400
    # Open the image with Pillow
    img = Image.open(file)
    num_of_colors = 10

    #PYLETTE
    palette = extract_colors(image=img, palette_size=num_of_colors, mode ="KMeans")
    pylette_colors = [color.hex for color in palette.colors] # list of hex codes
    #EXTRACTOR
    data = extractor.get_pixel_data(extractor.resize_image(img))
    extractor_colors = extractor.rgb_to_hex(extractor.cluster_rgb(data, num_of_colors)) #List of hex codes

    return jsonify({"message": "route works", "pylette":pylette_colors, "extractor_colors": extractor_colors})


@app.route("/api/generate-ase", methods = ["POST"])
def generate_ase():
    json = request.get_json()
    ase = write_ase(json["colors"])
    return send_file(BytesIO(ase),as_attachment=True, download_name="palette.ase", mimetype="application/octet-stream")
    return jsonify({"message": "colors received"})


@app.route("/api/generate-psd", methods = ["POST"])
def generate_psd():
    json = request.get_json()
    psd = write_psd(json["colors"])
    return send_file(BytesIO(psd), as_attachment=True, download_name="palette.psd", mimetype="image/vnd.adobe.photoshop")

if __name__ == "__main__":
    app.run(debug=True)
