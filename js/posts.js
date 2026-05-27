;(function () {
    'use strict';

    var POSTS_PER_PAGE = 5;
    var currentPage = 1;
    var allPosts = [];
    var filteredPosts = [];
    var activeTags = {};   // {tagName: true} — multi-select set
    var searchQuery = '';
    var tagsEl = null;
    var arrowLeft = null;
    var arrowRight = null;

    // iOS-compatible body scroll lock.
    // overflow:hidden on <body> doesn't prevent scroll on iOS Safari; the only
    // reliable approach is position:fixed + negative top = scroll position.
    var _scrollLockY = 0;
    function lockBodyScroll() {
        _scrollLockY = window.pageYOffset || 0;
        document.body.style.position   = 'fixed';
        document.body.style.top        = '-' + _scrollLockY + 'px';
        document.body.style.left       = '0';
        document.body.style.right      = '0';
        document.body.style.overflow   = 'hidden';
    }
    function unlockBodyScroll() {
        document.body.style.position = '';
        document.body.style.top      = '';
        document.body.style.left     = '';
        document.body.style.right    = '';
        document.body.style.overflow = '';
        window.scrollTo(0, _scrollLockY);
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function parseFrontmatter(content) {
        var result = { title: '', date: '', tags: [], body: content };
        if (!content.startsWith('---')) return result;

        var end = content.indexOf('---', 3);
        if (end === -1) return result;

        var fm = content.substring(3, end).trim();
        result.body = content.substring(end + 3).trim();

        fm.split('\n').forEach(function (line) {
            var colon = line.indexOf(':');
            if (colon === -1) return;
            var key = line.substring(0, colon).trim();
            var val = line.substring(colon + 1).trim().replace(/^["']|["']$/g, '');
            if (key === 'title') result.title = val;
            else if (key === 'date') result.date = val;
            else if (key === 'tags') {
                result.tags = val.split(',').map(function (t) { return t.trim(); }).filter(Boolean);
            }
        });

        return result;
    }

    function formatDate(str) {
        if (!str) return '';
        var d = new Date(str);
        if (isNaN(d.getTime())) return str;
        return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
    }

    function tagsHtml(tags) {
        if (!tags || !tags.length) return '';
        return tags.map(function (t) {
            return '<span class="post-tag" data-tag="' + escapeHtml(t) + '">' + escapeHtml(t) + '</span>';
        }).join('');
    }

    function updateTagArrows() {
        if (!tagsEl || !arrowLeft || !arrowRight) return;
        arrowLeft.classList.toggle('hidden', tagsEl.scrollLeft <= 0);
        arrowRight.classList.toggle('hidden',
            tagsEl.scrollLeft + tagsEl.clientWidth >= tagsEl.scrollWidth - 1);
    }

    function applyFilters() {
        currentPage = 1;
        var tagKeys = Object.keys(activeTags);
        filteredPosts = allPosts.filter(function (post) {
            var matchesSearch = !searchQuery ||
                (post.title || '').toLowerCase().indexOf(searchQuery) !== -1;
            var matchesTag = !tagKeys.length ||
                (post.tags && post.tags.some(function (t) { return activeTags[t]; }));
            return matchesSearch && matchesTag;
        });
    }

    function renderTagFilters() {
        var el = document.getElementById('posts-tag-filters');
        if (!el) return;

        var seen = {};
        var tags = [];
        allPosts.forEach(function (post) {
            (post.tags || []).forEach(function (t) {
                if (!seen[t]) { seen[t] = true; tags.push(t); }
            });
        });

        var hasActive = Object.keys(activeTags).length > 0;
        var html = '<button class="posts-filter-tag' + (!hasActive ? ' active' : '') + '" data-tag="">All</button>';
        tags.forEach(function (t) {
            html += '<button class="posts-filter-tag' + (activeTags[t] ? ' active' : '') + '" data-tag="' + escapeHtml(t) + '">' + escapeHtml(t) + '</button>';
        });
        el.innerHTML = html;

        Array.prototype.forEach.call(el.querySelectorAll('.posts-filter-tag'), function (btn) {
            btn.addEventListener('click', function () {
                var tag = this.getAttribute('data-tag');
                if (tag === '') {
                    activeTags = {};
                } else if (activeTags[tag]) {
                    delete activeTags[tag];
                } else {
                    activeTags[tag] = true;
                }
                applyFilters();
                renderTagFilters();
                renderTable();
                renderPagination();
            });
        });

        requestAnimationFrame(updateTagArrows);
    }

    function renderTable() {
        var tbody = document.getElementById('posts-tbody');
        if (!tbody) return;

        if (!filteredPosts.length) {
            var msg = allPosts.length ? 'No posts match your filter.' : 'No posts yet.';
            tbody.innerHTML = '<tr><td colspan="2" class="posts-empty">' + msg + '</td></tr>';
            return;
        }

        var start = (currentPage - 1) * POSTS_PER_PAGE;
        var slice = filteredPosts.slice(start, start + POSTS_PER_PAGE);
        var html = '';

        slice.forEach(function (post) {
            html += '<tr class="post-row" data-filename="' + escapeHtml(post.filename) + '">';
            html += '<td class="post-title-cell">';
            html += '<span class="post-title-text">' + escapeHtml(post.title || post.filename) + '</span>';
            if (post.date) html += '<span class="post-date-text">' + formatDate(post.date) + '</span>';
            html += '</td>';
            html += '<td class="post-tags-cell">' + tagsHtml(post.tags) + '</td>';
            html += '</tr>';
        });

        tbody.innerHTML = html;

        Array.prototype.forEach.call(tbody.querySelectorAll('.post-row'), function (row) {
            row.addEventListener('click', function () {
                openPost(this.getAttribute('data-filename'));
            });
        });

        Array.prototype.forEach.call(tbody.querySelectorAll('.post-tag'), function (tagEl) {
            tagEl.addEventListener('click', function (e) {
                e.stopPropagation();
                var tag = this.getAttribute('data-tag');
                if (activeTags[tag]) {
                    delete activeTags[tag];
                } else {
                    activeTags[tag] = true;
                }
                applyFilters();
                renderTagFilters();
                renderTable();
                renderPagination();
            });
        });
    }

    function renderPagination() {
        var el = document.getElementById('posts-pagination');
        if (!el) return;
        var total = Math.ceil(filteredPosts.length / POSTS_PER_PAGE);
        if (total <= 1) { el.innerHTML = ''; return; }

        var html = '';
        for (var i = 1; i <= total; i++) {
            html += '<button class="posts-page-btn' + (i === currentPage ? ' active' : '') + '" data-page="' + i + '">' + i + '</button>';
        }
        el.innerHTML = html;

        Array.prototype.forEach.call(el.querySelectorAll('.posts-page-btn'), function (btn) {
            btn.addEventListener('click', function () {
                currentPage = parseInt(this.getAttribute('data-page'), 10);
                renderTable();
                renderPagination();
            });
        });
    }

    function openPost(filename) {
        fetch('posts/' + filename)
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.text();
            })
            .then(function (raw) {
                var parsed = parseFrontmatter(raw);
                document.getElementById('post-modal-title').textContent = parsed.title || filename;

                var meta = document.getElementById('post-modal-meta');
                var parts = [];
                if (parsed.date) parts.push(formatDate(parsed.date));
                if (parsed.tags && parsed.tags.length) parts.push(tagsHtml(parsed.tags));
                meta.innerHTML = parts.join('<span class="post-modal-sep">&nbsp;·&nbsp;</span>');

                var content = document.getElementById('post-modal-content');
                if (window.marked) {
                    content.innerHTML = window.marked.parse(parsed.body);
                } else {
                    content.innerHTML = '<pre class="post-raw">' + escapeHtml(parsed.body) + '</pre>';
                }

                if (window.hljs) {
                    content.querySelectorAll('pre code').forEach(function (block) {
                        window.hljs.highlightElement(block);
                    });
                }

                var modal = document.getElementById('post-modal');
                modal.style.display = 'flex';
                document.getElementById('post-modal-content').scrollTop = 0;
                lockBodyScroll();
            })
            .catch(function (err) {
                console.error('Failed to load post', filename, err);
            });
    }

    function closeModal() {
        document.getElementById('post-modal').style.display = 'none';
        unlockBodyScroll();
    }

    function init() {
        var closeBtn = document.getElementById('post-modal-close');
        if (closeBtn) closeBtn.addEventListener('click', closeModal);

        var overlay = document.getElementById('post-modal');
        if (overlay) {
            overlay.addEventListener('click', function (e) {
                if (e.target === overlay) closeModal();
            });
        }

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeModal();
        });

        var searchInput = document.getElementById('posts-search');
        if (searchInput) {
            searchInput.addEventListener('input', function () {
                searchQuery = this.value.trim().toLowerCase();
                applyFilters();
                renderTable();
                renderPagination();
            });
        }

        tagsEl    = document.getElementById('posts-tag-filters');
        arrowLeft  = document.getElementById('tags-arrow-left');
        arrowRight = document.getElementById('tags-arrow-right');

        if (arrowLeft) {
            arrowLeft.addEventListener('click', function () {
                tagsEl.scrollBy({ left: -160, behavior: 'smooth' });
            });
        }
        if (arrowRight) {
            arrowRight.addEventListener('click', function () {
                tagsEl.scrollBy({ left: 160, behavior: 'smooth' });
            });
        }
        if (tagsEl) {
            tagsEl.addEventListener('scroll', updateTagArrows);
        }

        if (window.hljs) {
            window.hljs.configure({ ignoreUnescapedHTML: true });
            window.hljs.registerAliases(['cql'], { languageName: 'sql' });
        }

        fetch('posts/manifest.json')
            .then(function (r) { return r.json(); })
            .then(function (data) {
                allPosts = (data.posts || []).sort(function (a, b) {
                    return new Date(b.date || 0) - new Date(a.date || 0);
                });
                applyFilters();
                renderTagFilters();
                renderTable();
                renderPagination();
            })
            .catch(function () {
                var tbody = document.getElementById('posts-tbody');
                if (tbody) tbody.innerHTML = '<tr><td colspan="2" class="posts-empty">No posts available.</td></tr>';
            });
    }

    function matrixScramble(el, opts) {
        if (el._matrixRunning) return;
        el._matrixRunning = true;
        var ghostMode = opts && opts.ghost;
        var target = el.getAttribute('data-text') || el.textContent;
        el.setAttribute('data-text', target);
        var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*<>/\\|[]{}';
        var locked = [];
        var frame = 0;
        var totalFrames = target.length * 3;

        function tick() {
            var out = '';
            for (var i = 0; i < target.length; i++) {
                if (target[i] === ' ') { out += ' '; continue; }
                if (locked[i]) {
                    out += ghostMode
                        ? '<span>' + target[i] + '</span>'
                        : target[i];
                    continue;
                }
                var rnd = chars[Math.floor(Math.random() * chars.length)];
                if (frame >= i * 3) {
                    if (frame >= i * 3 + 2) {
                        locked[i] = true;
                        out += ghostMode ? '<span>' + target[i] + '</span>' : target[i];
                    } else {
                        out += ghostMode
                            ? '<span>' + rnd + '</span>'
                            : rnd;
                    }
                } else {
                    out += ghostMode
                        ? '<span>' + rnd + '</span>'
                        : rnd;
                }
            }
            if (ghostMode) { el.innerHTML = out; } else { el.textContent = out; }
            frame++;
            if (frame <= totalFrames) {
                requestAnimationFrame(tick);
            } else {
                if (ghostMode) { el.innerHTML = target; } else { el.textContent = target; }
                el._matrixRunning = false;
            }
        }

        requestAnimationFrame(tick);
    }

    function initDisclaimer() {
        var el = document.querySelector('.posts-disclaimer');
        var row = document.querySelector('.posts-disclaimer-row');
        if (!el) return;

        var triggered = false;
        function onScroll() {
            if (triggered) return;
            var rect = el.getBoundingClientRect();
            if (rect.top < window.innerHeight - 40) {
                triggered = true;
                window.removeEventListener('scroll', onScroll);
                matrixScramble(el);
            }
        }

        window.addEventListener('scroll', onScroll);
        onScroll();

        var hoverTarget = row || el;
        hoverTarget.addEventListener('mouseenter', function () { matrixScramble(el); });
    }

    function initHeroSubtitle() {
        var el = document.getElementById('hero-subtitle');
        if (!el) return;
        matrixScramble(el, { ghost: true });
        el.addEventListener('mouseenter', function () { matrixScramble(el, { ghost: true }); });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { init(); initDisclaimer(); initHeroSubtitle(); });
    } else {
        init();
        initDisclaimer();
        initHeroSubtitle();
    }

}());
