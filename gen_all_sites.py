import os

def generate_remote_urls():
    # 获取当前脚本所在目录
    script_dir = os.path.dirname(os.path.abspath(__file__))
    # sites目录路径
    sites_dir = os.path.join(script_dir, "./sites")
    # all_sites.txt文件路径
    output_file = os.path.join(script_dir, "./all_sites.txt")

    # 清空all_sites.txt文件
    with open(output_file, "w") as f:
        print("先清空txt！")
        pass

    # 遍历sites目录下的所有json文件
    for filename in os.listdir(sites_dir):
        if filename.endswith(".json"):
            # 构建远程路径
            remote_url = "https://cdn.jsdelivr.net/gh/mantou568/pre-dessert-sites@main/sites/" + filename
            # 将远程路径写入all_sites.txt文件
            with open(output_file, "a") as f:
                f.write(remote_url + "\n")
                print(f"站点{filename}添加成功!!")

    print("所有站点生成完成！")

generate_remote_urls()