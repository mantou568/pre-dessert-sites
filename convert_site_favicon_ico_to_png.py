import os
from PIL import Image

def convert_and_delete_ico(directory):
    for filename in os.listdir(directory):
        if filename.endswith('.ico'):
            ico_path = os.path.join(directory, filename)
            png_path = os.path.join(directory, f"{os.path.splitext(filename)[0]}.png")
            
            with Image.open(ico_path) as img:
                img.save(png_path, format='PNG')
            
            os.remove(ico_path)  # 删除原始的 .ico 文件
            print(f"Converted and deleted {filename}.")

# 使用示例：将 'site_favicon' 替换为你的图标目录路径
convert_and_delete_ico('site_favicon')