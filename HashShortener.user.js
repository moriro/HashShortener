// ==UserScript==
// @name         简略哈希值显示 (MD5/SHA1/SHA256/SHA512)
// @namespace    https://github.com/moriro/HashShortener
// @version      1.0
// @description  自定义前后位数，悬停查看、双击复制。
// @author       moriro
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function() {
    'use strict';

    GM_registerMenuCommand("⚙️设置", createSettingsUI);

    const config = {
        prefixLength: GM_getValue('prefixLength', 6),
        suffixLength: GM_getValue('suffixLength', 0)
    };

    function validateConfig(prefix, suffix) {
        let p = Math.max(0, Math.min(128, parseInt(prefix) || 0));
        let s = Math.max(0, Math.min(128, parseInt(suffix) || 0));
        if (p + s > 128) s = 128 - p;
        return { p, s };
    }

    // 匹配处理
    const hashRegex = /\b([a-fA-F0-9]{128}|[a-fA-F0-9]{64}|[a-fA-F0-9]{40}|[a-fA-F0-9]{32})\b/g;

    function shortenHashes(rootNode) {
        if (!rootNode) return;
        const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT, null, false);
        const nodesToReplace = [];
        let node;

        while (node = walker.nextNode()) {
            if (node.parentElement && ['SCRIPT', 'STYLE', 'TEXTAREA', 'TITLE', 'NOSCRIPT', 'INPUT'].includes(node.parentElement.tagName.toUpperCase())) {
                continue;
            }
            if (node.parentElement && node.parentElement.classList.contains('shortened-hash')) {
                continue;
            }
            // 预先测试节点中是否包含符合长度的哈希值
            if (/\b([a-fA-F0-9]{128}|[a-fA-F0-9]{64}|[a-fA-F0-9]{40}|[a-fA-F0-9]{32})\b/.test(node.nodeValue)) {
                nodesToReplace.push(node);
            }
        }

        nodesToReplace.forEach(node => {
            const text = node.nodeValue;
            let lastIndex = 0;
            let match;
            const fragment = document.createDocumentFragment();
            const regex = new RegExp(hashRegex);

            while ((match = regex.exec(text)) !== null) {
                const fullHash = match[1];
                const hashLen = fullHash.length; // 动态获取当前匹配到的哈希长度
                let shortText;

                // 根据当前哈希的实际长度进行智能判断
                if (config.prefixLength + config.suffixLength >= hashLen) {
                    shortText = fullHash; // 如果用户设置的保留长度加起来 >= 哈希总长，则显示全部
                } else if (config.prefixLength === 0 && config.suffixLength === 0) {
                    shortText = '...';
                } else {
                    const prefix = fullHash.substring(0, config.prefixLength);
                    const suffix = fullHash.substring(hashLen - config.suffixLength);
                    shortText = `${prefix}...${suffix}`;
                }

                if (match.index > lastIndex) {
                    fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
                }

                const span = document.createElement('span');
                span.className = 'shortened-hash';
                span.textContent = shortText;
                span.title = fullHash;
                span.style.cursor = 'help';
                span.style.borderBottom = '1px dotted #888';
                span.style.fontFamily = 'monospace';
                span.setAttribute('data-original-hash', fullHash);

                span.addEventListener('dblclick', function(e) {
                    navigator.clipboard.writeText(this.title).then(() => {
                        const originalText = this.textContent;
                        this.textContent = '已复制!';
                        this.style.color = '#4CAF50';
                        setTimeout(() => {
                            this.textContent = originalText;
                            this.style.color = '';
                        }, 1000);
                    });
                    window.getSelection().removeAllRanges();
                    e.stopPropagation();
                });

                fragment.appendChild(span);
                lastIndex = regex.lastIndex;
            }

            if (lastIndex < text.length) {
                fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
            }

            if (fragment.childNodes.length > 0 && node.parentNode) {
                node.parentNode.replaceChild(fragment, node);
            }
        });
    }

    function reRenderHashes() {
        const elements = document.querySelectorAll('.shortened-hash');
        elements.forEach(span => {
            const fullHash = span.getAttribute('data-original-hash');
            if (fullHash) {
                const hashLen = fullHash.length;
                if (config.prefixLength + config.suffixLength >= hashLen) {
                    span.textContent = fullHash;
                } else if (config.prefixLength === 0 && config.suffixLength === 0) {
                    span.textContent = '...';
                } else {
                    const prefix = fullHash.substring(0, config.prefixLength);
                    const suffix = fullHash.substring(hashLen - config.suffixLength);
                    span.textContent = `${prefix}...${suffix}`;
                }
            }
        });
    }

    // 设置UI
    function createSettingsUI() {
        if (document.getElementById('hash-shortener-settings')) return;

        const panel = document.createElement('div');
        panel.id = 'hash-shortener-settings';
        panel.style.cssText = `
            position: fixed !important; top: 20px !important; right: 20px !important; width: 250px !important;
            background: #fff !important; border: 1px solid #ccc !important; box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
            padding: 15px !important; z-index: 2147483647 !important; border-radius: 8px !important;
            font-family: sans-serif !important; color: #333 !important; font-size: 14px !important;
        `;

        panel.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px;">
                ⚙️显示设置
                <span id="hash-close-btn" style="float: right; cursor: pointer; color: #888;">✖</span>
            </div>
            <div style="margin-bottom: 10px;">
                <label style="display: block; margin-bottom: 5px; font-size: 12px; color: #666;">支持 MD5/SHA1/SHA256/SHA512</label>
                <label style="display: block; margin-bottom: 5px;">保留前几位(0-128):</label>
                <input type="number" id="hash-prefix" value="${config.prefixLength}" min="0" max="128" style="width: 100%; box-sizing: border-box; padding: 4px;">
            </div>
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px;">保留后几位(0-128):</label>
                <input type="number" id="hash-suffix" value="${config.suffixLength}" min="0" max="128" style="width: 100%; box-sizing: border-box; padding: 4px;">
            </div>
            <button id="hash-save-btn" style="width: 100%; padding: 6px; background: #007BFF; color: #fff; border: none; border-radius: 4px; cursor: pointer;">保存并动态应用</button>
        `;

        (document.body || document.documentElement).appendChild(panel);

        document.getElementById('hash-close-btn').addEventListener('click', () => panel.remove());

        document.getElementById('hash-save-btn').addEventListener('click', () => {
            const { p, s } = validateConfig(document.getElementById('hash-prefix').value, document.getElementById('hash-suffix').value);

            config.prefixLength = p;
            config.suffixLength = s;
            GM_setValue('prefixLength', p);
            GM_setValue('suffixLength', s);

            document.getElementById('hash-prefix').value = p;
            document.getElementById('hash-suffix').value = s;

            reRenderHashes();

            const btn = document.getElementById('hash-save-btn');
            const oldText = btn.textContent;
            btn.textContent = '✅已保存';
            btn.style.background = '#28a745';
            setTimeout(() => { panel.remove(); }, 600);
        });
    }

    // 初始化与监听
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE && node.id !== 'hash-shortener-settings') {
                    shortenHashes(node);
                } else if (node.nodeType === Node.TEXT_NODE && node.parentElement) {
                    shortenHashes(node.parentElement);
                }
            });
        });
    });

    function init() {
        if (document.body) {
            shortenHashes(document.body);
            observer.observe(document.body, { childList: true, subtree: true });
        } else {
            setTimeout(init, 100);
        }
    }

    init();
})();
