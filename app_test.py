import streamlit as st
from PIL import Image
import numpy as np
from sklearn.cluster import KMeans
from colorthief import ColorThief
from Pylette import extract_colors

# --- YOUR EXTRACTION LOGIC ---
def your_cluster_logic(img_ptr, k):
    img = Image.open(img_ptr).convert("RGB")
    # Your resizing logic
    if img.size[0] > 700:
        ratio = img.size[0] / 700
        img = img.resize((700, int(img.size[1] / ratio)))
    
    # Converting to array
    data = np.array(list(img.getdata()))
    
    # Running KMeans
    kmeans = KMeans(n_clusters=k, random_state=0).fit(data)
    rgb_centers = np.round(kmeans.cluster_centers_, decimals=0).astype(int)
    
    # Hex conversion
    return [f'#{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}' for rgb in rgb_centers]

# --- UI SETUP ---
st.set_page_config(page_title="Palette Benchmark", layout="wide")
st.title("🎨 Color Extraction Benchmark")

# Sidebar for inputs
uploaded_file = st.sidebar.file_uploader("Upload an Image", type=["jpg", "jpeg", "png"])
num_colors = st.sidebar.slider("Number of colors", 3, 10, 5)

# THE MAIN BLOCK - Everything happens inside here
if uploaded_file:
    # 1. Prepare Display
    col1, col2 = st.columns([1, 1.5])
    
    with col1:
        st.subheader("Source")
        display_img = Image.open(uploaded_file)
        st.image(display_img, use_container_width=True)
        
    with col2:
        st.subheader("Library Comparison")
        # Ensure the tabs are created INSIDE the 'with col2' block
        tab1, tab2, tab3, tab4 = st.tabs([
            "Pylette", 
            "ColorThief", 
            "Standard KMeans", 
            "My algorithm"
        ])

        # --- TAB 1: PYLETTE ---
        with tab1:
            palette = extract_colors(display_img, palette_size=num_colors, mode='KMeans')   
            cols = st.columns(3)
            for i, color in enumerate(palette.colors):
                with cols[i % 3]:
                    st.color_picker(f"Pylette {i+1}", str(color.hex), key=f"py_{i}")

        # --- TAB 2: COLOR THIEF ---
        with tab2:
            uploaded_file.seek(0)
            ct = ColorThief(uploaded_file)
            palette_ct = ct.get_palette(color_count=num_colors)
            cols = st.columns(3)
            for i, rgb in enumerate(palette_ct):
                hex_val = '#%02x%02x%02x' % rgb
                with cols[i % 3]:
                    st.color_picker(f"Thief {i+1}", hex_val, key=f"ct_{i}")

        # --- TAB 3: STANDARD ML ---
        with tab3:
            small_img = display_img.resize((100, 100)).convert("RGB")
            img_data = np.array(small_img).reshape(-1, 3)
            model = KMeans(n_clusters=num_colors, n_init='auto').fit(img_data)
            centers = model.cluster_centers_.astype(int)
            cols = st.columns(3)
            for i, rgb in enumerate(centers):
                hex_val = '#%02x%02x%02x' % tuple(rgb)
                with cols[i % 3]:
                    st.color_picker(f"ML {i+1}", hex_val, key=f"ml_{i}")

        # --- TAB 4: YOUR s ---
        with tab4:
            uploaded_file.seek(0)
            custom_hexes = your_cluster_logic(uploaded_file, num_colors)
            cols = st.columns(3)
            for i, hex_val in enumerate(custom_hexes):
                with cols[i % 3]:
                    st.color_picker(f"Custom {i+1}", hex_val, key=f"custom_{i}")
else:
    st.info("Please upload an image in the sidebar to view the comparison tabs.")