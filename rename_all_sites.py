import os
import json

# 定义目录路径
directory = 'closed_sites'

# 遍历目录下的所有文件
for filename in os.listdir(directory):
    if filename.endswith('.json'):
        filepath = os.path.join(directory, filename)
        
        # 读取json文件
        with open(filepath, encoding='utf-8') as file:
            data = json.load(file)
        
        # 获取id字段的值
        id_value = data.get('id')
        
        if id_value:
            # 构建新的文件名
            new_filename = id_value + '.json'
            
            # 构建新的文件路径
            new_filepath = os.path.join(directory, new_filename)
            
            # 重命名文件
            os.rename(filepath, new_filepath)
            print(f'Renamed {filename} to {new_filename}')
        else:
            print(f'No id found in {filename}')