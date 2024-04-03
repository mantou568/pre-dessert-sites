import os


def generate_remote_urls():
    # 获取当前脚本所在目录
    script_dir = os.path.dirname(os.path.abspath(__file__))
    # sites 目录路径
    sites_dir = os.path.join(script_dir, "./sites")
    # all_sites 文件路径
    output_file_cdn = os.path.join(script_dir, "./all_sites.txt")
    output_file_github = os.path.join(script_dir, "./all_sites_github.txt")

    # 清空 all_sites 文件
    with open(output_file_cdn, "w") as f:
        print("清空 CDN 源站点配置文件")
    with open(output_file_github, "w") as f:
        print("清空 GitHub 源站点配置文件")

    # 遍历 sites 目录下的所有 json 文件
    gen_success_num = 0
    gen_error_num = 0
    file_list = sorted(os.listdir(sites_dir), key=lambda x: x.lower())

    for index, filename in enumerate(file_list):
        if filename.endswith(".json"):
            # 构建远程路径
            remote_url_cdn = "https://cdn.jsdelivr.net/gh/mantou568/pre-dessert-sites@main/sites/" + filename
            remote_url_github = "https://raw.githubusercontent.com/mantou568/pre-dessert-sites/main/sites/" + filename
            # 将远程路径写入 all_sites 文件
            try:
                with open(output_file_cdn, "a") as f:
                    f.write(remote_url_cdn + "\n")
                with open(output_file_github, "a") as f:
                    f.write(remote_url_github + "\n")
                gen_success_num += 1
                print(f"({index + 1}/{len(file_list)}) 站点 {filename} 添加成功")
            except Exception as e:
                gen_error_num += 1
                print(f"({index + 1}/{len(file_list)}) 站点 {filename} 添加失败: {e}")

    print(f"所有站点生成完成: 成功 {gen_success_num}, 失败 {gen_error_num}")


if __name__ == "__main__":
    generate_remote_urls()
