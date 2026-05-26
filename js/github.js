;(function () {
    'use strict';

    var REPOS_PER_PAGE = 5;
    var currentPage = 1;
    var allRepos = [];
    var filteredRepos = [];
    var activeLangs = {};
    var searchQuery = '';
    var langsEl = null;
    var arrowLeft = null;
    var arrowRight = null;

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatDate(str) {
        if (!str) return '';
        var d = new Date(str);
        if (isNaN(d.getTime())) return str;
        return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
    }

    function updateArrows() {
        if (!langsEl || !arrowLeft || !arrowRight) return;
        arrowLeft.classList.toggle('hidden', langsEl.scrollLeft <= 0);
        arrowRight.classList.toggle('hidden',
            langsEl.scrollLeft + langsEl.clientWidth >= langsEl.scrollWidth - 1);
    }

    function applyFilters() {
        currentPage = 1;
        var langs = Object.keys(activeLangs);
        filteredRepos = allRepos.filter(function (repo) {
            var matchesSearch = !searchQuery ||
                (repo.name || '').toLowerCase().indexOf(searchQuery) !== -1 ||
                (repo.description || '').toLowerCase().indexOf(searchQuery) !== -1;
            var matchesLang = !langs.length || (repo.language && activeLangs[repo.language]);
            return matchesSearch && matchesLang;
        });
    }

    function renderLangFilters() {
        var el = document.getElementById('github-lang-filters');
        if (!el) return;

        var seen = {};
        var langs = [];
        allRepos.forEach(function (repo) {
            if (repo.language && !seen[repo.language]) {
                seen[repo.language] = true;
                langs.push(repo.language);
            }
        });

        var hasActive = Object.keys(activeLangs).length > 0;
        var html = '<button class="posts-filter-tag' + (!hasActive ? ' active' : '') + '" data-lang="">All</button>';
        langs.forEach(function (l) {
            html += '<button class="posts-filter-tag' + (activeLangs[l] ? ' active' : '') + '" data-lang="' + escapeHtml(l) + '">' + escapeHtml(l) + '</button>';
        });
        el.innerHTML = html;

        Array.prototype.forEach.call(el.querySelectorAll('.posts-filter-tag'), function (btn) {
            btn.addEventListener('click', function () {
                var lang = this.getAttribute('data-lang');
                if (lang === '') {
                    activeLangs = {};
                } else if (activeLangs[lang]) {
                    delete activeLangs[lang];
                } else {
                    activeLangs[lang] = true;
                }
                applyFilters();
                renderLangFilters();
                renderTable();
                renderPagination();
            });
        });

        requestAnimationFrame(updateArrows);
    }

    function renderTable() {
        var tbody = document.getElementById('github-repos-tbody');
        if (!tbody) return;

        if (!filteredRepos.length) {
            var msg = allRepos.length ? 'No repos match your filter.' : 'No repos found.';
            tbody.innerHTML = '<tr><td colspan="2" class="posts-empty">' + msg + '</td></tr>';
            return;
        }

        var start = (currentPage - 1) * REPOS_PER_PAGE;
        var slice = filteredRepos.slice(start, start + REPOS_PER_PAGE);
        var html = '';

        slice.forEach(function (repo) {
            var url = 'https://github.com/dagistankaradeniz/' + encodeURIComponent(repo.name);
            html += '<tr class="post-row" data-url="' + escapeHtml(url) + '">';
            html += '<td class="post-title-cell">';
            html += '<span class="post-title-text">' + escapeHtml(repo.name) + '</span>';
            if (repo.description) {
                html += '<span class="github-repo-desc">' + escapeHtml(repo.description) + '</span>';
            }
            html += '<span class="post-date-text">Updated ' + formatDate(repo.updated_at) + '</span>';
            html += '</td>';
            html += '<td class="post-tags-cell">';
            if (repo.stargazers_count > 0) {
                html += '<span class="github-repo-stars">&#9733; ' + repo.stargazers_count + '</span>';
            }
            if (repo.language) {
                html += '<span class="post-tag github-lang-tag">' + escapeHtml(repo.language) + '</span>';
            }
            html += '</td>';
            html += '</tr>';
        });

        tbody.innerHTML = html;

        Array.prototype.forEach.call(tbody.querySelectorAll('.post-row'), function (row) {
            row.addEventListener('click', function () {
                window.open(this.getAttribute('data-url'), '_blank', 'noopener,noreferrer');
            });
        });
    }

    function renderPagination() {
        var el = document.getElementById('github-repos-pagination');
        if (!el) return;
        var total = Math.ceil(filteredRepos.length / REPOS_PER_PAGE);
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

    function initContribChart() {
        var EMPTY_CELL   = '#ebedf0';
        var DARK_EMPTY   = '#1a2130';
        var BRIGHT_GREEN = '39D353';
        var container = document.getElementById('github-contrib-svg');
        if (!container) return;

        fetch('https://ghchart.rshah.org/' + BRIGHT_GREEN + '/dagistankaradeniz')
            .then(function (res) { return res.text(); })
            .then(function (svg) {
                svg = svg.replace(new RegExp(EMPTY_CELL, 'gi'), DARK_EMPTY);
                container.innerHTML = svg;
                var el = container.querySelector('svg');
                if (el) {
                    el.style.width  = '100%';
                    el.style.height = 'auto';
                    el.querySelectorAll('text').forEach(function (t) {
                        var fs = parseFloat(t.getAttribute('font-size')) || 9;
                        t.setAttribute('font-size', fs * 2);
                    });
                }
            })
            .catch(function () {
                container.innerHTML =
                    '<img src="https://ghchart.rshah.org/' + BRIGHT_GREEN +
                    '/dagistankaradeniz" style="max-width:100%;height:auto;">';
            });
    }

    function init() {
        var searchInput = document.getElementById('github-search');
        if (searchInput) {
            searchInput.addEventListener('input', function () {
                searchQuery = this.value.trim().toLowerCase();
                applyFilters();
                renderTable();
                renderPagination();
            });
        }

        langsEl    = document.getElementById('github-lang-filters');
        arrowLeft  = document.getElementById('github-arrow-left');
        arrowRight = document.getElementById('github-arrow-right');

        if (arrowLeft) {
            arrowLeft.addEventListener('click', function () {
                langsEl.scrollBy({ left: -160, behavior: 'smooth' });
            });
        }
        if (arrowRight) {
            arrowRight.addEventListener('click', function () {
                langsEl.scrollBy({ left: 160, behavior: 'smooth' });
            });
        }
        if (langsEl) {
            langsEl.addEventListener('scroll', updateArrows);
        }

        initContribChart();

        fetch('https://api.github.com/users/dagistankaradeniz/repos?sort=updated&direction=desc&per_page=100')
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(function (data) {
                var EXCLUDED = ['dagistankaradeniz.github.io', 'dagistankaradeniz'];
                allRepos = (data || []).filter(function (r) {
                    return !r.fork && EXCLUDED.indexOf(r.name) === -1;
                });
                applyFilters();
                renderLangFilters();
                renderTable();
                renderPagination();
            })
            .catch(function () {
                var tbody = document.getElementById('github-repos-tbody');
                if (tbody) tbody.innerHTML = '<tr><td colspan="2" class="posts-empty">Could not load repos.</td></tr>';
            });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

}());
