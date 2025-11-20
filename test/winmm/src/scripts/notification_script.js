(function(){
    const notificationDiv = document.createElement('div');
    Object.assign(notificationDiv.style, {
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: 'rgba(46, 204, 113, 0.9)',
        color: 'white',
        padding: '12px 24px',
        borderRadius: '8px',
        boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
        zIndex: '9999999',
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        textAlign: 'left',
        maxWidth: '450px',
        lineHeight: '1.5'
    });
    
    // 创建标题
    const titleElement = document.createElement('div');
    titleElement.textContent = '注入成功！';
    titleElement.style.fontSize = '16px';
    titleElement.style.fontWeight = 'bold';
    titleElement.style.marginBottom = '10px';
    titleElement.style.textAlign = 'center';
    notificationDiv.appendChild(titleElement);
    
    // 创建作者信息
    const authorElement = document.createElement('div');
    authorElement.innerHTML = '<b>作者:</b> SJYssr<br><b>GitHub地址:</b> <a target="_blank" style="color: white; text-decoration: underline;">https://github.com/SJYssr</a>';
    authorElement.style.marginBottom = '10px';
    notificationDiv.appendChild(authorElement);
    
    // 添加技术支持信息1
    const supportElement1 = document.createElement('div');
    supportElement1.innerHTML = '<b>技术支持:</b> ZYYO<br><b>GitHub地址:</b> <a target="_blank" style="color: white; text-decoration: underline;">https://github.com/zyyo666</a>';
    supportElement1.style.marginBottom = '10px';
    supportElement1.style.fontSize = '13px';
    notificationDiv.appendChild(supportElement1);

    // 添加技术支持信息2
    const supportElement2 = document.createElement('div');
    supportElement2.innerHTML = '<b>技术支持:</b> WYX<br><b>GitHub地址:</b> <a target="_blank" style="color: white; text-decoration: underline;">https://github.com/WYXssr</a>';
    supportElement2.style.marginBottom = '10px';
    supportElement2.style.fontSize = '13px';
    notificationDiv.appendChild(supportElement2);
    
    // 添加版本信息
    const versionElement = document.createElement('div');
    versionElement.innerHTML = '<b>版本:</b> V1.0.5';
    versionElement.style.marginBottom = '10px';
    notificationDiv.appendChild(versionElement);
    
    // 添加关闭按钮
    const closeButton = document.createElement('span');
    closeButton.textContent = '×';
    Object.assign(closeButton.style, {
        position: 'absolute',
        top: '10px',
        right: '12px',
        cursor: 'pointer',
        fontWeight: 'bold',
        fontSize: '18px'
    });
    const removeNotification = () => {
        if (notificationDiv.parentNode) {
            document.body.removeChild(notificationDiv);
        }
    };
    closeButton.addEventListener('click', removeNotification);
    notificationDiv.addEventListener('click', removeNotification);
    setTimeout(() => {
        document.addEventListener('click', removeNotification, { once: true, capture: true });
    }, 0);
    
    notificationDiv.appendChild(closeButton);
    document.body.appendChild(notificationDiv);
})();

