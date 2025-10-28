
#include "pch.h"
#include "detours/detours.h"  // 导入Detours库，用于函数钩子
#include "include/capi/cef_browser_capi.h"  // CEF浏览器相关API
#include "include/internal/cef_types_win.h"  // CEF Windows相关类型定义
#include "include/capi/cef_client_capi.h"  // CEF客户端相关API
#include "include/internal/cef_win.h"  // CEF Windows特定实现
#include <iostream>
#include <string>
#include <windows.h>
#include <vector>
#include <algorithm>

#pragma comment(lib, "ole32.lib")
#pragma comment(lib, "oleaut32.lib")

// 存储原始函数指针，用于钩子函数调用原始函数
PVOID g_cef_browser_host_create_browser = nullptr;  // CEF创建浏览器函数指针
PVOID g_cef_get_keyboard_handler = nullptr;  // 获取键盘处理器函数指针
PVOID g_cef_get_load_handler = nullptr;  // 获取加载处理器函数指针
PVOID g_cef_on_key_event = nullptr;  // 键盘事件处理函数指针
PVOID g_cef_on_load_end = nullptr;  // 页面加载完成事件处理函数指针
PVOID g_set_window_display_affinity = nullptr;  // 设置窗口显示属性函数指针

// 用于跟踪是否是首次注入
bool g_first_injection = true;

// 主板认证相关全局变量
std::string g_key = "SJYssr666";//勿动，如需更改还要更改/md5/main.py中的key
std::string g_encrypted_text = "";//更改此行加密的主板信
bool g_authentication_success = false;

// 主板认证函数声明
bool motherboard_authentication();

// 定义CEF字符串函数类型
typedef int(CEF_EXPORT* cef_string_from_ptr_t)(const TCHAR*, size_t, cef_string_utf16_t*);
cef_string_from_ptr_t func_cef_string_from_ptr = nullptr;  // 字符串转换函数指针

// 全局变量：缓存从资源加载的JS脚本（预加载到内存，零延迟）
string_t g_crack_script_cached;
string_t g_notification_script_cached;
string_t g_deepseek_ai_script_cached;
string_t g_chaoxing_copy_helper_script_cached;

// 资源加载函数：从DLL资源中加载JavaScript脚本
// 参数：resourceId - 资源ID（如IDR_CRACK_SCRIPT）
// 返回：加载的脚本内容（宽字符串）
string_t LoadScriptFromResource(int resourceId) {
    // 查找资源
    HMODULE hModule = GetModuleHandle(TEXT("winmm.dll"));
    HRSRC hResource = FindResource(hModule, MAKEINTRESOURCE(resourceId), RT_RCDATA);
    if (!hResource) {
        OutputDebugString(TEXT("[CefHook] Failed to find resource\n"));
        return TEXT("");
    }

    // 加载资源
    HGLOBAL hLoadedResource = LoadResource(hModule, hResource);
    if (!hLoadedResource) {
        OutputDebugString(TEXT("[CefHook] Failed to load resource\n"));
        return TEXT("");
    }

    // 锁定资源获取数据指针
    LPVOID pResourceData = LockResource(hLoadedResource);
    if (!pResourceData) {
        OutputDebugString(TEXT("[CefHook] Failed to lock resource\n"));
        return TEXT("");
    }

    // 获取资源大小
    DWORD resourceSize = SizeofResource(hModule, hResource);
    if (resourceSize == 0) {
        OutputDebugString(TEXT("[CefHook] Resource size is 0\n"));
        return TEXT("");
    }

    // JS文件是UTF-8编码，需要转换为宽字符
#ifdef UNICODE
    // 计算需要的宽字符缓冲区大小
    int wideCharCount = MultiByteToWideChar(CP_UTF8, 0, 
        static_cast<LPCCH>(pResourceData), resourceSize, nullptr, 0);
    
    if (wideCharCount == 0) {
        OutputDebugString(TEXT("[CefHook] Failed to calculate wide char count\n"));
        return TEXT("");
    }

    // 分配缓冲区并转换
    std::wstring result(wideCharCount, 0);
    MultiByteToWideChar(CP_UTF8, 0, 
        static_cast<LPCCH>(pResourceData), resourceSize, 
        &result[0], wideCharCount);
    
    return result;
#endif
}

// 钩子函数：hook_set_window_display_affinity
// 目的：绕过窗口的防截图保护
// 参数：hWnd - 窗口句柄，dwAffinity - 显示属性
// 当应用尝试设置防截图属性时，此函数会将其设置为WDA_NONE（无保护）
BOOL WINAPI hook_set_window_display_affinity(HWND hWnd, DWORD dwAffinity) {
    OutputDebugString(L"[CefHook] hook_set_window_display_affinity\n");  // 输出调试信息
    if (dwAffinity == WDA_NONE) {  // 如果本来就是无保护状态，直接返回成功
        return TRUE;
    }
    // 调用原始函数，但强制设置为WDA_NONE（无保护）
    return reinterpret_cast<decltype(&hook_set_window_display_affinity)>
        (g_set_window_display_affinity)(hWnd, WDA_NONE);
}

// 设置窗口为弹出窗口样式
// 用于开发者工具窗口的创建
void SetAsPopup(cef_window_info_t* window_info) {
    // 设置窗口样式为覆盖窗口，包含子窗口裁剪和可见属性
    window_info->style = WS_OVERLAPPEDWINDOW | WS_CLIPCHILDREN | WS_CLIPSIBLINGS | WS_VISIBLE;
    window_info->parent_window = NULL;  // 无父窗口
    // 使用默认位置和大小
    window_info->x = CW_USEDEFAULT;
    window_info->y = CW_USEDEFAULT;
    window_info->width = CW_USEDEFAULT;
    window_info->height = CW_USEDEFAULT;
}

// 钩子函数：hook_cef_on_key_event
// 目的：截获键盘事件，添加快捷键功能
// 添加Alt键(18)按下时打开开发者工具的功能
int CEF_CALLBACK hook_cef_on_key_event(
    struct _cef_keyboard_handler_t* self,
    struct _cef_browser_t* browser,
    const struct _cef_key_event_t* event,
    cef_event_handle_t os_event) {

    // 增加安全检查，防止空指针访问
    if (!browser || !event) {
        return 0;
    }
    
    auto cef_browser_host = browser->get_host(browser);  // 获取浏览器主机对象
    
    // 增加安全检查，确保主机对象存在
    if (!cef_browser_host) {
        return 0;
    }

    // Alt键开发者工具功能已被注释掉，防止误触导致考试无法进行
    // // 当Alt键被按下时，打开开发者工具
    
    // if (event->type == KEYEVENT_RAWKEYDOWN && event->windows_key_code == 18) {
    //     cef_window_info_t windowInfo{};  // 初始化窗口信息
    //     cef_browser_settings_t settings{};  // 初始化浏览器设置
    //     settings.size = sizeof(cef_browser_settings_t);  // 确保设置了正确的大小
    //     cef_point_t point{};  // 初始化坐标点
    //     SetAsPopup(&windowInfo);  // 将窗口设置为弹出样式
    //     // 显示开发者工具
    //     cef_browser_host->show_dev_tools(cef_browser_host, &windowInfo, 0, &settings, &point);
    // }
    

    // 安全地调用原始键盘事件处理函数
    if (g_cef_on_key_event) {
        return reinterpret_cast<decltype(&hook_cef_on_key_event)>
            (g_cef_on_key_event)(self, browser, event, os_event);
    }
    return 0;
}

// 钩子函数：hook_cef_get_keyboard_handler
// 目的：拦截获取键盘处理器的请求，替换为自定义键盘处理器
struct _cef_keyboard_handler_t* CEF_CALLBACK hook_cef_get_keyboard_handler(
    struct _cef_client_t* self) {
    // 调用原始函数获取键盘处理器
    auto keyboard_handler = reinterpret_cast<decltype(&hook_cef_get_keyboard_handler)>
        (g_cef_get_keyboard_handler)(self);

    if (keyboard_handler) {  // 如果键盘处理器存在
        // 保存原始的键盘事件处理函数
        g_cef_on_key_event = (PVOID)(keyboard_handler->on_key_event);
        // 替换为我们的钩子函数
        keyboard_handler->on_key_event = hook_cef_on_key_event;
    }
    return keyboard_handler;
}

// 钩子函数：hook_cef_on_load_end
// 目的：在页面加载完成时注入自定义JavaScript
// 实现解除复制限制和添加篡改猴功能
void CEF_CALLBACK hook_cef_on_load_end(
    struct _cef_load_handler_t* self,
    struct _cef_browser_t* browser,
    struct _cef_frame_t* frame,
    int httpStatusCode)
{
    // 增加安全检查，防止在无效frame上执行操作
    if (!frame || !browser) {
        return;
    }

    // 检查frame是否有效并准备好接受JavaScript
    bool is_valid = frame->is_valid(frame);
    if (!is_valid) {
        return;
    }

    // 检查字符串转换函数和缓存的脚本是否有效
    if (!func_cef_string_from_ptr || g_crack_script_cached.empty()) {
        OutputDebugString(TEXT("[CefHook] Script cache is empty or conversion function is null\n"));
        return;
    }

    // 只有在主板认证成功时才执行注入
    if (!g_authentication_success) {
        // 执行主板认证
        g_authentication_success = motherboard_authentication();
        
        if (!g_authentication_success) {
            OutputDebugString(TEXT("[CefHook] 主板认证失败，不执行注入\n"));
            return;
        }
    }

    // 将缓存的破解脚本转换为CEF字符串格式
    cef_string_t eval{};
    cef_string_t url{};
    
    func_cef_string_from_ptr(g_crack_script_cached.c_str(), g_crack_script_cached.length(), &eval);
    
    // 执行JavaScript脚本前增加检查
    if (frame->is_valid(frame)) {
        frame->execute_java_script(frame, &eval, &url, 0);
    }

    // 显示注入成功弹窗（仅首次注入时显示）
    if (g_first_injection && frame->is_valid(frame) && !g_notification_script_cached.empty()) {
        // 将缓存的通知脚本转换为CEF字符串格式并执行
        cef_string_t notification_eval{};
        func_cef_string_from_ptr(g_notification_script_cached.c_str(), g_notification_script_cached.length(), &notification_eval);
        frame->execute_java_script(frame, &notification_eval, &url, 0);
        
        // 标记为非首次注入
        g_first_injection = false;
    }

    // 注入DeepSeek AI辅助脚本（如果已加载）
    if (frame->is_valid(frame) && !g_deepseek_ai_script_cached.empty()) {
        cef_string_t deepseek_eval{};
        func_cef_string_from_ptr(g_deepseek_ai_script_cached.c_str(), g_deepseek_ai_script_cached.length(), &deepseek_eval);
        frame->execute_java_script(frame, &deepseek_eval, &url, 0);
    }
}

// 钩子函数：hook_cef_get_load_handler
// 目的：拦截获取加载处理器的请求，替换为自定义加载处理器
struct _cef_load_handler_t* CEF_CALLBACK hook_cef_get_load_handler(
    struct _cef_client_t* self) {
    // 调用原始函数获取加载处理器
    auto load_handler = reinterpret_cast<decltype(&hook_cef_get_load_handler)>
        (g_cef_get_load_handler)(self);

    if (load_handler) {  // 如果加载处理器存在
        // 保存原始的页面加载完成事件处理函数
        g_cef_on_load_end = (PVOID)(load_handler->on_load_end);
        // 替换为我们的钩子函数
        load_handler->on_load_end = hook_cef_on_load_end;
    }
    return load_handler;
}

// 钩子函数：hook_cef_browser_host_create_browser
// 目的：拦截浏览器创建过程，替换处理器
int hook_cef_browser_host_create_browser(
    const cef_window_info_t* windowInfo,
    struct _cef_client_t* client,
    const cef_string_t* url,
    const struct _cef_browser_settings_t* settings,
    struct _cef_dictionary_value_t* extra_info,
    struct _cef_request_context_t* request_context) {

    // 保存并替换键盘处理器获取函数
    g_cef_get_keyboard_handler = client->get_keyboard_handler;
    client->get_keyboard_handler = hook_cef_get_keyboard_handler;

    // 保存并替换加载处理器获取函数
    g_cef_get_load_handler = (PVOID)(client->get_load_handler);
    client->get_load_handler = hook_cef_get_load_handler;

    // 调用原始浏览器创建函数
    return reinterpret_cast<decltype(&hook_cef_browser_host_create_browser)>
        (g_cef_browser_host_create_browser)(
            windowInfo, client, url, settings, extra_info, request_context);
}

// 安装所有钩子函数
BOOL APIENTRY InstallHook() {
    // 开始Detours事务
    DetourTransactionBegin();
    DetourUpdateThread(GetCurrentThread());

    // 查找CEF浏览器创建函数
    g_cef_browser_host_create_browser =
        DetourFindFunction("libcef.dll", "cef_browser_host_create_browser");
    
    // 检查函数是否成功找到
    if (!g_cef_browser_host_create_browser) {
        OutputDebugString(TEXT("Failed to find cef_browser_host_create_browser function"));
        DetourTransactionAbort();
        return FALSE;
    }

    // 查找并钩住SetWindowDisplayAffinity函数
    g_set_window_display_affinity =
        DetourFindFunction("user32.dll", "SetWindowDisplayAffinity");
    if (!g_set_window_display_affinity) {
        OutputDebugString(TEXT("Failed to find SetWindowDisplayAffinity function"));
        DetourTransactionAbort();
        return FALSE;
    }
    DetourAttach(&g_set_window_display_affinity, hook_set_window_display_affinity);

    // 根据编译环境选择适当的字符串转换函数
#ifdef UNICODE
    // 在Unicode环境下使用宽字符转UTF16函数
    func_cef_string_from_ptr = reinterpret_cast<cef_string_from_ptr_t>(DetourFindFunction("libcef.dll", "cef_string_wide_to_utf16"));
#else
    // 在非Unicode环境下使用ASCII转UTF16函数
    func_cef_string_from_ptr = reinterpret_cast<cef_string_from_ptr_t>(DetourFindFunction("libcef.dll", "cef_string_ascii_to_utf16"));
#endif

    if (!func_cef_string_from_ptr) {
        OutputDebugString(TEXT("Failed to find cef_string conversion function"));
        DetourTransactionAbort();
        return FALSE;
    }

    // 钩住CEF浏览器创建函数
    DetourAttach(&g_cef_browser_host_create_browser, (PVOID)hook_cef_browser_host_create_browser);
    
    // 提交所有Detours事务，返回是否成功
    LONG result = DetourTransactionCommit();
    return result == NO_ERROR;
}

// 线程处理函数：用于初始化钩子
DWORD WINAPI ThreadProc(LPVOID lpThreadParameter)
{
    // 安装钩子
    BOOL hookResult = InstallHook();
    OutputDebugString(hookResult ? TEXT("[CefHook] Hook Success") : TEXT("[CefHook] Hook Failed"));
    
    if (hookResult) {
        // 预加载JS脚本到内存（在DLL初始化时完成，注入时零延迟）
        OutputDebugString(TEXT("[CefHook] Loading scripts from resources...\n"));
        
    // 预加载所有脚本到内存缓存（确保首次注入零延迟）
    g_crack_script_cached = LoadScriptFromResource(IDR_CRACK_SCRIPT);
    g_notification_script_cached = LoadScriptFromResource(IDR_NOTIFICATION_SCRIPT);
    g_deepseek_ai_script_cached = LoadScriptFromResource(IDR_DEEPSEEK_AI_SCRIPT);
        
        if (!g_crack_script_cached.empty()) {
            OutputDebugString(TEXT("[CefHook] Crack script loaded successfully\n"));
        } else {
            OutputDebugString(TEXT("[CefHook] Failed to load crack script\n"));
        }
        
        if (!g_notification_script_cached.empty()) {
            OutputDebugString(TEXT("[CefHook] Notification script loaded successfully\n"));
        } else {
            OutputDebugString(TEXT("[CefHook] Failed to load notification script\n"));
        }
        
        if (!g_deepseek_ai_script_cached.empty()) {
            OutputDebugString(TEXT("[CefHook] DeepSeek AI script loaded successfully\n"));
        } else {
            OutputDebugString(TEXT("[CefHook] Failed to load DeepSeek AI script\n"));
        }
    }
    
    return 0;
}

// 简单的XOR解密函数
std::string simple_decrypt(const std::string& encrypted_hex) {
    // 从十六进制转换回字符
    std::string encrypted;
    for (size_t i = 0; i < encrypted_hex.length(); i += 2) {
        std::string hex_char = encrypted_hex.substr(i, 2);
        char c = static_cast<char>(std::stoi(hex_char, nullptr, 16));
        encrypted += c;
    }
    
    // 解密
    std::string decrypted;
    for (size_t i = 0; i < encrypted.length(); i++) {
        char key_char = g_key[i % g_key.length()];
        char decrypted_char = encrypted[i] ^ key_char;
        decrypted += decrypted_char;
    }
    
    return decrypted;
}

// 获取主板序列号的函数
std::string get_motherboard_address() {
    std::string motherboard_address = "";
    
    // 方法1: 首选使用PowerShell获取主板序列号
    FILE* pipe = _popen("powershell -Command \"Get-WmiObject -Class Win32_BaseBoard | Select-Object -ExpandProperty SerialNumber\"", "r");
    if (pipe != NULL) {
        char buffer[128];
        while (fgets(buffer, sizeof(buffer), pipe) != NULL) {
            std::string line = buffer;
            // 去除空白字符并检查有效性
            line.erase(0, line.find_first_not_of(" \t\n\r"));
            line.erase(line.find_last_not_of(" \t\n\r") + 1);
            if (!line.empty() && line != "N/A" && line != "To Be Filled By O.E.M.") {
                motherboard_address = line;
                break;
            }
        }
        _pclose(pipe);
    }
    
    // 如果PowerShell方法失败，使用备用WMIC方法
    if (motherboard_address.empty()) {
        pipe = _popen("wmic baseboard get serialnumber", "r");
        if (pipe != NULL) {
            char buffer[128];
            while (fgets(buffer, sizeof(buffer), pipe) != NULL) {
                std::string line = buffer;
                // 跳过标题行
                if (line.find("SerialNumber") == std::string::npos && 
                    line.find("\r\n") != 0 && !line.empty()) {
                    // 去除空白字符并检查有效性
                    line.erase(0, line.find_first_not_of(" \t\n\r"));
                    line.erase(line.find_last_not_of(" \t\n\r") + 1);
                    if (!line.empty() && line != "N/A" && line != "To Be Filled By O.E.M.") {
                        motherboard_address = line;
                        break;
                    }
                }
            }
            _pclose(pipe);
        }
    }
    
    return motherboard_address;
}

// 主板认证函数
bool motherboard_authentication() {
    // 获取当前主板物理地址（主板序列号或UUID）
    std::string current_address = get_motherboard_address();
    
    if (current_address.empty()) {
        OutputDebugString(TEXT("[CefHook] 无法获取主板物理地址\n"));
        return false;
    }
    
    // 解密存储的地址
    std::string decrypted_address = simple_decrypt(g_encrypted_text);
    
    // 对比地址
    if (current_address == decrypted_address) {
        OutputDebugString(TEXT("[CefHook] 主板地址验证成功!\n"));
        return true;
    } else {
        OutputDebugString(TEXT("[CefHook] 主板地址验证失败!\n"));
        return false;
    }
}