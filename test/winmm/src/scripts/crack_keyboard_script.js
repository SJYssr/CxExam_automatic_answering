(function() {
    'use strict';
    
    // 破除按键限制：只针对功能键（F1-F12）和可能被阻止的特殊按键
    // 不影响正常的输入功能
    
    // 定义需要保护的功能键和特殊按键
    const protectedKeys = {
        // 功能键
        'F1': true, 'F2': true, 'F3': true, 'F4': true, 'F5': true, 'F6': true,
        'F7': true, 'F8': true, 'F9': true, 'F10': true, 'F11': true, 'F12': true,
        // 功能键的 code 格式
        'F1': true, 'F2': true, 'F3': true, 'F4': true, 'F5': true, 'F6': true,
        'F7': true, 'F8': true, 'F9': true, 'F10': true, 'F11': true, 'F12': true
    };
    
    // 判断是否是受保护的按键（功能键等）
    function isProtectedKey(event) {
        const key = event.key || '';
        const code = event.code || '';
        // 检查是否是功能键
        if (key.startsWith('F') && /^F\d+$/.test(key)) {
            return true;
        }
        if (code.startsWith('F') && /^F\d+$/.test(code)) {
            return true;
        }
        // 检查 keyCode（F1=112, F2=113, ... F12=123）
        const keyCode = event.keyCode || event.which;
        if (keyCode >= 112 && keyCode <= 123) {
            return true;
        }
        return false;
    }
    
    // 方法1：只在捕获阶段拦截受保护按键的事件，确保它们不被阻止
    document.addEventListener('keydown', function(event) {
        // 只处理功能键等受保护的按键
        if (isProtectedKey(event)) {
            // 保存原始的阻止方法
            const originalPreventDefault = event.preventDefault;
            const originalStopPropagation = event.stopPropagation;
            const originalStopImmediatePropagation = event.stopImmediatePropagation;
            
            // 重写阻止方法，对功能键不生效
            event.preventDefault = function() {
                // 对于功能键，不真正阻止
                if (isProtectedKey(event)) {
                    return;
                }
                return originalPreventDefault.call(this);
            };
            
            event.stopPropagation = function() {
                // 对于功能键，不真正停止传播
                if (isProtectedKey(event)) {
                    return;
                }
                return originalStopPropagation.call(this);
            };
            
            event.stopImmediatePropagation = function() {
                // 对于功能键，不真正停止立即传播
                if (isProtectedKey(event)) {
                    return;
                }
                return originalStopImmediatePropagation.call(this);
            };
        }
    }, true); // 使用捕获阶段，确保最早处理
    
    document.addEventListener('keyup', function(event) {
        // 同样处理 keyup 事件中的功能键
        if (isProtectedKey(event)) {
            const originalPreventDefault = event.preventDefault;
            const originalStopPropagation = event.stopPropagation;
            const originalStopImmediatePropagation = event.stopImmediatePropagation;
            
            event.preventDefault = function() {
                if (isProtectedKey(event)) {
                    return;
                }
                return originalPreventDefault.call(this);
            };
            
            event.stopPropagation = function() {
                if (isProtectedKey(event)) {
                    return;
                }
                return originalStopPropagation.call(this);
            };
            
            event.stopImmediatePropagation = function() {
                if (isProtectedKey(event)) {
                    return;
                }
                return originalStopImmediatePropagation.call(this);
            };
        }
    }, true);
    
    // 方法2：在事件冒泡阶段，如果功能键被阻止，重新允许它
    document.addEventListener('keydown', function(event) {
        if (isProtectedKey(event) && event.defaultPrevented) {
            // 功能键被阻止了，我们需要重新允许它
            // 创建一个新的事件，允许默认行为
            const newEvent = new KeyboardEvent('keydown', {
                key: event.key,
                code: event.code,
                keyCode: event.keyCode,
                which: event.which,
                bubbles: true,
                cancelable: true,
                ctrlKey: event.ctrlKey,
                altKey: event.altKey,
                shiftKey: event.shiftKey,
                metaKey: event.metaKey
            });
            
            // 如果原始事件被阻止，尝试重新触发
            // 注意：这可能会触发两次，但功能键通常不会有副作用
            if (event.target && event.target.dispatchEvent) {
                try {
                    event.target.dispatchEvent(newEvent);
                } catch (e) {
                    // 忽略错误
                }
            }
        }
    }, false); // 在冒泡阶段处理
    
    console.log('[CrackKeyboard] Keyboard restrictions removed for function keys only');
})();

