#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
主板序列号解密工具 - reget.py
用于解密已加密的主板序列号
"""

import sys
import os

def simple_decrypt(encrypted_hex, key="SJYssr666"):
    """
    简单的XOR解密函数
    
    Args:
        encrypted_hex (str): 加密的十六进制字符串
        key (str): 解密密钥，默认为"SJYssr666"
    
    Returns:
        str: 解密后的主板序列号
    """
    # 从十六进制转换回字符
    encrypted = ""
    for i in range(0, len(encrypted_hex), 2):
        hex_char = encrypted_hex[i:i+2]
        try:
            c = chr(int(hex_char, 16))
            encrypted += c
        except ValueError:
            print(f"警告：无效的十六进制字符: {hex_char}")
            continue
    
    # 解密
    decrypted = ""
    for i in range(len(encrypted)):
        key_char = key[i % len(key)]
        decrypted_char = chr(ord(encrypted[i]) ^ ord(key_char))
        decrypted += decrypted_char
    
    return decrypted

def decrypt_from_file(file_path, key="SJYssr666"):
    """
    从文件中读取加密文本并解密
    
    Args:
        file_path (str): 包含加密文本的文件路径
        key (str): 解密密钥
    
    Returns:
        str: 解密后的主板序列号
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            encrypted_text = f.read().strip()
        
        if not encrypted_text:
            print("错误：文件为空")
            return None
            
        return simple_decrypt(encrypted_text, key)
        
    except FileNotFoundError:
        print(f"错误：文件不存在 - {file_path}")
        return None
    except Exception as e:
        print(f"读取文件时出错: {e}")
        return None

def decrypt_interactive():
    """交互式解密模式"""
    print("=== 主板序列号解密工具 ===")
    print("1. 从文件解密")
    print("2. 手动输入加密文本")
    print("3. 退出")
    
    while True:
        choice = input("\n请选择操作 (1-3): ").strip()
        
        if choice == "1":
            file_path = input("请输入加密文件路径: ").strip()
            if not file_path:
                print("文件路径不能为空")
                continue
                
            custom_key = input("请输入解密密钥 (留空使用默认密钥): ").strip()
            key = custom_key if custom_key else "SJYssr666"
            
            result = decrypt_from_file(file_path, key)
            if result:
                print(f"\n解密成功!")
                print(f"主板序列号: {result}")
            
        elif choice == "2":
            encrypted_text = input("请输入加密的十六进制文本: ").strip()
            if not encrypted_text:
                print("加密文本不能为空")
                continue
                
            custom_key = input("请输入解密密钥 (留空使用默认密钥): ").strip()
            key = custom_key if custom_key else "SJYssr666"
            
            result = simple_decrypt(encrypted_text, key)
            if result:
                print(f"\n解密成功!")
                print(f"主板序列号: {result}")
            
        elif choice == "3":
            print("退出程序")
            break
        else:
            print("无效选择，请重新输入")

def main():
    """主函数"""
    if len(sys.argv) == 1:
        # 无参数，进入交互模式
        decrypt_interactive()
    elif len(sys.argv) == 2:
        # 一个参数，作为文件路径
        file_path = sys.argv[1]
        result = decrypt_from_file(file_path)
        if result:
            print(f"主板序列号: {result}")
    elif len(sys.argv) == 3:
        # 两个参数，第一个是文件路径，第二个是密钥
        file_path = sys.argv[1]
        key = sys.argv[2]
        result = decrypt_from_file(file_path, key)
        if result:
            print(f"主板序列号: {result}")
    else:
        print("用法:")
        print("  python reget.py                    # 交互模式")
        print("  python reget.py <加密文件路径>      # 从文件解密")
        print("  python reget.py <文件路径> <密钥>   # 使用自定义密钥解密")
        print("\n示例:")
        print("  python reget.py encrypted.txt")
        print("  python reget.py encrypted.txt mycustomkey")

if __name__ == "__main__":
    main()