# ampersand-router

Clientside router with fallbacks for browsers that don't support pushState. Mostly lifted from [Backbone.js](http://backbonejs.org/#Router).

Ampersand-router also adds a `redirectTo` method which is handy for doing "internal" redirects without breaking backbutton functionality in the browser.

<!-- starthide -->
Part of the [Ampersand.js toolkit](http://ampersandjs.com) for building clientside applications.
<!-- endhide -->

## install

```
npm install ampersand-router
```

<!-- starthide -->
## example

```javascript
var Router = require('ampersand-router');


module.exports = Router.extend({
    routes: {
        '': 'home',
        'users/:id': 'userDetail',
        'info': 'info'
    },

    // ------- ROUTE HANDLERS ---------
    home: function () {
        this.trigger('newPage', new HomePage());
    },

    // redirect example
    userDetail: function (id) {
        var user = app.users.get(id);
        if (user) {
            this.trigger('newPage', new HomePage());
        } else {
            this.redirectTo('users');
        }
    }

    ...
});
```
<!-- endhide -->

## API Reference

### extend `AmpersandRouter.extend(properties)`

Get started by creating a custom router class. Define actions that are triggered when certain URL fragments are matched, and provide a [routes](#ampersand-router-routes) hash that pairs routes to actions. Note that you'll want to avoid using a leading slash in your route definitions:

```javascript
var AppRouter = AmpersandRouter.extend({

  routes: {
    "help":                 "help",    // #help
    "search/:query":        "search",  // #search/kiwis
    "search/:query/p:page": "search"   // #search/kiwis/p7
  },

  help: function() {
    //...
  },

  search: function(query, page) {
    //...
  }

});
```

### routers `router.routes`

The routes hash maps URLs with parameters to functions on your router (or just direct function definitions, if you prefer), similar to the [View](#ampersand-view)'s [events hash](#ampersand-view-events). Routes can contain parameter parts, `:param`, which match a single URL component between slashes; and splat parts `*splat`, which can match any number of URL components. Part of a route can be made optional by surrounding it in parentheses `(/:optional)`.

For example, a route of `"search/:query/p:page"` will match a fragment of `#search/obama/p2`, passing `"obama"` and `"2"` to the action.

A route of `"file/*path"` will match `#file/nested/folder/file.txt`, passing `"nested/folder/file.txt"` to the action.

A route of `"docs/:section(/:subsection)"` will match #docs/faq and #docs/faq/installing, passing `"faq"` to the action in the first case, and passing `"faq"` and `"installing"` to the action in the second.

Trailing slashes are treated as part of the URL, and (correctly) treated as a unique route when accessed. `docs` and `docs/` will fire different callbacks. If you can't avoid generating both types of URLs, you can define a `"docs(/)"` matcher to capture both cases.

When the visitor presses the back button, or enters a URL, and a particular route is matched, the name of the action will be fired as an event, so that other objects can listen to the router, and be notified. In the following example, visiting `#help/uploading` will fire a `route:help` event from the router.

```javascript
routes: {
  "help/:page":         "help",
  "download/*path":     "download",
  "folder/:name":       "openFolder",
  "folder/:name-:mode": "openFolder"
}

router.on("route:help", function(page) {
  ...
});
```

### constructor / initialize `new Router([options])`

When creating a new router, you may pass its routes hash directly as an option, if you choose. All options will also be passed to your `initialize` function, if defined.

### route `router.route(route, name, [callback])`

Manually create a route for the router, The `route` argument may be a routing string or regular expression. Each matching capture from the route or regular expression will be passed as an argument to the callback. The `name` argument will be triggered as a `"route:name"` event whenever the route is matched. If the `callback` argument is omitted `router[name]` will be used instead. Routes added later may override previously declared routes.

```javascript
initialize: function(options) {

  // Matches #page/10, passing "10"
  this.route("page/:number", "page", function(number){ ... });

  // Matches /117-a/b/c/open, passing "117-a/b/c" to this.open
  this.route(/^(.*?)\/open$/, "open");

},

open: function(id) { ... }
```

### navigate `router.navigate(fragment, [options])`

Whenever you reach a point in your application that you'd like to save as a URL, call *navigate* in order to update the URL. If you wish to also call the route function, set the `trigger` option to `true`. To update the URL without creating an entry in the browser's history, set the `replace` option to `true`.

```javascript
openPage: function(pageNumber) {
  this.document.pages.at(pageNumber).open();
  this.navigate("page/" + pageNumber);
}

// Or ...

app.navigate("help/troubleshooting", {trigger: true});

// Or ...

app.navigate("help/troubleshooting", {trigger: true, replace: true});
```

### redirectTo `router.redirectTo(fragment)`

Sometimes you want to be able to redirect to a different route in your application without adding an entry in the browser's history. RedirectTo is just a shorthand for calling [navigate](#ampersand-router-navigate) with both `trigger` and `replace` set to `true`.

```javascript
var AppRouter = AmpersandRouter.extend({
    routes: {
        'login': 'login',
        'dashboard': 'dashboard'
    },

    dashboard: function () {
        if (!app.me.loggedIn) return redirectTo('login');

        // show dashboard page...
    }
});
```

### execute `router.execute(callback, args)`

This method is called internally within the router, whenever a route matches and its corresponding callback is about to be executed. Override it to perform custom parsing or wrapping of your routes, for example, to parse query strings before handing them to your route callback, like so:

```javascript
var Router = AmpersandRouter.extend({
  execute: function(callback, args) {
    args.push(parseQueryString(args.pop()));
    if (callback) callback.apply(this, args);
  }
});
```

### history.start `router.history.start([options])`

AmpersandRouter automatically requires and instantiates a single ampersand-history object. AmpersandHistory serves as a global router (per frame) to handle hashchange events or pushState, match the appropriate route, and trigger callbacks. You shouldn't ever have to create one of these yourself since ampersand-router already contains one.

When all of your Routers have been created, and all of the routes are set up properly, call `router.history.start()` on one of your routers to begin monitoring hashchange events, and dispatching routes. Subsequent calls to `history.start()` will throw an error, and `router.history.started` is a boolean value indicating whether it has already been called.

Supported options:

* **pushState** {Boolean} - To indicate that you'd like to use HTML5 pushState support in your application, use `router.history.start({pushState: true})`. __Defaults to false__
* **hashChange** {Boolean} - If you'd like to use pushState, but have browsers that don't support it natively use full page refreshes instead, you can add `{hashChange: false}` to the options. __Defaults to true__
* **root** {String} - If your application is not being served from the root url `/` of your domain, be sure to tell History where the root really is, as an option: `router.history.start({pushState: true, root: "/public/search/"})`. __Defaults to `/`__
* **silent** {Boolean} - If the server has already rendered the entire page, and you don't want the initial route to trigger when starting History, pass `silent: true`. __Defaults to false__

When called, if a route succeeds with a match for the current URL, `router.history.start()` returns `true`. If no defined route matches the current URL, it returns `false`.


<!-- starthide -->
## credits

All credit goes to Jeremy Ashkenas and the rest of the Backbone.js authors.

If you like this follow [@HenrikJoreteg](http://twitter.com/henrikjoreteg) on twitter.

## license

MIT
<!-- endhide -->
