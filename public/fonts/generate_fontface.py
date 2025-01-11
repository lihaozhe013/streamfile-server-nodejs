import os
FONT_DIR = "./Inter/static"
FONT_EXTENSIONS = {
    '.woff2': 'woff2',
    '.woff': 'woff',
    '.ttf': 'truetype'
}

WEIGHT_MAP = {
    'thin': 100,
    'extralight': 200,
    'light': 300,
    'regular': 400,
    'medium': 500,
    'semibold': 600,
    'bold': 700,
    'extrabold': 800,
    'black': 900
}

def guess_weight(filename):
    name = filename.lower()
    for key, weight in WEIGHT_MAP.items():
        if key in name:
            return weight
    return 400

def guess_style(filename):
    return 'italic' if 'italic' in filename.lower() else 'normal'

def generate_font_face(font_path, font_name="Inter"):
    rel_path = os.path.relpath(font_path, ".").replace("\\", "/")
    ext = os.path.splitext(font_path)[1].lower()
    format_type = FONT_EXTENSIONS.get(ext)

    if not format_type:
        return None

    weight = guess_weight(font_path)
    style = guess_style(font_path)

    return f"""@font-face {{
  font-family: '{font_name}';
  src: url('{rel_path}') format('{format_type}');
  font-weight: {weight};
  font-style: {style};
}}"""

def main():
    css_blocks = []

    for root, _, files in os.walk(FONT_DIR):
        for file in files:
            if os.path.splitext(file)[1].lower() in FONT_EXTENSIONS:
                full_path = os.path.join(root, file)
                block = generate_font_face(full_path)
                if block:
                    css_blocks.append(block)

    output = "\n\n".join(css_blocks)
    print(output)

if __name__ == "__main__":
    main()

