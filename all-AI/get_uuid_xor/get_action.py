import uuid
import subprocess
import re
import tkinter as tk
from tkinter import ttk, scrolledtext

key = "SJYssr666"  # 与加密相同的密钥

def get_mac_address():
    """获取Windows系统主板序列号"""
    
    # 方法1: 首选使用powershell获取主板序列号
    try:
        result = subprocess.check_output([
            'powershell', 
            'Get-WmiObject -Class Win32_BaseBoard | Select-Object -ExpandProperty SerialNumber'
        ], text=True, encoding='gbk', shell=True)
        
        if result.strip() and result.strip() != 'N/A' and result.strip() != 'To Be Filled By O.E.M.':
            return result.strip()
    except:
        pass
    
    # 方法2: 备用使用wmic命令获取主板序列号
    try:
        result = subprocess.check_output(['wmic', 'baseboard', 'get', 'SerialNumber'], 
                                       text=True, encoding='gbk')
        lines = result.strip().split('\n')
        for line in lines:
            if line.strip() and 'SerialNumber' not in line:
                serial = line.strip()
                if serial and serial != 'N/A' and serial != 'To Be Filled By O.E.M.':
                    return serial
    except:
        pass
    
    return "无法获取密钥"


def simple_encrypt(text):
    """简单的XOR加密（可解密）"""
    global key  # 简单的加密密钥
    encrypted = ""
    
    for i, char in enumerate(text):
        # 使用XOR运算进行加密
        key_char = key[i % len(key)]
        encrypted_char = chr(ord(char) ^ ord(key_char))
        encrypted += encrypted_char
    
    # 转换为十六进制字符串便于显示
    hex_result = "".join(["{:02x}".format(ord(c)) for c in encrypted])
    return hex_result

class MACAddressGUI:
    """MAC地址加密GUI界面"""
    
    def __init__(self, root):
        self.root = root
        self.root.title("密钥获取工具")
        self.root.geometry("450x100")
        self.root.resizable(True, True)
        
        # 窗口居中
        self.center_window()
        
        # 创建界面
        self.create_widgets()
    

    
    def center_window(self):
        """窗口居中显示"""
        # 更新窗口以获取正确的尺寸
        self.root.update_idletasks()
        
        # 获取屏幕尺寸
        screen_width = self.root.winfo_screenwidth()
        screen_height = self.root.winfo_screenheight()
        
        # 获取窗口尺寸
        window_width = self.root.winfo_width()
        window_height = self.root.winfo_height()
        
        # 计算居中位置
        x = (screen_width - window_width) // 2
        y = (screen_height - window_height) // 2
        
        # 设置窗口位置
        self.root.geometry(f"+{x}+{y}")
    
    def create_widgets(self):
        """创建界面组件"""
        # 主框架
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        # 获取MAC地址按钮
        self.get_mac_button = ttk.Button(main_frame, text="获取密钥",
                                        command=self.get_and_encrypt_mac)
        self.get_mac_button.pack(pady=(0, 10))
        
        # 输出文本框（单行，无滚动条）
        self.output_text = tk.Text(main_frame, 
                                  height=1,
                                  font=("Consolas", 9))
        self.output_text.pack(fill=tk.X)
    
    def get_and_encrypt_mac(self):
        """获取MAC地址并进行加密"""
        try:
            # 获取MAC地址
            main_mac = get_mac_address()
            
            if main_mac == "无法获取密钥":
                self.output_text.delete(1.0, tk.END)
                self.output_text.insert(1.0, "无法获取密钥")
                return
            
            # 对MAC地址进行简单加密（可解密）
            encrypted_result = simple_encrypt(main_mac)
            
            # 只显示加密结果（替换内容）
            self.output_text.delete(1.0, tk.END)
            self.output_text.insert(1.0, encrypted_result)
            
        except Exception as e:
            self.output_text.delete(1.0, tk.END)
            self.output_text.insert(1.0, "错误")
    

    






if __name__ == "__main__":
    
        # GUI模式
    root = tk.Tk()
    app = MACAddressGUI(root)
    root.mainloop()