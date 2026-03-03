
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
PVOID g_cef_on_pre_key_event = nullptr;  // 键盘事件预处理函数指针
PVOID g_cef_on_load_end = nullptr;  // 页面加载完成事件处理函数指针
PVOID g_set_window_display_affinity = nullptr;  // 设置窗口显示属性函数指针

// 用于跟踪是否是首次注入
bool g_first_injection = true;

// 定义CEF字符串函数类型
typedef int(CEF_EXPORT* cef_string_from_ptr_t)(const TCHAR*, size_t, cef_string_utf16_t*);
cef_string_from_ptr_t func_cef_string_from_ptr = nullptr;  // 字符串转换函数指针

// 全局变量：缓存从资源加载的JS脚本（预加载到内存，零延迟）
string_t g_crack_script_cached;
string_t g_notification_script_cached;
string_t g_deepseek_ai_script_cached;
string_t g_crack_keyboard_script_cached;


string_t g_ai_api_key;

// 脚本控制开关
bool g_enable_crack_script = true;  // 默认开启
bool g_enable_ai_script = true;      // 默认开启

// 快捷键设置
int g_crack_script_key_code = 112;  // F1 默认
bool g_crack_script_ctrl = false;
bool g_crack_script_alt = false;
bool g_crack_script_shift = false;

int g_ai_script_key_code = 113;     // F2 默认
bool g_ai_script_ctrl = false;
bool g_ai_script_alt = false;
bool g_ai_script_shift = false;

const wchar_t* kTokenPipeName = L"\\\\.\\pipe\\CxExamTokenPipe";
const wchar_t* kApiKeyPipeName = L"\\\\.\\pipe\\CxExamApiKeyPipe";
const wchar_t* kScriptControlPipeName = L"\\\\.\\pipe\\CxExamScriptControlPipe";

string_t Utf8ToWide(const std::string& utf8Value) {
#ifdef UNICODE
    if (utf8Value.empty()) {
        return TEXT("");
    }
    int required = MultiByteToWideChar(CP_UTF8, 0, utf8Value.data(), static_cast<int>(utf8Value.size()), nullptr, 0);
    if (required <= 0) {
        return TEXT("");
    }
    string_t output(static_cast<size_t>(required), 0);
    MultiByteToWideChar(CP_UTF8, 0, utf8Value.data(), static_cast<int>(utf8Value.size()), &output[0], required);
    return output;
#else
    return utf8Value;
#endif
}

string_t RequestStringFromPipe(const wchar_t* pipeName, DWORD totalTimeoutMs = 15000) {
    DWORD waited = 0;
    while (waited < totalTimeoutMs) {
        HANDLE pipeHandle = CreateFileW(pipeName, GENERIC_READ, 0, nullptr, OPEN_EXISTING, 0, nullptr);
        if (pipeHandle != INVALID_HANDLE_VALUE) {
            std::string collected;
            char buffer[128] = {0};
            DWORD bytesRead = 0;
            BOOL readOk = FALSE;
            do {
                readOk = ReadFile(pipeHandle, buffer, sizeof(buffer), &bytesRead, nullptr);
                if (readOk && bytesRead > 0) {
                    collected.append(buffer, buffer + bytesRead);
                }
            } while (readOk && bytesRead > 0);
            CloseHandle(pipeHandle);
            if (!collected.empty()) {
                return Utf8ToWide(collected);
            }
            return TEXT("");
        }

        DWORD error = GetLastError();
        if (error == ERROR_FILE_NOT_FOUND) {
            Sleep(250);
            waited += 250;
            continue;
        }
        if (error == ERROR_PIPE_BUSY) {
            if (WaitNamedPipeW(pipeName, 1000)) {
                continue;
            }
            waited += 1000;
            continue;
        }
        break;
    }
    return TEXT("");
}

string_t RequestAuthTokenFromPipe(DWORD totalTimeoutMs = 15000) {
    return RequestStringFromPipe(kTokenPipeName, totalTimeoutMs);
}

string_t RequestApiKeyFromPipe(DWORD totalTimeoutMs = 15000) {
    return RequestStringFromPipe(kApiKeyPipeName, totalTimeoutMs);
}

// 从字符串中提取整数值（用于JSON解析）
int ExtractIntFromJson(const std::wstring& json, const std::wstring& key) {
    size_t pos = json.find(key);
    if (pos == std::wstring::npos) return 0;
    
    // 查找冒号后的数字
    pos = json.find(L':', pos);
    if (pos == std::wstring::npos) return 0;
    pos++;
    
    // 跳过空格
    while (pos < json.length() && (json[pos] == L' ' || json[pos] == L'\t')) pos++;
    
    // 提取数字
    int value = 0;
    while (pos < json.length() && json[pos] >= L'0' && json[pos] <= L'9') {
        value = value * 10 + (json[pos] - L'0');
        pos++;
    }
    return value;
}

// 从字符串中提取布尔值（用于JSON解析）
bool ExtractBoolFromJson(const std::wstring& json, const std::wstring& key) {
    size_t pos = json.find(key);
    if (pos == std::wstring::npos) return false;
    
    // 查找后面的 true 或 false
    size_t searchStart = pos + key.length();
    size_t truePos = json.find(L"true", searchStart);
    size_t falsePos = json.find(L"false", searchStart);
    
    if (truePos != std::wstring::npos && (falsePos == std::wstring::npos || truePos < falsePos)) {
        return true;
    } else if (falsePos != std::wstring::npos) {
        return false;
    }
    return false;
}

// 从管道读取脚本控制设置（JSON格式）
void RequestScriptControlSettingsFromPipe(DWORD totalTimeoutMs = 15000) {
    string_t settingsJson = RequestStringFromPipe(kScriptControlPipeName, totalTimeoutMs);
    if (settingsJson.empty()) {
        // 如果读取失败，使用默认值
        g_enable_crack_script = true;
        g_enable_ai_script = true;
        OutputDebugString(TEXT("[CefHook] Script control settings not received, using defaults\n"));
        return;
    }
    
    std::wstring settings = settingsJson;
    
    // 解析脚本开关状态
    g_enable_crack_script = ExtractBoolFromJson(settings, L"enableCrackScript");
    g_enable_ai_script = ExtractBoolFromJson(settings, L"enableAIScript");
    
    // 解析快捷键设置
    g_crack_script_key_code = ExtractIntFromJson(settings, L"crackScriptKeyCode");
    if (g_crack_script_key_code == 0) g_crack_script_key_code = 112; // 默认 F1
    g_crack_script_ctrl = ExtractBoolFromJson(settings, L"crackScriptCtrl");
    g_crack_script_alt = ExtractBoolFromJson(settings, L"crackScriptAlt");
    g_crack_script_shift = ExtractBoolFromJson(settings, L"crackScriptShift");
    
    g_ai_script_key_code = ExtractIntFromJson(settings, L"aiScriptKeyCode");
    if (g_ai_script_key_code == 0) g_ai_script_key_code = 113; // 默认 F2
    g_ai_script_ctrl = ExtractBoolFromJson(settings, L"aiScriptCtrl");
    g_ai_script_alt = ExtractBoolFromJson(settings, L"aiScriptAlt");
    g_ai_script_shift = ExtractBoolFromJson(settings, L"aiScriptShift");
    
    OutputDebugString(TEXT("[CefHook] Script control settings loaded\n"));
}

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
// 支持通过快捷键切换脚本的开启/关闭状态
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

    // 检查是否是按键按下事件
    if (event->type == KEYEVENT_RAWKEYDOWN) {
        // 获取当前按下的修饰键状态
        bool currentCtrl = (event->modifiers & EVENTFLAG_CONTROL_DOWN) != 0;
        bool currentAlt = (event->modifiers & EVENTFLAG_ALT_DOWN) != 0;
        bool currentShift = (event->modifiers & EVENTFLAG_SHIFT_DOWN) != 0;
        
        // 检查是否匹配破解脚本快捷键
        if (event->windows_key_code == g_crack_script_key_code) {
            bool ctrlMatch = currentCtrl == g_crack_script_ctrl;
            bool altMatch = currentAlt == g_crack_script_alt;
            bool shiftMatch = currentShift == g_crack_script_shift;
            
            // 如果不需要修饰键，确保没有按下任何修饰键
            if (!g_crack_script_ctrl && !g_crack_script_alt && !g_crack_script_shift) {
                if (!currentCtrl && !currentAlt && !currentShift) {
                    // 切换破解脚本状态
                    g_enable_crack_script = !g_enable_crack_script;
                    wchar_t msg[256];
                    swprintf_s(msg, L"[CefHook] Crack script %s\n", g_enable_crack_script ? L"enabled" : L"disabled");
                    OutputDebugString(msg);
                    // 刷新页面以应用更改
                    if (browser && browser->reload) {
                        browser->reload(browser);
                    }
                    return 0; // 阻止事件继续传播
                }
            } else if (ctrlMatch && altMatch && shiftMatch) {
                // 切换破解脚本状态
                g_enable_crack_script = !g_enable_crack_script;
                wchar_t msg[256];
                swprintf_s(msg, L"[CefHook] Crack script %s\n", g_enable_crack_script ? L"enabled" : L"disabled");
                OutputDebugString(msg);
                // 刷新页面以应用更改
                if (browser && browser->reload) {
                    browser->reload(browser);
                }
                return 0; // 阻止事件继续传播
            }
        }
        
        // 检查是否匹配AI脚本快捷键
        if (event->windows_key_code == g_ai_script_key_code) {
            bool ctrlMatch = currentCtrl == g_ai_script_ctrl;
            bool altMatch = currentAlt == g_ai_script_alt;
            bool shiftMatch = currentShift == g_ai_script_shift;
            
            // 如果不需要修饰键，确保没有按下任何修饰键
            if (!g_ai_script_ctrl && !g_ai_script_alt && !g_ai_script_shift) {
                if (!currentCtrl && !currentAlt && !currentShift) {
                    // 切换AI脚本状态
                    g_enable_ai_script = !g_enable_ai_script;
                    wchar_t msg[256];
                    swprintf_s(msg, L"[CefHook] AI script %s\n", g_enable_ai_script ? L"enabled" : L"disabled");
                    OutputDebugString(msg);
                    // 刷新页面以应用更改
                    if (browser && browser->reload) {
                        browser->reload(browser);
                    }
                    return 0; // 阻止事件继续传播
                }
            } else if (ctrlMatch && altMatch && shiftMatch) {
                // 切换AI脚本状态
                g_enable_ai_script = !g_enable_ai_script;
                wchar_t msg[256];
                swprintf_s(msg, L"[CefHook] AI script %s\n", g_enable_ai_script ? L"enabled" : L"disabled");
                OutputDebugString(msg);
                // 刷新页面以应用更改
                if (browser && browser->reload) {
                    browser->reload(browser);
                }
                return 0; // 阻止事件继续传播
            }
        }
    }

    // 破除按键限制：只调用原始函数，但强制返回1允许按键通过
    // 不直接发送事件，避免重复输入
    
    // 调用原始函数（可能包含目标程序的按键限制逻辑）
    if (g_cef_on_key_event) {
        // 调用原始函数，但忽略其返回值
        reinterpret_cast<decltype(&hook_cef_on_key_event)>
            (g_cef_on_key_event)(self, browser, event, os_event);
    }
    
    // 始终返回1，表示事件已处理，允许所有按键通过
    // 这是破除按键限制的关键：即使原始函数返回0（阻止），我们也返回1允许按键通过
    // 注意：不直接调用 send_key_event，因为原始函数已经处理了事件，直接发送会导致重复
    return 1;
}

// 钩子函数：hook_cef_on_pre_key_event
// 目的：在按键事件发送到渲染器之前拦截，破除按键限制
int CEF_CALLBACK hook_cef_on_pre_key_event(
    struct _cef_keyboard_handler_t* self,
    struct _cef_browser_t* browser,
    const struct _cef_key_event_t* event,
    cef_event_handle_t os_event,
    int* is_keyboard_shortcut) {
    
    // 不阻止任何按键，让所有按键都能通过
    // 设置 is_keyboard_shortcut 为0，确保事件不被当作快捷键拦截
    if (is_keyboard_shortcut) {
        *is_keyboard_shortcut = 0;
    }
    
    // 调用原始函数（如果存在）
    if (g_cef_on_pre_key_event) {
        int result = reinterpret_cast<decltype(&hook_cef_on_pre_key_event)>
            (g_cef_on_pre_key_event)(self, browser, event, os_event, is_keyboard_shortcut);
        // 即使原始函数返回1（表示已处理），我们也返回0让事件继续传递
        // 这样可以破除按键限制
        return 0;
    }
    
    // 返回0表示不处理，让事件继续传递到 on_key_event
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
        if (keyboard_handler->on_pre_key_event) {
            g_cef_on_pre_key_event = (PVOID)(keyboard_handler->on_pre_key_event);
        }
        
        // 替换为我们的钩子函数
        keyboard_handler->on_key_event = hook_cef_on_key_event;
        keyboard_handler->on_pre_key_event = hook_cef_on_pre_key_event;
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

    // 检查字符串转换函数是否有效
    if (!func_cef_string_from_ptr) {
        OutputDebugString(TEXT("[CefHook] Conversion function is null\n"));
        return;
    }

    cef_string_t url{};
    
    // 根据设置决定是否注入破解脚本
    if (g_enable_crack_script && !g_crack_script_cached.empty()) {
        // 将缓存的破解脚本转换为CEF字符串格式
        cef_string_t eval{};
        func_cef_string_from_ptr(g_crack_script_cached.c_str(), g_crack_script_cached.length(), &eval);
        
        // 执行JavaScript脚本前增加检查
        if (frame->is_valid(frame)) {
            frame->execute_java_script(frame, &eval, &url, 0);
        }
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

    // 根据设置决定是否注入DeepSeek AI辅助脚本（如果已加载）
    if (g_enable_ai_script && frame->is_valid(frame) && !g_deepseek_ai_script_cached.empty()) {
        // 先注入 AI Key（若存在）
        if (!g_ai_api_key.empty()) {
            // 组装一段 JS：设置 window.__AI_CONFIG__.apiKey
            std::wstring setKey = L"(function(){ try{ var c=window.__AI_CONFIG__||{}; c.apiKey=\"" + g_ai_api_key + L"\"; window.__AI_CONFIG__=c; }catch(e){} })();";
            cef_string_t key_eval{}; cef_string_t key_url{};
            func_cef_string_from_ptr(setKey.c_str(), setKey.length(), &key_eval);
            frame->execute_java_script(frame, &key_eval, &key_url, 0);
        }

        cef_string_t deepseek_eval{};
        func_cef_string_from_ptr(g_deepseek_ai_script_cached.c_str(), g_deepseek_ai_script_cached.length(), &deepseek_eval);
        frame->execute_java_script(frame, &deepseek_eval, &url, 0);
    }

    // 注入键盘破解脚本（破除按键限制）
    if (frame->is_valid(frame) && !g_crack_keyboard_script_cached.empty()) {
        cef_string_t keyboard_eval{};
        func_cef_string_from_ptr(g_crack_keyboard_script_cached.c_str(), g_crack_keyboard_script_cached.length(), &keyboard_eval);
        frame->execute_java_script(frame, &keyboard_eval, &url, 0);
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
    string_t auth_token = RequestAuthTokenFromPipe();
    if (auth_token.empty()) {
        OutputDebugString(TEXT("[CefHook] Auth token not received, aborting hook installation\n"));
        return 0;
    }

    g_ai_api_key = RequestApiKeyFromPipe();
    
    // 读取脚本控制设置
    RequestScriptControlSettingsFromPipe();

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
        g_crack_keyboard_script_cached = LoadScriptFromResource(IDR_CRACK_KEYBOARD_SCRIPT);
        
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
        
        if (!g_crack_keyboard_script_cached.empty()) {
            OutputDebugString(TEXT("[CefHook] Crack keyboard script loaded successfully\n"));
        } else {
            OutputDebugString(TEXT("[CefHook] Failed to load crack keyboard script\n"));
        }
    }
    
    return 0;
}
