//Don't want to call these, but it breaks IE9, so welp
window.history.pushState = window.history.replaceState = function () {};

var tape = require('tape');
var test = tape;

tape.Test.prototype.strictEqual = function () {
    this.equal.apply(this, arguments);
};

var AmpHistory = require('../ampersand-history');
var AmpRouter = require('../ampersand-router');
var AmpHistoryConstructor = AmpHistory.constructor;

function module(moduleName, opts) {
    test = function (name, n, cb) {
        if (!cb && typeof n === 'function') {
            cb = n;
            n = null;
        }

        tape(moduleName + ': ' + name, function (t) {
            if (opts.setup) opts.setup();
            if (n) t.plan(n);
            cb(t);
            if (opts.teardown) opts.teardown();
            if (!n) t.end();
        });
    };
    test.only = function (name, n, cb) {
        tape.only(moduleName + ': ' + name, function (t) {
            if (opts.setup) opts.setup();
            if (n) t.plan(n);
            cb(t);
            if (opts.teardown) opts.teardown();
            if (!n) t.end();
        });
    };
}

function restartHistoryWithoutPushState() {
    AmpHistory.stop();
    AmpHistory.start({pushState: false});
}

(function () {
    var bind = require('lodash.bind');
    var extend = require('lodash.assign');
    var each = require('lodash.foreach');
    var pick = require('lodash.pick');

    var router = null;
    var location = null;
    var lastRoute = null;
    var lastArgs = [];

    var onRoute = function (router, route, args) {
        lastRoute = route;
        lastArgs = args;
    };

    var Location = function (href) {
        this.replace(href);
    };

    extend(Location.prototype, {
        parser: document.createElement('a'),

        replace: function (href) {
            this.parser.href = href;

            extend(this, pick(this.parser,
                'href',
                'hash',
                'host',
                'search',
                'fragment',
                'pathname',
                'protocol'
            ));
            // In IE, anchor.pathname does not contain a leading slash though
            // window.location.pathname does.
            if (!/^\//.test(this.pathname)) this.pathname = '/' + this.pathname;
        },

        toString: function () {
            return this.href;
        }
    });

    module("Router", {
        setup: function () {
            location = new Location('http://example.com');
            history.location = location;
            AmpHistory = extend(new AmpHistoryConstructor(), {location: location});
            router = new Router({testing: 101, history: AmpHistory});
            AmpHistory.interval = 9;
            AmpHistory.start();
            lastRoute = null;
            lastArgs = [];
            AmpHistory.on('route', onRoute);
        },

        teardown: function () {
            AmpHistory.stop();
            AmpHistory.off('route', onRoute);
        }
    });

    var ExternalObject = {
        value: 'unset',

        routingFunction: function (value) {
            this.value = value;
        }
    };
    ExternalObject.routingFunction = bind(ExternalObject.routingFunction, ExternalObject);

    var Router = AmpRouter.extend({

        count: 0,

        routes: {
            "noCallback": "noCallback",
            "counter": "counter",
            "search/:query": "search",
            "search/:query/p:page": "search",
            "charñ": "charUTF",
            "char%C3%B1": "charEscaped",
            "contacts": "contacts",
            "contacts/new": "newContact",
            "contacts/:id": "loadContact",
            "route-event/:arg": "routeEvent",
            "optional(/:item)": "optionalItem",
            "named/optional/(y:z)": "namedOptional",
            "splat/*args/end": "splat",
            ":repo/compare/*from...*to": "github",
            "decode/:named/*splat": "decode",
            "*first/complex-*part/*rest": "complex",
            "query/:entity": "query",
            "function/:value": ExternalObject.routingFunction,
            "*anything": "anything"
        },

        initialize: function (options) {
            this.testing = options.testing;
            this.route('implicit', 'implicit');
        },

        counter: function () {
            this.count++;
        },

        implicit: function () {
            this.count++;
        },

        search: function (query, page) {
            this.query = query;
            this.page = page;
        },

        charUTF: function () {
            this.charType = 'UTF';
        },

        charEscaped: function () {
            this.charType = 'escaped';
        },

        contacts: function () {
            this.contact = 'index';
        },

        newContact: function () {
            this.contact = 'new';
        },

        loadContact: function () {
            this.contact = 'load';
        },

        optionalItem: function (arg) {
            this.arg = arg != void 0 ? arg : null;
        },

        splat: function (args) {
            this.args = args;
        },

        github: function (repo, from, to) {
            this.repo = repo;
            this.from = from;
            this.to = to;
        },

        complex: function (first, part, rest) {
            this.first = first;
            this.part = part;
            this.rest = rest;
        },

        query: function (entity, args) {
            this.entity = entity;
            this.queryArgs = args;
        },

        anything: function (whatever) {
            this.anything = whatever;
        },

        namedOptional: function (z) {
            this.z = z;
        },

        decode: function (named, path) {
            this.named = named;
            this.path = path;
        },

        routeEvent: function (arg) {
        }

    });



    test("initialize", 1, function (t) {
        t.equal(router.testing, 101);
    });

    test("routes (simple)", 4, function (t) {
        restartHistoryWithoutPushState();
        location.replace('http://example.com#search/news');
        AmpHistory.checkUrl();
        t.equal(router.query, 'news');
        t.equal(router.page, null);
        t.equal(lastRoute, 'search');
        t.equal(lastArgs[0], 'news');
    });

    test("routes (simple, but unicode)", 4, function (t) {
        restartHistoryWithoutPushState();
        location.replace('http://example.com#search/' + encodeURIComponent('тест'));
        AmpHistory.checkUrl();
        t.equal(router.query, 'тест');
        t.equal(router.page, null);
        t.equal(lastRoute, 'search');
        t.equal(lastArgs[0], 'тест');
    });

    test("routes (two part)", 2, function (t) {
        restartHistoryWithoutPushState();
        location.replace('http://example.com#search/nyc/p10');
        AmpHistory.checkUrl();
        t.equal(router.query, 'nyc');
        t.equal(router.page, '10');
    });

    test("routes via navigate", 2, function (t) {
        AmpHistory.navigate('search/manhattan/p20');
        t.equal(router.query, 'manhattan');
        t.equal(router.page, '20');
    });

    test("routes via navigate with params", 1, function (t) {
        AmpHistory.navigate('query/test?a=b');
        t.equal(router.queryArgs, 'a=b');
    });

    test("routes via navigate for backwards-compatibility", 2, function (t) {
        AmpHistory.navigate('search/manhattan/p20', true);
        t.equal(router.query, 'manhattan');
        t.equal(router.page, '20');
    });

    test("reports matched route via nagivate", 1, function (t) {
        t.ok(AmpHistory.navigate('search/manhattan/p20', true));
    });

    // I guess that this test is currently redundant after we switched to `{trigger: true}` by default
    test("route precedence via navigate", 6, function (t) {
        // check both 0.9.x and backwards-compatibility options
        each([ { trigger: true }, true ], function (options) {
            AmpHistory.navigate('contacts', options);
            t.equal(router.contact, 'index');
            AmpHistory.navigate('contacts/new', options);
            t.equal(router.contact, 'new');
            AmpHistory.navigate('contacts/foo', options);
            t.equal(router.contact, 'load');
        });
    });

    test("loadUrl is not called for identical routes.", 1, function (t) {
        restartHistoryWithoutPushState();
        AmpHistory.navigate('route');
        AmpHistory.loadUrl = function () {
            t.ok(false);
        };
        AmpHistory.navigate('route');
        AmpHistory.navigate('/route');
        AmpHistory.navigate('/route');
        t.ok(true);
    });

    test("use implicit callback if none provided", 1, function (t) {
        router.count = 0;
        router.navigate('implicit');
        t.equal(router.count, 1);
    });

    test("routes via navigate with {replace: true}", 1, function (t) {
        restartHistoryWithoutPushState();
        location.replace('http://example.com#start_here');
        AmpHistory.checkUrl();
        location.replace = function (href) {
            t.strictEqual(href, new Location('http://example.com#end_here').href);
        };
        AmpHistory.navigate('end_here', {replace: true});
    });

    test("routes (splats)", 1, function (t) {
        restartHistoryWithoutPushState();
        location.replace('http://example.com#splat/long-list/of/splatted_99args/end');
        AmpHistory.checkUrl();
        t.equal(router.args, 'long-list/of/splatted_99args');
    });

    test("routes (github)", 3, function (t) {
        restartHistoryWithoutPushState();
        location.replace('http://example.com#backbone/compare/1.0...braddunbar:with/slash');
        AmpHistory.checkUrl();
        t.equal(router.repo, 'backbone');
        t.equal(router.from, '1.0');
        t.equal(router.to, 'braddunbar:with/slash');
    });

    test("routes (optional)", 2, function (t) {
        restartHistoryWithoutPushState();
        location.replace('http://example.com#optional');
        AmpHistory.checkUrl();
        t.ok(!router.arg);
        location.replace('http://example.com#optional/thing');
        AmpHistory.checkUrl();
        t.equal(router.arg, 'thing');
    });

    test("routes (complex)", 3, function (t) {
        restartHistoryWithoutPushState();
        location.replace('http://example.com#one/two/three/complex-part/four/five/six/seven');
        AmpHistory.checkUrl();
        t.equal(router.first, 'one/two/three');
        t.equal(router.part, 'part');
        t.equal(router.rest, 'four/five/six/seven');
    });

    test("routes (query)", 5, function (t) {
        restartHistoryWithoutPushState();
        location.replace('http://example.com#query/mandel?a=b&c=d');
        AmpHistory.checkUrl();
        t.equal(router.entity, 'mandel');
        t.equal(router.queryArgs, 'a=b&c=d');
        t.equal(lastRoute, 'query');
        t.equal(lastArgs[0], 'mandel');
        t.equal(lastArgs[1], 'a=b&c=d');
    });

    test("routes (anything)", 1, function (t) {
        restartHistoryWithoutPushState();
        location.replace('http://example.com#doesnt-match-a-route');
        AmpHistory.checkUrl();
        t.equal(router.anything, 'doesnt-match-a-route');
    });

    test("routes (function)", 3, function (t) {
        restartHistoryWithoutPushState();
        router.on('route', function (name) {
            t.ok(name === '');
        });
        t.equal(ExternalObject.value, 'unset');
        location.replace('http://example.com#function/set');
        AmpHistory.checkUrl();
        t.equal(ExternalObject.value, 'set');
    });

    test("Decode named parameters, not splats.", 2, function (t) {
        restartHistoryWithoutPushState();
        location.replace('http://example.com#decode/a%2Fb/c%2Fd/e');
        AmpHistory.checkUrl();
        t.strictEqual(router.named, 'a/b');
        t.strictEqual(router.path, 'c/d/e');
    });

    test("fires event when router doesn't have callback on it", 1, function (t) {
        restartHistoryWithoutPushState();
        router.on("route:noCallback", function () {
            t.ok(true);
        });
        location.replace('http://example.com#noCallback');
        AmpHistory.checkUrl();
    });

    test("No events are triggered if #execute returns false.", 1, function (t) {
        restartHistoryWithoutPushState();
        var Router = AmpRouter.extend({

            routes: {
                foo: function () {
                    t.ok(true);
                }
            },

            execute: function (callback, args) {
                callback.apply(this, args);
                return false;
            }

        });

        var router = new Router({ history: AmpHistory });

        router.on('route route:foo', function () {
            t.ok(false);
        });

        AmpHistory.on('route', function () {
            t.ok(false);
        });

        location.replace('http://example.com#foo');
        AmpHistory.checkUrl();
    });

    test("#933, #908 - leading slash", 2, function (t) {
        location.replace('http://example.com/root/foo');

        AmpHistory.stop();
        AmpHistory = extend(new AmpHistoryConstructor(), {location: location});
        AmpHistory.start({root: '/root', hashChange: false, silent: true});
        t.strictEqual(AmpHistory.getFragment(), 'foo');

        AmpHistory.stop();
        AmpHistory = extend(new AmpHistoryConstructor(), {location: location});
        AmpHistory.start({root: '/root/', hashChange: false, silent: true});
        t.strictEqual(AmpHistory.getFragment(), 'foo');
    });

    test("#1003 - History is started before navigate is called", 1, function (t) {
        AmpHistory.stop();
        AmpHistory.navigate = function () {
            t.ok(AmpHistoryConstructor.started);
        };
        AmpHistory.start({pushState: false});
        // If this is not an old IE navigate will not be called.
        if (!AmpHistory.iframe) t.ok(true);
    });

    test("#967 - Route callback gets passed encoded values.", 3, function (t) {
        var route = 'has%2Fslash/complex-has%23hash/has%20space';
        AmpHistory.navigate(route);
        t.strictEqual(router.first, 'has/slash');
        t.strictEqual(router.part, 'has#hash');
        t.strictEqual(router.rest, 'has space');
    });

    test("correctly handles URLs with % (#868)", 3, function (t) {
        restartHistoryWithoutPushState();
        location.replace('http://example.com#search/fat%3A1.5%25');
        AmpHistory.checkUrl();
        location.replace('http://example.com#search/fat');
        AmpHistory.checkUrl();
        t.equal(router.query, 'fat');
        t.equal(router.page, null);
        t.equal(lastRoute, 'search');
    });

    test("#2666 - Hashes with UTF8 in them.", 2, function (t) {
        AmpHistory.navigate('charñ');
        t.equal(router.charType, 'UTF');
        AmpHistory.navigate('char%C3%B1');
        t.equal(router.charType, 'UTF');
    });

    test("#1185 - Use pathname when hashChange is not wanted.", 1, function (t) {
        AmpHistory.stop();
        location.replace('http://example.com/path/name#hash');
        AmpHistory = extend(new AmpHistoryConstructor(), {location: location});
        AmpHistory.start({hashChange: false});
        var fragment = AmpHistory.getFragment();
        t.strictEqual(fragment, location.pathname.replace(/^\//, ''));
    });

    test("#1206 - Strip leading slash before location.assign.", 1, function (t) {
        AmpHistory.stop();
        location.replace('http://example.com/root/');
        AmpHistory = extend(new AmpHistoryConstructor(), {location: location});
        AmpHistory.start({pushState: false, hashChange: false, root: '/root/'});
        location.assign = function (pathname) {
            t.strictEqual(pathname, '/root/fragment');
        };
        AmpHistory.navigate('/fragment');
    });

    test("#1387 - Root fragment without trailing slash.", 1, function (t) {
        AmpHistory.stop();
        location.replace('http://example.com/root');
        AmpHistory = extend(new AmpHistoryConstructor(), {location: location});
        AmpHistory.start({hashChange: false, root: '/root/', silent: true});
        t.strictEqual(AmpHistory.getFragment(), '');
    });

    test("#1366 - History does not prepend root to fragment.", 2, function (t) {
        AmpHistory.stop();
        location.replace('http://example.com/root/');
        AmpHistory = extend(new AmpHistoryConstructor(), {
            location: location,
            history: {
                pushState: function (state, title, url) {
                    t.strictEqual(url, '/root/x');
                }
            }
        });
        AmpHistory.start({root: '/root/', hashChange: false});
        AmpHistory.navigate('x');
        t.strictEqual(AmpHistory.fragment, 'x');
    });

    test("Normalize root.", 1, function (t) {
        AmpHistory.stop();
        location.replace('http://example.com/root');
        AmpHistory = extend(new AmpHistoryConstructor(), {
            location: location,
            history: {
                pushState: function (state, title, url) {
                    t.strictEqual(url, '/root/fragment');
                }
            }
        });
        AmpHistory.start({root: '/root', hashChange: false});
        AmpHistory.navigate('fragment');
    });

    test("Normalize root.", 1, function (t) {
        AmpHistory.stop();
        location.replace('http://example.com/root#fragment');
        AmpHistory = extend(new AmpHistoryConstructor(), {
            location: location,
            history: {
                pushState: function (state, title, url) {},
                replaceState: function (state, title, url) {
                    t.strictEqual(url, '/root/fragment');
                }
            }
        });
        AmpHistory.start({root: '/root'});
    });

    test("Normalize root.", 1, function (t) {
        AmpHistory.stop();
        location.replace('http://example.com/root');
        AmpHistory = extend(new AmpHistoryConstructor(), {location: location});
        AmpHistory.loadUrl = function () {
            t.ok(true);
        };
        AmpHistory.start({root: '/root'});
    });

    test("Normalize root - leading slash.", 1, function (t) {
        AmpHistory.stop();
        location.replace('http://example.com/root');
        AmpHistory = extend(new AmpHistoryConstructor(), {
            location: location,
            history: {
                pushState: function () {},
                replaceState: function () {}
            }
        });
        AmpHistory.start({root: 'root'});
        t.strictEqual(AmpHistory.root, '/root/');
    });

    test("Transition from hashChange to pushState.", 1, function (t) {
        AmpHistory.stop();
        location.replace('http://example.com/root#x/y');
        AmpHistory = extend(new AmpHistoryConstructor(), {
            location: location,
            history: {
                pushState: function () {},
                replaceState: function (state, title, url) {
                    t.strictEqual(url, '/root/x/y');
                }
            }
        });
        AmpHistory.start({root: 'root'});
    });

    test("#1619: Router: Normalize empty root", 1, function (t) {
        AmpHistory.stop();
        location.replace('http://example.com/');
        AmpHistory = extend(new AmpHistoryConstructor(), {
            location: location,
            history: {
                pushState: function () {},
                replaceState: function () {}
            }
        });
        AmpHistory.start({root: ''});
        t.strictEqual(AmpHistory.root, '/');
    });

    test("#1619: Router: nagivate with empty root", 1, function (t) {
        AmpHistory.stop();
        location.replace('http://example.com/');
        AmpHistory = extend(new AmpHistoryConstructor(), {
            location: location,
            history: {
                pushState: function (state, title, url) {
                    t.strictEqual(url, '/fragment');
                }
            }
        });
        AmpHistory.start({root: '', hashChange: false});
        AmpHistory.navigate('fragment');
    });

    test("Transition from pushState to hashChange.", 1, function (t) {
        AmpHistory.stop();
        location.replace('http://example.com/root/x/y?a=b');
        location.replace = function (url) {
            t.strictEqual(url, '/root/#x/y?a=b');
        };
        AmpHistory = extend(new AmpHistoryConstructor(), {
            location: location,
            history: {
                pushState: null,
                replaceState: null
            }
        });
        AmpHistory.start({root: 'root'});
    });

    test("#1695 - hashChange to pushState with search.", 1, function (t) {
        AmpHistory.stop();
        location.replace('http://example.com/root#x/y?a=b');
        AmpHistory = extend(new AmpHistoryConstructor(), {
            location: location,
            history: {
                pushState: function () {},
                replaceState: function (state, title, url) {
                    t.strictEqual(url, '/root/x/y?a=b');
                }
            }
        });
        AmpHistory.start({root: 'root'});
    });

    test("#1746 - Router allows empty route.", 1, function (t) {
        var Router = AmpRouter.extend({
            routes: {'': 'empty'},
            empty: function () {},
            route: function (route) {
                t.strictEqual(route, '');
            }
        });
        new Router();
    });

    test("#1794 - Trailing space in fragments.", 1, function (t) {
        var history = new AmpHistoryConstructor();
        t.strictEqual(history.getFragment('fragment   '), 'fragment');
    });

    test("#1820 - Leading slash and trailing space.", 1, function (t) {
        var history = new AmpHistoryConstructor();
        t.strictEqual(history.getFragment('/fragment '), 'fragment');
    });

    test("#1980 - Optional parameters.", 2, function (t) {
        restartHistoryWithoutPushState();
        location.replace('http://example.com#named/optional/y');
        AmpHistory.checkUrl();
        t.strictEqual(router.z, undefined);
        location.replace('http://example.com#named/optional/y123');
        AmpHistory.checkUrl();
        t.strictEqual(router.z, '123');
    });

    test("#2062 - Trigger 'route' event on router instance.", 2, function (t) {
        restartHistoryWithoutPushState();
        router.on('route', function (name, args) {
            t.strictEqual(name, 'routeEvent');
            t.deepEqual(args, ['x', null]);
        });
        location.replace('http://example.com#route-event/x');
        AmpHistory.checkUrl();
    });

    test("#2255 - Extend routes by making routes a function.", 1, function (t) {
        var RouterBase = AmpRouter.extend({
            routes: function () {
                return {
                    home: "root",
                    index: "index.html"
                };
            }
        });

        var RouterExtended = RouterBase.extend({
            routes: function () {
                var _super = RouterExtended.__super__.routes;
                return extend(_super(), {
                    show: 'show',
                    search: 'search'
                });
            }
        });

        var router = new RouterExtended();
        t.deepEqual({home: "root", index: "index.html", show: "show", search: "search"}, router.routes);
    });

    test("#2538 - hashChange to pushState only if both requested.", 1, function (t) {
        AmpHistory.stop();
        location.replace('http://example.com/root?a=b#x/y');
        AmpHistory = extend(new AmpHistoryConstructor(), {
            location: location,
            history: {
                pushState: function () {},
                replaceState: function () {
                    t.ok(false);
                }
            }
        });
        AmpHistory.start({root: 'root', hashChange: false});
        t.ok(true);
    });

    test('No hash fallback.', 1, function (t) {
        AmpHistory.stop();
        AmpHistory = extend(new AmpHistoryConstructor(), {
            location: location,
            history: {
                pushState: function () {},
                replaceState: function () {}
            }
        });

        var Router = AmpRouter.extend({
            routes: {
                hash: function () {
                    t.ok(false);
                }
            }
        });
        var router = new Router({ history: AmpHistory });

        location.replace('http://example.com/');
        AmpHistory.start({hashChange: false});
        location.replace('http://example.com/nomatch#hash');
        AmpHistory.checkUrl();
        t.ok(true);
    });

    test('#2656 - No trailing slash on root.', 1, function (t) {
        AmpHistory.stop();
        AmpHistory = extend(new AmpHistoryConstructor(), {
            location: location,
            history: {
                pushState: function (state, title, url) {
                    t.strictEqual(url, '/root');
                }
            }
        });
        location.replace('http://example.com/root/path');
        AmpHistory.start({hashChange: false, root: 'root'});
        AmpHistory.navigate('');
    });

    test('#2656 - No trailing slash on root.', 1, function (t) {
        AmpHistory.stop();
        AmpHistory = extend(new AmpHistoryConstructor(), {
            location: location,
            history: {
                pushState: function (state, title, url) {
                    t.strictEqual(url, '/');
                }
            }
        });
        location.replace('http://example.com/path');
        AmpHistory.start({hashChange: false});
        AmpHistory.navigate('');
    });

    test('#2765 - Fragment matching sans query/hash.', 2, function (t) {
        AmpHistory.stop();
        AmpHistory = extend(new AmpHistoryConstructor(), {
            location: location,
            history: {
                pushState: function (state, title, url) {
                    t.strictEqual(url, '/path?query#hash');
                }
            }
        });

        var Router = AmpRouter.extend({
            routes: {
                path: function () {
                    t.ok(true);
                }
            }
        });
        var router = new Router({ history: AmpHistory });

        location.replace('http://example.com/');
        AmpHistory.start({hashChange: false});
        AmpHistory.navigate('path?query#hash', true);
    });

    test('Do not decode the search params.', 1, function (t) {
        var Router = AmpRouter.extend({
            routes: {
                path: function (params) {
                    t.strictEqual(params, 'x=y z');
                }
            }
        });
        var router = new Router({ history: AmpHistory });
        AmpHistory.navigate('path?x=y%20z', true);
    });

    test('Navigate to a hash url.', 1, function (t) {
        AmpHistory.stop();
        AmpHistory = extend(new AmpHistoryConstructor(), {location: location});
        AmpHistory.start();
        var Router = AmpRouter.extend({
            routes: {
                path: function (params) {
                    t.strictEqual(params, 'x=y');
                }
            }
        });
        var router = new Router({ history: AmpHistory });
        location.replace('http://example.com/path?x=y#hash');
        AmpHistory.checkUrl();
    });

    test('#navigate to a hash url.', 1, function (t) {
        AmpHistory.stop();
        AmpHistory = extend(new AmpHistoryConstructor(), {location: location});
        AmpHistory.start();
        var Router = AmpRouter.extend({
            routes: {
                path: function (params) {
                    t.strictEqual(params, 'x=y');
                }
            }
        });
        var router = new Router({ history: AmpHistory });
        AmpHistory.navigate('path?x=y#hash', true);
    });

    test('unicode pathname', 1, function (t) {
        location.replace('http://example.com/myyjä');
        AmpHistory.stop();
        AmpHistory = extend(new AmpHistoryConstructor(), {location: location});
        var Router = AmpRouter.extend({
            routes: {
                'myyjä': function () {
                    t.ok(true);
                }
            }
        });
        var router = new Router({ history: AmpHistory });
        AmpHistory.start();
    });

    test('newline in route', 1, function (t) {
        location.replace('http://example.com/stuff%0Anonsense?param=foo%0Abar');
        AmpHistory.stop();
        AmpHistory = extend(new AmpHistoryConstructor(), {location: location});
        var Router = AmpRouter.extend({
            routes: {
                'stuff\nnonsense': function () {
                    t.ok(true);
                }
            }
        });
        new Router({ history: AmpHistory });
        AmpHistory.start();
    });

    test('Router#execute receives callback, args, name.', 3, function (t) {
        location.replace('http://example.com#foo/123/bar?x=y');
        AmpHistory.stop();
        AmpHistory = extend(new AmpHistoryConstructor(), {location: location});
        var Router = AmpRouter.extend({
            routes: {'foo/:id/bar': 'foo'},
            foo: function () {},
            execute: function (callback, args, name) {
                t.strictEqual(callback, this.foo);
                t.deepEqual(args, ['123', 'x=y']);
                t.strictEqual(name, 'foo');
            }
        });
        var router = new Router({ history: AmpHistory });
        AmpHistory.start({pushState: false});
    });

    test("pushState to hashChange with only search params.", 1, function (t) {
        AmpHistory.stop();
        location.replace('http://example.com?a=b');
        location.replace = function (url) {
            t.strictEqual(url, '/#?a=b');
        };
        AmpHistory = extend(new AmpHistoryConstructor(), {
            location: location,
            history: null
        });
        AmpHistory.start();
    });

    test("#3123 - History#navigate decodes before comparison.", 1, function (t) {
        AmpHistory.stop();
        location.replace('http://example.com/shop/search?keyword=short%20dress');
        AmpHistory = extend(new AmpHistoryConstructor(), {
            location: location,
            history: {
                pushState: function () {
                    t.ok(false);
                },
                replaceState: function () {
                    t.ok(false);
                }
            }
        });
        AmpHistory.start();
        AmpHistory.navigate('shop/search?keyword=short%20dress', true);
        t.strictEqual(AmpHistory.fragment, 'shop/search?keyword=short dress');
    });

    test('#3175 - Urls in the params', 1, function (t) {
        AmpHistory.stop();
        location.replace('http://example.com#login?a=value&backUrl=https%3A%2F%2Fwww.msn.com%2Fidp%2Fidpdemo%3Fspid%3Dspdemo%26target%3Db');
        AmpHistory = extend(new AmpHistoryConstructor(), {location: location});
        var router = new AmpRouter({ history: AmpHistory });
        router.route('login', function (params) {
            t.strictEqual(params, 'a=value&backUrl=https%3A%2F%2Fwww.msn.com%2Fidp%2Fidpdemo%3Fspid%3Dspdemo%26target%3Db');
        });
        AmpHistory.start({pushState: false});
    });

    test("redirectTo", 2, function (t) {
        AmpHistory.stop();
        location.replace('http://example.com/redirect');
        AmpHistory = extend(new AmpHistoryConstructor(), {location: location});
        var router = new AmpRouter({ history: AmpHistory });
        router.route('redirect', function () {
            t.ok('yup');
            this.redirectTo('other');
        });
        router.route('other', function () {
            t.pass();
        });
        AmpHistory.start();
    });

    test("app can know when the history has started", 2, function (t) {
        AmpHistory.stop();
        var router = new AmpRouter({ history: AmpHistory });
        t.notOk(router.history.started());
        AmpHistory.start();
        t.ok(router.history.started());
    });

    test("reload", 2, function (t) {
        AmpHistory.stop();
        location.replace('http://example.com/foo');
        var Router = AmpRouter.extend({
            routes: {'foo': 'foo'},
            foo: function () {
                t.ok('yep');//Should get called twice
            }
        });
        AmpHistory = extend(new AmpHistoryConstructor(), {location: location});
        var router = new Router({ history: AmpHistory });
        AmpHistory.start();
        router.navigate('foo', {trigger: true});
        router.reload();
    });

    test("router accepts routes through extend or instantiation", 2, function (t) {
        var router1 = new (AmpRouter.extend({
            routes: {
                'test': 'test'
            }
        }))();
        var router2 = new AmpRouter({
            routes: {
                'test': 'test'
            }
        });

        t.ok(router1.routes.test, 'test');
        t.ok(router2.routes.test, 'test');
    });
})();
