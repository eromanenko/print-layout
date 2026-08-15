# pip install pypdf
# py booklet_maker.py

import math
from pypdf import PdfReader, PdfWriter, PageObject, Transformation

def create_seamless_booklet(input_pdf_path, output_pdf_path):
    reader = PdfReader(input_pdf_path)
    writer = PdfWriter()
    
    pages = list(reader.pages)
    
    # Dimensions of a standard A4 sheet in points (landscape orientation)
    A4_WIDTH = 842.0
    A4_HEIGHT = 595.0
    CENTER_X = A4_WIDTH / 2.0
    
    # For a booklet, the total number of pages must be a multiple of 4
    # Add blank pages to the end if it's not
    while len(pages) % 4 != 0:
        pages.append(PageObject.create_blank_page(width=pages[0].mediabox.width, height=pages[0].mediabox.height))
        
    total_pages = len(pages)
    
    # Create the imposition (saddle stitch)
    for i in range(total_pages // 2):
        # Create a new blank A4 sheet
        sheet = PageObject.create_blank_page(width=A4_WIDTH, height=A4_HEIGHT)
        
        # Page arrangement logic (first-last, second-second to last, etc.)
        if i % 2 == 0:
            left_page = pages[total_pages - 1 - i]
            right_page = pages[i]
        else:
            left_page = pages[i]
            right_page = pages[total_pages - 1 - i]
            
        # --- LEFT PAGE PROCESSING ---
        left_width = float(left_page.mediabox.width)
        left_height = float(left_page.mediabox.height)
        
        # Scale to fit the page on the left half (A5)
        left_scale = min(CENTER_X / left_width, A4_HEIGHT / left_height)
        new_left_width = left_width * left_scale
        new_left_height = left_height * left_scale
        
        # Align vertically (center of the A4 sheet)
        left_y_offset = (A4_HEIGHT - new_left_height) / 2.0 - float(left_page.mediabox.bottom) * left_scale
        # The right edge of the left page is exactly on the fold axis
        left_x_offset = CENTER_X - new_left_width - float(left_page.mediabox.left) * left_scale 
        
        left_transform = Transformation().scale(left_scale, left_scale).translate(left_x_offset, left_y_offset)
        left_page.add_transformation(left_transform)
        
        # Fix cropbox/mediabox so pypdf doesn't clip the scaled page to the old boundaries
        left_page.cropbox.lower_left = (0, 0)
        left_page.cropbox.upper_right = (A4_WIDTH, A4_HEIGHT)
        left_page.mediabox.lower_left = (0, 0)
        left_page.mediabox.upper_right = (A4_WIDTH, A4_HEIGHT)
        
        sheet.merge_page(left_page)
        
        # --- RIGHT PAGE PROCESSING ---
        right_width = float(right_page.mediabox.width)
        right_height = float(right_page.mediabox.height)
        
        # Scale to fit the page on the right half (A5)
        right_scale = min(CENTER_X / right_width, A4_HEIGHT / right_height)
        new_right_width = right_width * right_scale
        new_right_height = right_height * right_scale
        
        # Align vertically (center of the A4 sheet)
        right_y_offset = (A4_HEIGHT - new_right_height) / 2.0 - float(right_page.mediabox.bottom) * right_scale
        # The left edge of the right page is exactly on the fold axis
        right_x_offset = CENTER_X - float(right_page.mediabox.left) * right_scale 
        
        right_transform = Transformation().scale(right_scale, right_scale).translate(right_x_offset, right_y_offset)
        right_page.add_transformation(right_transform)
        
        # Fix cropbox/mediabox so pypdf doesn't clip the scaled page to the old boundaries
        right_page.cropbox.lower_left = (0, 0)
        right_page.cropbox.upper_right = (A4_WIDTH, A4_HEIGHT)
        right_page.mediabox.lower_left = (0, 0)
        right_page.mediabox.upper_right = (A4_WIDTH, A4_HEIGHT)
        
        sheet.merge_page(right_page)
        
        writer.add_page(sheet)
        
    # Save the finished booklet
    with open(output_pdf_path, "wb") as output_file:
        writer.write(output_file)
    print(f"Booklet successfully created: {output_pdf_path}")

# Script execution
if __name__ == "__main__":
    import sys
    import os
    
    if len(sys.argv) > 1:
        input_file = sys.argv[1]
    else:
        # Attempt to use a graphical file selection window if no arguments are provided
        try:
            import tkinter as tk
            from tkinter import filedialog
            root = tk.Tk()
            root.withdraw()
            input_file = filedialog.askopenfilename(
                title="Select a PDF file to process",
                filetypes=[("PDF files", "*.pdf"), ("All files", "*.*")]
            )
            if not input_file:
                print("No file selected. Exiting.")
                sys.exit(0)
        except ImportError:
            input_file = input("Enter the path to the PDF file: ").strip()
            if not input_file:
                print("No file provided. Exiting.")
                sys.exit(0)

    # Generate the output file name: <original_name>_booklet.pdf
    base_name, ext = os.path.splitext(input_file)
    output_file = f"{base_name}_booklet.pdf"
    
    create_seamless_booklet(input_file, output_file)