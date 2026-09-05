;(function () {
    'use strict';

    /* ------------------------------------------------------------------
     * WebMCP — expose the site's content to in-browser AI agents via the
     * native `document.modelContext` API (W3C Web Machine Learning CG
     * proposal, origin-trial in Chrome). If the browser does not support
     * the API, this script does nothing and the page behaves as before.
     * ------------------------------------------------------------------ */

    var MANIFEST_URL = 'posts/manifest.json';

    var allPosts = [];
    var manifestLoaded = false;

    var PROFILE = {
        name: 'Dağıstan Karadeniz',
        role: 'Senior Solutions Architect',
        title: 'Computer Scientist & Software Engineer',
        location: 'London, UK',
        company: 'Callsign Ltd.',
        site: 'https://www.dagistankaradeniz.com',
        bio: 'Computer Scientist and Software Engineer. Publishes deep-dive blog posts on Java, ' +
            'Spring, the JVM, security, machine learning / AI, cryptography, and software architecture.',
        social: {
            linkedin: 'https://www.linkedin.com/in/dagistankaradeniz/',
            github: 'https://github.com/dagistankaradeniz',
            huggingface: 'https://huggingface.co/dagistan'
        }
    };

    function loadManifest() {
        if (manifestLoaded) return Promise.resolve(allPosts);
        return fetch(MANIFEST_URL)
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(function (data) {
                allPosts = (data.posts || [])
                    .slice()
                    .sort(function (a, b) {
                        return new Date(b.date || 0) - new Date(a.date || 0);
                    });
                manifestLoaded = true;
                return allPosts;
            })
            .catch(function (err) {
                console.error('[webmcp] failed to load manifest', err);
                return [];
            });
    }

    function postStemFromFilename(filename) {
        return filename.replace(/\.md$/, '');
    }

    function postUrl(filename) {
        return PROFILE.site + '/#post=' + encodeURIComponent(postStemFromFilename(filename));
    }

    function textResult(text) {
        return { content: [{ type: 'text', text: String(text) }] };
    }

    /* Fetch a single post markdown by filename. */
    function fetchPost(filename) {
        return fetch('posts/' + filename)
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.text();
            });
    }

    /* Parse the `---` front-matter head (title/date/tags) out of a post body. */
    function parseFrontmatter(content) {
        var result = { title: '', date: '', tags: [], body: content };
        if (!content || content.indexOf('---') !== 0) return result;
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

    function buildTools() {
        return [
            {
                name: 'get_profile',
                description: 'Get the site owner\'s profile: name, role, location, employer, bio, and social links.',
                inputSchema: { type: 'object', properties: {} },
                execute: function () {
                    return textResult(JSON.stringify(PROFILE, null, 2));
                }
            },
            {
                name: 'get_post_list',
                description: 'List all blog posts with their title, date, and tags. Returns an array (empty if none yet).',
                inputSchema: {
                    type: 'object',
                    properties: {
                        limit: {
                            type: 'integer',
                            description: 'Optional maximum number of posts to return (most recent first).'
                        }
                    }
                },
                execute: function (args) {
                    return loadManifest().then(function (posts) {
                        var limit = args && args.limit ? Math.max(1, Math.floor(args.limit)) : posts.length;
                        var slice = posts.slice(0, limit).map(function (p) {
                            return {
                                title: p.title || null,
                                filename: p.filename,
                                date: p.date || null,
                                tags: p.tags || [],
                                url: postUrl(p.filename)
                            };
                        });
                        return textResult(JSON.stringify({ total: posts.length, posts: slice }, null, 2));
                    });
                }
            },
            {
                name: 'search_posts',
                description: 'Search blog posts by a free-text query against title and tags. Returns matching posts with metadata and their direct URL.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        query: { type: 'string', description: 'Search text to match against post titles and tags.' }
                    },
                    required: ['query']
                },
                execute: function (args) {
                    var q = (args && args.query || '').trim().toLowerCase();
                    return loadManifest().then(function (posts) {
                        if (!q) {
                            return textResult(JSON.stringify({ query: q, matches: [] }, null, 2));
                        }
                        var matches = posts.filter(function (p) {
                            var haystack = ((p.title || '') + ' ' + (p.tags || []).join(' ')).toLowerCase();
                            return q.split(/\s+/).every(function (term) { return haystack.indexOf(term) !== -1; });
                        });
                        return textResult(JSON.stringify({
                            query: q,
                            matches: matches.map(function (p) {
                                return {
                                    title: p.title || null,
                                    filename: p.filename,
                                    date: p.date || null,
                                    tags: p.tags || [],
                                    url: postUrl(p.filename)
                                };
                            })
                        }, null, 2));
                    });
                }
            },
            {
                name: 'get_post',
                description: 'Get the full markdown body of a blog post by filename (e.g. "jvm-architecture-heap-stack-gc.md") or by its URL stem (e.g. "jvm-architecture-heap-stack-gc").',
                inputSchema: {
                    type: 'object',
                    properties: {
                        filename: { type: 'string', description: 'Filename or URL stem of the post to fetch.' }
                    },
                    required: ['filename']
                },
                execute: function (args) {
                    var name = args && args.filename ? String(args.filename).trim() : '';
                    var filename = name.indexOf('.md') === -1 ? name + '.md' : name;
                    return fetchPost(filename)
                        .then(function (raw) {
                            var parsed = parseFrontmatter(raw);
                            return textResult(JSON.stringify({
                                title: parsed.title || filename,
                                filename: filename,
                                date: parsed.date || null,
                                tags: parsed.tags || [],
                                url: postUrl(filename),
                                content: parsed.body
                            }, null, 2));
                        })
                        .catch(function () {
                            return textResult(JSON.stringify({ error: 'Post not found: ' + filename }));
                        });
                }
            }
        ];
    }

    function init() {
        var api = (typeof document !== 'undefined' && document.modelContext) ||
                  (typeof navigator !== 'undefined' && navigator.modelContext);
        if (!api || typeof api.provideContext !== 'function') {
            // Browser does not support WebMCP — silently no-op.
            return;
        }
        try {
            api.provideContext({ tools: buildTools() });
        } catch (err) {
            console.error('[webmcp] failed to register tools', err);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}());
