import cairosvg
from PIL import Image
import io

def svg_to_ico(svg_path, ico_path, sizes=((16, 16), (32, 32), (48, 48), (256, 256))):
    """
    Converts an SVG file to an ICO file containing multiple sizes.
    """
    
    # 1. Rasterize SVG to multiple PNGs (in memory)
    png_images = []
    
    for width, height in sizes:
        # CairoSVG renders the SVG into a PNG byte string
        png_bytes = cairosvg.svg2png(url=svg_path, output_width=width, output_height=height)
        
        # Load the PNG bytes into a Pillow Image object
        img = Image.open(io.BytesIO(png_bytes))
        png_images.append(img)
    
    # 2. Save the PNG images as a single ICO file
    if not png_images:
        print("Error: Could not rasterize SVG.")
        return False
        
    # The first image is the primary, others are added as "append_images"
    try:
        png_images[0].save(
            ico_path,
            format='ICO',
            sizes=sizes,
            append_images=png_images[1:]
        )
        print(f"Successfully converted {svg_path} to ICO: {ico_path}")
        return True
    except Exception as e:
        print(f"Error saving ICO file: {e}")
        return False

# # Example Usage:
# svg_to_ico("/Users/cgl/codes/zheng-related/usb-can-tauri/1.svg", "output1.ico")
svg_to_ico("/Users/cgl/codes/zheng-related/usb-can-tauri/1.svg", "output2.ico", sizes=( (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)))