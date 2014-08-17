//Don't want to call these, but it breaks IE9, so welp
window.history.pushState = window.history.replaceState = function () {};

var tape = require('tape');
var test = tape;

tape.Test.prototype.strictEqual = function () {
    this.equal.apply(this, arguments);
};

var Backbone = {
    Router: require('../ampersand-router'),
    history: require('../ampersand-history')
};
Backbone.History = Backbone.history.constructor;

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


(function () {
    var _ = require('underscore');

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

    _.extend(Location.prototype, {
        parser: document.createElement('a'),

        replace: function (href) {
            this.parser.href = href;
            _.extend(this, _.pick(this.parser,
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

    module("Backbone.Router", {
        setup: function () {
            location = new Location('http://example.com');
            history.location = location;
            Backbone.history = _.extend(new Backbone.History(), {location: location});
            router = new Router({testing: 101, history: Backbone.history});
            Backbone.history.interval = 9;
            Backbone.history.start({pushState: false});
            lastRoute = null;
            lastArgs = [];
            Backbone.history.on('route', onRoute);
        },

        teardown: function () {
            Backbone.history.stop();
            Backbone.history.off('route', onRoute);
        }
    });

    var ExternalObject = {
        value: 'unset',

        routingFunction: function (value) {
            this.value = value;
        }
    };
    _.bindAll(ExternalObject, 'routingFunction');

    var Router = Backbone.Router.extend({

        count: 0,

        routes: {
            "noCallback":                 "noCallback",
            "counter":                    "counter",
            "search/:query":              "search",
            "search/:query/p:page":       "search",
            "charñ":                      "charUTF",
            "char%C3%B1":                 "charEscaped",
            "contacts":                   "contacts",
            "contacts/new":               "newContact",
            "contacts/:id":               "loadContact",
            "route-event/:arg":           "routeEvent",
            "optional(/:item)":           "optionalItem",
            "named/optional/(y:z)":       "namedOptional",
            "splat/*args/end":            "splat",
            ":repo/compare/*from...*to":  "github",
            "decode/:named/*splat":       "decode",
            "*first/complex-*part/*rest": "complex",
            "query/:entity":              "query",
            "function/:value":            ExternalObject.routingFunction,
            "*anything":                  "anything"
        },

        initialize : function (options) {
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
            this.entity    = entity;
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
        location.replace('http://example.com#search/news');
        Backbone.history.checkUrl();
        t.equal(router.query, 'news');
        t.equal(router.page, null);
        t.equal(lastRoute, 'search');
        t.equal(lastArgs[0], 'news');
    });

    test("routes (simple, but unicode)", 4, function (t) {
        location.replace('http://example.com#search/' + encodeURIComponent('тест'));
        Backbone.history.checkUrl();
        t.equal(router.query, 'тест');
        t.equal(router.page, null);
        t.equal(lastRoute, 'search');
        t.equal(lastArgs[0], 'тест');
    });

    test("routes (two part)", 2, function (t) {
        location.replace('http://example.com#search/nyc/p10');
        Backbone.history.checkUrl();
        t.equal(router.query, 'nyc');
        t.equal(router.page, '10');
    });

    test("routes via navigate", 2, function (t) {
        Backbone.history.navigate('search/manhattan/p20', {trigger: true});
        t.equal(router.query, 'manhattan');
        t.equal(router.page, '20');
    });

    test("routes via navigate with params", 1, function (t) {
        Backbone.history.navigate('query/test?a=b', {trigger: true});
        t.equal(router.queryArgs, 'a=b');
    });

    test("routes via navigate for backwards-compatibility", 2, function (t) {
        Backbone.history.navigate('search/manhattan/p20', true);
        t.equal(router.query, 'manhattan');
        t.equal(router.page, '20');
    });

    test("reports matched route via nagivate", 1, function (t) {
        t.ok(Backbone.history.navigate('search/manhattan/p20', true));
    });

    test("route precedence via navigate", 6, function (t) {
        // check both 0.9.x and backwards-compatibility options
        _.each([ { trigger: true }, true ], function (options) {
            Backbone.history.navigate('contacts', options);
            t.equal(router.contact, 'index');
            Backbone.history.navigate('contacts/new', options);
            t.equal(router.contact, 'new');
            Backbone.history.navigate('contacts/foo', options);
            t.equal(router.contact, 'load');
        });
    });

    test("loadUrl is not called for identical routes.", 1, function (t) {
        Backbone.history.loadUrl = function () {t.ok(false); };
        location.replace('http://example.com#route');
        Backbone.history.navigate('route');
        Backbone.history.navigate('/route');
        Backbone.history.navigate('/route');
        t.ok(true);
    });

    test("use implicit callback if none provided", 1, function (t) {
        router.count = 0;
        router.navigate('implicit', {trigger: true});
        t.equal(router.count, 1);
    });

    test("routes via navigate with {replace: true}", 1, function (t) {
        location.replace('http://example.com#start_here');
        Backbone.history.checkUrl();
        location.replace = function (href) {
            t.strictEqual(href, new Location('http://example.com#end_here').href);
        };
        Backbone.history.navigate('end_here', {replace: true});
    });

    test("routes (splats)", 1, function (t) {
        location.replace('http://example.com#splat/long-list/of/splatted_99args/end');
        Backbone.history.checkUrl();
        t.equal(router.args, 'long-list/of/splatted_99args');
    });

    test("routes (github)", 3, function (t) {
        location.replace('http://example.com#backbone/compare/1.0...braddunbar:with/slash');
        Backbone.history.checkUrl();
        t.equal(router.repo, 'backbone');
        t.equal(router.from, '1.0');
        t.equal(router.to, 'braddunbar:with/slash');
    });

    test("routes (optional)", 2, function (t) {
        location.replace('http://example.com#optional');
        Backbone.history.checkUrl();
        t.ok(!router.arg);
        location.replace('http://example.com#optional/thing');
        Backbone.history.checkUrl();
        t.equal(router.arg, 'thing');
    });

    test("routes (complex)", 3, function (t) {
        location.replace('http://example.com#one/two/three/complex-part/four/five/six/seven');
        Backbone.history.checkUrl();
        t.equal(router.first, 'one/two/three');
        t.equal(router.part, 'part');
        t.equal(router.rest, 'four/five/six/seven');
    });

    test("routes (query)", 5, function (t) {
        location.replace('http://example.com#query/mandel?a=b&c=d');
        Backbone.history.checkUrl();
        t.equal(router.entity, 'mandel');
        t.equal(router.queryArgs, 'a=b&c=d');
        t.equal(lastRoute, 'query');
        t.equal(lastArgs[0], 'mandel');
        t.equal(lastArgs[1], 'a=b&c=d');
    });

    test("routes (anything)", 1, function (t) {
        location.replace('http://example.com#doesnt-match-a-route');
        Backbone.history.checkUrl();
        t.equal(router.anything, 'doesnt-match-a-route');
    });

    test("routes (function)", 3, function (t) {
        router.on('route', function (name) {
            t.ok(name === '');
        });
        t.equal(ExternalObject.value, 'unset');
        location.replace('http://example.com#function/set');
        Backbone.history.checkUrl();
        t.equal(ExternalObject.value, 'set');
    });

    test("Decode named parameters, not splats.", 2, function (t) {
        location.replace('http://example.com#decode/a%2Fb/c%2Fd/e');
        Backbone.history.checkUrl();
        t.strictEqual(router.named, 'a/b');
        t.strictEqual(router.path, 'c/d/e');
    });

    test("fires event when router doesn't have callback on it", 1, function (t) {
        router.on("route:noCallback", function () {t.ok(true); });
        location.replace('http://example.com#noCallback');
        Backbone.history.checkUrl();
    });

    test("No events are triggered if #execute returns false.", 1, function (t) {
        var Router = Backbone.Router.extend({

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

        var router = new Router({ history: Backbone.history });

        router.on('route route:foo', function () {
            t.ok(false);
        });

        Backbone.history.on('route', function () {
            t.ok(false);
        });

        location.replace('http://example.com#foo');
        Backbone.history.checkUrl();
    });

    test("#933, #908 - leading slash", 2, function (t) {
        location.replace('http://example.com/root/foo');

        Backbone.history.stop();
        Backbone.history = _.extend(new Backbone.History(), {location: location});
        Backbone.history.start({root: '/root', hashChange: false, silent: true});
        t.strictEqual(Backbone.history.getFragment(), 'foo');

        Backbone.history.stop();
        Backbone.history = _.extend(new Backbone.History(), {location: location});
        Backbone.history.start({root: '/root/', hashChange: false, silent: true});
        t.strictEqual(Backbone.history.getFragment(), 'foo');
    });

    test("#1003 - History is started before navigate is called", 1, function (t) {
        Backbone.history.stop();
        Backbone.history.navigate = function () {t.ok(Backbone.History.started); };
        Backbone.history.start();
        // If this is not an old IE navigate will not be called.
        if (!Backbone.history.iframe) t.ok(true);
    });

    test("#967 - Route callback gets passed encoded values.", 3, function (t) {
        var route = 'has%2Fslash/complex-has%23hash/has%20space';
        Backbone.history.navigate(route, {trigger: true});
        t.strictEqual(router.first, 'has/slash');
        t.strictEqual(router.part, 'has#hash');
        t.strictEqual(router.rest, 'has space');
    });

    test("correctly handles URLs with % (#868)", 3, function (t) {
        location.replace('http://example.com#search/fat%3A1.5%25');
        Backbone.history.checkUrl();
        location.replace('http://example.com#search/fat');
        Backbone.history.checkUrl();
        t.equal(router.query, 'fat');
        t.equal(router.page, null);
        t.equal(lastRoute, 'search');
    });

    test("#2666 - Hashes with UTF8 in them.", 2, function (t) {
        Backbone.history.navigate('charñ', {trigger: true});
        t.equal(router.charType, 'UTF');
        Backbone.history.navigate('char%C3%B1', {trigger: true});
        t.equal(router.charType, 'UTF');
    });

    test("#1185 - Use pathname when hashChange is not wanted.", 1, function (t) {
        Backbone.history.stop();
        location.replace('http://example.com/path/name#hash');
        Backbone.history = _.extend(new Backbone.History(), {location: location});
        Backbone.history.start({hashChange: false});
        var fragment = Backbone.history.getFragment();
        t.strictEqual(fragment, location.pathname.replace(/^\//, ''));
    });

    test("#1206 - Strip leading slash before location.assign.", 1, function (t) {
        Backbone.history.stop();
        location.replace('http://example.com/root/');
        Backbone.history = _.extend(new Backbone.History(), {location: location});
        Backbone.history.start({hashChange: false, root: '/root/'});
        location.assign = function (pathname) {
            t.strictEqual(pathname, '/root/fragment');
        };
        Backbone.history.navigate('/fragment');
    });

    test("#1387 - Root fragment without trailing slash.", 1, function (t) {
        Backbone.history.stop();
        location.replace('http://example.com/root');
        Backbone.history = _.extend(new Backbone.History(), {location: location});
        Backbone.history.start({hashChange: false, root: '/root/', silent: true});
        t.strictEqual(Backbone.history.getFragment(), '');
    });

    test("#1366 - History does not prepend root to fragment.", 2, function (t) {
        Backbone.history.stop();
        location.replace('http://example.com/root/');
        Backbone.history = _.extend(new Backbone.History(), {
            location: location,
            history: {
                pushState: function (state, title, url) {
                    t.strictEqual(url, '/root/x');
                }
            }
        });
        Backbone.history.start({
            root: '/root/',
            pushState: true,
            hashChange: false
        });
        Backbone.history.navigate('x');
        t.strictEqual(Backbone.history.fragment, 'x');
    });

    test("Normalize root.", 1, function (t) {
        Backbone.history.stop();
        location.replace('http://example.com/root');
        Backbone.history = _.extend(new Backbone.History(), {
            location: location,
            history: {
                pushState: function (state, title, url) {
                    t.strictEqual(url, '/root/fragment');
                }
            }
        });
        Backbone.history.start({
            pushState: true,
            root: '/root',
            hashChange: false
        });
        Backbone.history.navigate('fragment');
    });

    test("Normalize root.", 1, function (t) {
        Backbone.history.stop();
        location.replace('http://example.com/root#fragment');
        Backbone.history = _.extend(new Backbone.History(), {
            location: location,
            history: {
                pushState: function (state, title, url) {},
                replaceState: function (state, title, url) {
                    t.strictEqual(url, '/root/fragment');
                }
            }
        });
        Backbone.history.start({
            pushState: true,
            root: '/root'
        });
    });

    test("Normalize root.", 1, function (t) {
        Backbone.history.stop();
        location.replace('http://example.com/root');
        Backbone.history = _.extend(new Backbone.History(), {location: location});
        Backbone.history.loadUrl = function () {t.ok(true); };
        Backbone.history.start({
            pushState: true,
            root: '/root'
        });
    });

    test("Normalize root - leading slash.", 1, function (t) {
        Backbone.history.stop();
        location.replace('http://example.com/root');
        Backbone.history = _.extend(new Backbone.History(), {
            location: location,
            history: {
                pushState: function () {},
                replaceState: function () {}
            }
        });
        Backbone.history.start({root: 'root'});
        t.strictEqual(Backbone.history.root, '/root/');
    });

    test("Transition from hashChange to pushState.", 1, function (t) {
        Backbone.history.stop();
        location.replace('http://example.com/root#x/y');
        Backbone.history = _.extend(new Backbone.History(), {
            location: location,
            history: {
                pushState: function () {},
                replaceState: function (state, title, url) {
                    t.strictEqual(url, '/root/x/y');
                }
            }
        });
        Backbone.history.start({
            root: 'root',
            pushState: true
        });
    });

    test("#1619: Router: Normalize empty root", 1, function (t) {
        Backbone.history.stop();
        location.replace('http://example.com/');
        Backbone.history = _.extend(new Backbone.History(), {
            location: location,
            history: {
                pushState: function () {},
                replaceState: function () {}
            }
        });
        Backbone.history.start({root: ''});
        t.strictEqual(Backbone.history.root, '/');
    });

    test("#1619: Router: nagivate with empty root", 1, function (t) {
        Backbone.history.stop();
        location.replace('http://example.com/');
        Backbone.history = _.extend(new Backbone.History(), {
            location: location,
            history: {
                pushState: function (state, title, url) {
                    t.strictEqual(url, '/fragment');
                }
            }
        });
        Backbone.history.start({
            pushState: true,
            root: '',
            hashChange: false
        });
        Backbone.history.navigate('fragment');
    });

    test("Transition from pushState to hashChange.", 1, function (t) {
        Backbone.history.stop();
        location.replace('http://example.com/root/x/y?a=b');
        location.replace = function (url) {
            t.strictEqual(url, '/root/#x/y?a=b');
        };
        Backbone.history = _.extend(new Backbone.History(), {
            location: location,
            history: {
                pushState: null,
                replaceState: null
            }
        });
        Backbone.history.start({
            root: 'root',
            pushState: true
        });
    });

    test("#1695 - hashChange to pushState with search.", 1, function (t) {
        Backbone.history.stop();
        location.replace('http://example.com/root#x/y?a=b');
        Backbone.history = _.extend(new Backbone.History(), {
            location: location,
            history: {
                pushState: function () {},
                replaceState: function (state, title, url) {
                    t.strictEqual(url, '/root/x/y?a=b');
                }
            }
        });
        Backbone.history.start({
            root: 'root',
            pushState: true
        });
    });

    test("#1746 - Router allows empty route.", 1, function (t) {
        var Router = Backbone.Router.extend({
            routes: {'': 'empty'},
            empty: function () {},
            route: function (route) {
                t.strictEqual(route, '');
            }
        });
        new Router();
    });

    test("#1794 - Trailing space in fragments.", 1, function (t) {
        var history = new Backbone.History();
        t.strictEqual(history.getFragment('fragment   '), 'fragment');
    });

    test("#1820 - Leading slash and trailing space.", 1, function (t) {
        var history = new Backbone.History();
        t.strictEqual(history.getFragment('/fragment '), 'fragment');
    });

    test("#1980 - Optional parameters.", 2, function (t) {
        location.replace('http://example.com#named/optional/y');
        Backbone.history.checkUrl();
        t.strictEqual(router.z, undefined);
        location.replace('http://example.com#named/optional/y123');
        Backbone.history.checkUrl();
        t.strictEqual(router.z, '123');
    });

    test("#2062 - Trigger 'route' event on router instance.", 2, function (t) {
        router.on('route', function (name, args) {
            t.strictEqual(name, 'routeEvent');
            t.deepEqual(args, ['x', null]);
        });
        location.replace('http://example.com#route-event/x');
        Backbone.history.checkUrl();
    });

    test("#2255 - Extend routes by making routes a function.", 1, function (t) {
        var RouterBase = Backbone.Router.extend({
            routes: function () {
                return {
                    home:  "root",
                    index: "index.html"
                };
            }
        });

        var RouterExtended = RouterBase.extend({
            routes: function () {
                var _super = RouterExtended.__super__.routes;
                return _.extend(_super(),
                                { show:   "show",
                                    search: "search" });
            }
        });

        var router = new RouterExtended();
        t.deepEqual({home: "root", index: "index.html", show: "show", search: "search"}, router.routes);
    });

    test("#2538 - hashChange to pushState only if both requested.", 1, function (t) {
        Backbone.history.stop();
        location.replace('http://example.com/root?a=b#x/y');
        Backbone.history = _.extend(new Backbone.History(), {
            location: location,
            history: {
                pushState: function () {},
                replaceState: function () {t.ok(false); }
            }
        });
        Backbone.history.start({
            root: 'root',
            pushState: true,
            hashChange: false
        });
        t.ok(true);
    });

    test('No hash fallback.', 1, function (t) {
        Backbone.history.stop();
        Backbone.history = _.extend(new Backbone.History(), {
            location: location,
            history: {
                pushState: function () {},
                replaceState: function () {}
            }
        });

        var Router = Backbone.Router.extend({
            routes: {
                hash: function () {t.ok(false); }
            }
        });
        var router = new Router({ history: Backbone.history });

        location.replace('http://example.com/');
        Backbone.history.start({
            pushState: true,
            hashChange: false
        });
        location.replace('http://example.com/nomatch#hash');
        Backbone.history.checkUrl();
        t.ok(true);
    });

    test('#2656 - No trailing slash on root.', 1, function (t) {
        Backbone.history.stop();
        Backbone.history = _.extend(new Backbone.History(), {
            location: location,
            history: {
                pushState: function (state, title, url) {
                    t.strictEqual(url, '/root');
                }
            }
        });
        location.replace('http://example.com/root/path');
        Backbone.history.start({pushState: true, hashChange: false, root: 'root'});
        Backbone.history.navigate('');
    });

    test('#2656 - No trailing slash on root.', 1, function (t) {
        Backbone.history.stop();
        Backbone.history = _.extend(new Backbone.History(), {
            location: location,
            history: {
                pushState: function (state, title, url) {
                    t.strictEqual(url, '/');
                }
            }
        });
        location.replace('http://example.com/path');
        Backbone.history.start({pushState: true, hashChange: false});
        Backbone.history.navigate('');
    });

    test('#2765 - Fragment matching sans query/hash.', 2, function (t) {
        Backbone.history.stop();
        Backbone.history = _.extend(new Backbone.History(), {
            location: location,
            history: {
                pushState: function (state, title, url) {
                    t.strictEqual(url, '/path?query#hash');
                }
            }
        });

        var Router = Backbone.Router.extend({
            routes: {
                path: function () {t.ok(true); }
            }
        });
        var router = new Router({ history: Backbone.history });

        location.replace('http://example.com/');
        Backbone.history.start({pushState: true, hashChange: false});
        Backbone.history.navigate('path?query#hash', true);
    });

    test('Do not decode the search params.', 1, function (t) {
        var Router = Backbone.Router.extend({
            routes: {
                path: function (params) {
                    t.strictEqual(params, 'x=y z');
                }
            }
        });
        var router = new Router({ history: Backbone.history });
        Backbone.history.navigate('path?x=y%20z', true);
    });

    test('Navigate to a hash url.', 1, function (t) {
        Backbone.history.stop();
        Backbone.history = _.extend(new Backbone.History(), {location: location});
        Backbone.history.start({pushState: true});
        var Router = Backbone.Router.extend({
            routes: {
                path: function (params) {
                    t.strictEqual(params, 'x=y');
                }
            }
        });
        var router = new Router({ history: Backbone.history });
        location.replace('http://example.com/path?x=y#hash');
        Backbone.history.checkUrl();
    });

    test('#navigate to a hash url.', 1, function (t) {
        Backbone.history.stop();
        Backbone.history = _.extend(new Backbone.History(), {location: location});
        Backbone.history.start({pushState: true});
        var Router = Backbone.Router.extend({
            routes: {
                path: function (params) {
                    t.strictEqual(params, 'x=y');
                }
            }
        });
        var router = new Router({ history: Backbone.history });
        Backbone.history.navigate('path?x=y#hash', true);
    });

    test('unicode pathname', 1, function (t) {
        location.replace('http://example.com/myyjä');
        Backbone.history.stop();
        Backbone.history = _.extend(new Backbone.History(), {location: location});
        var Router = Backbone.Router.extend({
            routes: {
                'myyjä': function () {
                    t.ok(true);
                }
            }
        });
        var router = new Router({ history: Backbone.history });
        Backbone.history.start({pushState: true});
    });

    test('newline in route', 1, function (t) {
        location.replace('http://example.com/stuff%0Anonsense?param=foo%0Abar');
        Backbone.history.stop();
        Backbone.history = _.extend(new Backbone.History(), {location: location});
        var Router = Backbone.Router.extend({
            routes: {
                'stuff\nnonsense': function () {
                    t.ok(true);
                }
            }
        });
        new Router({ history: Backbone.history });
        Backbone.history.start({pushState: true});
    });

    test('Router#execute receives callback, args, name.', 3, function (t) {
        location.replace('http://example.com#foo/123/bar?x=y');
        Backbone.history.stop();
        Backbone.history = _.extend(new Backbone.History(), {location: location});
        var Router = Backbone.Router.extend({
            routes: {'foo/:id/bar': 'foo'},
            foo: function () {},
            execute: function (callback, args, name) {
                t.strictEqual(callback, this.foo);
                t.deepEqual(args, ['123', 'x=y']);
                t.strictEqual(name, 'foo');
            }
        });
        var router = new Router({ history: Backbone.history });
        Backbone.history.start();
    });

    test("pushState to hashChange with only search params.", 1, function (t) {
        Backbone.history.stop();
        location.replace('http://example.com?a=b');
        location.replace = function (url) {
            t.strictEqual(url, '/#?a=b');
        };
        Backbone.history = _.extend(new Backbone.History(), {
            location: location,
            history: null
        });
        Backbone.history.start({pushState: true});
    });

    test("#3123 - History#navigate decodes before comparison.", 1, function (t) {
        Backbone.history.stop();
        location.replace('http://example.com/shop/search?keyword=short%20dress');
        Backbone.history = _.extend(new Backbone.History(), {
            location: location,
            history: {
                pushState: function () {t.ok(false); },
                replaceState: function () {t.ok(false); }
            }
        });
        Backbone.history.start({pushState: true});
        Backbone.history.navigate('shop/search?keyword=short%20dress', true);
        t.strictEqual(Backbone.history.fragment, 'shop/search?keyword=short dress');
    });

    test('#3175 - Urls in the params', 1, function (t) {
        Backbone.history.stop();
        location.replace('http://example.com#login?a=value&backUrl=https%3A%2F%2Fwww.msn.com%2Fidp%2Fidpdemo%3Fspid%3Dspdemo%26target%3Db');
        Backbone.history = _.extend(new Backbone.History(), {location: location});
        var router = new Backbone.Router({ history: Backbone.history });
        router.route('login', function (params) {
            t.strictEqual(params, 'a=value&backUrl=https%3A%2F%2Fwww.msn.com%2Fidp%2Fidpdemo%3Fspid%3Dspdemo%26target%3Db');
        });
        Backbone.history.start();
    });

    test("redirectTo", 2, function (t) {
        Backbone.history.stop();
        location.replace('http://example.com/redirect');
        Backbone.history = _.extend(new Backbone.History(), {location: location});
        var router = new Backbone.Router({ history: Backbone.history });
        router.route('redirect', function () {
            t.ok('yup');
            this.redirectTo('other');
        });
        router.route('other', function () {
            t.pass();
        });
        Backbone.history.start({pushState: true});
    });

})();
