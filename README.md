# ampersand-router

Clientside router with fallbacks for browsers that don't support pushState. Mostly lifted from Backbone.js.

<!-- starthide -->
Part of the [Ampersand.js toolkit](http://ampersandjs.com) for building clientside applications.
<!-- endhide -->

## install

```
npm install ampersand-router
```

## example

```javascript
var Router = require('ampersand-router');


module.exports = Router.extend({
    routes: {
        '': 'home',
        'collections/:id': 'collections',
        'info': 'info'
    },

    // ------- ROUTE HANDLERS ---------
    home: function () {
        this.trigger('newPage', new HomePage());
    },

    ...
}};
```

<!-- starthide -->
## credits

All credit goes to Jeremy Ashkenas and the rest of the Backbone.js authors.

If you like this follow [@HenrikJoreteg](http://twitter.com/henrikjoreteg) on twitter.

## license

MIT
<!-- endhide -->
