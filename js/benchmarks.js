;(function () {
    'use strict';

    /* ------------------------------------------------------------------
     * Coding agent benchmark scores.
     *
     * Data source: BenchLM's public, documented JSON endpoint. BenchLM
     * publishes its aggregated dataset under CC BY-NC 4.0 — "You may
     * reproduce tables, scores, and charts in articles, papers, and
     * research for non-commercial use, with attribution. Commercial use —
     * including redistributing the dataset or building a product on it —
     * requires a license from us." This site is a personal, non-monetised
     * site with no advertising, affiliate links or paid placements, which
     * is what keeps it inside the non-commercial term. If the site is ever
     * monetised or used in a company/product context, this section has to
     * come out or be relicensed.
     *
     * Their terms also permit "read, link to, quote with attribution, and
     * use published downloads under any license stated with that data", and
     * forbid misrepresenting their results or removing attribution.
     *
     * Two things deliberately are NOT done here:
     *   1. No scraping of the rendered leaderboard HTML, and no iframe of
     *      their widget — they send `x-frame-options: SAMEORIGIN` and
     *      `frame-ancestors 'self'`, so framing it here would be blocked.
     *   2. No hardcoded score snapshots. A stale copy is a misrepresentation
     *      of their results, so the numbers are read at page load and always
     *      carry the source's own `lastUpdated` date.
     *
     * BenchLM aggregates and re-normalises results published by the original
     * benchmark authors; the composite is theirs, not a raw score from any
     * single benchmark. That distinction is stated in the note below the
     * table rather than left implied, and the underlying results remain
     * subject to their original publishers' own terms.
     * ------------------------------------------------------------------ */

    var API = 'https://benchlm.ai/api/data/leaderboard';
    var ROW_LIMIT = 12;

    var CATEGORIES = [
        { key: '',           label: 'Overall' },
        { key: 'coding',     label: 'Coding' },
        { key: 'agentic',    label: 'Agentic' }
    ];

    var EVIDENCE = {
        supported: 'Supported',
        provisional: 'Provisional',
        estimated: 'Estimated',
        reported: 'Reported'
    };

    var tbody = null;
    var filtersEl = null;
    var noteEl = null;
    var captionEl = null;
    var activeCategory = '';
    var rows = [];
    var snapshotDate = null;

    function escapeHtml(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function num(value, digits) {
        if (typeof value !== 'number' || !isFinite(value)) return '—';
        return value.toFixed(digits == null ? 2 : digits);
    }

    function price(perMillion) {
        if (typeof perMillion !== 'number' || !isFinite(perMillion) || perMillion <= 0) return '—';
        return '$' + num(perMillion, perMillion < 1 ? 3 : 2);
    }

    function evidenceLabel(row) {
        var map = row.categoryEvidence || {};
        var key = activeCategory ? map[activeCategory] : row.evidenceStatus;
        return EVIDENCE[key] || 'Unverified';
    }

    function currentScore(row) {
        if (!activeCategory) return row.overallScore;
        return (row.categoryScores || {})[activeCategory];
    }

    function renderFilters() {
        if (!filtersEl) return;
        var html = '';
        CATEGORIES.forEach(function (c) {
            html += '<button class="posts-filter-tag' + (c.key === activeCategory ? ' active' : '') +
                '" type="button" data-category="' + c.key + '">' + escapeHtml(c.label) + '</button>';
        });
        filtersEl.innerHTML = html;

        Array.prototype.forEach.call(filtersEl.querySelectorAll('.posts-filter-tag'), function (btn) {
            btn.addEventListener('click', function () {
                activeCategory = this.getAttribute('data-category');
                load();
            });
        });
    }

    function renderTable() {
        if (!tbody) return;

        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="posts-empty">No data returned for this category.</td></tr>';
            return;
        }

        var html = '';
        rows.forEach(function (row, i) {
            var ci = row.interval90 || {};
            html += '<tr>';
            html += '<td class="bench-rank">' + (i + 1) + '</td>';
            html += '<td class="bench-model">' + escapeHtml(row.model) + '</td>';
            html += '<td class="bench-creator">' + escapeHtml(row.creator) + '</td>';
            html += '<td class="bench-score">' + num(currentScore(row)) + '</td>';
            html += '<td class="bench-ci">' + num(ci.lower, 1) + ' – ' + num(ci.upper, 1) + '</td>';
            html += '<td class="bench-evidence">' + escapeHtml(evidenceLabel(row)) + '</td>';
            html += '<td class="bench-price">' + price(row.inputPrice) + ' / ' + price(row.outputPrice) + '</td>';
            html += '</tr>';
        });
        tbody.innerHTML = html;
    }

    function renderNote() {
        if (!noteEl) return;
        var date = snapshotDate
            ? 'Retrieved ' + escapeHtml(snapshotDate) + ' via their documented JSON endpoint at page load, not scraped from their page.'
            : 'Read live from their documented JSON endpoint at page load, not scraped from their page. The request did not complete, so no figures are shown here.';
        noteEl.innerHTML =
            'Source: <a href="https://benchlm.ai" target="_blank" rel="noopener noreferrer">BenchLM.ai</a> ' +
            '(<a href="https://benchlm.ai/data" target="_blank" rel="noopener noreferrer">licence and methodology</a>, ' +
            'CC BY-NC 4.0 &mdash; reproduced here for non-commercial use on this personal site). ' +
            date + ' ' +
            'BenchLM aggregates, normalises and verifies results published by the original benchmark authors, so a composite ' +
            'score is their normalisation rather than a raw result from any single benchmark; the underlying results remain ' +
            'subject to their original publishers&rsquo; own terms. Prices are per million tokens and change. ' +
            'Not affiliated with or endorsed by any source linked here.<br>' +
            'Live leaderboards to read directly: ' +
            '<a href="https://livebench.ai/#/?cats=Coding%2CAgentic%20Coding" target="_blank" rel="noopener noreferrer">LiveBench</a> ' +
            '(contamination-free; questions, answers and scoring code open source under Apache-2.0) &middot; ' +
            '<a href="https://artificialanalysis.ai/agents/coding-agents" target="_blank" rel="noopener noreferrer">Artificial Analysis</a> ' +
            '&middot; <a href="https://benchlm.ai/compare" target="_blank" rel="noopener noreferrer">BenchLM compare</a>.';
    }

    function setCaption() {
        if (!captionEl) return;
        var label = 'Overall';
        CATEGORIES.forEach(function (c) { if (c.key === activeCategory) label = c.label; });
        captionEl.textContent = label +
            ' — normalised 0–100 composite score, higher is better. Intervals are the source’s 90% confidence range.';
    }

    function setLoading() {
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="7" class="posts-loading">Loading benchmark data…</td></tr>';
        }
    }

    function setError() {
        if (!tbody) return;
        var html = '<tr><td colspan="7" class="posts-empty">Could not load benchmark data. ' +
            'Read the live leaderboards instead: ' +
            '<a href="https://benchlm.ai" target="_blank" rel="noopener noreferrer">BenchLM.ai</a> &middot; ' +
            '<a href="https://livebench.ai/#/?cats=Coding%2CAgentic%20Coding" target="_blank" rel="noopener noreferrer">LiveBench</a> &middot; ' +
            '<a href="https://artificialanalysis.ai/agents/coding-agents" target="_blank" rel="noopener noreferrer">Artificial Analysis</a>' +
            '</td></tr>';
        tbody.innerHTML = html;
    }

    function load() {
        renderFilters();
        setCaption();
        setLoading();

        var url = API + '?limit=' + ROW_LIMIT;
        if (activeCategory) url += '&category=' + encodeURIComponent(activeCategory);

        fetch(url, { mode: 'cors', credentials: 'omit' })
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(function (data) {
                rows = (data && data.models) || [];
                snapshotDate = (data && data.lastUpdated) || null;
                renderTable();
                renderNote();
            })
            .catch(function (err) {
                if (window.console && console.warn) console.warn('[benchmarks] load failed', err);
                setError();
            });
    }

    function init() {
        tbody = document.getElementById('bench-tbody');
        filtersEl = document.getElementById('bench-source-filters');
        noteEl = document.getElementById('bench-note');
        captionEl = document.getElementById('bench-caption');
        if (!tbody) return;
        // Attribution and methodology must be on the page even if the fetch
        // fails, so render the note before requesting anything.
        renderNote();
        load();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

}());
