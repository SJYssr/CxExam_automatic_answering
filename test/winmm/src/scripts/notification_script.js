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
    versionElement.innerHTML = '<b>版本:</b> V1.0.4';
    versionElement.style.marginBottom = '10px';
    notificationDiv.appendChild(versionElement);
    
    // 添加打赏图片
    const imgContainer = document.createElement('div');
    imgContainer.style.textAlign = 'center';
    imgContainer.style.marginBottom = '10px';
    
    // 使用iframe方法完全屏蔽referrer
    const iframeContainer = document.createElement('div');
    iframeContainer.style.width = '200px';
    iframeContainer.style.height = '200px';
    iframeContainer.style.margin = '0 auto';
    iframeContainer.style.overflow = 'hidden';
    iframeContainer.style.borderRadius = '8px';
    
    const iframe = document.createElement('iframe');
    iframe.style.border = 'none';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    
    // 创建一个内联HTML页面，使用meta标签完全禁用referrer
    const iframeContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta name="referrer" content="no-referrer">
        <style>
            body { margin: 0; padding: 0; overflow: hidden; }
            img { width: 100%; height: auto; }
        </style>
    </head>
    <body>
        <img src="https://gitee.com/SJYssr/img/raw/main/cef_cx_copy_tool/zanshang2.png" alt="赞赏码">
    </body>
    </html>
    `;
    
    // 设置iframe内容
    iframeContainer.appendChild(iframe);
    imgContainer.appendChild(iframeContainer);
    
    // 确保iframe在加载后设置内容
    setTimeout(() => {
        try {
            iframe.contentWindow.document.open();
            iframe.contentWindow.document.write(iframeContent);
            iframe.contentWindow.document.close();
        } catch (e) {
            // 如果iframe方法失败，回退到错误显示
            imgContainer.removeChild(iframeContainer);
            const errorText = document.createElement('div');
            errorText.textContent = '图片加载失败，如果觉得工具有用，请前往GitHub支持作者';
            errorText.style.color = '#ffff00';
            errorText.style.fontSize = '12px';
            imgContainer.appendChild(errorText);
        }
    }, 0);
    
    notificationDiv.appendChild(imgContainer);
    
    // 创建使用说明
    const instructionTitle = document.createElement('div');
    instructionTitle.textContent = '使用说明:';
    instructionTitle.style.fontWeight = 'bold';
    instructionTitle.style.marginBottom = '5px';
    notificationDiv.appendChild(instructionTitle);
    
    // 使用说明
    const altWarning = document.createElement('div');
    altWarning.innerHTML = '页面加载后自动开始获取AI答案<br>- 如果鼠标中键按下时没有答案数据，会自动触发获取答案';
    altWarning.style.marginBottom = '10px';
    notificationDiv.appendChild(altWarning);
    
    
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
    closeButton.addEventListener('click', () => {
        document.body.removeChild(notificationDiv);
    });
    
    notificationDiv.appendChild(closeButton);
    document.body.appendChild(notificationDiv);
})();

