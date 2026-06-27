import os
import sys
import json
import glob
import math
import re
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm

def hex_to_rgb(hex_color):
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) / 255.0 for i in (0, 2, 4))

def main():
    print("Print Layout Generator - CLI Tool")
    print("---------------------------------")
    
    # 1. Find json config
    json_files = glob.glob('*.json')
    if not json_files:
        print("Error: No .json configuration file found in the current directory.")
        sys.exit(1)
        
    config_file = json_files[0]
    print(f"Loading config from: {config_file}")
    with open(config_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    if 'config' not in data:
        print(f"Error: Invalid configuration file format in {config_file}.")
        sys.exit(1)
        
    config = data['config']
    
    # 2. Check backType
    if config.get('backType') != 'different':
        print(f"\n[WARNING] The script only supports 'different' backType. Found: '{config.get('backType')}'.")
        print("Please configure the layout in the web app to use 'Different for each' back type, save the JSON again, and retry.")
        sys.exit(1)

    # 3. Gather images
    valid_exts = {'.png', '.jpg', '.jpeg', '.webp'}
    all_files = sorted([f for f in os.listdir('.') if os.path.isfile(f)])
    images = [f for f in all_files if os.path.splitext(f)[1].lower() in valid_exts]
    
    if not images:
        print("Error: No images found in the current directory.")
        sys.exit(1)
        
    raw_fronts = images[0::2] # Odd images (1st, 3rd, 5th -> index 0, 2, 4)
    raw_backs = images[1::2]  # Even images (2nd, 4th, 6th -> index 1, 3, 5)
    
    fronts = []
    backs = []
    
    for f, b in zip(raw_fronts, raw_backs):
        match = re.search(r'[_\-\s]?[xX](\d+)\.[^.]+$', f)
        count = max(1, int(match.group(1))) if match else 1
        for _ in range(count):
            fronts.append(f)
            backs.append(b)
            
    total_cards = len(fronts)
    if total_cards == 0:
        print("Error: Not enough images to form a front/back pair.")
        sys.exit(1)
        
    print(f"Found {len(fronts)} front images and {len(backs)} back images.")
    print(f"Generating layout for {total_cards} cards...\n")

    # 4. Math
    page_sizes = {
        'A4': (210, 297),
        'A3': (297, 420),
        'Letter': (215.9, 279.4)
    }
    ps_key = config.get('pageSize', 'A4')
    pw_mm, ph_mm = page_sizes.get(ps_key, page_sizes['A4'])
    
    if config.get('orientation') == 'landscape':
        pw_mm, ph_mm = ph_mm, pw_mm
        
    card_w = config['cardWidth']
    card_h = config['cardHeight']
    max_bleed_w = max(config['front']['bleedWidth'], config['back']['bleedWidth'])
    
    total_card_w = card_w + 2 * max_bleed_w
    total_card_h = card_h + 2 * max_bleed_w
    
    gap = config.get('gap', 0)
    margins = config.get('margins', 0)
    fold_margin = config.get('foldMargin', 0)
    
    layout_mode = config.get('layoutMode', 'standard')
    is_foldable_v = layout_mode == 'foldable-v'
    is_foldable_h = layout_mode == 'foldable-h'
    is_foldable = is_foldable_v or is_foldable_h
    
    usable_w = (pw_mm / 2) - margins - fold_margin if is_foldable_v else pw_mm - 2 * margins
    usable_h = (ph_mm / 2) - margins - fold_margin if is_foldable_h else ph_mm - 2 * margins
    
    cols = math.floor((usable_w + gap) / (total_card_w + gap))
    rows = math.floor((usable_h + gap) / (total_card_h + gap))
    
    if cols <= 0 or rows <= 0:
        print("Error: Cards do not fit on the page with current margins/sizes.")
        sys.exit(1)
        
    cards_per_page = cols * rows
    grid_w = cols * total_card_w + (cols - 1) * gap
    grid_h = rows * total_card_h + (rows - 1) * gap
    
    start_x = (pw_mm / 2) - fold_margin - grid_w if is_foldable_v else (pw_mm - grid_w) / 2
    start_y = (ph_mm / 2) - fold_margin - grid_h if is_foldable_h else (ph_mm - grid_h) / 2
    
    # 5. PDF Init
    c = canvas.Canvas("output.pdf", pagesize=(pw_mm * mm, ph_mm * mm))
    bg_color = hex_to_rgb(config.get('pageBgColor', '#ffffff'))

    def draw_bg():
        c.setFillColorRGB(*bg_color)
        c.rect(0, 0, pw_mm * mm, ph_mm * mm, fill=1, stroke=0)
        
    def process_image(img_path, target_w_mm, target_h_mm, bg_hex):
        img = Image.open(img_path).convert("RGBA")
        bg_rgb = tuple(int(bg_hex.lstrip('#')[i:i+2], 16) for i in (0, 2, 4))
        bg = Image.new("RGB", img.size, bg_rgb)
        bg.paste(img, mask=img.split()[3])
        
        target_ratio = target_w_mm / target_h_mm
        img_ratio = bg.width / bg.height
        
        if img_ratio > target_ratio:
            new_w = int(bg.height * target_ratio)
            left = (bg.width - new_w) // 2
            bg = bg.crop((left, 0, left + new_w, bg.height))
        else:
            new_h = int(bg.width / target_ratio)
            top = (bg.height - new_h) // 2
            bg = bg.crop((0, top, bg.width, top + new_h))
            
        temp_name = f"temp_{os.getpid()}_{os.path.basename(img_path)}.jpg"
        bg.save(temp_name, "JPEG", quality=95)
        return temp_name

    def draw_crop_marks(is_back):
        side_config = config['back'] if is_back else config['front']
        if side_config.get('cropMarks', 'none') == 'none':
            return
            
        c.setStrokeColorRGB(*hex_to_rgb(side_config.get('cropColor', '#808080')))
        c.setLineWidth(0.5)
        
        line_len = 3 
        
        for row in range(rows):
            for col in range(cols):
                cx = start_x + col * (total_card_w + gap)
                cy = start_y + row * (total_card_h + gap)
                
                if is_back:
                    if is_foldable_v or not is_foldable:
                        cx = pw_mm - cx - total_card_w
                    if is_foldable_h:
                        cy = ph_mm - cy - total_card_h
                        
                left = cx + max_bleed_w
                right = cx + total_card_w - max_bleed_w
                bottom = cy + total_card_h - max_bleed_w # cy is top
                top = cy + max_bleed_w
                
                def rl_y(y): return ph_mm - y
                
                mark_type = side_config.get('cropMarks')
                if mark_type == 'lines':
                    c.line(left * mm, rl_y(top - 1) * mm, left * mm, rl_y(top - 1 - line_len) * mm)
                    c.line((left - 1) * mm, rl_y(top) * mm, (left - 1 - line_len) * mm, rl_y(top) * mm)
                    c.line(right * mm, rl_y(top - 1) * mm, right * mm, rl_y(top - 1 - line_len) * mm)
                    c.line((right + 1) * mm, rl_y(top) * mm, (right + 1 + line_len) * mm, rl_y(top) * mm)
                    c.line(left * mm, rl_y(bottom + 1) * mm, left * mm, rl_y(bottom + 1 + line_len) * mm)
                    c.line((left - 1) * mm, rl_y(bottom) * mm, (left - 1 - line_len) * mm, rl_y(bottom) * mm)
                    c.line(right * mm, rl_y(bottom + 1) * mm, right * mm, rl_y(bottom + 1 + line_len) * mm)
                    c.line((right + 1) * mm, rl_y(bottom) * mm, (right + 1 + line_len) * mm, rl_y(bottom) * mm)
                elif mark_type == 'crosses':
                    c.line((left - line_len) * mm, rl_y(top) * mm, (left + line_len) * mm, rl_y(top) * mm)
                    c.line(left * mm, rl_y(top - line_len) * mm, left * mm, rl_y(top + line_len) * mm)
                    c.line((right - line_len) * mm, rl_y(top) * mm, (right + line_len) * mm, rl_y(top) * mm)
                    c.line(right * mm, rl_y(top - line_len) * mm, right * mm, rl_y(top + line_len) * mm)
                    c.line((left - line_len) * mm, rl_y(bottom) * mm, (left + line_len) * mm, rl_y(bottom) * mm)
                    c.line(left * mm, rl_y(bottom - line_len) * mm, left * mm, rl_y(bottom + line_len) * mm)
                    c.line((right - line_len) * mm, rl_y(bottom) * mm, (right + line_len) * mm, rl_y(bottom) * mm)
                    c.line(right * mm, rl_y(bottom - line_len) * mm, right * mm, rl_y(bottom + line_len) * mm)

    # 6. Generate Loop
    total_pages_generated = 0
    total_pages = math.ceil(total_cards / cards_per_page)
    temp_files = []
    
    for p in range(total_pages):
        draw_bg()
        start_idx = p * cards_per_page
        end_idx = min(start_idx + cards_per_page, total_cards)
        
        def draw_grid(is_back):
            for i in range(start_idx, end_idx):
                local_idx = i - start_idx
                row = local_idx // cols
                col = local_idx % cols
                
                x = start_x + col * (total_card_w + gap)
                y = start_y + row * (total_card_h + gap)
                
                if is_back:
                    if is_foldable_v or not is_foldable:
                        x = pw_mm - x - total_card_w
                    if is_foldable_h:
                        y = ph_mm - y - total_card_h
                        
                img_path = backs[i] if is_back else fronts[i]
                side_cfg = config['back'] if is_back else config['front']
                bg_col = side_cfg.get('bleedColor', '#ffffff')
                
                tmp_img = process_image(img_path, total_card_w, total_card_h, bg_col)
                temp_files.append(tmp_img)
                
                draw_y = ph_mm - y - total_card_h
                c.drawImage(tmp_img, x * mm, draw_y * mm, width=total_card_w * mm, height=total_card_h * mm)
                
            draw_crop_marks(is_back)

        draw_grid(False) # Fronts
        
        if is_foldable:
            draw_grid(True) # Backs
            c.showPage()
            total_pages_generated += 1
        else:
            c.showPage()
            total_pages_generated += 1
            draw_bg()
            draw_grid(True) # Backs on new page
            c.showPage()
            total_pages_generated += 1
            
    c.save()
    
    # Cleanup temp files
    for t in temp_files:
        if os.path.exists(t):
            os.remove(t)
            
    print("---------------------------------")
    print(f"Success! Output saved to 'output.pdf'")
    print(f"Total cards processed: {total_cards}")
    print(f"Total pages in PDF: {total_pages_generated}")

if __name__ == "__main__":
    main()
