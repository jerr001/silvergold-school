#!/usr/bin/env python3
from PIL import Image
import os
import glob

# Get all TIF files in the current directory
tif_files = glob.glob("*.tif")

if not tif_files:
    print("No TIF files found.")
    exit(1)

print(f"Found {len(tif_files)} TIF file(s). Converting to JPG...")

for tif_file in tif_files:
    try:
        # Open the TIF image
        img = Image.open(tif_file)
        
        # Convert RGBA to RGB if necessary
        if img.mode in ('RGBA', 'LA', 'P'):
            rgb_img = Image.new('RGB', img.size, (255, 255, 255))
            rgb_img.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
            img = rgb_img
        
        # Create output filename
        jpg_file = os.path.splitext(tif_file)[0] + ".jpg"
        
        # Save as JPG with quality 85 for good balance of quality and file size
        img.save(jpg_file, "JPEG", quality=85, optimize=True)
        
        print(f"✓ {tif_file} → {jpg_file}")
    except Exception as e:
        print(f"✗ Error converting {tif_file}: {e}")

print("\nConversion complete!")
