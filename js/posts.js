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
    var defaultTitle = document.title;
    var defaultDescription = '';
    var defaultOgImage = '';
    var jsonLdScript = null;

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /* ----------------------------------------------------------
     *  SEO: meta-tag helpers
     * ---------------------------------------------------------- */
    function cacheDefaultMeta() {
        var desc = document.querySelector('meta[name="description"]');
        var ogImg = document.querySelector('meta[property="og:image"]');
        defaultDescription = desc ? desc.getAttribute('content') : '';
        defaultOgImage = ogImg ? ogImg.getAttribute('content') : '';
    }

    function setMeta(name, content) {
        var el = document.querySelector('meta[name="' + name + '"]') ||
                 document.querySelector('meta[property="' + name + '"]');
        if (el) el.setAttribute('content', content);
    }

    function setPostMeta(post) {
        var title = (post.title || post.filename) + ' — Dağıstan Karadeniz';
        var desc = post.title
            ? 'Deep-dive article: ' + post.title + '. Tags: ' + (post.tags || []).join(', ')
            : defaultDescription;
        var postUrl = 'https://www.dagistankaradeniz.com/#post=' + encodeURIComponent(post.filename);
        var image = defaultOgImage;

        document.title = title;
        setMeta('description', desc);
        setMeta('og:title', title);
        setMeta('og:description', desc);
        setMeta('og:url', postUrl);
        setMeta('og:type', 'article');
        setMeta('og:image', image);
        setMeta('twitter:title', title);
        setMeta('twitter:description', desc);
        setMeta('twitter:url', postUrl);
        setMeta('twitter:image', image);

        // Canonical
        var canonical = document.querySelector('link[rel="canonical"]');
        if (canonical) canonical.setAttribute('href', postUrl);

        // JSON-LD BlogPosting
        removeJsonLd();
        jsonLdScript = document.createElement('script');
        jsonLdScript.type = 'application/ld+json';
        jsonLdScript.className = 'seo-jsonld-post';
        jsonLdScript.textContent = JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BlogPosting',
            'headline': post.title || post.filename,
            'datePublished': post.date || undefined,
            'dateModified': post.date || undefined,
            'author': { '@type': 'Person', 'name': 'Dağıstan Karadeniz', 'url': 'https://www.dagistankaradeniz.com' },
            'publisher': { '@type': 'Person', 'name': 'Dağıstan Karadeniz' },
            'url': postUrl,
            'mainEntityOfPage': { '@type': 'WebPage', '@id': postUrl },
            'description': desc,
            'keywords': (post.tags || []).join(', ')
        });
        document.head.appendChild(jsonLdScript);
    }

    function resetMeta() {
        document.title = defaultTitle;
        setMeta('description', defaultDescription);
        setMeta('og:title', 'Dağıstan Karadeniz — Computer Scientist & Software Engineer');
        setMeta('og:description', defaultDescription);
        setMeta('og:url', 'https://www.dagistankaradeniz.com/');
        setMeta('og:type', 'website');
        setMeta('og:image', defaultOgImage);
        setMeta('twitter:title', 'Dağıstan Karadeniz — Computer Scientist & Software Engineer');
        setMeta('twitter:description', defaultDescription);
        setMeta('twitter:url', 'https://www.dagistankaradeniz.com/');
        setMeta('twitter:image', defaultOgImage);

        var canonical = document.querySelector('link[rel="canonical"]');
        if (canonical) canonical.setAttribute('href', 'https://www.dagistankaradeniz.com/');

        removeJsonLd();
    }

    function removeJsonLd() {
        if (jsonLdScript && jsonLdScript.parentNode) {
            jsonLdScript.parentNode.removeChild(jsonLdScript);
            jsonLdScript = null;
        }
        var old = document.querySelectorAll('.seo-jsonld-post');
        for (var i = 0; i < old.length; i++) old[i].parentNode.removeChild(old[i]);
    }

    /* ----------------------------------------------------------
     *  URL routing via hash — #post=<filename-stem>
     * ---------------------------------------------------------- */
    function postStemFromFilename(filename) {
        return filename.replace(/\.md$/, '');
    }

    function filenameFromStem(stem) {
        return stem + '.md';
    }

    function readHashPost() {
        var hash = window.location.hash;
        var m = hash.match(/^#post=(.+)$/);
        return m ? decodeURIComponent(m[1]) : null;
    }

    function navigateToPost(stem) {
        window.location.hash = '#post=' + encodeURIComponent(stem);
    }

    function clearPostHash() {
        if (window.location.hash) {
            history.pushState('', '', window.location.pathname + window.location.search);
        }
    }

    function handleHashChange() {
        var stem = readHashPost();
        if (stem) {
            var filename = filenameFromStem(stem);
            var exists = allPosts.some(function (p) { return p.filename === filename; });
            if (exists) {
                openPost(filename, true);   // true = don't push hash again
            }
        } else {
            closeModal(true);              // true = don't reset hash
        }
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
        if (isNaN(d.getTime())) return escapeHtml(str);
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

    // Wire up horizontal scroll arrows for a single post's tag strip.
    function setupTagsScroll(row) {
        var scroll = row.querySelector('.post-tags-scroll');
        var left = row.querySelector('.post-tags-arrow-left');
        var right = row.querySelector('.post-tags-arrow-right');
        if (!scroll || !left || !right) return;

        function update() {
            left.classList.toggle('hidden', scroll.scrollLeft <= 0);
            right.classList.toggle('hidden',
                scroll.scrollLeft + scroll.clientWidth >= scroll.scrollWidth - 1);
        }

        var STEP = 120;
        left.addEventListener('click', function (e) {
            e.stopPropagation();
            scroll.scrollBy({ left: -STEP, behavior: 'smooth' });
        });
        right.addEventListener('click', function (e) {
            e.stopPropagation();
            scroll.scrollBy({ left: STEP, behavior: 'smooth' });
        });
        scroll.addEventListener('scroll', update);
        requestAnimationFrame(update);
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
            html += '<td class="post-cell">';
            html += '<span class="post-title-text">' + escapeHtml(post.title || post.filename) + '</span>';
            html += '<div class="post-meta-row">';
            html += '<span class="post-date-text">' + (post.date ? formatDate(post.date) : '') + '</span>';
            if (post.tags && post.tags.length) {
                html += '<div class="post-tags-row">';
                html += '<button class="post-tags-arrow post-tags-arrow-left hidden" aria-label="Scroll tags left">&#8249;</button>';
                html += '<div class="post-tags-scroll">' + tagsHtml(post.tags.slice(0, 5)) + '</div>';
                html += '<button class="post-tags-arrow post-tags-arrow-right hidden" aria-label="Scroll tags right">&#8250;</button>';
                html += '</div>';
            }
            html += '</div>';
            html += '</td>';
            html += '</tr>';
        });

        tbody.innerHTML = html;

        Array.prototype.forEach.call(tbody.querySelectorAll('.post-row'), function (row) {
            row.addEventListener('click', function () {
                openPost(this.getAttribute('data-filename'));
            });
            setupTagsScroll(row);
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

    function openPost(filename, skipHash) {
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
                    if (!window.DOMPurify) {
                        content.textContent = '[Post could not be rendered safely.]';
                        return;
                    }
                    content.innerHTML = window.DOMPurify.sanitize(window.marked.parse(parsed.body));
                } else {
                    content.innerHTML = '<pre class="post-raw">' + escapeHtml(parsed.body) + '</pre>';
                }

                // Convert ```mermaid fenced blocks into <pre class="mermaid"> so Mermaid
                // can render them, and keep them out of the Highlight.js pass.
                content.querySelectorAll('code.language-mermaid').forEach(function (block) {
                    var pre = block.parentElement;
                    var holder = document.createElement('pre');
                    holder.className = 'mermaid';
                    holder.textContent = block.textContent;
                    if (pre && pre.parentElement) {
                        pre.parentElement.replaceChild(holder, pre);
                    }
                });

                if (window.hljs) {
                    content.querySelectorAll('pre code').forEach(function (block) {
                        window.hljs.highlightElement(block);
                        var pre = block.parentElement;
                        if (!pre || pre.classList.contains('hljs-label-added')) return;
                        pre.classList.add('hljs-label-added');
                        var lang = '';
                        Array.prototype.forEach.call(block.classList, function (cls) {
                            if (cls.indexOf('language-') === 0) {
                                lang = cls.substring(9);
                            }
                        });
                        if (!lang) lang = 'text';
                        var header = document.createElement('div');
                        header.className = 'code-header';
                        pre.style.position = 'relative';
                        pre.appendChild(header);

                        var label = document.createElement('span');
                        label.className = 'code-lang-label';
                        label.textContent = lang;
                        header.appendChild(label);

                        var copyBtn = document.createElement('button');
                        copyBtn.className = 'code-copy-btn';
                        copyBtn.setAttribute('aria-label', 'Copy code');
                        copyBtn.textContent = '📋';
                        header.appendChild(copyBtn);
                        copyBtn.addEventListener('click', function (e) {
                            e.stopPropagation();
                            var code = block.textContent;
                            function done() {
                                copyBtn.textContent = '✅';
                                setTimeout(function () { copyBtn.textContent = '📋'; }, 1500);
                            }
                            if (navigator.clipboard && navigator.clipboard.writeText) {
                                navigator.clipboard.writeText(code).then(done);
                            } else {
                                var ta = document.createElement('textarea');
                                ta.value = code;
                                ta.style.position = 'fixed';
                                ta.style.left = '-9999px';
                                document.body.appendChild(ta);
                                ta.select();
                                document.execCommand('copy');
                                document.body.removeChild(ta);
                                done();
                            }
                        });
                    });
                }

                content.querySelectorAll('pre code').forEach(function (block) {
                    var pre = block.parentElement;
                    if (!pre || pre.classList.contains('code-collapsible-added')) return;
                    pre.classList.add('code-collapsible-added');
                    var btn = document.createElement('button');
                    btn.className = 'code-toggle-btn';
                    btn.innerHTML = '<span class="toggle-text">Show code</span><span class="toggle-icon">▼</span>';
                    pre.insertAdjacentElement('afterend', btn);
                    btn.addEventListener('click', function () {
                        var expanded = pre.classList.toggle('expanded');
                        btn.querySelector('.toggle-text').textContent = expanded ? 'Hide code' : 'Show code';
                    });
                });

                if (window.mermaid) {
                    var diagrams = content.querySelectorAll('pre.mermaid');
                    if (diagrams.length) {
                        try {
                            window.mermaid.run({ nodes: diagrams });
                        } catch (e) {
                            console.error('Mermaid render failed', e);
                        }
                    }
                }

                var modal = document.getElementById('post-modal');
                modal.style.display = 'flex';
                document.getElementById('post-modal-content').scrollTop = 0;
                document.body.style.overflow = 'hidden';

                // SEO: update URL hash and meta tags
                if (!skipHash) {
                    navigateToPost(postStemFromFilename(filename));
                }
                setPostMeta({ title: parsed.title, filename: filename, date: parsed.date, tags: parsed.tags });
            })
            .catch(function (err) {
                console.error('Failed to load post', filename, err);
            });
    }

    function closeModal(skipHash) {
        document.getElementById('post-modal').style.display = 'none';
        document.body.style.overflow = '';
        resetMeta();
        if (!skipHash) clearPostHash();
    }

    var diagramZoomState = { scale: 1, x: 0, y: 0 };

    function openDiagramZoom(svg) {
        var modal = document.getElementById('diagram-zoom-modal');
        var body = document.getElementById('diagram-zoom-body');
        body.innerHTML = '';
        var clone = svg.cloneNode(true);
        clone.removeAttribute('style');
        clone.style.maxWidth = '100%';
        clone.style.maxHeight = '100%';
        body.appendChild(clone);

        diagramZoomState.scale = 1;
        diagramZoomState.x = 0;
        diagramZoomState.y = 0;
        applyZoomTransform(clone);
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';

        var hint = document.createElement('div');
        hint.className = 'zoom-hint';
        hint.textContent = 'scroll to zoom · drag to pan';
        body.appendChild(hint);

        var isPanning = false, startX, startY;

        body._wheelHandler = function (e) {
            e.preventDefault();
            var delta = e.deltaY > 0 ? 0.9 : 1.1;
            diagramZoomState.scale = Math.min(10, Math.max(0.2, diagramZoomState.scale * delta));
            applyZoomTransform(clone);
        };
        body._mousedownHandler = function (e) {
            if (e.target !== clone && !clone.contains(e.target)) return;
            isPanning = true;
            startX = e.clientX - diagramZoomState.x;
            startY = e.clientY - diagramZoomState.y;
            body.style.cursor = 'grabbing';
        };
        body._mousemoveHandler = function (e) {
            if (!isPanning) return;
            diagramZoomState.x = e.clientX - startX;
            diagramZoomState.y = e.clientY - startY;
            applyZoomTransform(clone);
        };
        body._mouseupHandler = function () {
            isPanning = false;
            body.style.cursor = '';
        };

        body.addEventListener('wheel', body._wheelHandler, { passive: false });
        body.addEventListener('mousedown', body._mousedownHandler);
        window.addEventListener('mousemove', body._mousemoveHandler);
        window.addEventListener('mouseup', body._mouseupHandler);
    }

    function applyZoomTransform(el) {
        el.style.transform = 'translate(' + diagramZoomState.x + 'px, ' + diagramZoomState.y + 'px) scale(' + diagramZoomState.scale + ')';
    }

    function closeDiagramZoom() {
        var modal = document.getElementById('diagram-zoom-modal');
        var body = document.getElementById('diagram-zoom-body');
        modal.classList.remove('active');
        document.body.style.overflow = '';
        if (body._wheelHandler) body.removeEventListener('wheel', body._wheelHandler);
        if (body._mousedownHandler) body.removeEventListener('mousedown', body._mousedownHandler);
        if (body._mousemoveHandler) window.removeEventListener('mousemove', body._mousemoveHandler);
        if (body._mouseupHandler) window.removeEventListener('mouseup', body._mouseupHandler);
        body.innerHTML = '';
    }

    function wrapMermaidDiagram(pre) {
        if (pre.dataset.zoomReady) return;
        var svg = pre.querySelector('svg');
        if (!svg) return;
        pre.dataset.zoomReady = 'true';
        var wrapper = document.createElement('div');
        wrapper.className = 'mermaid-wrapper';
        pre.parentNode.insertBefore(wrapper, pre);
        wrapper.appendChild(pre);
        wrapper.addEventListener('click', function (e) {
            e.stopPropagation();
            openDiagramZoom(svg);
        });
    }

    function initMermaidZoomObserver() {
        var zoomModal = document.getElementById('diagram-zoom-modal');
        var observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                mutation.addedNodes.forEach(function (node) {
                    if (node.nodeType !== 1) return;
                    if (zoomModal && zoomModal.contains(node)) return;
                    var pre;
                    if (node.tagName === 'svg' && (pre = node.closest('pre.mermaid'))) {
                        wrapMermaidDiagram(pre);
                    }
                    if (node.matches && node.matches('pre.mermaid')) {
                        var svg = node.querySelector('svg');
                        if (svg) wrapMermaidDiagram(node);
                    }
                    var nestedPres = node.querySelectorAll && node.querySelectorAll('pre.mermaid');
                    Array.prototype.forEach.call(nestedPres, function (pre) {
                        wrapMermaidDiagram(pre);
                    });
                });
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function init() {
        cacheDefaultMeta();

        var closeBtn = document.getElementById('post-modal-close');
        if (closeBtn) closeBtn.addEventListener('click', function () { closeModal(); });

        var overlay = document.getElementById('post-modal');
        if (overlay) {
            overlay.addEventListener('click', function (e) {
                if (e.target === overlay) closeModal();
            });
        }

        var diagramModal = document.getElementById('diagram-zoom-modal');
        var diagramClose = document.getElementById('diagram-zoom-close');
        if (diagramClose) diagramClose.addEventListener('click', closeDiagramZoom);
        if (diagramModal) {
            diagramModal.addEventListener('click', function (e) {
                if (e.target === diagramModal || e.target === document.getElementById('diagram-zoom-body')) {
                    closeDiagramZoom();
                }
            });
        }

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                if (diagramModal && diagramModal.classList.contains('active')) {
                    closeDiagramZoom();
                } else {
                    closeModal();
                }
            }
        });

        // SEO: listen for hash changes (back/forward browser navigation)
        window.addEventListener('hashchange', handleHashChange);

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

        if (window.mermaid) {
            window.mermaid.initialize({
                startOnLoad: false,
                theme: 'dark',
                securityLevel: 'strict',
                fontFamily: 'inherit'
            });
            initMermaidZoomObserver();
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

                // SEO: open post from URL hash on initial load
                handleHashChange();
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
                        ? '<span>' + escapeHtml(target[i]) + '</span>'
                        : target[i];
                    continue;
                }
                var rnd = chars[Math.floor(Math.random() * chars.length)];
                if (frame >= i * 3) {
                    if (frame >= i * 3 + 2) {
                        locked[i] = true;
                        out += ghostMode ? '<span>' + escapeHtml(target[i]) + '</span>' : target[i];
                    } else {
                        out += ghostMode
                            ? '<span>' + escapeHtml(rnd) + '</span>'
                            : rnd;
                    }
                } else {
                    out += ghostMode
                        ? '<span>' + escapeHtml(rnd) + '</span>'
                        : rnd;
                }
            }
            if (ghostMode) { el.innerHTML = out; } else { el.textContent = out; }
            frame++;
            if (frame <= totalFrames) {
                requestAnimationFrame(tick);
            } else {
                el.textContent = target;
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
