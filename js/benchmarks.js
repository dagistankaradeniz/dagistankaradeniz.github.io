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
            var score = currentScore(row);
            var scorable = typeof score === 'number' && isFinite(score);
            var pct = scorable ? Math.max(0, Math.min(100, score)) : 0;
            html += '<tr>';
            html += '<td class="bench-rank">' + (i + 1) + '</td>';
            html += '<td class="bench-model">' + escapeHtml(row.model) + '</td>';
            html += '<td class="bench-creator">' + escapeHtml(row.creator) + '</td>';
            // data-value carries the raw number so the count-up can animate to
            // the exact figure; the text is the real value up front, so a JS
            // failure leaves a correct (if unanimated) table rather than a
            // table of zeroes.
            html += '<td class="bench-score">';
            html += '<span class="bench-score-val" data-value="' + (scorable ? score : '') + '" data-decimals="2">' +
                num(score) + '</span>';
            if (scorable) {
                html += '<span class="bench-bar" aria-hidden="true">' +
                    '<span class="bench-bar-fill" style="width:' + pct.toFixed(2) + '%"></span></span>';
            }
            html += '</td>';
            html += '<td class="bench-ci">' + num(ci.lower, 1) + ' – ' + num(ci.upper, 1) + '</td>';
            html += '<td class="bench-evidence">' + escapeHtml(evidenceLabel(row)) + '</td>';
            html += '<td class="bench-price">' + price(row.inputPrice) + ' / ' + price(row.outputPrice) + '</td>';
            html += '</tr>';
        });
        tbody.innerHTML = html;

        animateRows();
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

    /* ------------------------------------------------------------------
     * Reveal animation. Runs once per rendered table, on first scroll into
     * view, or immediately if the section is already on screen (e.g. the
     * reader filtered a category while looking at it).
     *
     * Everything is driven from a single requestAnimationFrame loop so the
     * count-up and the bar stay exactly in step. The pre-animation state is
     * only applied once we know we are going to animate — if the section
     * never scrolls into view, or JS throws, the table keeps its real values.
     * ------------------------------------------------------------------ */

    var REDUCED = window.matchMedia
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;

    function motionAllowed() {
        return !(REDUCED && REDUCED.matches);
    }

    function easeOutExpo(t) {
        return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    }

    function countUp(el, target, decimals, delay, duration) {
        var start = null;

        function step(now) {
            if (start === null) start = now;
            var elapsed = now - start - delay;
            if (elapsed < 0) {
                requestAnimationFrame(step);
                return;
            }
            var t = Math.min(1, elapsed / duration);
            var eased = easeOutExpo(t);
            el.textContent = (target * eased).toFixed(decimals);
            if (t < 1) {
                requestAnimationFrame(step);
            } else {
                el.textContent = target.toFixed(decimals);
            }
        }

        requestAnimationFrame(step);
    }

    function animateRows() {
        if (!tbody || !rows.length) return;
        var trs = tbody.querySelectorAll('tr');
        if (!trs.length) return;

        if (!motionAllowed()) return;

        // Swap the table into its pre-animation state only now that we are
        // committed to animating.
        tbody.classList.add('bench-anim');
        var cells = [];
        Array.prototype.forEach.call(trs, function (tr) {
            var valEl = tr.querySelector('.bench-score-val');
            var fillEl = tr.querySelector('.bench-bar-fill');
            var raw = valEl && valEl.getAttribute('data-value');
            var parsed = (raw === '' || raw == null) ? NaN : parseFloat(raw);
            var decimals = valEl ? (parseInt(valEl.getAttribute('data-decimals'), 10) || 0) : 0;

            cells.push({
                tr: tr,
                valEl: valEl,
                fillEl: fillEl,
                target: isFinite(parsed) ? parsed : null,
                decimals: decimals
            });

            if (valEl && isFinite(parsed)) valEl.textContent = (0).toFixed(decimals);
            if (fillEl) fillEl.style.width = '0%';
        });

        var ROW_STAGGER = 45;
        var DURATION = 850;

        // Safety net: whatever happens during the animation, the table must
        // end up visible. Dropping the pre-animation class forces that.
        function settle() {
            tbody.classList.remove('bench-anim');
        }

        function run() {
            cells.forEach(function (cell, i) {
                var delay = i * ROW_STAGGER;
                if (cell.target !== null && cell.valEl) {
                    countUp(cell.valEl, cell.target, cell.decimals, delay, DURATION);
                }
                if (cell.fillEl && cell.target !== null) {
                    var pct = Math.max(0, Math.min(100, cell.target));
                    cell.fillEl.style.transition = 'width ' + DURATION + 'ms cubic-bezier(0.16, 1, 0.3, 1) ' + delay + 'ms';
                    cell.fillEl.style.width = pct.toFixed(2) + '%';
                }
                setTimeout(function () {
                    cell.tr.classList.add('bench-row-in');
                }, delay);
            });
            setTimeout(settle, cells.length * ROW_STAGGER + DURATION + 400);
        }

        // Fire immediately when the section is already in view, otherwise
        // wait for it to scroll in.
        var wrap = document.querySelector('#fh5co-benchmarks .bench-table-wrap');
        if (!wrap) { run(); return; }
        var rect = wrap.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) { run(); return; }

        if (typeof IntersectionObserver !== 'function') { run(); return; }
        var io = new IntersectionObserver(function (entries) {
            for (var i = 0; i < entries.length; i++) {
                if (entries[i].isIntersecting) {
                    io.disconnect();
                    run();
                    return;
                }
            }
        }, { threshold: 0.15 });
        io.observe(wrap);
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
