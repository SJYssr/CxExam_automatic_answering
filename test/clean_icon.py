# _*_coding : UTF_8 _*_
# author : SJYssr
# Date : 2025/11/30 下午6:49
# ClassName : main.py
# Github : https://github.com/SJYssr
import os
import subprocess
import time
import glob
import ctypes
import sys


def is_admin():
    """检查是否以管理员权限运行"""
    try:
        return ctypes.windll.shell32.IsUserAnAdmin()
    except:
        return False


def clear_icon_cache():
    # 设置CMD标题
    os.system("title CxExam-AUTO 图标缓存清理工具")

    print("=" * 60)
    print("       CxExam-AUTO.exe 图标缓存清理工具")
    print("=" * 60)
    print("警告：此操作将暂时关闭 Windows 资源管理器 (Explorer)。")
    print("桌面图标会短暂消失，清理完成后会自动重启。")
    print("=" * 60)
    print(f"当前运行权限: {'[管理员]' if is_admin() else '[普通用户 - 可能会失败]'}")
    print("-" * 60)

    # 1. 确定图标缓存路径
    local_app_data = os.environ.get('LOCALAPPDATA')
    icon_cache_path = os.path.join(local_app_data, 'Microsoft', 'Windows', 'Explorer')

    db_patterns = [
        os.path.join(icon_cache_path, 'iconcache_*.db'),
        os.path.join(icon_cache_path, 'thumbcache_*.db')
    ]

    print("[1/4] 正在终止 explorer.exe...")
    try:
        subprocess.run(["taskkill", "/f", "/im", "explorer.exe"], check=False, stdout=subprocess.DEVNULL,
                       stderr=subprocess.DEVNULL)
    except Exception as e:
        print(f"无法终止进程: {e}")

    time.sleep(2)

    print(f"[2/4] 正在清理缓存数据库...")
    deleted_count = 0
    for pattern in db_patterns:
        files = glob.glob(pattern)
        for file in files:
            try:
                os.remove(file)
                print(f"    已删除: {os.path.basename(file)}")
                deleted_count += 1
            except PermissionError:
                print(f"    [跳过] 文件被占用: {os.path.basename(file)}")
            except Exception as e:
                pass

    # 清理旧版缓存
    legacy_cache = os.path.join(local_app_data, "IconCache.db")
    if os.path.exists(legacy_cache):
        try:
            os.remove(legacy_cache)
            deleted_count += 1
        except:
            pass

    if deleted_count == 0:
        print("    未删除任何文件(可能已是最新状态)。")

    print("[3/4] 正在重启 Explorer...")
    subprocess.Popen(["explorer.exe"])

    print("[4/4] 刷新系统关联...")
    ctypes.windll.shell32.SHChangeNotify(0x08000000, 0x0000, None, None)

    print("\n" + "=" * 60)
    print("清理完成！")
    print("=" * 60)


if __name__ == "__main__":
    # 这里的 input 是防止窗口执行完直接消失的关键
    try:
        if not is_admin():
            # 虽然打包参数会强制提权，但保留此检测作为双重保险
            print("正在尝试请求管理员权限...")
            ctypes.windll.shell32.ShellExecuteW(None, "runas", sys.executable, " ".join(sys.argv), None, 1)
        else:
            clear_icon_cache()
    except Exception as e:
        print(f"发生错误: {e}")

    input("\n按回车键退出...")