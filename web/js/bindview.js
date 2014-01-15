//=========================================================
// bindview.js
//---------------------------------------------------------

(function ($, global, undefined)
{
    'use strict';

    var Watcher = Class.extend
    ({
        init: function ()
        {
            this.id       = $.fn.bindview.defaults.prefix+'-id';
            this.weakrefs = [];
        },
        map: function (object)
        {
            if (object[this.id] == null)
            {
                this.weakrefs[this.weakrefs.length] = { callbacks: {} };
                Object.defineProperty (object, this.id,
                    {
                        value: (this.weakrefs.length -  1)
                    });
            }

            return this.weakrefs[object[this.id]];
        },
        // --------
        get: function (object, property)
        {
            return object[property];
        },
        set: function (object, property, value)
        {
            object[property] = value;
        },
        // --------
        watch: function (object, property, handler)
        {
            var callbacks = this.map (object).callbacks;

            if (callbacks[property] == null)
            {
                var value = object[property],
                    self  = this;

                callbacks[property] = [];

                Object.defineProperty (object, property,
                    {
                        get : function () { return value; },
                        set : function (newValue)
                        {
                            if (value != newValue)
                            {
                                var oldValue = value;
                                value = newValue;

                                for (var i = 0, callback; callback = callbacks[property][i]; i++)
                                    callback (newValue);

                                self.unwatch_mutations (oldValue, object[this.id], property);
                                self.watch_mutations (newValue, object[this.id], property);

                                return newValue;
                            }
                        }
                    });
            }

            if (callbacks[property].indexOf (handler) < 0)
                callbacks[property].push (handler);

            this.watch_mutations (object[property], object[this.id], property);
        },
        unwatch: function (object, property, handler)
        {
            var callbacks= this.map (object).callbacks[property];

            if (handler)
            {
                if (callbacks.indexOf (handler) != -1)
                    callbacks.splice (callbacks.indexOf (handler), 1);
            }
            else
                callbacks.length = 0;
        },
        // --------
        stub: function (array, method)
        {
            var original = array[method],
                map = this.map (array),
                self = this;

            array[method] = function ()
            {
                var result = original.apply (this, arguments);

                for (var id in map.pointers)
                {
                    for (var i = 0, property; property = map.pointers[id][i]; i++)
                    {
                        var callbacks = self.weakrefs[id] && (self.weakrefs[id].callbacks[property] || []);
                        for (var j = 0, callback; callback = callbacks[j]; j++)
                            callback (this);
                    }
                }
                return result;
            }
        },
        watch_mutations: function (array, id, property)
        {
            if (!$.isArray (array))
                return;

            var methods = ['push', 'pop', 'shift', 'unshift', 'sort', 'reverse', 'splice'],
                map = this.map (array);

            if (map.pointers == null)
            {
                map.pointers = {};
                for (var i = 0, method; method = methods[i]; i++)
                    this.stub (array, method);
            }

            if (map.pointers[id] == null)
                map.pointers[id] = [];

            if (map.pointers[id].indexOf (property) < 0)
                map.pointers[id].push (property);
        },
        unwatch_mutations: function (array, id, property)
        {
            if (!$.isArray (array) || array[this.id] == null)
                return;

            var map = this.map (array);

            if (map.pointer
                && $.isArray (map.pointers[id])
                && map.pointers[id].indexOf (property) != -1)
                map.pointers[id].splice (map.pointers[id].indexOf (property), -1)
        }
    });

    //-----------------------------------------------------

    var terminals =
    {
        // note: token matching order matters!
        // -- consts
        'true'      : 'true',
        'false'     : 'false',
        'null'      : 'null',
        // -- basic
        'ws'        : '\\s+',
        'string'    : "?:'([^']*?)'",
        'name'      : '[\\$a-zA-Z_][\\$a-zA-Z_0-9]*',
        'number'    : '\\d+(?:\\.\\d+(?:[eE][-+]?\\d+)?)?',
        // -- operators
        'eq'        : '\\=\\=',
        'neq'       : '\\!\\=',
        'lteq'      : '\\<\\=',
        'gteq'      : '\\>\\=',
        'and'       : '\\&\\&',
        'or'        : '\\|\\|',
        'inc'       : '\\+\\+',
        'dec'       : '\\-\\-',
        'add'       : '\\+',
        'sub'       : '\\-',
        'mul'       : '\\*',
        'div'       : '\\/',
        'mod'       : '\\%',
        'assign'    : '\\=',
        'lt'        : '\\<',
        'gt'        : '\\>',
        'not'       : '\\!',
        //'if'        : '\\?',       // not implemented, yet
        'colon'     : '\\:',
        'comma'     : '\\,',
        'dot'       : '\\.',
        'lparen'    : '\\(',
        'rparen'    : '\\)',
        'lbracket'  : '\\[',
        'rbracket'  : '\\]',
        'lbrace'    : '\\{',
        'rbrace'    : '\\}',
        //  -- anything else
        'invalid'   : '.+?'
    };

    var precedence_table =
    [
        // infix
        ['assign'],
        //['if'],       // not implemented, yet
        ['or'],
        ['and'],
        ['eq','neq'],
        ['lt', 'lteq', 'gt', 'gteq'],
        ['add', 'sub'],
        ['mul', 'div', 'mod']
    ];

    //-----------------------------------------------------

    var operators1 =
    {
        sub : function (a) { return (-a); },
        not : function (a) { return (!a); }
    }

    var operators2 =
    {
        assign : function (a, b) { return (a = b); },
        add    : function (a, b) { return (a + b); },
        sub    : function (a, b) { return (a - b); },
        mul    : function (a, b) { return (a * b); },
        div    : function (a, b) { return (a / b); },
        mod    : function (a, b) { return (a % b); },
        and    : function (a, b) { return (a && b); },
        or     : function (a, b) { return (a || b); },
        eq     : function (a, b) { return (a == b); },
        neq    : function (a, b) { return (a != b); },
        lt     : function (a, b) { return (a < b); },
        lteq   : function (a, b) { return (a <= b); },
        gt     : function (a, b) { return (a > b); },
        gteq   : function (a, b) { return (a >= b); }
    };

    var mutators =
    {
        inc : function (a) { return (a = a + 1); },
        dec : function (a) { return (a = a - 1); }
    }

    //-----------------------------------------------------

    // a = b
    // a + b,  a - b,
    // a * b,  a / b, a % b
    // a || b, a && b
    // a < b,  a <= b,
    // a < b,  a >= b
    // a == b, a != b
    var Expr = Class.extend
    ({
        // -- watchable
        value   : null,
        // ------------------------------------------------
        init: function (op, lval, rval)
        {
            this.op   = operators2[op];
            this.lval = lval;
            this.rval = rval;

            this.update = this.update.bind (this);
            this.update ();
            this.checkconst (this.update, this.lval, this.rval);
        },
        update: function ()
        {
            this.value = this.op (this.lval.value, this.rval.value);
        },
        publish: function (value)
        {
        },
        // ------------------------------------------------
        checkconst: function (update)
        {
            var exprs  = [];

            for (var i = 1, arg; arg = arguments[i]; i++)
            {
                if ($.isArray (arg))
                    exprs = exprs.concat (arg);
                else
                    exprs.push (arg);
            }

            this.isconst = true;
            for (var i = 0, expr; expr = exprs[i]; i++)
            {
                this.isconst = this.isconst && expr.isconst;

                if (!expr.isconst)
                    watcher.watch (expr, 'value', update)
            }
        }
    });

    // -a, !a
    var UnaryExpr = Expr.extend
    ({
        init: function (op, lval, rval)
        {
            this.op   = operators1[op];
            this.lval = lval;

            this.update = this.update.bind (this);
            this.update ();
            this.checkconst (this.update, this.lval);
        },
        update: function ()
        {
            this.value = this.op (this.lval.value);
        }
    })

    // true, false, null,
    // number,
    // string
    var ConstantExpr = Expr.extend
    ({
        isconst: true,
        init: function (value)
        {
            this.value = value;
        }
    });

    // name
    // name.name
    var PropertyAccess = Expr.extend
    ({
        init: function (lval, name)
        {
            this.lval = lval;
            this.name = name;

            this.readonly = !$.isPlainObject (this.lval.value)
                            || $.isFunction (this.lval.value[this.name]);

            this.update = this.update.bind (this);
            this.update ();
            //this.checkconst (this.update, this.lval);

            if (!this.readonly)
                watcher.watch (this.lval.value, this.name, this.update);

        },
        update: function ()
        {
            this.value = this.lval.value[this.name];
        },
        publish: function (value)
        {
            if (!this.readonly)
                this.lval.value[this.name] = value;
        }
    });

    // name[expr]
    var IndexAccess = Expr.extend
    ({
        init: function (lval, rval)
        {
            this.lval = lval;
            this.rval = rval;

            this.readonly = !$.isArray (this.lval.value)
                            || $.isFunction (this.lval.value[this.rval.value]);

            this.update = this.update.bind (this);
            this.update ();
            this.checkconst (this.update, this.lval, this.rval);
        },
        update: function ()
        {
            if (!this.readonly && (this.index != this.rval.value))
            {
                if (typeof (this.index) != 'undefined')
                    watcher.unwatch (this.lval.value, this.index, this.update);

                this.index = this.rval.value;
                watcher.watch (this.lval.value, this.index, this.update);
            }

            this.value = this.lval.value[this.index];
        },
        publish: function (value)
        {
            if (!this.readonly)
                this.lval.value[this.index] = value;
        }
    });

    // ++a --a
    // a++ a--
    var Mutator = Expr.extend
    ({
        init: function (op, lval, post)
        {
            this.op   = mutators[op];
            this.lval = lval;
            this.post = post;

            this.update = this.update.bind (this);
            this.update ();
            this.checkconst (this.update, this.lval);
        },
        update: function ()
        {
            // do not disturb (update) again, when op is called
            if (this.dnd)
            {
                this.dnd = false;
                return;
            }
            this.dnd = true;

            // call op
            if (this.post)
            {
                this.value = this.lval.value;
                this.op (this.lval.value);
            }
            else
                this.value = this.op (this.lval.value);
        }
    });

    // [ expr, ... ]
    var ArrayExpr = Expr.extend
    ({
        init: function (values)
        {
            this.values = values;

            this.update = this.update.bind (this);
            this.update ();
            this.checkconst (this.update, this.values);
        },
        update: function ()
        {
            var array = [];

            for (var i = 0, expr; expr = this.values[i]; i++)
                array[i] = expr.value;

            this.value = array;
        }
    });

    // { name: expr, ... }
    var ObjectExpr = Expr.extend
    ({
        init: function (values)
        {
            this.values = values;

            var exprs = [];
            for (var key in this.values)
                exprs.push (this.values[key]);

            this.update = this.update.bind (this);
            this.update ();
            this.checkconst (this.update, exprs);
        },
        update: function ()
        {
            var object = {};

            for (var key in this.values)
                object[key] = this.values[key].value;

            this.value = object;
        }
    });

    //name (expr, ... )
    var CallExpr = Expr.extend
    ({
        init: function (lval, args, scope)
        {
            this.lval  = lval;
            this.args  = args;
            this.scope = scope;

            if (!(this.lval instanceof PropertyAccess)
                || !$.isFunction (this.lval.value)
                || (this.lval.name == 'constructor'))
                throw ['invalid call', this];

            this.update = this.update.bind (this);
            this.update ();
            this.checkconst (this.update, this.lval.lval, this.args);
        },
        update: function ()
        {
            var args = [];

            for (var i = 0, expr; expr = this.args[i]; i++)
                args[i] = expr.value;

            this.value = this.lval.value.apply (this.lval.lval.value, args);
        }
    });

    //-----------------------------------------------------

    var Parser = Class.extend
    ({
        init: function ()
        {
            var patterns = [];

            this.types = [];

            for (var token in terminals)
            {
                this.types.push (token);
                patterns.push (terminals[token]);
            }

            this.tokenizer = new RegExp ('('+patterns.join (')|(')+')', 'g');
        },
        //-------------------------------------------------
        parse: function (source, scope)
        {
            this.tokenize (source);
            this.scope = scope;

            var value = this.descent_parser (0);
            this.expect ('end');

            return value;
        },
        tokenize: function (source)
        {
            this.source  = source;
            this.tokens  = [];
            this.current = 0;

            var match;
            while (match = this.tokenizer.exec (source))
            {
                for (var i = 0, type; type = this.types[i]; i++)
                {
                    if (typeof (match[i + 1]) != 'undefined')
                    {
                        if (type != 'ws')
                            this.tokens.push ({ type: type, value: match[i + 1], index: match.index });
                        break;
                    }
                }
            }

            this.tokens.push ({type: 'end', index: source.length });
        },
        //-------------------------------------------------
        token: function ()
        {
            return this.tokens[this.current];
        },
        next: function ()
        {
            this.current++;
            return this.token();
        },
        peek: function (type)
        {
            return (this.token().type == type);
        },
        expect: function (type, skip)
        {
            var token = this.token ();

            if  (token.type != type)
            {
                this.error
                (
                    'unexpected "'+token.type+'"'+
                    (token.value ? ' ("'+token.value+'")' : '')+
                    ', expecting "'+type+'"'
                );
            }

            (skip !== false) && this.next ();
        },
        error: function (message, token)
        {
            token || (token = this.token ());

            message += '\n\t';

            if (token && token.index)
                message += ' at character '+token.index;

            message += ' in "'+this.source+'".';
            throw 'parse error: '+message;
        },
        // ------------------------------------------------
        descent_parser: function (level)
        {
            if (typeof (precedence_table[level]) == 'undefined')
                return this.parse_unary_expr ();

            var lval = this.descent_parser (level + 1);

            if (!lval) return null;

            while (true)
            {
                var token = this.token ();

                if (precedence_table[level].indexOf (token.type) == -1)
                    break;

                this.next ();
                lval = (new Expr (token.type, lval, this.descent_parser (level)));
            }

            return lval;
        },
        parse_unary_expr: function ()
        {
            var token = this.token ();

            switch (token.type)
            {
                case 'sub':
                case 'not':
                    this.next ();
                    return (new UnaryExpr (token.type, this.parse_unary_expr ()));
                    break;

                case 'inc':
                case 'dec':
                    this.next ();
                    return (new Mutator (token.type, this.parse_unary_expr (), false));
                    break;

                default:
                    break;
            }

            return this.parse_postfix_expr ();
        },
        parse_postfix_expr: function ()
        {
            var lval = this.parse_literal_expr (),
                done = false;

            if (!lval) return null;

            do
            {
                var token = this.token ();

                switch (token.type)
                {
                    case 'inc':
                    case 'dec':
                        this.next ();
                        lval = (new Mutator (token.type, lval, true));
                        break;

                    case 'dot':
                        this.next ();
                        this.expect ('name', false);
                        lval = (new PropertyAccess (lval, this.token ().value));
                        this.next();
                        break;

                    case 'lbracket':
                        this.next ();
                        var index= this.descent_parser (0);
                        this.expect ('rbracket');
                        lval = (new IndexAccess (lval, index));
                        break;

                    case 'lparen':
                        lval = this.parse_call (lval);
                        break;

                    default:
                        done = true;
                        break;
                }
            }
            while (!done);

            return lval;
        },
        parse_call: function (lval)
        {
            var args = [];

            do
            {
                this.next ();

                if (this.peek ('rparen'))
                    break;

                args.push (this.descent_parser (0));
            }
            while (this.peek ('comma'));

            this.expect ('rparen');

            return (new CallExpr (lval, args, this.scope));
        },
        parse_literal_expr: function ()
        {
            var token = this.token (),
                value;

            switch (token.type)
            {
                case 'number':
                    value = new Number (parseFloat (token.value));
                    break;

                case 'string':
                    value = new String (token.value);
                    break;

                case 'true':
                    value = new Boolean (true);
                    break;

                case 'false':
                    value = new Boolean (false);
                    break;

                case 'null':
                    value = null;
                    break;

                case 'lbracket':
                    return this.parse_array_literal ();
                    break;

                case 'lbrace':
                    return this.parse_object_literal ();
                    break;

                case 'lparen':
                    this.next ();
                    var expr = this.descent_parser (0);
                    this.expect ('rparen');
                    return expr;
                    break;

                case 'name':
                    this.next();
                    var name = token.value;
                    return (new PropertyAccess
                        (
                            { value: this.scope, isconst: false },
                            token.value
                        ))
                    break;

                default:
                    this.expect ('expression', false);
                    return null;
                    break;
            }

            this.next ();
            return (new ConstantExpr (value));
        },
        parse_array_literal: function ()
        {
            var value = [];

            do
            {
                this.next ();

                if (this.peek ('rbracket'))
                    break;

                value.push (this.descent_parser (0));
            }
            while (this.peek ('comma'));

            this.expect ('rbracket');

            return (new ArrayExpr (value));
        },
        parse_object_literal: function ()
        {
            var value = {};

            do
            {
                var token = this.next ();

                if (this.peek ('rbrace'))
                    break;

                if (!this.peek ('name'))
                    this.expect ('string', false);

                var key = token.value;
                this.next ();

                if (typeof (value[key]) != 'undefined')
                    this.error ('property "'+key+'" already defined', token);

                this.expect ('colon');

                value[key] = this.descent_parser (0);
            }
            while (this.peek ('comma'));

            this.expect ('rbrace');

            return (new ObjectExpr (value));
        },
    });

    var parser = new Parser ();

    //-----------------------------------------------------

    var Binder = Class.extend
    ({
        init: function (view, scope, element, type, arg, attr)
        {
            this.scope   = scope;
            this.element = element;
            this.type    = type;
            this.arg     = arg;
            this.attr    = attr;

            this.publish = this.publish.bind (this);
            this.render  = this.render.bind (this);
            this.bind ();
        },
        publish: function ()
        {
            this.expr.publish (this.val ());
        },
        val: function ()
        {
            return $(this.element).val ();
        },
        // --------
        bind: function ()
        {
            this.expr = parser.parse (this.attr, this.scope);
            watcher.watch (this.expr, 'value', this.render);
            this.attach ();
            this.render (this.expr.value);
        },
        unbind: function ()
        {
            this.detach ();
            watcher.unwatch (this.expr, 'value', this.render);
        },
        //-----
        attach: function ()
        {
        },
        detach: function ()
        {
        },
        render: function (value)
        {
        }
    });

    //-----------------------------------------------------

    var View = Class.extend
    ({
        init: function (element, scope)
        {
            this.prefix   = new RegExp ('^'+$.fn.bindview.defaults.prefix+'-');
            this.element  = $(element);
            this.scope    = scope;
            this.bindings = [];

            this.bind ();
        },
        bind: function ()
        {
            var self = this;
            this.element.each (function ()
            {
                self.parse (this, self.scope);
            });
        },
        unbind: function ()
        {
            for (var i = 0, binding; binding = this.bindings[i]; i++)
                binding.unbind ();
        },
        parse: function (node, scope)
        {
            if (node.nodeType == 3)
            {
                var text  = $(node).text (),
                    re    = new RegExp('(?:\\{\\{(.*?)\\}\\})', 'g'),
                    delta = 0,
                    match;

                if (text.trim () && (re.test (text)))
                {
                    re.lastIndex = 0;
                    while (match = re.exec (text))
                    {
                        var token = node.splitText (match.index - delta);
                        node = token.splitText (match[0].length);
                        delta = match.index + match[0].length;

                        this.bindings.push
                        (
                            new $.fn.bindview.defaults.binders['text']
                            (this, scope, token, 'text', undefined, match[1].trim ())
                        );
                    }
                }
            }
            else
            if (node.attributes != null)
            {
                var block = false;

                for (var j = 0, attr; attr = node.attributes[j]; j++)
                {
                    if (this.prefix.test (attr.name))
                    {
                        var binder = this.bind_attr (scope, node, attr);
                        this.bindings.push (binder);
                        block = (block || binder.block);
                    }
                }

                if (!block)
                {
                    for (var child = node.firstChild; child; child = child.nextSibling)
                        this.parse (child, scope);
                }
            }
        },
        bind_attr:  function (scope, node, attr)
        {
            var type  = attr.name.replace (this.prefix, ''),
                binder = $.fn.bindview.defaults.binders[type],
                arg;

            if (!binder)
            {
                for (var key in $.fn.bindview.defaults.binders)
                {
                    if (key.indexOf ('*') > 0)
                    {
                        var regexp = new RegExp ('^'+(key.replace ('*', '(.+?)')+'$'));

                        if (regexp.test (type))
                        {
                            binder = $.fn.bindview.defaults.binders[key];
                            arg = regexp.exec (type)[1];
                            break;
                        }
                    }
                }
            }

            binder || (binder = $.fn.bindview.defaults.binders['*']);

            return new binder (this, scope, node, type, arg, attr.value)
        }
    });

    //-----------------------------------------------------

    $.fn.bindview = function (scope)
    {
        return (new View (this, scope || {}));
    }

    $.fn.bindview.defaults =
    {
        prefix  : 'bind',
        binders :
        {
            '*': Binder.extend
                ({
                    render: function (value)
                    {
                        $(this.element).attr (this.type, (value || undefined));
                    }
                }),
            'show': Binder.extend
                ({
                    render: function (value)
                    {
                        (value
                            ? $(this.element).show ()
                            : $(this.element).hide ());
                    }
                }),
            'text': Binder.extend
                ({
                    render: function (value)
                    {
                        value = (value != null ? value : '');
                        return (this.element.textContent != null
                            ? (this.element.textContent = value)
                            : (this.element.innerText = value));
                    }
                }),
            'html': Binder.extend
                ({
                    render: function (value)
                    {
                        $(this.element).html (value || '');
                    }
                }),
            'value': Binder.extend
                ({
                    attach: function ()
                    {
                        $(this.element).on ('change keyup blur', this.publish);
                    },
                    detach: function ()
                    {
                        $(this.element).off ('change keyup blur', this.publish);
                    },
                    render: function (value)
                    {
                        if (!$(this.element).is (':focus'))
                            $(this.element).val (value);
                    }
                }),
            'data-*': Binder.extend
                ({
                    render: function (value)
                    {
                        $(this.element).data (this.arg, (value || undefined));
                    }
                }),
            'on-*': Binder.extend
                ({
                    detach: function ()
                    {
                        if (this.handler)
                            $(this.element).off (this.arg, this.handler);
                    },
                    render: function (value)
                    {
                        var self = this;
                        this.detach ();
                        $(this.element).on (this.arg, (this.handler = function (event)
                            {
                                var args = $(self.element).data (self.type);
                                args = ($.isArray (args) ? args : [ args ]);
                                value.apply (self, [ event ].concat (args));
                            }));
                    }
                }),
            'repeat-*': Binder.extend
                ({
                    block: true,
                    attach: function ()
                    {
                        this.template = document.createDocumentFragment ();
                        this.iterated = [];

                        var node = this.element.firstChild,
                            next = node.nextSibling;

                        while (node)
                        {
                            this.template.appendChild (node);
                            node = next;
                            next = node && node.nextSibling;
                        }
                    },
                    detach: function ()
                    {
                        this.render (null);
                    },
                    render: function (collection)
                    {
                        collection = collection || [];

                        while (this.iterated.length > collection.length)
                        {
                            var view = this.iterated.pop ();
                            view.unbind ();
                            view.element.remove ();
                        }

                        for (var i = 0, item; item = collection[i]; i++)
                        {
                            if (this.iterated[i])
                            {
                                if (typeof (item) != 'object')
                                    this.iterated[i].scope[this.arg] = item;
                                continue;
                            }

                            var frag     = this.template.cloneNode (true),
                                elements = $(frag.childNodes),
                                scope    = {};

                            scope['$parent'] = this.scope;
                            scope['$index']  = i;
                            scope[this.arg]  = item;

                            this.iterated.push (new View (elements, scope));

                            this.element.appendChild (frag);
                        }
                    }
                })
        }
    };

    var watcher = new Watcher ();

})(jQuery, window);
