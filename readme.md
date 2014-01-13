# bindview.js

Simple and flexible DOM data binding and DOM templating library.

Based on some ideas from [rivets.js](http://www.rivetsjs.com/) and [angular.js](http://angularjs.org/),
written in plain javascript.

## Requires

- IE8+ / FF / Chrome
- jQuery
- <http://ejohn.org/blog/simple-javascript-inheritance/> (included)

## Quick usage example

Define a view:
```
#!html
<div id="bindto">

    Name: <input type="text" bind-value="name" />

    <h2>Hello {{ name.toUpperCase () }}!</h2>

</div>
```

Activate the binding:
```
#!js
$('#bindto').bindview ({ name: 'John Finch' });
```

## Features

### POJO binding

bindiew.js binds to Plain Old Javascipr Objects, so there's no need to use some
propiretary library to wrap the model.

```
#!js
$('#bindto').bindview
({
    name: 'John Finch',
    articles: [ { ... }, ...],
});
```

### Binders

```
#!html
<span bind-text="item.summary"></span>
```

Binders create a binding that auto-updates when the model data
changes, or when the user interacts with the DOM.

### Expressions

```
#!html
<p class="lead">{{ article.lead.substr(0, 100) + '...' }}</p>

```

You can use complex expressions in bindings, to help augment your view with some presentational logic.

