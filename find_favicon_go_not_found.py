import os

def get_json_filenames(directory):
    json_filenames = []
    for filename in os.listdir(directory):
        if filename.endswith('.json'):
            json_filenames.append(os.path.splitext(filename)[0])
    return json_filenames

def get_png_filenames(directory):
    png_filenames = []
    for filename in os.listdir(directory):
        if filename.endswith('.png'):
            png_filenames.append(os.path.splitext(filename)[0])
    return png_filenames

def compare_filenames(json_dir, png_dir):
    json_filenames = get_json_filenames(json_dir)
    png_filenames = get_png_filenames(png_dir)
    
    missing_pngs = [name for name in json_filenames if name not in png_filenames]
    missing_jsons = [name for name in png_filenames if name not in json_filenames]
    
    return missing_pngs, missing_jsons

# 使用示例：替换为实际的文件夹路径
json_directory = 'go/sites'
png_directory = 'site_favicon'

missing_pngs, missing_jsons = compare_filenames(json_directory, png_directory)

print("以下 JSON 文件在 site_favicon 中没有对应的 PNG 文件:")
for name in missing_pngs:
    print(name)

print("\n以下 PNG 文件在 go/sites 中没有对应的 JSON 文件:")
for name in missing_jsons:
    print(name)
