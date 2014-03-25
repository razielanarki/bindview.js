//=========================================================
// bindview.js
//---------------------------------------------------------

(function ($, global, document, undefined)
{
    'use strict';

    //-----------------------------------------------------
    // Watcher API
    //-----------------------------------------------------

    var Watcher = Class.extend
    ({
        init: function ()
        {
            this.id       = $.fn.bindview.prefix+'-id';
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
            // -- array length
            if ($.isArray (object) && property == 'length')
            {
                var map = this.map (object);
                // this is a not-so-weak reference
                map.ref = { ref: object, handler: function (ref) { handler (ref.length); } };
                this.watch (map.ref, 'ref', map.ref.handler);
                return;
            }

            // -- watch
            var descriptor = Object.getOwnPropertyDescriptor (object, property);

            if (descriptor
                && (!descriptor.configurable
                    || (descriptor.value === undefined && !descriptor.get)
                    || descriptor.writable === false))
            {
                return;
            }

            var callbacks = this.map (object).callbacks;

            if (!$.isArray (callbacks[property]))
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
            // -- array length
            if ($.isArray (object) && property == 'length')
            {
                var map = this.map (object);
                if (map.ref)
                {
                    this.unwatch (map.ref, 'ref', map.ref.handler);
                    delete map.ref; // delete the not-so-weak reference
                }
                return;
            }

            // -- unwatch
            var callbacks= this.map (object).callbacks[property];

            if (!$.isArray (callbacks))
                return;

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

            array[method] = (function ()
            {
                var result = original.apply (this, arguments);

                for (var id in map.pointers)
                {
                    for (var i = 0, property; property = map.pointers[id][i]; i++)
                    {
                        var callbacks = (self.weakrefs[id] && self.weakrefs[id].callbacks[property]) || [];
                        for (var j = 0, callback; callback = callbacks[j]; j++)
                            callback (this);
                    }
                }

                return result;
            }).bind (array);
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

    var Proxy = Class.extend
    ({
        init : function (dst_obj, dst_prop, src_obj, src_prop)
        {
            this.dnd = false;

            this.dst_handler = this.dst_handler.bind (this);
            this.src_handler = this.src_handler.bind (this);

            this.dst (dst_obj, dst_prop);
            this.src (src_obj, src_prop);
        },
        unbind : function ()
        {
            this.dst (null);
            this.src (null);
        },
        //--
        src_handler : function (value)
        {
            if (this.dnd) { this.dnd = false; return; }
            this.dnd = true;
            this.dst_obj[this.dst_prop] = value;
        },
        dst_handler : function (value)
        {
            if (this.dnd) { this.dnd = false; return; }
            this.dnd = true;
            this.src_obj[this.src_prop] = value;
        },
        //--
        dst: function (dst_obj, dst_prop)
        {
            if (this.dst_obj)
                watcher.unwatch (this.dst_obj, this.dst_prop, this.dst_handler);

            this.dst_obj  = dst_obj;
            this.dst_prop = dst_prop;

            if (this.dst_obj)
                watcher.watch (this.dst_obj, this.dst_prop, this.dst_handler);
        },
        //--
        src: function (src_obj, src_prop)
        {
            if (this.src_obj)
                watcher.unwatch (this.src_obj, this.src_prop, this.src_handler);

            this.src_obj  = src_obj;
            this.src_prop = src_prop;

            if (this.src_obj)
                watcher.watch (this.src_obj, this.src_prop, this.src_handler);
        }
    });

    //-----------------------------------------------------
    // Parser API
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
        'if'        : '\\?',
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

    var descent_precedence =
    [
        ['or'],
        ['and'],
        ['eq','neq'],
        ['lt', 'lteq', 'gt', 'gteq'],
        ['add', 'sub'],
        ['mul', 'div', 'mod']
    ];

    //-----------------------------------------------------

    var unary_operators =
    {
        sub : function (a) { return (-a); },
        not : function (a) { return (!a); }
    }

    var binary_operators =
    {
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
            this.op   = binary_operators[op];
            this.lval = lval;
            this.rval = rval;

            this.update = this.update.bind (this);
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
                this.isconst = this.isconst && !!expr.isconst;

                if (!expr.isconst)
                    watcher.watch (expr, 'value', update)
            }

            update ();
        }
    });

    // a = b
    var AssignExpr = Expr.extend
    ({
        init: function (lval, rval)
        {
            this.lval = lval;
            this.rval = rval;

            this.update = this.update.bind (this);
            this.checkconst (this.update, this.lval, this.rval);
        },
        update: function ()
        {
            this.value = this.rval.value;
            this.lval.publish (this.rval.value);
        }
    });

    // a ? b : c
    var TernaryExpr = Expr.extend
    ({
        init: function (expr, lval, rval)
        {
            this.expr = expr;
            this.lval = lval;
            this.rval = rval;

            this.update = this.update.bind (this);
            this.checkconst (this.update, this.expr, this.lval, this.rval);
        },
        update: function ()
        {
            // unwrap primitive wrappers
            var expr = this.expr.value.valueOf
                ? this.expr.value.valueOf ()
                : this.expr.value;

            this.value = expr
                ? this.lval.value
                : this.rval.value;
        }
    });

    // -a, !a
    var UnaryExpr = Expr.extend
    ({
        init: function (op, lval, rval)
        {
            this.op   = unary_operators[op];
            this.lval = lval;

            this.update = this.update.bind (this);
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

            this.update = this.update.bind (this);
            this.checkconst (this.update, this.lval);
        },
        isreadonly: function (value)
        {
            return (!$.isPlainObject (this.object)
                        && !$.isArray (this.object))
                    || $.isFunction (this.object[this.name]);
        },
        update: function ()
        {
            if (this.object != this.lval.value)
            {
                if (!this.isreadonly ()
                    && (typeof (this.object) !== 'undefined'))
                {
                    watcher.unwatch (this.object, this.name, this.update);
                }

                this.object = this.lval.value;

                if (!this.isreadonly ())
                    watcher.watch (this.object, this.name, this.update);
            }

            this.value = this.object[this.name];
        },
        publish: function (value)
        {
            if (!this.isreadonly ())
                this.object[this.name] = value;
        }
    });

    // name[expr]
    var IndexAccess = Expr.extend
    ({
        init: function (lval, rval)
        {
            this.lval = lval;
            this.rval = rval;

            this.update = this.update.bind (this);
            this.checkconst (this.update, this.lval, this.rval);
        },
        isreadonly: function (value)
        {
            return (!$.isPlainObject (this.array)
                        && !$.isArray (this.array))
                    || $.isFunction (this.array[this.index]);
        },
        update: function ()
        {
            if ((this.array != this.lval.value) || (this.index != this.rval.value))
            {
                if (!this.isreadonly ()
                    && (typeof (this.array) != 'undefined')
                    && (typeof (this.index) != 'undefined'))
                {
                    watcher.unwatch (this.array, this.index, this.update);
                }

                this.array = this.lval.value;
                this.index = this.rval.value;

                if (!this.isreadonly ())
                    watcher.watch (this.array, this.index, this.update);
            }

            this.value = this.array[this.index];
        },
        publish: function (value)
        {
            if (!this.isreadonly ())
                this.array[this.index] = value;
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

    // name (expr, ... )
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

            if (this.peek ('end'))
                return (new ConstantExpr (null));

            var value = this.parse_outer ();
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
        parse_outer: function ()
        {
            return this.parse_assign_expr ();
        },
        parse_assign_expr: function ()
        {
            var lval = this.parse_ternary_expr ();

            if (!lval) return null;

            while (this.peek ('assign'))
            {
                this.next ();
                lval = (new AssignExpr (lval, this.parse_outer ()));
            }

            return lval;
        },
        parse_ternary_expr: function ()
        {
            var expr = this.descent_parser (0);

            if (!expr) return null;

            while (this.peek ('if'))
            {
                this.next ();
                var lval = this.parse_outer ();
                this.expect ('colon');
                expr = (new TernaryExpr (expr, lval, this.parse_outer ()));
            }

            return expr;
        },
        descent_parser: function (level)
        {
            if (typeof (descent_precedence[level]) == 'undefined')
                return this.parse_unary_expr ();

            var lval = this.descent_parser (level + 1);

            if (!lval) return null;

            while (true)
            {
                var token = this.token ();

                if (descent_precedence[level].indexOf (token.type) == -1)
                    break;

                this.next ();
                lval = (new Expr (token.type, lval, this.parse_outer ()));
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
                        var name = this.token ().value;

                        // search for property on the object
                        // and create it as a null if not found
                        if (!lval.value.hasOwnProperty (name))
                            lval.value[name] = null;

                        lval = (new PropertyAccess (lval, name));
                        this.next();
                        break;

                    case 'lbracket':
                        this.next ();
                        var index = this.parse_outer ();
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

                args.push (this.parse_outer ());
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

                // --------

                case 'lbracket':
                    return this.parse_array_literal ();
                    break;

                case 'lbrace':
                    return this.parse_object_literal ();
                    break;

                case 'lparen':
                    this.next ();
                    var expr = this.parse_outer ();
                    this.expect ('rparen');
                    return expr;
                    break;

                case 'name':
                    this.next();

                    var name = token.value;
                    var scope = this.scope;

                    // search for property on the scope chain
                    while (!scope.hasOwnProperty (name) && scope.$parent)
                        scope = scope.$parent;

                    // we are at the outer scope, still not found:
                    // create it as a null on the outermost scope
                    if (!scope.hasOwnProperty (name))
                        scope[name] = null;

                    return (new PropertyAccess
                        (
                            { value: scope, isconst: false },
                            token.value
                        ));
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

                value.push (this.parse_outer ());
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

                value[key] = this.parse_outer ();
            }
            while (this.peek ('comma'));

            this.expect ('rbrace');

            return (new ObjectExpr (value));
        },
    });

    var parser = new Parser ();

    //-----------------------------------------------------
    // Binding API
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
            // handle checkboxes with the same name as a multiselect
            // (ie: return an array of selected values)
            if (this.element.type == 'checkbox')
            {
                var checkboxes = $('[name='+this.element.name+']', this.element.form || document);

                if (checkboxes.length > 1)
                {
                    return $.map (checkboxes, function (checkbox)
                    {
                        if ($(checkbox).is(':checked'))
                            return checkbox.value;
                    });
                }
            }

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
            this.prefix   = new RegExp ('^'+$.fn.bindview.prefix+'-');
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
                            new $.fn.bindview.binders['text']
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
                binder = $.fn.bindview.binders[type],
                arg;

            if (!binder)
            {
                for (var key in $.fn.bindview.binders)
                {
                    if (key.indexOf ('*') > 0)
                    {
                        var regexp = new RegExp ('^'+(key.replace ('*', '(.+?)')+'$'));

                        if (regexp.test (type))
                        {
                            binder = $.fn.bindview.binders[key];
                            arg = regexp.exec (type)[1];
                            break;
                        }
                    }
                }
            }

            binder || (binder = $.fn.bindview.binders['*']);

            return new binder (this, scope, node, type, arg, attr.value)
        }
    });

    //-----------------------------------------------------

    $.fn.bindview = function (scope)
    {
        return (new View (this, scope || {}));
    }

    $.extend ($.fn.bindview,
    {
        prefix  : 'bind',
        binder  : Binder, // export base binder class
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
            'visible': Binder.extend
                ({
                    render: function (value)
                    {
                        $(this.element).css ('visibility', value ? 'visible' : 'hidden');
                    }
                }),
            'text': Binder.extend
                ({
                    render: function (value)
                    {
                        value = (value || '');
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
            'to': Binder.extend
                ({
                    attach: function ()
                    {
                        $(this.element).on ('change keyup blur', this.publish);
                    },
                    detach: function ()
                    {
                        $(this.element).off ('change keyup blur', this.publish);
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
                                return value.apply (self, args);
                            }));
                    }
                }),
            'repeat-*': Binder.extend
                ({
                    block: true,
                    attach: function ()
                    {
                        this.template = document.createDocumentFragment ();
                        this.iterated = {};

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
                        collection = collection || {};

                        // update props
                        for (var prop in collection)
                        {
                            // only iterate own properties
                            if (!({}).hasOwnProperty.call (collection, prop))
                                continue;

                            // only iterate numeric array props
                            if ($.isArray (collection)
                                && (String (prop >>> 0) != prop
                                || prop >>> 0 == 0xffffffff))
                                continue;

                            // update item if already present
                            // rebind proxy: (re)set src to (collection, prop)
                            if (({}).hasOwnProperty.call (this.iterated, prop))
                            {
                                if (this.iterated[prop].scope[this.arg] != collection[prop])
                                {
                                    this.iterated[prop].proxy.src (collection, prop);
                                    this.iterated[prop].scope[this.arg] = collection[prop];
                                }
                                continue;
                            }

                            // or create a new subview
                            var fragment = this.template.cloneNode (true),
                                elements = $(fragment.childNodes),
                                scope    = {};

                            scope['$parent'] = this.scope;
                            scope['$index']  = new Number (prop);
                            scope['$key']    = new String (prop);
                            scope[this.arg]  = collection[prop];

                            this.iterated[prop] = new View (elements, scope);
                            this.iterated[prop].proxy = new Proxy (scope, this.arg, collection, prop);

                            this.element.appendChild (fragment);
                        }

                        // remove old props not present in new collection
                        for (var prop in this.iterated)
                        {
                            if (!({}).hasOwnProperty.call (this.iterated, prop))
                                continue;

                            if (({}).hasOwnProperty.call (collection, prop))
                                continue;

                            this.iterated[prop].proxy.unbind ();
                            this.iterated[prop].unbind ();
                            this.iterated[prop].element.remove ();
                            delete this.iterated[prop];
                        }
                    }
                })
        }
    });

    var watcher = new Watcher ();

})(jQuery, window, document);
