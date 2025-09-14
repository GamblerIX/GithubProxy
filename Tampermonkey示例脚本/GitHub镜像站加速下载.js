// ==UserScript==
// @name         GitHub镜像站加速下载
// @version      1.0.0
// @author       GamblerIX
// @description  加速下载GitHub镜像站上的文件
// @match        *://github.com/*
// @match        *://hub.mihoyo.online/*
// @icon         data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAMAAABEpIrGAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAACEUExURUxpcRgWFhsYGBgWFhcWFh8WFhoYGBgWFiUlJRcVFRkWFhgVFRgWFhgVFRsWFhgWFigeHhkWFv////////////r6+h4eHv///xcVFfLx8SMhIUNCQpSTk/r6+jY0NCknJ97e3ru7u+fn51BOTsPCwqGgoISDg6empmpoaK2srNDQ0FhXV3eXcCcAAAAXdFJOUwCBIZXMGP70BuRH2Ze/LpIMUunHkpQR34sfygAAAVpJREFUOMt1U+magjAMDAVb5BDU3W25b9T1/d9vaYpQKDs/rF9nSNJkArDA9ezQZ8wPbc8FE6eAiQUsOO1o19JolFibKCdHGHC0IJezOMD5snx/yE+KOYYr42fPSufSZyazqDoseTPw4lGJNOu6LBXVUPBG3lqYAOv/5ZwnNUfUifzBt8gkgfgINmjxOpgqUA147QWNaocLniqq3QsSVbQHNp45N/BAwoYQz9oUJEiE4GMGfoBSMj5gjeWRIMMqleD/CAzUHFqTLyjOA5zjNnwa4UCEZ2YK3khEcBXHjVBtEFeIZ6+NxYbPqWp1DLKV42t6Ujn2ydyiPi9nX0TTNAkVVZ/gozsl6FbrktkwaVvL2TRK0C8Ca7Hck7f5OBT6FFbLATkL2ugV0tm0RLM9fedDvhWstl8Wp9AFDjFX7yOY/lJrv8AkYuz7fuP8dv9izCYH+x3/LBnj9fYPBTpJDNzX+7cAAAAASUVORK5CYII=
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_openInTab
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_notification
// @grant        GM_setClipboard
// @grant        window.onurlchange
// @sandbox      JavaScript
// @license      MIT
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';
    var menu_rawFast = GM_getValue('xiu2_menu_raw_fast'), menu_rawFast_ID, menu_rawDownLink_ID, menu_gitClone_ID, menu_customUrl_ID, menu_feedBack_ID;
    const download_url_us = [
        ['https://releases.mihoyo.online/https://github.com', '自建', 'CF CDN - 自建加速源'],
    ], clone_url = [
        ['https://gitclone.com', '大陆', '中国大陆 - GitClone - 首次慢，缓存后较快'],
    ], clone_ssh_url = [
        ['ssh://git@ssh.github.com:443/', 'Github 原生', '日本、新加坡等 - Github 官方提供的 443 端口的 SSH（依然是 SSH 协议），适用于限制访问 22 端口的网络环境'],
    ], raw_url = [
        ['https://raw.mihoyo.online', '自建', 'CF CDN - 自建加速源'],
    ], svg = [
        '<svg class="octicon octicon-cloud-download" aria-hidden="true" height="16" version="1.1" viewBox="0 0 16 16" width="16"><path d="M9 12h2l-3 3-3-3h2V7h2v5zm3-8c0-.44-.91-3-4.5-3C5.08 1 3 2.92 3 5 1.02 5 0 6.52 0 8c0 1.53 1 3 3 3h3V9.7H3C1.38 9.7 1.3 8.28 1.3 8c0-.17.05-1.7 1.7-1.7h1.3V5c0-1.39 1.56-2.7 3.2-2.7 2.55 0 3.13 1.55 3.2 1.8v1.2H12c.81 0 2.7.22 2.7 2.2 0 2.09-2.25 2.2-2.7 2.2h-2V11h2c2.08 0 4-1.16 4-3.5C16 5.06 14.08 4 12 4z"></path></svg>'
    ], style = ['padding:0 6px; margin-right: -1px; border-radius: 2px; background-color: var(--XIU2-background-color); border-color: var(--borderColor-default); font-size: 11px; color: var(--XIU2-font-color);'];

    if (menu_rawFast == null){menu_rawFast = 1; GM_setValue('xiu2_menu_raw_fast', 1)};
    if (GM_getValue('menu_rawDownLink') == null){GM_setValue('menu_rawDownLink', true)};
    if (GM_getValue('menu_gitClone') == null){GM_setValue('menu_gitClone', true)};
    // 切换加速源
    function menu_toggle_raw_fast() {
        // 如果当前加速源位置大于等于加速源总数，则改为第一个加速源，反之递增下一个加速源
        if (menu_rawFast >= raw_url.length - 1) {menu_rawFast = 0;} else {menu_rawFast += 1;}
        GM_setValue('xiu2_menu_raw_fast', menu_rawFast);
        delRawDownLink(); // 删除旧加速源
        addRawDownLink(); // 添加新加速源
        GM_notification({text: "已切换加速源为：" + raw_url[menu_rawFast][1], timeout: 3000}); // 提示消息
    };

    colorMode(); // 适配白天/夜间主题模式
    setTimeout(addRawFile, 1000); // Raw 加速
    setTimeout(addRawDownLink, 2000); // Raw 单文件快捷下载（☁），延迟 2 秒执行，避免被 pjax 刷掉

    // Tampermonkey v4.11 版本添加的 onurlchange 事件 grant，可以监控 pjax 等网页的 URL 变化
    if (window.onurlchange === undefined) addUrlChangeEvent();
    window.addEventListener('urlchange', function() {
        colorMode(); // 适配白天/夜间主题模式
        if (location.pathname.indexOf('/releases')) addRelease(); // Release 加速
        setTimeout(addRawFile, 1000); // Raw 加速
        setTimeout(addRawDownLink, 2000); // Raw 单文件快捷下载（☁），延迟 2 秒执行，避免被 pjax 刷掉
        setTimeout(addRawDownLink_, 1000); // 在浏览器返回/前进时重新添加 Raw 下载链接（☁）鼠标事件
    });


    // Github Git Clone/SSH、Release、Download ZIP 改版为动态加载文件列表，因此需要监控网页元素变化
    const callback = (mutationsList, observer) => {
        if (location.pathname.indexOf('/releases') > -1) { // Release
            for (const mutation of mutationsList) {
                for (const target of mutation.addedNodes) {
                    if (target.nodeType !== 1) return
                    if (target.tagName === 'DIV' && target.dataset.viewComponent === 'true' && target.classList[0] === 'Box') addRelease();
                }
            }
        } else if (document.querySelector('#repository-container-header:not([hidden])')) { // 项目首页
            for (const mutation of mutationsList) {
                for (const target of mutation.addedNodes) {
                    if (target.nodeType !== 1) return
                    if (target.tagName === 'DIV' && target.parentElement && target.parentElement.id === '__primerPortalRoot__') {
                        addDownloadZIP(target);
                        addGitClone(target);
                        addGitCloneSSH(target);
                    } else if (target.tagName === 'DIV' && target.className.indexOf('Box-sc-') != -1) {
                        if (target.querySelector('input[value^="https:"]')) {
                            addGitCloneClear('.XIU2-GCS'); addGitClone(target);
                        } else if (target.querySelector('input[value^="git@"]')) {
                            addGitCloneClear('.XIU2-GC'); addGitCloneSSH(target);
                        } else if (target.querySelector('input[value^="gh "]')) {
                            addGitCloneClear('.XIU2-GC, .XIU2-GCS');
                        }
                    }
                }
            }
        }
    };
    const observer = new MutationObserver(callback);
    observer.observe(document, { childList: true, subtree: true });


    // download_url 输出加速源
    function get_New_download_url() {
        let minnum = 1; // 输出加速源
        let shuffled = download_url_us.slice(0), i = download_url_us.length, min = i - minnum, temp, index;
        while (i-- > min) {index = Math.floor((i + 1) * Math.random()); temp = shuffled[index]; shuffled[index] = shuffled[i]; shuffled[i] = temp;}
        return shuffled.slice(min) // 随机洗牌 download_url_us 数组并取前几个，然后将其合并至 download_url 数组
    }

    // Release
    function addRelease() {
        let html = document.querySelectorAll('.Box-footer'); if (html.length == 0 || location.pathname.indexOf('/releases') == -1) return
        let divDisplay = 'margin-left: -90px;', new_download_url = get_New_download_url();
        if (document.documentElement.clientWidth > 755) {divDisplay = 'margin-top: -3px;margin-left: 8px;display: inherit;';}; // 调整小屏幕时的样式
        html[0].appendChild(document.createElement('style')).textContent = '@media (min-width: 768px) {.Box-footer li.Box-row>div>span.color-fg-muted {min-width: 27px !important;}}';
        for (const current of html) {
            if (current.querySelector('.XIU2-RS')) continue
            current.querySelectorAll('li.Box-row a').forEach(function (_this) {
                let href = _this.href.split(location.host),
                    url = '', _html = `<div class="XIU2-RS" style="${divDisplay}">`;

                for (let i=0;i<new_download_url.length;i++) {
                    if (new_download_url[i][3] !== undefined && url.indexOf('/archive/') !== -1) {
                        url = new_download_url[i][3] + href[1]
                    } else {
                        url = new_download_url[i][0] + href[1]
                    }
                    _html += `<a style="${style[0]}" class="btn" href="${url}" target="_blank" title="${new_download_url[i][2]}\n\n提示：如果不想要点击链接在前台打开空白新标签页（一闪而过影响体验），\n可以 [鼠标中键] 或 [Ctrl+鼠标左键] 点击加速链接即可在后台打开新标签页！" rel="noreferrer noopener nofollow">${new_download_url[i][1]}</a>`
                }
                _this.parentElement.nextElementSibling.insertAdjacentHTML('beforeend', _html + '</div>');
            });
        }
    }


    // Download ZIP
    function addDownloadZIP(target) {
        let html = target.querySelector('ul[class^=prc-ActionList-ActionList-]>li:last-child');if (!html) return
        let href_script = document.querySelector('react-partial[partial-name=repos-overview]>script[data-target="react-partial.embeddedData"]'),
            href_slice = href_script.textContent.slice(href_script.textContent.indexOf('"zipballUrl":"')+14),
            href = href_slice.slice(0, href_slice.indexOf('"')),
            url = '', _html = '', new_download_url = get_New_download_url();

        // 克隆原 Download ZIP 元素，并定位 <a> <span> 标签
        let html_clone = html.cloneNode(true),
            html_clone_a = html_clone.querySelector('a[href$=".zip"]'),
            html_clone_span = html_clone.querySelector('span[id]');

        for (let i=0;i<new_download_url.length;i++) {
            if (new_download_url[i][3] === '') continue

            if (new_download_url[i][3] !== undefined) {
                url = new_download_url[i][3] + href
            } else {
                url = new_download_url[i][0] + href
            }
            html_clone_a.href = url
            html_clone_a.setAttribute('title', new_download_url[i][2].replaceAll('&#10;','\n') + '\n\n提示：如果不想要点击链接在前台打开空白新标签页（一闪而过影响体验），\n可以 [鼠标中键] 或 [Ctrl+鼠标左键] 点击加速链接即可在后台打开新标签页！');
            html_clone_a.setAttribute('target', '_blank');
            html_clone_a.setAttribute('rel', 'noreferrer noopener nofollow');
            html_clone_span.textContent = 'Download ZIP ' + new_download_url[i][1]
            _html += html_clone.outerHTML
        }
        html.insertAdjacentHTML('afterend', _html);
    }

    // Git Clone 切换清理
    function addGitCloneClear(css) {
        document.querySelectorAll(css).forEach((e)=>{e.remove()})
    }

    // Git Clone
    function addGitClone(target) {
        let html = target.querySelector('input[value^="https:"]:not([title])');if (!html) return
        let href_split = html.value.split(location.host)[1],
            html_parent = '<div style="margin-top: 4px;" class="XIU2-GC ' + html.parentElement.className + '">',
            url = '', _html = '', _gitClone = '';
        if (html.nextElementSibling) html.nextElementSibling.hidden = true; // 隐藏右侧复制按钮（考虑到能直接点击复制，就不再重复实现复制按钮事件了）
        if (html.parentElement.nextElementSibling.tagName === 'SPAN'){
            html.parentElement.nextElementSibling.textContent += ' (↑点击上面文字可复制)'
        }
        if (GM_getValue('menu_gitClone')) {_gitClone='git clone '; html.value = _gitClone + html.value; html.setAttribute('value', html.value);}
        // 克隆原 Git Clone 元素
        let html_clone = html.cloneNode(true);
        for (let i=0;i<clone_url.length;i++) {
            if (clone_url[i][0] === 'https://gitclone.com') {
                url = clone_url[i][0] + '/github.com' + href_split
            } else {
                url = clone_url[i][0] + href_split
            }
            html_clone.title = `${url}\n\n${clone_url[i][2].replaceAll('&#10;','\n')}\n\n提示：点击文字可直接复制`
            html_clone.setAttribute('value', _gitClone + url)
            _html += html_parent + html_clone.outerHTML + '</div>'
        }
        html.parentElement.insertAdjacentHTML('afterend', _html);
        if (html.parentElement.parentElement.className.indexOf('XIU2-GCP') === -1){
            html.parentElement.parentElement.classList.add('XIU2-GCP')
            html.parentElement.parentElement.addEventListener('click', (e)=>{if (e.target.tagName === 'INPUT') {GM_setClipboard(e.target.value);}})
        }
    }


    // Git Clone SSH
    function addGitCloneSSH(target) {
        let html = target.querySelector('input[value^="git@"]:not([title])');if (!html) return
        let href_split = html.value.split(':')[1],
            html_parent = '<div style="margin-top: 4px;" class="XIU2-GCS ' + html.parentElement.className + '">',
            url = '', _html = '', _gitClone = '';
        html.nextElementSibling.hidden = true; // 隐藏右侧复制按钮（考虑到能直接点击复制，就不再重复实现复制按钮事件了）
        if (html.parentElement.nextElementSibling.tagName === 'SPAN'){
            html.parentElement.nextElementSibling.textContent += ' (↑点击文字可复制)'
        }
        if (GM_getValue('menu_gitClone')) {_gitClone='git clone '; html.value = _gitClone + html.value; html.setAttribute('value', html.value);}
        // 克隆原 Git Clone SSH 元素
        let html_clone = html.cloneNode(true);
        for (let i=0;i<clone_ssh_url.length;i++) {
            url = clone_ssh_url[i][0] + href_split
            html_clone.title = `${url}\n\n${clone_ssh_url[i][2].replaceAll('&#10;','\n')}\n\n提示：点击文字可直接复制`
            html_clone.setAttribute('value', _gitClone + url)
            _html += html_parent + html_clone.outerHTML + '</div>'
        }
        html.parentElement.insertAdjacentHTML('afterend', _html);
        if (html.parentElement.parentElement.className.indexOf('XIU2-GCP') === -1){
            html.parentElement.parentElement.classList.add('XIU2-GCP')
            html.parentElement.parentElement.addEventListener('click', (e)=>{if (e.target.tagName === 'INPUT') {GM_setClipboard(e.target.value);}})
        }
    }


    // Raw
    function addRawFile() {
        let html = document.querySelector('a[data-testid="raw-button"]');if (!html) return
        let href = location.href.replace(`https://${location.host}`,''),
            href2 = href.replace('/blob/','/'),
            url = '', _html = '';

        for (let i=1;i<raw_url.length;i++) {
            if ((raw_url[i][0].indexOf('/gh') + 3 === raw_url[i][0].length) && raw_url[i][0].indexOf('cdn.staticaly.com') === -1) {
                url = raw_url[i][0] + href.replace('/blob/','@');
            } else {
                url = raw_url[i][0] + href2;
            }
            _html += `<a href="${url}" title="${raw_url[i][2]}\n\n提示：如果想要直接下载，可使用 [Alt + 左键] 点击加速按钮或 [右键 - 另存为...]" target="_blank" role="button" rel="noreferrer noopener nofollow" data-size="small" data-variant="default" class="${html.className} XIU2-RF" style="border-radius: 0;margin-left: -1px;">${raw_url[i][1].replace(/ \d/,'')}</a>`
        }
        if (document.querySelector('.XIU2-RF')) document.querySelectorAll('.XIU2-RF').forEach((e)=>{e.remove()})
        html.insertAdjacentHTML('afterend', _html);
    }


    // Raw 单文件快捷下载（☁）
    function addRawDownLink() {
        if (!GM_getValue('menu_rawDownLink')) return
        // 如果不是项目文件页面，就返回，如果网页有 Raw 下载链接（☁）就返回
        let files = document.querySelectorAll('div.Box-row svg.octicon.octicon-file, .react-directory-filename-column>svg.color-fg-muted');if(files.length === 0) return;if (location.pathname.indexOf('/tags') > -1) return
        let files1 = document.querySelectorAll('a.fileDownLink');if(files1.length > 0) return;

        // 鼠标指向则显示
        var mouseOverHandler = function(evt) {
            let elem = evt.currentTarget,
                aElm_new = elem.querySelectorAll('.fileDownLink'),
                aElm_now = elem.querySelectorAll('svg.octicon.octicon-file, svg.color-fg-muted');
            aElm_new.forEach(el=>{el.style.cssText = 'display: inline'});
            aElm_now.forEach(el=>{el.style.cssText = 'display: none'});
        };

        // 鼠标离开则隐藏
        var mouseOutHandler = function(evt) {
            let elem = evt.currentTarget,
                aElm_new = elem.querySelectorAll('.fileDownLink'),
                aElm_now = elem.querySelectorAll('svg.octicon.octicon-file, svg.color-fg-muted');
            aElm_new.forEach(el=>{el.style.cssText = 'display: none'});
            aElm_now.forEach(el=>{el.style.cssText = 'display: inline'});
        };

        // 循环添加
        files.forEach(function(fileElm) {
            let trElm = fileElm.parentNode.parentNode,
                cntElm_a = trElm.querySelector('[role="rowheader"] > .css-truncate.css-truncate-target.d-block.width-fit > a, .react-directory-truncate>a'),
                Name = cntElm_a.innerText,
                href = cntElm_a.getAttribute('href'),
                href2 = href.replace('/blob/','/'), url = '';
            if ((raw_url[menu_rawFast][0].indexOf('/gh') + 3 === raw_url[menu_rawFast][0].length) && raw_url[menu_rawFast][0].indexOf('cdn.staticaly.com') === -1) {
                url = raw_url[menu_rawFast][0] + href.replace('/blob/','@');
            } else {
                url = raw_url[menu_rawFast][0] + href2;
            }

            fileElm.insertAdjacentHTML('afterend', `<a href="${url}" download="${Name}" target="_blank" rel="noreferrer noopener nofollow" class="fileDownLink" style="display: none;" title="「${raw_url[menu_rawFast][1]}」&#10;&#10;[Alt + 左键点击] 或 [右键 - 另存为...] 下载文件。&#10;注意：鼠标点击 [☁] 图标，而不是左侧的文件名！&#10;&#10;${raw_url[menu_rawFast][2]}&#10;&#10;提示：点击浏览器右上角 Tampermonkey 扩展图标 - [ ${raw_url[menu_rawFast][1]} ] 加速源 (☁) 即可切换。">${svg[0]}</a>`);
            // 绑定鼠标事件
            trElm.onmouseover = mouseOverHandler;
            trElm.onmouseout = mouseOutHandler;
        });
    }


    // 移除 Raw 单文件快捷下载（☁）
    function delRawDownLink() {
        if (!GM_getValue('menu_rawDownLink')) return
        let aElm = document.querySelectorAll('.fileDownLink');if(aElm.length === 0) return;
        aElm.forEach(function(fileElm) {fileElm.remove();})
    }


    // 在浏览器返回/前进时重新添加 Raw 单文件快捷下载（☁）鼠标事件
    function addRawDownLink_() {
        if (!GM_getValue('menu_rawDownLink')) return
        // 如果不是项目文件页面，就返回，如果网页没有 Raw 下载链接（☁）就返回
        let files = document.querySelectorAll('div.Box-row svg.octicon.octicon-file, .react-directory-filename-column>svg.color-fg-muted');if(files.length === 0) return;
        let files1 = document.querySelectorAll('a.fileDownLink');if(files1.length === 0) return;

        // 鼠标指向则显示
        var mouseOverHandler = function(evt) {
            let elem = evt.currentTarget,
                aElm_new = elem.querySelectorAll('.fileDownLink'),
                aElm_now = elem.querySelectorAll('svg.octicon.octicon-file, svg.color-fg-muted');
            aElm_new.forEach(el=>{el.style.cssText = 'display: inline'});
            aElm_now.forEach(el=>{el.style.cssText = 'display: none'});
        };

        // 鼠标离开则隐藏
        var mouseOutHandler = function(evt) {
            let elem = evt.currentTarget,
                aElm_new = elem.querySelectorAll('.fileDownLink'),
                aElm_now = elem.querySelectorAll('svg.octicon.octicon-file, svg.color-fg-muted');
            aElm_new.forEach(el=>{el.style.cssText = 'display: none'});
            aElm_now.forEach(el=>{el.style.cssText = 'display: inline'});
        };
        // 循环添加
        files.forEach(function(fileElm) {
            let trElm = fileElm.parentNode.parentNode;
            // 绑定鼠标事件
            trElm.onmouseover = mouseOverHandler;
            trElm.onmouseout = mouseOutHandler;
        });
    }


    // 适配白天/夜间主题模式
    function colorMode() {
        let style_Add;
        if (document.getElementById('XIU2-Github')) {style_Add = document.getElementById('XIU2-Github')} else {style_Add = document.createElement('style'); style_Add.id = 'XIU2-Github'; style_Add.type = 'text/css';}
        let backColor = '#ffffff', fontColor = '#888888';

        if (document.lastElementChild.dataset.colorMode === 'dark') { // 如果是夜间模式
            if (document.lastElementChild.dataset.darkTheme === 'dark_dimmed') {
                backColor = '#272e37'; fontColor = '#768390';
            } else {
                backColor = '#161a21'; fontColor = '#97a0aa';
            }
        } else if (document.lastElementChild.dataset.colorMode === 'auto') { // 如果是自动模式
            if (window.matchMedia('(prefers-color-scheme: dark)').matches || document.lastElementChild.dataset.lightTheme.indexOf('dark') > -1) { // 如果浏览器是夜间模式 或 白天模式是 dark 的情况
                if (document.lastElementChild.dataset.darkTheme === 'dark_dimmed') {
                    backColor = '#272e37'; fontColor = '#768390';
                } else if (document.lastElementChild.dataset.darkTheme.indexOf('light') == -1) { // 排除夜间模式是 light 的情况
                    backColor = '#161a21'; fontColor = '#97a0aa';
                }
            }
        }

        document.lastElementChild.appendChild(style_Add).textContent = `.XIU2-RS a {--XIU2-background-color: ${backColor}; --XIU2-font-color: ${fontColor};}`;
    }


    // 自定义 urlchange 事件（用来监听 URL 变化），针对非 Tampermonkey 油猴管理器
    function addUrlChangeEvent() {
        history.pushState = ( f => function pushState(){
            var ret = f.apply(this, arguments);
            window.dispatchEvent(new Event('pushstate'));
            window.dispatchEvent(new Event('urlchange'));
            return ret;
        })(history.pushState);

        history.replaceState = ( f => function replaceState(){
            var ret = f.apply(this, arguments);
            window.dispatchEvent(new Event('replacestate'));
            window.dispatchEvent(new Event('urlchange'));
            return ret;
        })(history.replaceState);

        window.addEventListener('popstate',()=>{ // 点击浏览器的前进/后退按钮时触发 urlchange 事件
            window.dispatchEvent(new Event('urlchange'))
        });
    }
})();