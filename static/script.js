// 1. Select existing HTML elements
const uploadForm = document.getElementById('uploadForm');
const extractorContainer = document.getElementById('extractor-container');
const pyletteContainer = document.getElementById('pylette-container');

// 2. Main Event Listener
uploadForm.addEventListener('submit', async (event) => {
    // Stop page refresh
    event.preventDefault();

    console.log("Starting color extraction...");

    // Collect data from the form
    const formData = new FormData(uploadForm);

    try {
        // Send request to Flask
        const response = await fetch('/api/extract-colors', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const result = await response.json();
        console.log("Data received:", result);

        // 3. Render both palettes
        renderPalette(result.extractor_colors, 'extractor-container');
        renderPalette(result.pylette, 'pylette-container');

    } catch (error) {
        console.error("Fetch Error:", error);
        alert("Extraction failed. Check the console for details.");
    }
});

// 4. Function to draw swatches
function renderPalette(colors, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Clear previous results
    container.innerHTML = '';
    
    // Container Layout Styling
    container.style.display = 'flex';
    container.style.flexWrap = 'wrap';
    container.style.gap = '10px';
    container.style.marginTop = '10px';
    container.style.marginBottom = '30px';

    colors.forEach(hex => {
        // Create the swatch box
        const swatch = document.createElement('div');
        
        // Swatch Visuals
        swatch.style.width = '120px';
        swatch.style.height = '120px';
        swatch.style.backgroundColor = hex;
        swatch.style.borderRadius = '8px';
        swatch.style.display = 'flex';
        swatch.style.flexDirection = 'column';
        swatch.style.alignItems = 'center';
        swatch.style.justifyContent = 'center';
        swatch.style.cursor = 'pointer';
        swatch.style.transition = 'transform 0.1s';
        swatch.title = "Click to copy hex";

        // Add Hex Text
        const text = document.createElement('span');
        text.textContent = hex.toUpperCase();
        text.style.fontFamily = 'monospace';
        text.style.fontWeight = 'bold';
        text.style.color = getContrastYIQ(hex); // Auto black or white text
        
        swatch.appendChild(text);

        // Click to copy functionality
        swatch.addEventListener('click', () => {
            navigator.clipboard.writeText(hex);
            const originalText = text.textContent;
            text.textContent = "COPIED!";
            setTimeout(() => { text.textContent = originalText; }, 800);
        });

        // Hover effect
        swatch.addEventListener('mouseover', () => swatch.style.transform = 'scale(1.05)');
        swatch.addEventListener('mouseout', () => swatch.style.transform = 'scale(1)');

        container.appendChild(swatch);
    });
}

/**
 * Determines if text should be black or white based on background brightness
 * @param {string} hexcolor 
 * @returns {string} 'black' or 'white'
 */
function getContrastYIQ(hexcolor) {
    hexcolor = hexcolor.replace("#", "");
    const r = parseInt(hexcolor.substr(0, 2), 16);
    const g = parseInt(hexcolor.substr(2, 2), 16);
    const b = parseInt(hexcolor.substr(4, 2), 16);
    // YIQ formula: standard for perceived brightness
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? 'black' : 'white';
}