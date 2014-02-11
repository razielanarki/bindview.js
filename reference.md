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
  - **Bi-directional data binding**:
    update the DOM with your data, and vice versa
  - **Expressions**:
    a simple expression language to allow manipulating values
  - **Iteration binding**:
    for binding items in an array / members of an object
  - **event handlers**:
    for interactive UI-s
  - **hackable API**:
    easily extendable with new types of bindings

# reference

## getting started

include the necessary javascript files in your project:

```
#!html
<script type="text/javascript" src="js/jquery-1.10.2.min.js"></script>
<script type="text/javascript" src="js/class.js"></script>
<script type="text/javascript" src="js/bindview.js"></script>
```

### creating a view


first, we need to define a template for our view.

```
#!html
<div id="bindto">

    Name: <input type="text" bind-value="name" />

    <h2>Hello {{ name }}!</h2>

</div>
```

### binding the view

use the `$.bindview` function  to bind some data to the view.

```
#!js
var boundview = $('#bindto').bindview ({ name: 'John Finch' });
```

the function accepts an object (called the "scope" of the view) to be bound to the template,
and returns with a reference to the view, which later can be unbound, and discarded if not needed anymore:

```
#!js
boundview.unbind ();
```

## template syntax

### special attributes

bindview.js reads special attributes on the tags to attach bindings to specified places.

the attributes must start with `bind-`, and their value is always an expression.

```
#!html
<input type="text" bind-value="name">
```

see later for explanation of available binders.


### text interpolation

you can interpolate text content with a binding by surrounding an expression with double curly braces:

```
#!html
<div>Hello {{ name.toUpperCase() }}</div>
```

the former is functionally equivalent to writing this:

```
#!html
<div>Hello <span bind-text="name.toUpperCase()"></span></div>
```

## binders

### default binders

#### `bind-*`
the default binder, used if no other binder name matches.

updates an attibute with the expression value.

example:
```
#!html
<td bind-colspan="cols.count"> ... </td>
```

#### `bind-show`
shows/hides an element depeding on whether the expression is truthy / falsy

example:
```
#!html
<div bind-show="$index == (array.length - 1)"> this is the last item </div>
```

#### `bind-visible`
same as `bind-show`, but toggles the visibility of an element
(ie: the layout does not collapse around it)

#### `bind-text`
binds the result of the expression to the `textContent` of a node, escaping special characters as necessary

```
#!html
<span bind-text="user.about_me"></span>
```
interpolated bindings, marked in the content of the nodes behave the same way
(except they bind to a `TextNode` instead of a `HTMLElement` node)

```
#!html
<div> ... {{ user.about_me }} ... </div>
```

#### `bind-html`
binds the result of the expression to the `innertHTML` of a node.
this does not escape special characters, and can be used to  change the dom:

```
#!html
<div bind-html="markdown.preview (source)"></div>
```

#### `bind-to`
binds the value attribute of a html element to the expression,
(but does not bind the expression to the input field.)

useful if you have multiple inputs with different values, that should store their value, if selected, to the same place:

```
#!html
<input type="radio" name="option" bind-checked="selected == 1" bind-to="selected" value="1" />
<input type="radio" name="option" bind-checked="selected == 2" bind-to="selected" value="2" />
```

#### `bind-value`
a two-way binding for the value of the html element:
changing the value on the element changes the bound js value, and changing the js value changes the value on the element.

```
#!html
<input type="text" bind-value="name" />
```

#### `bind-data-*`
binds the value of an  expression to a data attribute.

well not "really", just with a jQuery `$.data()` call, so complex objects may be stored this way.

```
#!html
<input bind-data-attribute="variable" />
```

it's also useful, if you want to pass arguments to the event handlers, the event handler reads parameters
form the value of the matching data attribute: a single value is passed as the first argument, and an array of values are passed asmultiple arguments

```
#!html
<button bind-on-click="log_me" bind-data-on-click="[arg1, arg2, arg3]">log me!</button>
```

#### `bind-on-*`
binds a function to be executed on a specific event. the event name can be anything.

**WARNING**: binding to a a _function via it's name_ (ie: `"log_me"`),
and binding to a _result of a function call_ (ie: `"log_me()"`)  is two very different things!
always bind to function **names** and **not calls**.

**NOTE**: to pass parameters to use the `bind-data-on-*` binding syntax, see above.

```
#!html
<button bind-on-click="sayhello">hello?!</button>
```

#### `bind-repeat-*`

!fixme

### extending bindview.js

!fixme

## expressions

!fixme
