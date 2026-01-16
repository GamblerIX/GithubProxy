​// ==UserScript==
// @name         GitHub镜像站增强工具
// @namespace    https://github.com/GamblerIX/
// @description  汉化GitHub镜像站界面、加速下载、自动跳转到镜像站
// @icon         https://github.githubassets.com/pinned-octocat.svg
// @version      3.0.4
// @author       GamblerIX
// @license      MIT
// @homepage     https://github.com/GamblerIX/GithubProxy
// @supportURL   https://github.com/GamblerIX/GithubProxy/issues
// @match        https://github.com/*
// @match        https://hub.mihoyo.online/*
// @match        https://skills.github.com/*
// @match        https://gist.github.com/*
// @match        https://gist.mihoyo.online/*
// @match        https://education.github.com/*
// @match        https://www.githubstatus.com/*
// @require      https://update.greasyfork.org/scripts/461072/1661491/GitHub%20%E4%B8%AD%E6%96%87.js
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_notification
// @grant        GM_setClipboard
// @grant        GM_openInTab
// @grant        window.onurlchange
// @connect      fanyi.iflyrec.com
// @noframes
// ==/UserScript==

(function () {
    'use strict';

    const CONFIG = {
        VERSION: '3.0.3',
        LANG: 'zh-CN',
        STORAGE_KEYS: {
            AUTO_REDIRECT: 'auto_redirect',
            ENABLE_TRANSLATION: 'enable_translation',
            RAW_FAST_INDEX: 'xiu2_menu_raw_fast',
            RAW_DOWN_LINK: 'menu_rawDownLink',
            GIT_CLONE: 'menu_gitClone',
        },
        PERFORMANCE: {
            MAX_TEXT_LENGTH: 500,
            DEBOUNCE_DELAY: 300,
            CACHE_EXPIRE_TIME: 5 * 60 * 1000,
            REQUEST_TIMEOUT: 10000,
        },
        SELECTORS: {
            RELEASE_FOOTER: '.Box-footer',
            RAW_BUTTON: 'a[data-testid="raw-button"]',
            FILE_ICONS: 'div.Box-row svg.octicon.octicon-file, .react-directory-filename-column>svg.color-fg-muted',
        },
        CSS_CLASSES: {
            XIU2_RS: 'XIU2-RS',
            XIU2_RF: 'XIU2-RF',
            FILE_DOWNLOAD_LINK: 'fileDownLink',
            TRANSLATE_BUTTON: 'translate-me',
        }
    };

    const DOWNLOAD_SOURCES = {
        release: [
            ['https://releases.mihoyo.online/https://github.com', '自建', 'CF CDN - 自建加速源'],
            ['https://github.com', '官方', 'GitHub 官方源']
        ],
        clone: [
            ['https://gitclone.com', 'GitClone', '大陆推荐，首次慢，缓存后较快'],
            ['https://github.com', '官方', 'GitHub 官方源']
        ],
        ssh: [
            ['ssh://git@ssh.github.com:443/', '官方SSH', 'GitHub 官方 SSH 443端口']
        ],
        raw: [
            ['https://raw.mihoyo.online', '自建', 'CF CDN - 自建加速源'],
            ['https://raw.githubusercontent.com', '官方', 'GitHub 官方源']
        ]
    };

    const Utils = {
        debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        },
        safeQuerySelector(selector, parent = document) {
            try {
                return parent.querySelector(selector);
            } catch (error) {
                return null;
            }
        },
        safeQuerySelectorAll(selector, parent = document) {
            try {
                return parent.querySelectorAll(selector);
            } catch (error) {
                return [];
            }
        },
        createElement(tag, attributes = {}, textContent = '') {
            const element = document.createElement(tag);
            Object.entries(attributes).forEach(([key, value]) => {
                if (key === 'style' && typeof value === 'object') {
                    Object.assign(element.style, value);
                } else {
                    element.setAttribute(key, value);
                }
            });
            if (textContent) element.textContent = textContent;
            return element;
        },
        getNestedProperty(obj, path) {
            return path.split('.').reduce((acc, part) => {
                const match = part.match(/(\w+)(?:\[(\d+)\])?/);
                if (!match) return undefined;
                const key = match[1];
                const index = match[2];
                if (acc && acc[key] !== undefined) {
                    return index !== undefined ? acc[key][index] : acc[key];
                }
                return undefined;
            }, obj);
        }
    };

    const Storage = {
        get(key, defaultValue = null) {
            try {
                return GM_getValue(key, defaultValue);
            } catch (error) {
                return defaultValue;
            }
        },
        set(key, value) {
            try {
                GM_setValue(key, value);
                return true;
            } catch (error) {
                return false;
            }
        }
    };

    class SimpleCache {
        constructor() {
            this.cache = new Map();
            this.expireTime = CONFIG.PERFORMANCE.CACHE_EXPIRE_TIME;
        }
        set(key, value) {
            this.cache.set(key, {
                value,
                expire: Date.now() + this.expireTime
            });
        }
        get(key) {
            const item = this.cache.get(key);
            if (!item) return null;
            if (Date.now() > item.expire) {
                this.cache.delete(key);
                return null;
            }
            return item.value;
        }
        clear() {
            this.cache.clear();
        }
    }

    class GitHubEnhancer {
        constructor() {
            this.cache = new SimpleCache();
            this.pageConfig = {};
            this.rawFastIndex = Storage.get(CONFIG.STORAGE_KEYS.RAW_FAST_INDEX, 0);
            this.initDefaultSettings();
        }

        initDefaultSettings() {
            const defaults = {
                [CONFIG.STORAGE_KEYS.AUTO_REDIRECT]: true,
                [CONFIG.STORAGE_KEYS.ENABLE_TRANSLATION]: true,
                [CONFIG.STORAGE_KEYS.RAW_FAST_INDEX]: 0,
                [CONFIG.STORAGE_KEYS.RAW_DOWN_LINK]: true,
                [CONFIG.STORAGE_KEYS.GIT_CLONE]: true,
            };
            Object.entries(defaults).forEach(([key, defaultValue]) => {
                if (Storage.get(key) === null) {
                    Storage.set(key, defaultValue);
                }
            });
        }

        async init() {
            try {
                if (this.shouldRedirect()) {
                    this.performRedirect();
                    return;
                }
                if (!this.checkDependencies()) {
                    return;
                }
                this.setupLanguageEnvironment();
                this.updatePageConfig();
                this.setupEventListeners();
                this.registerMenuCommands();
                this.setupColorMode();
                setTimeout(() => this.addRawFile(), 1000);
                setTimeout(() => this.addRawDownLink(), 2000);
                if (location.pathname.indexOf('/releases') > -1) {
                    setTimeout(() => this.addRelease(), 1500);
                }
                this.performInitialTranslation();
            } catch (error) {
                this.showNotification('初始化失败，请刷新页面重试');
            }
        }

        shouldRedirect() {
            return Storage.get(CONFIG.STORAGE_KEYS.AUTO_REDIRECT) && window.location.host === 'github.com';
        }

        performRedirect() {
            const newUrl = window.location.href.replace('https://github.com', 'https://hub.mihoyo.online');
            window.location.replace(newUrl);
        }

        checkDependencies() {
            if (typeof I18N === 'undefined') {
                this.showNotification('词库文件未加载，脚本无法运行！');
                return false;
            }
            return true;
        }

        setupLanguageEnvironment() {
            document.documentElement.lang = CONFIG.LANG;
            new MutationObserver(() => {
                if (document.documentElement.lang === "en") {
                    document.documentElement.lang = CONFIG.LANG;
                }
            }).observe(document.documentElement, { attributeFilter: ['lang'] });
        }

        updatePageConfig() {
            const pageType = this.detectPageType();
            if (pageType) {
                this.pageConfig = this.buildPageConfig(pageType);
            }
        }

        detectPageType() {
            try {
                const url = new URL(window.location.href);
                const { hostname, pathname } = url;
                const pageMap = {
                    'gist.github.com': 'gist1',
                    'www.githubstatus.com': 'status',
                    'skills.github.com': 'skills',
                    'education.github.com': 'education',
                    'gist.mihoyo.online': 'gist2',
                };
                const site = pageMap[hostname] || 'github';
                const specialSites = ['gist1', 'status', 'skills', 'education', 'gist2'];
                if (specialSites.includes(site)) {
                    return site;
                }
                if (pathname === '/') {
                    return document.body?.classList.contains("logged-in") ? 'dashboard' : 'homepage';
                } else if (pathname.includes('/releases')) {
                    return 'repository';
                } else {
                    return 'repository';
                }
            } catch (error) {
                return 'repository';
            }
        }

        buildPageConfig(pageType) {
            try {
                return {
                    currentPageType: pageType,
                    staticDict: {
                        ...I18N[CONFIG.LANG].public.static,
                        ...(I18N[CONFIG.LANG][pageType]?.static || {})
                    },
                    regexpRules: [
                        ...(I18N[CONFIG.LANG][pageType]?.regexp || []),
                        ...I18N[CONFIG.LANG].public.regexp
                    ]
                };
            } catch (error) {
                return { currentPageType: pageType };
            }
        }

        setupEventListeners() {
            if (window.onurlchange === undefined) {
                this.addUrlChangeEvent();
            }
            window.addEventListener('urlchange', () => {
                this.setupColorMode();
                if (location.pathname.indexOf('/releases') > -1) {
                    this.addRelease();
                }
                setTimeout(() => this.addRawFile(), 1000);
                setTimeout(() => this.addRawDownLink(), 2000);
            });
            document.addEventListener('turbo:load', () => {
                this.translateTitle();
            });
            this.setupMutationObserver();
        }

        setupMutationObserver() {
            const observer = new MutationObserver((mutations) => {
                this.handleMutations(mutations);
            });
            const config = {
                childList: true,
                subtree: true,
                characterData: true
            };
            if (document.body) {
                observer.observe(document.body, config);
            } else {
                document.addEventListener('DOMContentLoaded', () => {
                    if (document.body) {
                        observer.observe(document.body, config);
                    }
                });
            }
        }

        handleMutations(mutations) {
            if (location.pathname.indexOf('/releases') > -1) {
                for (const mutation of mutations) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.tagName === 'DIV' &&
                                node.dataset &&
                                node.dataset.viewComponent === 'true' &&
                                node.classList &&
                                node.classList.contains('Box')) {
                                setTimeout(() => this.addRelease(), 100);
                                break;
                            }
                        }
                    }
                }
            }
            if (Utils。safeQuerySelector('#repository-container-header:not([hidden])')) {
                for (const mutation of mutations) {
                    for (const node of mutation。addedNodes) {
                        if (node。nodeType === Node。ELEMENT_NODE && node。tagName === 'DIV') {
                            if (node。parentElement && node。parentElement。id === '__primerPortalRoot__') {
                                setTimeout(() => {
                                    this。addDownloadZIP(node);
                                    this。addGitClone(node);
                                }， 100);
                            }
                        }
                    }
                }
            }
            if (Storage。get(CONFIG。STORAGE_KEYS。ENABLE_TRANSLATION)) {
                const nodesToTranslate = mutations。flatMap(({ addedNodes， 输入 }) => {
                    if (输入 === 'childList' && addedNodes。length > 0) {
                        return [...addedNodes]。filter(node =>
                            node。nodeType === Node。ELEMENT_NODE || node。nodeType === Node。TEXT_NODE
                        );
                    }
                    return [];
                });
                nodesToTranslate。forEach(node => {
                    this。traverseNode(node);
                });
            }
        }

        addUrlChangeEvent() {
            const originalPushState = history。pushState;
            const originalReplaceState = history。replaceState;
            history。pushState = function (...args) {
                const result = originalPushState。apply(this， args);
                window。dispatchEvent(new Event('urlchange'));
                return result;
            };
            history。replaceState = function (...args) {
                const result = originalReplaceState。apply(this， args);
                window。dispatchEvent(new Event('urlchange'));
                return result;
            };
            window。addEventListener('popstate'， () => {
                window。dispatchEvent(new Event('urlchange'));
            });
        }

        performInitialTranslation() {
            if (Storage。get(CONFIG。STORAGE_KEYS。ENABLE_TRANSLATION)) {
                this。translateTitle();
                this。traverseNode(document。body);
            }
        }
