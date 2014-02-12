# bindview.js

Simple and flexible DOM data binding and DOM templating library.

Based on some ideas from [rivets.js](http://www.rivetsjs.com/) and [angular.js](http://angularjs.org/),
written in plain javascript.

## requires

  - IE9 / FF / Chrome
  - jQuery 1.10
  - <http://ejohn.org/blog/simple-javascript-inheritance/> (included)

## features

  - **DOM based templating**:
    instead of string templates, bindview manipulates the DOM directly
  - **POJO binding**:
    bindview.js bounds to _Plain Old Javascript Objects_
  - **bi-directional data binding**:
    update the DOM with your data, and vice versa
  - **expressions**:
    a simple expression language to allow manipulating values
  - **iteration binding**:
    for binding items in an array / members of an object
  - **event handlers**:
    for responsive, interactive UI-s
  - **hackable API**:
    easily extendable with new types of bindings

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

bindiew.js binds to Plain Old Javascipt Objects, so there's no need to use some
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
<p class="lead">{{ article.lead.substr(0, 100) }}...</p>

```

You can use simple expressions in bindings, to help augment your view with some presentational logic.

