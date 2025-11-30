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
import re


def is_admin():
    """检查是否以管理员权限运行"""
    try:
        return ctypes.windll.shell32.IsUserAnAdmin()
    except:
        return False


def is_valid_icon_cache_file(file_path, expected_dir):
    """
    验证文件是否为有效的图标缓存文件
    只允许删除以下格式的文件：
    - iconcache_数字.db (在 Explorer 目录下)
    - thumbcache_数字.db (在 Explorer 目录下)
    """
    # 确保文件路径是绝对路径
    abs_file_path = os.path.abspath(file_path)
    abs_expected_dir = os.path.abspath(expected_dir)
    
    # 验证文件必须在预期目录下（精确匹配，不允许在子目录中）
    file_dir = os.path.dirname(abs_file_path)
    if file_dir != abs_expected_dir:
        return False
    
    # 获取文件名
    filename = os.path.basename(abs_file_path)
    
    # 严格验证文件名格式：只允许 iconcache_数字.db 或 thumbcache_数字.db
    # 使用正则表达式确保格式完全匹配
    pattern = r'^(iconcache_\d+\.db|thumbcache_\d+\.db)$'
    if re.match(pattern, filename, re.IGNORECASE):
        return True
    
    return False


def is_valid_legacy_cache_file(file_path, expected_dir):
    """
    验证旧版图标缓存文件
    只允许删除 LOCALAPPDATA 根目录下的 IconCache.db
    """
    abs_file_path = os.path.abspath(file_path)
    abs_expected_dir = os.path.abspath(expected_dir)
    
    # 验证文件必须在预期目录下（根目录，不是子目录）
    if os.path.dirname(abs_file_path) != abs_expected_dir:
        return False
    
    # 文件名必须是 IconCache.db
    filename = os.path.basename(abs_file_path)
    if filename.lower() == 'iconcache.db':
        return True
    
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
        # 先尝试正常关闭 Explorer
        subprocess.run(["taskkill", "/im", "explorer.exe"], check=False, stdout=subprocess.DEVNULL,
                       stderr=subprocess.DEVNULL, timeout=5)
        time.sleep(1)
        # 如果还在运行，强制终止
        subprocess.run(["taskkill", "/f", "/im", "explorer.exe"], check=False, stdout=subprocess.DEVNULL,
                       stderr=subprocess.DEVNULL, timeout=5)
    except subprocess.TimeoutExpired:
        print("    警告: 终止进程超时，继续执行...")
    except Exception as e:
        print(f"    警告: 无法终止进程: {e}")

    # 增加等待时间，确保 Explorer 完全关闭
    print("    等待 Explorer 完全关闭...")
    time.sleep(3)

    print(f"[2/4] 正在清理缓存数据库...")
    deleted_count = 0
    
    # 清理图标缓存文件（在 Explorer 目录下）
    for pattern in db_patterns:
        files = glob.glob(pattern)
        for file in files:
            # 严格验证：只删除符合格式的图标缓存文件
            if is_valid_icon_cache_file(file, icon_cache_path):
                try:
                    os.remove(file)
                    print(f"    已删除: {os.path.basename(file)}")
                    deleted_count += 1
                except PermissionError:
                    print(f"    [跳过] 文件被占用: {os.path.basename(file)}")
                except Exception as e:
                    print(f"    [错误] 无法删除 {os.path.basename(file)}: {e}")
            else:
                # 如果文件名不符合预期格式，跳过（安全措施）
                print(f"    [跳过] 文件名不符合图标缓存格式: {os.path.basename(file)}")

    # 清理旧版缓存（在 LOCALAPPDATA 根目录下）
    legacy_cache = os.path.join(local_app_data, "IconCache.db")
    if os.path.exists(legacy_cache):
        # 严格验证：只删除根目录下的 IconCache.db
        if is_valid_legacy_cache_file(legacy_cache, local_app_data):
            try:
                os.remove(legacy_cache)
                print(f"    已删除: {os.path.basename(legacy_cache)}")
                deleted_count += 1
            except PermissionError:
                print(f"    [跳过] 文件被占用: {os.path.basename(legacy_cache)}")
            except Exception as e:
                print(f"    [错误] 无法删除 {os.path.basename(legacy_cache)}: {e}")
        else:
            print(f"    [跳过] 旧版缓存文件路径验证失败")

    if deleted_count == 0:
        print("    未删除任何文件(可能已是最新状态)。")

    print("[3/4] 正在重启 Explorer...")
    try:
        # 使用更可靠的方式重启 Explorer
        # 使用 start 命令确保在新的进程中启动
        subprocess.run(["cmd", "/c", "start", "explorer.exe"], check=False, 
                      stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10)
        time.sleep(2)
        
        # 验证 Explorer 是否成功启动
        result = subprocess.run(["tasklist", "/FI", "IMAGENAME eq explorer.exe"], 
                              capture_output=True, text=True, timeout=5)
        if "explorer.exe" in result.stdout:
            print("    Explorer 已成功重启")
        else:
            print("    警告: Explorer 可能未正常启动，尝试再次启动...")
            # 再次尝试启动
            subprocess.run(["cmd", "/c", "start", "explorer.exe"], check=False,
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10)
            time.sleep(2)
    except subprocess.TimeoutExpired:
        print("    警告: 启动 Explorer 超时")
    except Exception as e:
        print(f"    错误: 无法重启 Explorer: {e}")
        print("    正在尝试备用方式启动 Explorer...")
        try:
            # 备用方式：直接调用 explorer.exe
            subprocess.Popen(["explorer.exe"], shell=True)
            time.sleep(2)
        except Exception as e2:
            print(f"    备用方式也失败: {e2}")
            print("    请手动重启 Explorer 或重启电脑")

    print("[4/4] 刷新系统关联...")
    try:
        ctypes.windll.shell32.SHChangeNotify(0x08000000, 0x0000, None, None)
    except Exception as e:
        print(f"    警告: 刷新系统关联失败: {e}")

    print("\n" + "=" * 60)
    print("清理完成！")
    print("=" * 60)


def ensure_explorer_running():
    """确保 Explorer 正在运行，如果没有则启动它"""
    try:
        result = subprocess.run(["tasklist", "/FI", "IMAGENAME eq explorer.exe"], 
                              capture_output=True, text=True, timeout=5)
        if "explorer.exe" not in result.stdout:
            print("\n检测到 Explorer 未运行，正在启动...")
            subprocess.run(["cmd", "/c", "start", "explorer.exe"], check=False,
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10)
            time.sleep(2)
            print("Explorer 已启动")
    except Exception as e:
        print(f"\n警告: 无法检查/启动 Explorer: {e}")
        try:
            subprocess.Popen(["explorer.exe"], shell=True)
        except:
            pass


if __name__ == "__main__":
    # 这里的 input 是防止窗口执行完直接消失的关键
    try:
        if not is_admin():
            # 虽然打包参数会强制提权，但保留此检测作为双重保险
            print("正在尝试请求管理员权限...")
            ctypes.windll.shell32.ShellExecuteW(None, "runas", sys.executable, " ".join(sys.argv), None, 1)
        else:
            clear_icon_cache()
    except KeyboardInterrupt:
        print("\n\n操作被用户中断")
        ensure_explorer_running()
    except Exception as e:
        print(f"\n发生错误: {e}")
        ensure_explorer_running()

    input("\n按回车键退出...")