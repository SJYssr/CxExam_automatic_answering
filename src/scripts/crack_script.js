(function(){
    // 创建样式元素，设置全局可选中文本
    const style = document.createElement('style');
    style.textContent = `
        * {
            user-select: text !important;
            -webkit-user-select: text !important;
        }
        input, textarea {
            user-select: text !important;
            -webkit-modify: read-write !important;
        }
        ::selection {
            background: #b5d6fd !important;
        }`;
    document.head.appendChild(style);

    // 开启内容可编辑和设计模式
    document.body.contentEditable = false;
    document.designMode = 'off';

    // 阻止右键菜单事件传播
    document.addEventListener('contextmenu', e => e.stopPropagation(), true);
    window.addEventListener('contextmenu', e => e.stopPropagation(), true);

    // 阻止复制、剪切、粘贴、选择事件的传播
    const events = ['copy', 'cut', 'paste', 'selectstart'];
    events.forEach(e => {
        document.addEventListener(e, ev => ev.stopPropagation(), true);
        window.addEventListener(e, ev => ev.stopPropagation(), true);
    });

    // 定期强制所有元素可选
    setInterval(() => {
        document.querySelectorAll('*').forEach(el => {
            el.style.userSelect = 'text';
            el.style.webkitUserSelect = 'text';
        });
    }, 1000);

    // 禁用webdriver检测
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
})();

