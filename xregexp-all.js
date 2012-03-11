
/***** xregexp.js *****/

/*!
 * XRegExp v2.0.0-beta
 * Copyright 2007-2012 Steven Levithan <http://xregexp.com/>
 * Available under the MIT License
 */

/**
 * XRegExp provides augmented, extensible JavaScript regular expressions. You get new syntax,
 * flags, and methods beyond what browsers support natively. XRegExp is also a regex utility belt
 * with tools to make your client-side grepping simpler and more powerful, while freeing you from
 * worrying about pesky cross-browser inconsistencies and the dubious `lastIndex` property. See
 * XRegExp's documentation (http://xregexp.com/) for more details.
 * @module xregexp
 * @requires N/A
 */

// Avoid running twice; that would duplicate tokens and could break references to native globals
;typeof XRegExp === "undefined" &&
function (root, undefined) {
"use strict";

/*--------------------------------------
 *  Constructor
 *------------------------------------*/

/**
 * Creates an extended regular expression object for matching text with a pattern. Differs from a
 * native regular expression in that additional syntax and flags are supported. The returned object
 * is in fact a native `RegExp` and works with all native methods.
 * @class XRegExp
 * @constructor
 * @param {String} pattern The text of the regular expression.
 * @param {String} [flags] Can have any combination of the following values:
 *   <li>`g` - global
 *   <li>`i` - ignore case
 *   <li>`m` - multiline anchors
 *   <li>`n` - explicit capture
 *   <li>`s` - dot matches all (aka singleline)
 *   <li>`x` - free-spacing and line comments (aka extended)
 *   <li>`y` - sticky (Firefox 3+ only)
 * @returns {RegExp} The extended regular expression object.
 * @example
 *
 * // With named capture and flag x
 * date = XRegExp('(?<year>  [0-9]{4}) -?  # year  \n\
 *                 (?<month> [0-9]{2}) -?  # month \n\
 *                 (?<day>   [0-9]{2})     # day   ', 'x');
 *
 * // Clones the regex, preserving special properties for named capture
 * XRegExp(date);
 */
function XRegExp (pattern, flags) {
    if (X.isRegExp(pattern)) {
        if (flags !== undefined)
            throw new TypeError("can't supply flags when constructing one RegExp from another");
        return copy(pattern);
    }
    // Tokens become part of the regex construction process, so protect against infinite recursion
    // when an XRegExp is constructed within a token handler function
    if (isInsideConstructor)
        throw new Error("can't call the XRegExp constructor within token definition functions");
    var output = [],
        scope = defaultScope,
        tokenContext = {
            hasNamedCapture: false,
            captureNames: [],
            hasFlag: function (flag) {return flags.indexOf(flag) > -1;},
            setFlag: function (flag) {flags += flag;}
        },
        pos = 0,
        tokenResult, match, chr;
    pattern = pattern === undefined ? "" : pattern + "";
    flags = flags === undefined ? "" : flags + "";
    while (pos < pattern.length) {
        // Check for custom tokens at the current position
        tokenResult = runTokens(pattern, pos, scope, tokenContext);
        if (tokenResult) {
            output.push(tokenResult.output);
            pos += (tokenResult.match[0].length || 1);
        } else {
            // Check for native tokens (except character classes) at the current position
            if ((match = nativ.exec.call(nativeTokens[scope], pattern.slice(pos)))) {
                output.push(match[0]);
                pos += match[0].length;
            } else {
                chr = pattern.charAt(pos);
                if (chr === "[") scope = classScope;
                else if (chr === "]") scope = defaultScope;
                // Advance position by one character
                output.push(chr);
                pos++;
            }
        }
    }
    return augment(new R(output.join(""), nativ.replace.call(flags, flagClip, "")), tokenContext);
}


/*--------------------------------------
 *  Private variables
 *------------------------------------*/

// Shortcuts
var X = XRegExp,
    R = RegExp,
    S = String;

// Optional features; can be installed and uninstalled
var features = {
    natives: false,
    methods: false,
    extensibility: false
};

// Store native methods to use and restore ("native" is an ES3 reserved keyword)
var nativ = {
    exec: R.prototype.exec,
    test: R.prototype.test,
    match: S.prototype.match,
    replace: S.prototype.replace,
    split: S.prototype.split,
    // Hold these so they can be given back if present before XRegExp runs
    apply: R.prototype.apply,
    call: R.prototype.call
};

// Storage for fixed/extended native methods
var fixed = {};

// Storage for addon tokens
var tokens = [];

// Token scope bitflags
var classScope = 0x1,
    defaultScope = 0x2;

// Storage for regexes that match native regex syntax
var nativeTokens = {};
// Any native multicharacter token in character class scope (includes octals)
nativeTokens[classScope] = /^(?:\\(?:[0-3][0-7]{0,2}|[4-7][0-7]?|x[\dA-Fa-f]{2}|u[\dA-Fa-f]{4}|c[A-Za-z]|[\s\S]))/;
// Any native multicharacter token in default scope (includes octals, excludes character classes)
nativeTokens[defaultScope] = /^(?:\\(?:0(?:[0-3][0-7]{0,2}|[4-7][0-7]?)?|[1-9]\d*|x[\dA-Fa-f]{2}|u[\dA-Fa-f]{4}|c[A-Za-z]|[\s\S])|\(\?[:=!]|[?*+]\?|{\d+(?:,\d*)?}\??)/;

// Any backreference in replacement strings
var replacementToken = /\$(?:(\d\d?|[$&`'])|{([$\w]+)})/g;

// Nonnative and duplicate flags
var flagClip = /[^gimy]+|([\s\S])(?=[\s\S]*\1)/g;

// Any greedy/lazy quantifier
var quantifier = /^(?:[?*+]|{\d+(?:,\d*)?})\??/;

// Check for correct `exec` handling of nonparticipating capturing groups
var compliantExecNpcg = nativ.exec.call(/()??/, "")[1] === undefined;

// Check for correct handling of `lastIndex` after zero-length matches
var compliantLastIndexIncrement = function () {
    var x = /^/g;
    nativ.test.call(x, "");
    return !x.lastIndex;
}();

// Check for flag y support (Firefox 3+)
var hasNativeY = R.prototype.sticky !== undefined;

// Used to kill infinite recursion during XRegExp construction
var isInsideConstructor = false;

// Installed and uninstalled states for `XRegExp.addToken`
var addToken = {
    on: function (regex, handler, scope, trigger) {
        tokens.push({
            pattern: copy(regex, "g" + (hasNativeY ? "y" : "")),
            handler: handler,
            scope: scope || defaultScope,
            trigger: trigger || null
        });
    },
    off: function () {
        throw new Error("extensibility must be installed before running addToken");
    }
};


/*--------------------------------------
 *  Public properties/methods
 *------------------------------------*/

/**
 * The semantic version number.
 * @static
 * @memberOf XRegExp
 * @type String
 */
X.version = "2.0.0-beta";

/**
 * Bitflag for regex character class scope; used by addons.
 * @final
 * @memberOf XRegExp
 * @type Number
 */
X.INSIDE_CLASS = classScope;

/**
 * Bitflag for regex default scope; used by addons.
 * @final
 * @memberOf XRegExp
 * @type Number
 */
X.OUTSIDE_CLASS = defaultScope;

/**
 * Extends or changes XRegExp syntax and allows custom flags. This is used internally by XRegExp
 * and can be used to create XRegExp addons. `XRegExp.install('extensibility')` must be run before
 * calling this function, or an error is thrown. If more than one token can match the same string,
 * the last added wins.
 * @memberOf XRegExp
 * @param {RegExp} regex A regex object that matches the token being added.
 * @param {Function} handler A function that returns a new pattern string (using native regex
 *   syntax) to replace the matched pattern within all future XRegExp regexes. Invoked with two
 *   arguments: The match object, and the regex scope where the match was found. Has access to
 *   persistent properties of the regex being built through `this`.
 * @param {Number} [scope=XRegExp.OUTSIDE_CLASS] The regex scope where the token applies. Use
 *   bitwise OR to include multiple scopes.
 * @param {Function} [trigger] A function that returns `true` if the token should be applied; e.g.,
 *   if a flag is set. If `false` is returned, the matched pattern segment can be matched by other
 *   tokens. Has access to persistent properties of the regex being built through `this`, including
 *   function `this.hasFlag`.
 * @returns {undefined} N/A
 * @example
 *
 * // Adds support for escape sequences: \Q..\E and \Q..
 * XRegExp.addToken(
 *   /\\Q([\s\S]*?)(?:\\E|$)/,
 *   function (match) {return XRegExp.escape(match[1]);},
 *   XRegExp.INSIDE_CLASS | XRegExp.OUTSIDE_CLASS
 * );
 */
X.addToken = addToken.off;

/**
 * Caches and returns the result of calling `XRegExp(pattern, flags)`. On any subsequent call with
 * the same pattern and flag combination, the cached copy is returned.
 * @memberOf XRegExp
 * @param {String} pattern The text of the regular expression.
 * @param {String} [flags] Can have any combination of native and custom flags.
 * @returns {RegExp} The cached XRegExp object.
 * @example
 *
 * while (match = XRegExp.cache('.', 'gs').exec(str)) {
 *   // The regex is compiled once only
 * }
 */
X.cache = function (pattern, flags) {
    var key = pattern + "/" + (flags || "");
    return X.cache[key] || (X.cache[key] = X(pattern, flags));
};

/**
 * Escapes any regular expression metacharacters, for use when matching literal strings. The result
 * can safely be used at any point within a regex that uses any flags.
 * @memberOf XRegExp
 * @param {String} str The string to escape.
 * @returns {String} The escaped string.
 * @example
 *
 * XRegExp.escape('Escaped? <.>');
 * // -> 'Escaped\?\ <\.>'
 */
X.escape = function (str) {
    return nativ.replace.call(str, /[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};

/**
 * Executes a regex search in a specified string. Returns a result array or `null`. If the provided
 * regex uses named capture, named backreference properties are included on the result array.
 * Optional `pos` and `sticky` arguments specify the search start position, and whether the match
 * must start at the specified position only. The `lastIndex` property of the provided regex is not
 * used, but is updated for compatibility.
 * @memberOf XRegExp
 * @param {String} str The string to search.
 * @param {RegExp} regex The regular expression to use for the search.
 * @param {Number} [pos=0] The zero-indexed position to start the search within the string.
 * @param {Boolean} [sticky=false] Whether the match must start at the specified position only.
 * @returns {Array} A result array with named backreference properties, or null.
 * @example
 *
 * // Basic use, with named backreference
 * var match = XRegExp.exec('U+2620', XRegExp('U\\+(?<hex>[0-9A-F]{4})'));
 * match.hex; // -> '2620'
 *
 * // With pos and sticky, in a loop
 * var pos = 2, result;
 * while (match = XRegExp.exec('<1><2><3><4>5<6>', /<(\d)>/, pos, true)) {
 *   result.push(match[1]);
 *   pos = match.index + match[0].length;
 * }
 * // result -> ['2', '3', '4']
 */
X.exec = function (str, regex, pos, sticky) {
    var r2 = copy(regex, "g" + ((sticky && hasNativeY) ? "y" : "")),
        match;
    r2.lastIndex = pos = pos || 0;
    match = fixed.exec.call(r2, str); // Fixed `exec` required for `lastIndex` fix, etc.
    if (sticky && match && match.index !== pos)
        match = null;
    if (regex.global)
        regex.lastIndex = match ? r2.lastIndex : 0;
    return match;
};

// Executes `callback` once per match within `str`; returns `context`. Provides a simpler and
// cleaner way to iterate over regex matches compared to the traditional approaches of
// subverting `String.prototype.replace` or repeatedly calling `exec` within a `while` loop
X.forEach = function (str, regex, callback, context) {
    var r2 = X.globalize(regex),
        i = -1, match;
    while ((match = fixed.exec.call(r2, str))) { // Fixed `exec` required for `lastIndex` fix, etc.
        if (regex.global)
            regex.lastIndex = r2.lastIndex; // Doing this to follow expectations if `lastIndex` is checked within `callback`
        callback.call(context, match, ++i, str, regex);
        if (r2.lastIndex === match.index)
            r2.lastIndex++;
    }
    if (regex.global)
        regex.lastIndex = 0;
    return context;
};

// Accepts a `RegExp` instance; returns a copy with the `/g` flag set. The copy has a fresh
// `lastIndex` (set to zero). If you want to copy a regex without forcing the `global`
// property, use `XRegExp(regex)`. Do not use `RegExp(regex)` because it will not preserve
// special properties required for named capture
X.globalize = function (regex) {
    return copy(regex, "g");
};

/**
 * Installs optional features according to the specified options.
 * @memberOf XRegExp
 * @param {String|Object} options Options object.
 * @returns {undefined} N/A
 * @example
 *
 * // With an options object
 * XRegExp.install({
 *   // Overrides native regex methods with fixed/extended versions that support named
 *   // backreferences and fix numerous cross-browser bugs
 *   natives: true,
 *   // Copies the XRegExp.prototype.apply/call methods to RegExp.prototype
 *   methods: true,
 *   // Enables XRegExp syntax and flag extensibility (used by addons)
 *   extensibility: true
 * });
 *
 * // With an options string
 * XRegExp.install('natives methods');
 *
 * // Using a shortcut to install all optional features
 * XRegExp.install('all');
 */
X.install = function (options) {
    options = prepareOptions(options);
    if (!features.natives && options.natives) setNatives(true);
    if (!features.methods && options.methods) setMethods(true);
    if (!features.extensibility && options.extensibility) setExtensibility(true);
};

// Accepts any value; returns a Boolean indicating whether the argument is a `RegExp` object.
// Note that this is also `true` for regex literals and regexes created by the `XRegExp`
// constructor. This works correctly for variables created in another frame, when `instanceof`
// and `constructor` checks would fail to work as intended
X.isRegExp = function (value) {
    return Object.prototype.toString.call(value) === "[object RegExp]";
};

// Checks whether an optional feature is installed
X.isInstalled = function (feature) {
    return !!(features[feature]);
};

/**
 * Retrieves the matches from searching a string using a chain of regexes that successively search
 * within previous matches. The provided `chain` array can contain regexes and objects with `regex`
 * and `backref` properties. When a backreference is specified, the named or numbered backreference
 * is passed forward to the next regex or returned.
 * @memberOf XRegExp
 * @param {String} str The string to search.
 * @param {Array} chain Array of regexes that each search for matches within previous results.
 * @returns {Array} Strings matched by the last regex in the chain. Empty array if no matches.
 * @example
 *
 * // Basic usage; matches numbers within <b> tags
 * XRegExp.matchChain('1 <b>2</b> 3 <b>4 a 56</b>', [
 *   XRegExp('(?is)<b>.*?<\\/b>'),
 *   /\d+/
 * ]);
 * // -> ['2', '4', '56']
 *
 * // Passing forward and returning specific backreferences
 * XRegExp.matchChain(html, [
 *   {regex: /<a href="([^"]+)">/i, backref: 1},
 *   {regex: XRegExp('(?i)^https?://(?<domain>[^/?#]+)'), backref: 'domain'}
 * ]);
 */
X.matchChain = function (str, chain) {
    return function recurseChain (values, level) {
        var item = chain[level].regex ? chain[level] : {regex: chain[level]},
            regex = X.globalize(item.regex),
            matches = [], i;
        for (i = 0; i < values.length; i++) {
            X.forEach(values[i], regex, function (match) {
                matches.push(item.backref ? (match[item.backref] || "") : match[0]);
            });
        }
        return ((level === chain.length - 1) || !matches.length) ?
            matches : recurseChain(matches, level + 1);
    }([str], 0);
};

// Returns a new string with one or all matches of a pattern replaced by a replacement. The
// pattern can be a string or a regex, and the replacement can be a string or a function to be
// called for each match. An optional Boolean argument specifies whether to replace the first
// match only or all matches (overrides flag `/g`). Replacement strings can use `${n}` for
// named and numbered backreferences. Replacement functions can use named backreferences via
// `arguments[0].name`
X.replace = function (str, search, replacement, replaceAll) {
    var isRegex = X.isRegExp(search),
        search2 = search,
        result;
    if (isRegex) {
        if (replaceAll === undefined)
            replaceAll = search.global; // Follow flag g when `replaceAll` isn't explicit
        // Note that since a copy is used, `search`'s `lastIndex` isn't updated *during* replacement iterations
        search2 = copy(search, replaceAll ? "g" : "", replaceAll ? "" : "g");
    } else if (replaceAll) {
        search2 = new R(X.escape(search + ""), "g");
    }
    result = fixed.replace.call(str + "", search2, replacement); // Fixed `replace` required for named backreferences, etc.
    if (isRegex && search.global)
        search.lastIndex = 0; // Fixes IE, Safari bug (last tested IE 9, Safari 5.1)
    return result;
};

// Fixes browser bugs in the native `String.prototype.split`
X.split = function (str, separator, limit) {
    return fixed.split.call(str, separator, limit);
};

/**
 * Uninstalls optional features according to the specified options.
 * @memberOf XRegExp
 * @param {String|Object} options Options object.
 * @returns {undefined} N/A
 * @example
 *
 * // With an options object
 * XRegExp.uninstall({
 *   // Restores native regex methods
 *   natives: true,
 *   // Removes added RegExp.prototype methods, or restores to their original values
 *   methods: true,
 *   // Disables additional syntax and flag extensions
 *   extensibility: true
 * });
 *
 * // With an options string
 * XRegExp.uninstall('natives methods');
 *
 * // Using a shortcut to uninstall all optional features
 * XRegExp.uninstall('all');
 */
X.uninstall = function (options) {
    options = prepareOptions(options);
    if (features.natives && options.natives) setNatives(false);
    if (features.methods && options.methods) setMethods(false);
    if (features.extensibility && options.extensibility) setExtensibility(false);
};


/*--------------------------------------
 *  XRegExp.prototype methods
 *------------------------------------*/

// Accepts a context object and arguments array; returns the result of calling `exec` with the
// first value in the arguments array. the context is ignored but is accepted for congruity
// with `Function.prototype.apply`
X.prototype.apply = function (context, args) {
    return this.test(args[0]); // Intentionally doesn't specify fixed/native `test`
};

// Accepts a context object and string; returns the result of calling `exec` with the provided
// string. the context is ignored but is accepted for congruity with `Function.prototype.call`
X.prototype.call = function (context, str) {
    return this.test(str); // Intentionally doesn't specify fixed/native `test`
};


/*--------------------------------------
 *  Fixed/extended native methods
 *------------------------------------*/

// Adds named capture support (with backreferences returned as `result.name`), and fixes
// browser bugs in the native `RegExp.prototype.exec`
fixed.exec = function (str) {
    var match, name, r2, origLastIndex;
    if (!this.global)
        origLastIndex = this.lastIndex;
    match = nativ.exec.apply(this, arguments);
    if (match) {
        // Fix browsers whose `exec` methods don't consistently return `undefined` for
        // nonparticipating capturing groups
        if (!compliantExecNpcg && match.length > 1 && indexOf(match, "") > -1) {
            r2 = new R(this.source, nativ.replace.call(getNativeFlags(this), "g", ""));
            // Using `str.slice(match.index)` rather than `match[0]` in case lookahead allowed
            // matching due to characters outside the match
            nativ.replace.call((str + "").slice(match.index), r2, function () {
                for (var i = 1; i < arguments.length - 2; i++) {
                    if (arguments[i] === undefined)
                        match[i] = undefined;
                }
            });
        }
        // Attach named capture properties
        if (this._xregexp && this._xregexp.captureNames) {
            for (var i = 1; i < match.length; i++) {
                name = this._xregexp.captureNames[i - 1];
                if (name)
                   match[name] = match[i];
            }
        }
        // Fix browsers that increment `lastIndex` after zero-length matches
        if (!compliantLastIndexIncrement && this.global && !match[0].length && (this.lastIndex > match.index))
            this.lastIndex--;
    }
    if (!this.global)
        this.lastIndex = origLastIndex; // Fixes IE, Opera bug (last tested IE 9, Opera 11.6)
    return match;
};

// Fixes browser bugs in the native `RegExp.prototype.test`
fixed.test = function (str) {
    // Do this the easy way :-)
    return !!fixed.exec.call(this, str);
};

// Adds named capture support and fixes browser bugs in the native `String.prototype.match`
fixed.match = function (regex) {
    if (!X.isRegExp(regex))
        regex = new R(regex); // Use native `RegExp`
    if (regex.global) {
        var result = nativ.match.apply(this, arguments);
        regex.lastIndex = 0; // Fixes IE bug
        return result;
    }
    return fixed.exec.call(regex, this);
};

// Adds support for `${n}` tokens for named and numbered backreferences in replacement text,
// and provides named backreferences to replacement functions as `arguments[0].name`. Also
// fixes browser bugs in replacement text syntax when performing a replacement using a nonregex
// search value, and the value of a replacement regex's `lastIndex` property during replacement
// iterations and upon completion. Note that this doesn't support SpiderMonkey's proprietary
// third (`flags`) argument
fixed.replace = function (search, replacement) {
    var isRegex = X.isRegExp(search),
        captureNames, result, str, origLastIndex;
    if (isRegex) {
        if (search._xregexp) captureNames = search._xregexp.captureNames;
        if (!search.global) origLastIndex = search.lastIndex;
    } else {
        search += "";
    }
    if (Object.prototype.toString.call(replacement) === "[object Function]") {
        result = nativ.replace.call(this + "", search, function () {
            if (captureNames) {
                // Change the `arguments[0]` string primitive to a `String` object that can store properties
                arguments[0] = new S(arguments[0]);
                // Store named backreferences on `arguments[0]`
                for (var i = 0; i < captureNames.length; i++) {
                    if (captureNames[i])
                        arguments[0][captureNames[i]] = arguments[i + 1];
                }
            }
            // Update `lastIndex` before calling `replacement`.
            // Fixes IE, Chrome, Firefox, Safari bug (last tested IE 9, Chrome 17, Firefox 10, Safari 5.1)
            if (isRegex && search.global)
                search.lastIndex = arguments[arguments.length - 2] + arguments[0].length;
            return replacement.apply(null, arguments);
        });
    } else {
        str = this + ""; // Ensure `args[args.length - 1]` will be a string when given nonstring `this`
        result = nativ.replace.call(str, search, function () {
            var args = arguments; // Keep this function's `arguments` available through closure
            return nativ.replace.call(replacement + "", replacementToken, function ($0, $1, $2) {
                // Numbered backreference (without delimiters) or special variable
                if ($1) {
                    if ($1 === "$") return "$";
                    if ($1 === "&") return args[0];
                    if ($1 === "`") return args[args.length - 1].slice(0, args[args.length - 2]);
                    if ($1 === "'") return args[args.length - 1].slice(args[args.length - 2] + args[0].length);
                    // Else, numbered backreference
                    /* Assert: `$10` in replacement is one of:
                     *   1. Backreference 10, if 10 or more capturing groups exist.
                     *   2. Backreference 1 followed by `0`, if 1-9 capturing groups exist.
                     *   3. Otherwise, it's the literal string `$10`.
                     * Details:
                     *   - Backreferences cannot be more than two digits (enforced by `replacementToken`).
                     *   - `$01` is equivalent to `$1` if a capturing group exists, otherwise it's the string `$01`.
                     *   - There is no `$0` token (`$&` is the entire match).
                     */
                    var literalNumbers = "";
                    $1 = +$1; // Type-convert; drop leading zero
                    if (!$1) // `$1` was `0` or `00`
                        return $0;
                    while ($1 > args.length - 3) {
                        literalNumbers = S.prototype.slice.call($1, -1) + literalNumbers;
                        $1 = Math.floor($1 / 10); // Drop the last digit
                    }
                    return ($1 ? args[$1] || "" : "$") + literalNumbers;
                // Named backreference or delimited numbered backreference
                } else {
                    /* Assert: `${n}` in replacement is one of:
                     *   1. Backreference to numbered capture `n`. Differences from `$n`:
                     *     a. `n` can be more than two digits.
                     *     b. Backreference 0 is allowed, and is the entire match.
                     *   2. Backreference to named capture `n`, if it exists and is not a number overridden by numbered capture.
                     *   3. Otherwise, it's the literal string `${n}`.
                     */
                    var n = +$2; // Type-convert; drop leading zeros
                    if (n <= args.length - 3)
                        return args[n];
                    n = captureNames ? indexOf(captureNames, $2) : -1;
                    return n > -1 ? args[n + 1] : $0;
                }
            });
        });
    }
    if (isRegex) {
        if (search.global) search.lastIndex = 0; // Fixes IE, Safari bug (last tested IE 9, Safari 5.1)
        else search.lastIndex = origLastIndex; // Fixes IE, Opera bug (last tested IE 9, Opera 11.6)
    }
    return result;
};

// Fixes numerous browser bugs in the native `String.prototype.split`
fixed.split = function (s /*separator*/, limit) {
    // If separator `s` is not a regex, use the native `split`
    if (!X.isRegExp(s))
        return nativ.split.apply(this, arguments);
    var str = this + "",
        output = [],
        lastLastIndex = 0,
        match, lastLength;
    /* Values for `limit`, per the spec:
     * If undefined: 4294967295 // Math.pow(2, 32) - 1
     * If 0, Infinity, or NaN: 0
     * If a positive number: limit = Math.floor(limit); if (limit > 4294967295) limit -= 4294967296;
     * If a negative number: 4294967296 - Math.floor(Math.abs(limit))
     * If other: Type-convert, then use the above rules
     */
    limit = limit === undefined ?
        -1 >>> 0 : // Math.pow(2, 32) - 1
        limit >>> 0; // ToUint32(limit)
    // This is required if not `s.global`, and it avoids needing to set `s.lastIndex` to zero
    // and restore it to its original value when we're done using the regex
    s = X.globalize(s);
    while ((match = fixed.exec.call(s, str))) { // Fixed `exec` required for `lastIndex` fix, etc.
        if (s.lastIndex > lastLastIndex) {
            output.push(str.slice(lastLastIndex, match.index));
            if (match.length > 1 && match.index < str.length)
                Array.prototype.push.apply(output, match.slice(1));
            lastLength = match[0].length;
            lastLastIndex = s.lastIndex;
            if (output.length >= limit)
                break;
        }
        if (s.lastIndex === match.index)
            s.lastIndex++;
    }
    if (lastLastIndex === str.length)
        (!nativ.test.call(s, "") || lastLength) && output.push("");
    else
        output.push(str.slice(lastLastIndex));
    return output.length > limit ? output.slice(0, limit) : output;
};


/*--------------------------------------
 *  Built-in tokens
 *------------------------------------*/

// Default scope is `XRegExp.OUTSIDE_CLASS`.
// The most frequently used tokens are added last

// Temporarily install
X.install("extensibility");

// Shortcut
var XAdd = X.addToken;

/* Unicode token: \p{..}, \P{..}, or \p{^..}
 * A placeholder that reserves Unicode token syntax; superseded by addon XRegExp Unicode Base
 */
XAdd(/\\[pP]{\^?[^}]*}/,
    function () {
        throw new ReferenceError("Unicode tokens require XRegExp Unicode Base");
    },
    X.INSIDE_CLASS | X.OUTSIDE_CLASS
);

/* Empty character class: [] or [^]
 * Fixes a critical cross-browser syntax inconsistency. Unless this is standardized (per the spec),
 * regex syntax cannot be accurately parsed because character class endings cannot be determined
 */
XAdd(/\[\^?]/,
    function (match) {
        // For cross-browser compatibility with ES3, convert [] to \b\B and [^] to [\s\S].
        // (?!) should work like \b\B, but is unreliable in Firefox
        return match[0] === "[]" ? "\\b\\B" : "[\\s\\S]";
    }
);

/* Comment pattern: (?# )
 * Inline comments are an alternative to the line comments allowed in free-spacing mode (flag x)
 */
XAdd(/\(\?#[^)]*\)/,
    function (match) {
        // Keep tokens separated unless the following token is a quantifier
        return nativ.test.call(quantifier, match.input.slice(match.index + match[0].length)) ? "" : "(?:)";
    }
);

/* Leading mode modifier, with any combination of flags imnsx: (?imnsx)
 * Does not support: ..(?i), (?-i), (?i-m), (?i: ), (?i)(?m), etc.
 */
XAdd(/^\(\?([imnsx]+)\)/,
    function (match) {
        this.setFlag(match[1]);
        return "";
    }
);

/* Named backreference: \k<name>
 * Backreference names can use the characters A�Z, a�z, 0�9, _, and $ only
 */
XAdd(/\\k<([\w$]+)>/,
    function (match) {
        var index = indexOf(this.captureNames, match[1]);
        // Keep backreferences separate from subsequent literal numbers. Preserve back-
        // references to named groups that are undefined at this point as literal strings
        return index > -1 ?
            "\\" + (index + 1) + (isNaN(match.input.charAt(match.index + match[0].length)) ? "" : "(?:)") :
            match[0];
    }
);

/* Whitespace and line comments, in free-spacing mode (aka extended mode, flag x) only
 */
XAdd(/(?:\s+|#.*)+/,
    function (match) {
        // Keep tokens separated unless the following token is a quantifier
        return nativ.test.call(quantifier, match.input.slice(match.index + match[0].length)) ? "" : "(?:)";
    },
    X.OUTSIDE_CLASS,
    function () {return this.hasFlag("x");}
);

/* Dot, in dotall mode (aka singleline mode, flag s) only
 */
XAdd(/\./,
    function () {return "[\\s\\S]";},
    X.OUTSIDE_CLASS,
    function () {return this.hasFlag("s");}
);

/* Named capturing group; match the opening delimiter only: (?<name>
 * Capture names can use the characters A�Z, a�z, 0�9, _, and $ only. Names cannot be integers
 */
XAdd(/\(\?<([$\w]+)>/,
    function (match) {
        if (!isNaN(match[1])) // Avoid incorrect lookups since named backreferences are added to match arrays
            throw new SyntaxError("cannot use an integer as capture name");
        this.captureNames.push(match[1]);
        this.hasNamedCapture = true;
        return "(";
    }
);

/* Capturing group; match the opening parenthesis only.
 * Required for support of named capturing groups. Also adds explicit capture mode (flag n)
 */
XAdd(/\((?!\?)/,
    function () {
        if (this.hasFlag("n")) {
            return "(?:";
        } else {
            this.captureNames.push(null);
            return "(";
        }
    }
);

// Revert to default state
X.uninstall("extensibility");


/*--------------------------------------
 *  Private helper functions
 *------------------------------------*/

function augment (regex, details) {
    return extend(regex, {
        _xregexp: {captureNames: details.hasNamedCapture ? details.captureNames : null},
        // Can't automatically inherit these methods since the XRegExp constructor returns a
        // nonprimitive value
        apply: X.prototype.apply,
        call: X.prototype.call
    });
}

/**
 * Returns a new copy of a `RegExp` object (with its `lastIndex` zeroed), preserving properties
 * required for named capture. Allows adding and removing flags while copying the regex.
 * @private
 * @param {RegExp} regex The regex to copy.
 * @param {String} [addFlags] List of flags to be added while copying the regex.
 * @param {String} [removeFlags] List of flags to be removed while copying the regex.
 * @returns {RegExp} A new copy of the regex, possibly with modified flags.
 */
function copy (regex, addFlags, removeFlags) {
    if (!X.isRegExp(regex))
        throw new TypeError("type RegExp expected");
    var x = regex._xregexp,
        flags = getNativeFlags(regex) + (addFlags || "");
    if (removeFlags)
        flags = nativ.replace.call(flags, new R("[" + removeFlags + "]+", "g"), ""); // Would need to escape `removeFlags` if this wasn't private
    if (x) {
        // Compiling the current (rather than precompilation) source preserves the effects of nonnative source flags
        regex = X(regex.source, flags);
        regex._xregexp = {captureNames: x.captureNames ? x.captureNames.slice(0) : null};
    } else {
        // Remove duplicate flags to avoid throwing
        flags = nativ.replace.call(flags, /([\s\S])(?=[\s\S]*\1)/g, "");
        // Don't use `XRegExp`; avoid searching for special tokens and adding special properties
        regex = new R(regex.source, flags);
    }
    return regex;
}

/**
 * Copy properties of `b` to `a`.
 * @private
 * @param {Object} a The property-receiving object.
 * @param {Object} b The property-providing object.
 * @returns {Object} The augmented `a` object.
 */
function extend (a, b) {
    for (var p in b)
        b.hasOwnProperty(p) && (a[p] = b[p]);
    return a;
}

function getNativeFlags (regex) {
    //return nativ.exec.call(/\/([a-z]*)$/i, regex + "")[1];
    return (regex.global     ? "g" : "") +
           (regex.ignoreCase ? "i" : "") +
           (regex.multiline  ? "m" : "") +
           (regex.extended   ? "x" : "") + // Proposed for ES4; included in AS3
           (regex.sticky     ? "y" : ""); // Included in Firefox 3+
}

function indexOf (array, item, from) {
    if (Array.prototype.indexOf) // Use the native array method if available
        return array.indexOf(item, from);
    for (var i = from || 0; i < array.length; i++) {
        if (array[i] === item)
            return i;
    }
    return -1;
}

/**
 * Prepares an options object from the given value.
 * @private
 * @param {String|Object} value The value to convert to an options object.
 * @returns {Object} The options object.
 */
function prepareOptions (value) {
    value = value || {};
    if (value === "all" || value.all)
        value = {natives: true, methods: true, extensibility: true};
    else if (typeof value === "string")
        value = X.forEach(value, /[^\s,]+/, function (m) {this[m] = true;}, {});
    return value;
}

function runTokens (pattern, index, scope, context) {
    var i = tokens.length,
        result, match, t;
    // Protect against constructing XRegExps within token handler and trigger functions
    isInsideConstructor = true;
    // Must reset `isInsideConstructor`, even if a `trigger` or `handler` throws
    try {
        while (i--) { // Run in reverse order
            t = tokens[i];
            if ((scope & t.scope) && (!t.trigger || t.trigger.call(context))) {
                t.pattern.lastIndex = index;
                match = fixed.exec.call(t.pattern, pattern); // Fixed `exec` here allows use of named backreferences, etc.
                if (match && match.index === index) {
                    result = {
                        output: t.handler.call(context, match, scope),
                        match: match
                    };
                    break;
                }
            }
        }
    } catch (err) {
        throw err;
    } finally {
        isInsideConstructor = false;
    }
    return result;
}

function setExtensibility (on) {
    X.addToken = addToken[on ? "on" : "off"];
    features.extensibility = on;
}

function setMethods (on) {
    if (on) {
        R.prototype.apply = X.prototype.apply;
        R.prototype.call = X.prototype.call;
    } else {
        // Restore methods if they existed before XRegExp ran; otherwise delete
        nativ.apply ? R.prototype.apply = nativ.apply : delete R.prototype.apply;
        nativ.call ? R.prototype.call = nativ.call : delete R.prototype.call;
    }
    features.methods = on;
}

function setNatives (on) {
    R.prototype.exec = (on ? fixed : nativ).exec;
    R.prototype.test = (on ? fixed : nativ).test;
    S.prototype.match = (on ? fixed : nativ).match;
    S.prototype.replace = (on ? fixed : nativ).replace;
    S.prototype.split = (on ? fixed : nativ).split;
    features.natives = on;
}


/*--------------------------------------
 *  Expose XRegExp
 *------------------------------------*/

if (typeof exports === "undefined")
    root.XRegExp = X; // Create global varable
else // For CommonJS enviroments
    exports.XRegExp = X;

}(this);


/***** concatenate-source-files-fix.js *****/

// Ensure that XRegExp is defined in the module scope, so included addons are able to access it
if (typeof exports !== "undefined") {
    var XRegExp = exports.XRegExp;
}


/***** xregexp-unicode-base.js *****/

/*!
 * XRegExp Unicode Base v1.0.0-beta
 * Copyright 2008-2012 Steven Levithan <http://xregexp.com/>
 * Available under the MIT License
 * Uses Unicode 6.1 <http://unicode.org/Public/6.1.0/ucd/>
 */

/**
 * Adds support for the `\p{L}` or `\p{Letter}` Unicode category. Addon packages for the remaining
 * Unicode categories, scripts, and blocks are available separately. All Unicode tokens can be
 * inverted using `\P{..}` or `\p{^..}`. Token names are case insensitive, and any spaces, hyphens,
 * and underscores are ignored.
 */
;(function () {
"use strict";

var unicode = {}, // Storage for package tokens
    extensible = XRegExp.isInstalled("extensibility");

if (!extensible)
    XRegExp.install("extensibility"); // Temporarily install

XRegExp.addUnicodePackage = function (pack, aliases) {
    var p;
    if (!XRegExp.isInstalled("extensibility"))
        throw new Error("can't add Unicode package unless extensibility is installed");
    for (p in pack)
        pack.hasOwnProperty(p) && (unicode[slug(p)] = expand(pack[p]));
    if (aliases) {
        for (p in aliases)
            aliases.hasOwnProperty(p) && (unicode[slug(aliases[p])] = unicode[slug(p)]);
    }
};

XRegExp.addToken(
    /\\([pP]){(\^?)([^}]*)}/,
    function (match, scope) {
        var inv = (match[1] === "P" || match[2]) ? "^" : "",
            item = slug(match[3]);
        // \p{..}, \P{..}, and \p{^..} are valid, but the double negative \P{^..} isn't
        if (match[1] === "P" && match[2])
            throw new SyntaxError("erroneous characters: " + match[0]);
        if (!unicode.hasOwnProperty(item))
            throw new SyntaxError("invalid or unsupported Unicode item: " + match[0]);
        return scope === XRegExp.INSIDE_CLASS ?
            (inv ? cacheInversion(item) : unicode[item]) :
            "[" + inv + unicode[item] + "]";
    },
    XRegExp.INSIDE_CLASS | XRegExp.OUTSIDE_CLASS
);

XRegExp.addUnicodePackage({
    L: "0041-005A0061-007A00AA00B500BA00C0-00D600D8-00F600F8-02C102C6-02D102E0-02E402EC02EE0370-037403760377037A-037D03860388-038A038C038E-03A103A3-03F503F7-0481048A-05270531-055605590561-058705D0-05EA05F0-05F20620-064A066E066F0671-06D306D506E506E606EE06EF06FA-06FC06FF07100712-072F074D-07A507B107CA-07EA07F407F507FA0800-0815081A082408280840-085808A008A2-08AC0904-0939093D09500958-09610971-09770979-097F0985-098C098F09900993-09A809AA-09B009B209B6-09B909BD09CE09DC09DD09DF-09E109F009F10A05-0A0A0A0F0A100A13-0A280A2A-0A300A320A330A350A360A380A390A59-0A5C0A5E0A72-0A740A85-0A8D0A8F-0A910A93-0AA80AAA-0AB00AB20AB30AB5-0AB90ABD0AD00AE00AE10B05-0B0C0B0F0B100B13-0B280B2A-0B300B320B330B35-0B390B3D0B5C0B5D0B5F-0B610B710B830B85-0B8A0B8E-0B900B92-0B950B990B9A0B9C0B9E0B9F0BA30BA40BA8-0BAA0BAE-0BB90BD00C05-0C0C0C0E-0C100C12-0C280C2A-0C330C35-0C390C3D0C580C590C600C610C85-0C8C0C8E-0C900C92-0CA80CAA-0CB30CB5-0CB90CBD0CDE0CE00CE10CF10CF20D05-0D0C0D0E-0D100D12-0D3A0D3D0D4E0D600D610D7A-0D7F0D85-0D960D9A-0DB10DB3-0DBB0DBD0DC0-0DC60E01-0E300E320E330E40-0E460E810E820E840E870E880E8A0E8D0E94-0E970E99-0E9F0EA1-0EA30EA50EA70EAA0EAB0EAD-0EB00EB20EB30EBD0EC0-0EC40EC60EDC-0EDF0F000F40-0F470F49-0F6C0F88-0F8C1000-102A103F1050-1055105A-105D106110651066106E-10701075-1081108E10A0-10C510C710CD10D0-10FA10FC-1248124A-124D1250-12561258125A-125D1260-1288128A-128D1290-12B012B2-12B512B8-12BE12C012C2-12C512C8-12D612D8-13101312-13151318-135A1380-138F13A0-13F41401-166C166F-167F1681-169A16A0-16EA1700-170C170E-17111720-17311740-17511760-176C176E-17701780-17B317D717DC1820-18771880-18A818AA18B0-18F51900-191C1950-196D1970-19741980-19AB19C1-19C71A00-1A161A20-1A541AA71B05-1B331B45-1B4B1B83-1BA01BAE1BAF1BBA-1BE51C00-1C231C4D-1C4F1C5A-1C7D1CE9-1CEC1CEE-1CF11CF51CF61D00-1DBF1E00-1F151F18-1F1D1F20-1F451F48-1F4D1F50-1F571F591F5B1F5D1F5F-1F7D1F80-1FB41FB6-1FBC1FBE1FC2-1FC41FC6-1FCC1FD0-1FD31FD6-1FDB1FE0-1FEC1FF2-1FF41FF6-1FFC2071207F2090-209C21022107210A-211321152119-211D212421262128212A-212D212F-2139213C-213F2145-2149214E218321842C00-2C2E2C30-2C5E2C60-2CE42CEB-2CEE2CF22CF32D00-2D252D272D2D2D30-2D672D6F2D80-2D962DA0-2DA62DA8-2DAE2DB0-2DB62DB8-2DBE2DC0-2DC62DC8-2DCE2DD0-2DD62DD8-2DDE2E2F300530063031-3035303B303C3041-3096309D-309F30A1-30FA30FC-30FF3105-312D3131-318E31A0-31BA31F0-31FF3400-4DB54E00-9FCCA000-A48CA4D0-A4FDA500-A60CA610-A61FA62AA62BA640-A66EA67F-A697A6A0-A6E5A717-A71FA722-A788A78B-A78EA790-A793A7A0-A7AAA7F8-A801A803-A805A807-A80AA80C-A822A840-A873A882-A8B3A8F2-A8F7A8FBA90A-A925A930-A946A960-A97CA984-A9B2A9CFAA00-AA28AA40-AA42AA44-AA4BAA60-AA76AA7AAA80-AAAFAAB1AAB5AAB6AAB9-AABDAAC0AAC2AADB-AADDAAE0-AAEAAAF2-AAF4AB01-AB06AB09-AB0EAB11-AB16AB20-AB26AB28-AB2EABC0-ABE2AC00-D7A3D7B0-D7C6D7CB-D7FBF900-FA6DFA70-FAD9FB00-FB06FB13-FB17FB1DFB1F-FB28FB2A-FB36FB38-FB3CFB3EFB40FB41FB43FB44FB46-FBB1FBD3-FD3DFD50-FD8FFD92-FDC7FDF0-FDFBFE70-FE74FE76-FEFCFF21-FF3AFF41-FF5AFF66-FFBEFFC2-FFC7FFCA-FFCFFFD2-FFD7FFDA-FFDC"
},
{
    L: "Letter"
});

if (!extensible)
    XRegExp.uninstall("extensibility"); // Revert to previous state

// Generates a standardized token name (lowercase, with hyphens, spaces, and underscores removed)
function slug (name) {return name.replace(/[- _]+/g, "").toLowerCase();}

// Expands a list of Unicode code points and ranges to be usable in a regex character class
function expand (str) {return str.replace(/\w{4}/g, "\\u$&");}

// Converts a hexadecimal number to decimal
function dec (hex) {return parseInt(hex, 16);}

// Converts a decimal number to hexadecimal
function hex (dec) {return pad(parseInt(dec, 10).toString(16));}

// Adds leading zeros if shorter than four characters
function pad (str) {while (str.length < 4) str = "0" + str; return str;}

// Generates an inverted token on first use
function cacheInversion (item) {return unicode["^" + item] || (unicode["^" + item] = invert(unicode[item]));}

// Inverts a list of Unicode code points and ranges
function invert (range) {
    var output = [],
        lastEnd = -1,
        start;
    XRegExp.forEach(range, /\\u(\w{4})(?:-\\u(\w{4}))?/, function (m) {
        start = dec(m[1]);
        if (start > (lastEnd + 1)) {
            output.push("\\u" + pad(hex(lastEnd + 1)));
            (start > (lastEnd + 2)) && output.push("-\\u" + pad(hex(start - 1)));
        }
        lastEnd = dec(m[2] || m[1]);
    });
    if (lastEnd < 65535) {
        output.push("\\u" + pad(hex(lastEnd + 1)));
        (lastEnd < 65534) && output.push("-\\uFFFF");
    }
    return output.join("");
}

}());


/***** xregexp-unicode-blocks.js *****/

/*!
 * XRegExp Unicode Blocks v1.2.0-beta
 * Copyright 2010-2012 Steven Levithan <http://xregexp.com/>
 * Available under the MIT License
 * Uses Unicode 6.1 <http://unicode.org/Public/6.1.0/ucd/Blocks.txt>
 */

/**
 * Adds support for all Unicode blocks in the Basic Multilingual Plane (U+0000-U+FFFF). Unicode
 * blocks use the prefix "In". E.g., `\p{InBasicLatin}`. Token names are case insensitive, and any
 * spaces, hyphens, and underscores are ignored.
 */
;(function () {
"use strict";

if (typeof XRegExp === "undefined" || typeof XRegExp.addUnicodePackage === "undefined") {
    throw new ReferenceError("XRegExp Unicode Base must be loaded before Unicode Blocks");
}

var extensible = XRegExp.isInstalled("extensibility");

if (!extensible)
    XRegExp.install("extensibility"); // Temporarily install

XRegExp.addUnicodePackage({
    InBasic_Latin: "0000-007F",
    InLatin_1_Supplement: "0080-00FF",
    InLatin_Extended_A: "0100-017F",
    InLatin_Extended_B: "0180-024F",
    InIPA_Extensions: "0250-02AF",
    InSpacing_Modifier_Letters: "02B0-02FF",
    InCombining_Diacritical_Marks: "0300-036F",
    InGreek_and_Coptic: "0370-03FF",
    InCyrillic: "0400-04FF",
    InCyrillic_Supplement: "0500-052F",
    InArmenian: "0530-058F",
    InHebrew: "0590-05FF",
    InArabic: "0600-06FF",
    InSyriac: "0700-074F",
    InArabic_Supplement: "0750-077F",
    InThaana: "0780-07BF",
    InNKo: "07C0-07FF",
    InSamaritan: "0800-083F",
    InMandaic: "0840-085F",
    InArabic_Extended_A: "08A0-08FF",
    InDevanagari: "0900-097F",
    InBengali: "0980-09FF",
    InGurmukhi: "0A00-0A7F",
    InGujarati: "0A80-0AFF",
    InOriya: "0B00-0B7F",
    InTamil: "0B80-0BFF",
    InTelugu: "0C00-0C7F",
    InKannada: "0C80-0CFF",
    InMalayalam: "0D00-0D7F",
    InSinhala: "0D80-0DFF",
    InThai: "0E00-0E7F",
    InLao: "0E80-0EFF",
    InTibetan: "0F00-0FFF",
    InMyanmar: "1000-109F",
    InGeorgian: "10A0-10FF",
    InHangul_Jamo: "1100-11FF",
    InEthiopic: "1200-137F",
    InEthiopic_Supplement: "1380-139F",
    InCherokee: "13A0-13FF",
    InUnified_Canadian_Aboriginal_Syllabics: "1400-167F",
    InOgham: "1680-169F",
    InRunic: "16A0-16FF",
    InTagalog: "1700-171F",
    InHanunoo: "1720-173F",
    InBuhid: "1740-175F",
    InTagbanwa: "1760-177F",
    InKhmer: "1780-17FF",
    InMongolian: "1800-18AF",
    InUnified_Canadian_Aboriginal_Syllabics_Extended: "18B0-18FF",
    InLimbu: "1900-194F",
    InTai_Le: "1950-197F",
    InNew_Tai_Lue: "1980-19DF",
    InKhmer_Symbols: "19E0-19FF",
    InBuginese: "1A00-1A1F",
    InTai_Tham: "1A20-1AAF",
    InBalinese: "1B00-1B7F",
    InSundanese: "1B80-1BBF",
    InBatak: "1BC0-1BFF",
    InLepcha: "1C00-1C4F",
    InOl_Chiki: "1C50-1C7F",
    InSundanese_Supplement: "1CC0-1CCF",
    InVedic_Extensions: "1CD0-1CFF",
    InPhonetic_Extensions: "1D00-1D7F",
    InPhonetic_Extensions_Supplement: "1D80-1DBF",
    InCombining_Diacritical_Marks_Supplement: "1DC0-1DFF",
    InLatin_Extended_Additional: "1E00-1EFF",
    InGreek_Extended: "1F00-1FFF",
    InGeneral_Punctuation: "2000-206F",
    InSuperscripts_and_Subscripts: "2070-209F",
    InCurrency_Symbols: "20A0-20CF",
    InCombining_Diacritical_Marks_for_Symbols: "20D0-20FF",
    InLetterlike_Symbols: "2100-214F",
    InNumber_Forms: "2150-218F",
    InArrows: "2190-21FF",
    InMathematical_Operators: "2200-22FF",
    InMiscellaneous_Technical: "2300-23FF",
    InControl_Pictures: "2400-243F",
    InOptical_Character_Recognition: "2440-245F",
    InEnclosed_Alphanumerics: "2460-24FF",
    InBox_Drawing: "2500-257F",
    InBlock_Elements: "2580-259F",
    InGeometric_Shapes: "25A0-25FF",
    InMiscellaneous_Symbols: "2600-26FF",
    InDingbats: "2700-27BF",
    InMiscellaneous_Mathematical_Symbols_A: "27C0-27EF",
    InSupplemental_Arrows_A: "27F0-27FF",
    InBraille_Patterns: "2800-28FF",
    InSupplemental_Arrows_B: "2900-297F",
    InMiscellaneous_Mathematical_Symbols_B: "2980-29FF",
    InSupplemental_Mathematical_Operators: "2A00-2AFF",
    InMiscellaneous_Symbols_and_Arrows: "2B00-2BFF",
    InGlagolitic: "2C00-2C5F",
    InLatin_Extended_C: "2C60-2C7F",
    InCoptic: "2C80-2CFF",
    InGeorgian_Supplement: "2D00-2D2F",
    InTifinagh: "2D30-2D7F",
    InEthiopic_Extended: "2D80-2DDF",
    InCyrillic_Extended_A: "2DE0-2DFF",
    InSupplemental_Punctuation: "2E00-2E7F",
    InCJK_Radicals_Supplement: "2E80-2EFF",
    InKangxi_Radicals: "2F00-2FDF",
    InIdeographic_Description_Characters: "2FF0-2FFF",
    InCJK_Symbols_and_Punctuation: "3000-303F",
    InHiragana: "3040-309F",
    InKatakana: "30A0-30FF",
    InBopomofo: "3100-312F",
    InHangul_Compatibility_Jamo: "3130-318F",
    InKanbun: "3190-319F",
    InBopomofo_Extended: "31A0-31BF",
    InCJK_Strokes: "31C0-31EF",
    InKatakana_Phonetic_Extensions: "31F0-31FF",
    InEnclosed_CJK_Letters_and_Months: "3200-32FF",
    InCJK_Compatibility: "3300-33FF",
    InCJK_Unified_Ideographs_Extension_A: "3400-4DBF",
    InYijing_Hexagram_Symbols: "4DC0-4DFF",
    InCJK_Unified_Ideographs: "4E00-9FFF",
    InYi_Syllables: "A000-A48F",
    InYi_Radicals: "A490-A4CF",
    InLisu: "A4D0-A4FF",
    InVai: "A500-A63F",
    InCyrillic_Extended_B: "A640-A69F",
    InBamum: "A6A0-A6FF",
    InModifier_Tone_Letters: "A700-A71F",
    InLatin_Extended_D: "A720-A7FF",
    InSyloti_Nagri: "A800-A82F",
    InCommon_Indic_Number_Forms: "A830-A83F",
    InPhags_pa: "A840-A87F",
    InSaurashtra: "A880-A8DF",
    InDevanagari_Extended: "A8E0-A8FF",
    InKayah_Li: "A900-A92F",
    InRejang: "A930-A95F",
    InHangul_Jamo_Extended_A: "A960-A97F",
    InJavanese: "A980-A9DF",
    InCham: "AA00-AA5F",
    InMyanmar_Extended_A: "AA60-AA7F",
    InTai_Viet: "AA80-AADF",
    InMeetei_Mayek_Extensions: "AAE0-AAFF",
    InEthiopic_Extended_A: "AB00-AB2F",
    InMeetei_Mayek: "ABC0-ABFF",
    InHangul_Syllables: "AC00-D7AF",
    InHangul_Jamo_Extended_B: "D7B0-D7FF",
    InHigh_Surrogates: "D800-DB7F",
    InHigh_Private_Use_Surrogates: "DB80-DBFF",
    InLow_Surrogates: "DC00-DFFF",
    InPrivate_Use_Area: "E000-F8FF",
    InCJK_Compatibility_Ideographs: "F900-FAFF",
    InAlphabetic_Presentation_Forms: "FB00-FB4F",
    InArabic_Presentation_Forms_A: "FB50-FDFF",
    InVariation_Selectors: "FE00-FE0F",
    InVertical_Forms: "FE10-FE1F",
    InCombining_Half_Marks: "FE20-FE2F",
    InCJK_Compatibility_Forms: "FE30-FE4F",
    InSmall_Form_Variants: "FE50-FE6F",
    InArabic_Presentation_Forms_B: "FE70-FEFF",
    InHalfwidth_and_Fullwidth_Forms: "FF00-FFEF",
    InSpecials: "FFF0-FFFF"
});

if (!extensible)
    XRegExp.uninstall("extensibility"); // Revert to previous state

}());


/***** xregexp-unicode-categories.js *****/

/*!
 * XRegExp Unicode Categories v1.2.0-beta
 * Copyright 2010-2012 Steven Levithan <http://xregexp.com/>
 * Available under the MIT License
 * Uses Unicode 6.1 <http://unicode.org/Public/6.1.0/ucd/UnicodeData.txt>
 */

/**
 * Adds support for all Unicode categories (aka properties) E.g., `\p{Lu}` or
 * `\p{Uppercase Letter}`. Token names are case insensitive, and any spaces, hyphens,
 * and underscores are ignored.
 */
;(function () {
"use strict";

if (typeof XRegExp === "undefined" || typeof XRegExp.addUnicodePackage === "undefined") {
    throw new ReferenceError("XRegExp Unicode Base must be loaded before Unicode Categories");
}

var extensible = XRegExp.isInstalled("extensibility");

if (!extensible)
    XRegExp.install("extensibility"); // Temporarily install

XRegExp.addUnicodePackage({
    //L: "", // Included in the Unicode Base addon
    Ll: "0061-007A00B500DF-00F600F8-00FF01010103010501070109010B010D010F01110113011501170119011B011D011F01210123012501270129012B012D012F01310133013501370138013A013C013E014001420144014601480149014B014D014F01510153015501570159015B015D015F01610163016501670169016B016D016F0171017301750177017A017C017E-0180018301850188018C018D019201950199-019B019E01A101A301A501A801AA01AB01AD01B001B401B601B901BA01BD-01BF01C601C901CC01CE01D001D201D401D601D801DA01DC01DD01DF01E101E301E501E701E901EB01ED01EF01F001F301F501F901FB01FD01FF02010203020502070209020B020D020F02110213021502170219021B021D021F02210223022502270229022B022D022F02310233-0239023C023F0240024202470249024B024D024F-02930295-02AF037103730377037B-037D039003AC-03CE03D003D103D5-03D703D903DB03DD03DF03E103E303E503E703E903EB03ED03EF-03F303F503F803FB03FC0430-045F04610463046504670469046B046D046F04710473047504770479047B047D047F0481048B048D048F04910493049504970499049B049D049F04A104A304A504A704A904AB04AD04AF04B104B304B504B704B904BB04BD04BF04C204C404C604C804CA04CC04CE04CF04D104D304D504D704D904DB04DD04DF04E104E304E504E704E904EB04ED04EF04F104F304F504F704F904FB04FD04FF05010503050505070509050B050D050F05110513051505170519051B051D051F05210523052505270561-05871D00-1D2B1D6B-1D771D79-1D9A1E011E031E051E071E091E0B1E0D1E0F1E111E131E151E171E191E1B1E1D1E1F1E211E231E251E271E291E2B1E2D1E2F1E311E331E351E371E391E3B1E3D1E3F1E411E431E451E471E491E4B1E4D1E4F1E511E531E551E571E591E5B1E5D1E5F1E611E631E651E671E691E6B1E6D1E6F1E711E731E751E771E791E7B1E7D1E7F1E811E831E851E871E891E8B1E8D1E8F1E911E931E95-1E9D1E9F1EA11EA31EA51EA71EA91EAB1EAD1EAF1EB11EB31EB51EB71EB91EBB1EBD1EBF1EC11EC31EC51EC71EC91ECB1ECD1ECF1ED11ED31ED51ED71ED91EDB1EDD1EDF1EE11EE31EE51EE71EE91EEB1EED1EEF1EF11EF31EF51EF71EF91EFB1EFD1EFF-1F071F10-1F151F20-1F271F30-1F371F40-1F451F50-1F571F60-1F671F70-1F7D1F80-1F871F90-1F971FA0-1FA71FB0-1FB41FB61FB71FBE1FC2-1FC41FC61FC71FD0-1FD31FD61FD71FE0-1FE71FF2-1FF41FF61FF7210A210E210F2113212F21342139213C213D2146-2149214E21842C30-2C5E2C612C652C662C682C6A2C6C2C712C732C742C76-2C7B2C812C832C852C872C892C8B2C8D2C8F2C912C932C952C972C992C9B2C9D2C9F2CA12CA32CA52CA72CA92CAB2CAD2CAF2CB12CB32CB52CB72CB92CBB2CBD2CBF2CC12CC32CC52CC72CC92CCB2CCD2CCF2CD12CD32CD52CD72CD92CDB2CDD2CDF2CE12CE32CE42CEC2CEE2CF32D00-2D252D272D2DA641A643A645A647A649A64BA64DA64FA651A653A655A657A659A65BA65DA65FA661A663A665A667A669A66BA66DA681A683A685A687A689A68BA68DA68FA691A693A695A697A723A725A727A729A72BA72DA72F-A731A733A735A737A739A73BA73DA73FA741A743A745A747A749A74BA74DA74FA751A753A755A757A759A75BA75DA75FA761A763A765A767A769A76BA76DA76FA771-A778A77AA77CA77FA781A783A785A787A78CA78EA791A793A7A1A7A3A7A5A7A7A7A9A7FAFB00-FB06FB13-FB17FF41-FF5A",
    Lu: "0041-005A00C0-00D600D8-00DE01000102010401060108010A010C010E01100112011401160118011A011C011E01200122012401260128012A012C012E01300132013401360139013B013D013F0141014301450147014A014C014E01500152015401560158015A015C015E01600162016401660168016A016C016E017001720174017601780179017B017D018101820184018601870189-018B018E-0191019301940196-0198019C019D019F01A001A201A401A601A701A901AC01AE01AF01B1-01B301B501B701B801BC01C401C701CA01CD01CF01D101D301D501D701D901DB01DE01E001E201E401E601E801EA01EC01EE01F101F401F6-01F801FA01FC01FE02000202020402060208020A020C020E02100212021402160218021A021C021E02200222022402260228022A022C022E02300232023A023B023D023E02410243-02460248024A024C024E03700372037603860388-038A038C038E038F0391-03A103A3-03AB03CF03D2-03D403D803DA03DC03DE03E003E203E403E603E803EA03EC03EE03F403F703F903FA03FD-042F04600462046404660468046A046C046E04700472047404760478047A047C047E0480048A048C048E04900492049404960498049A049C049E04A004A204A404A604A804AA04AC04AE04B004B204B404B604B804BA04BC04BE04C004C104C304C504C704C904CB04CD04D004D204D404D604D804DA04DC04DE04E004E204E404E604E804EA04EC04EE04F004F204F404F604F804FA04FC04FE05000502050405060508050A050C050E05100512051405160518051A051C051E05200522052405260531-055610A0-10C510C710CD1E001E021E041E061E081E0A1E0C1E0E1E101E121E141E161E181E1A1E1C1E1E1E201E221E241E261E281E2A1E2C1E2E1E301E321E341E361E381E3A1E3C1E3E1E401E421E441E461E481E4A1E4C1E4E1E501E521E541E561E581E5A1E5C1E5E1E601E621E641E661E681E6A1E6C1E6E1E701E721E741E761E781E7A1E7C1E7E1E801E821E841E861E881E8A1E8C1E8E1E901E921E941E9E1EA01EA21EA41EA61EA81EAA1EAC1EAE1EB01EB21EB41EB61EB81EBA1EBC1EBE1EC01EC21EC41EC61EC81ECA1ECC1ECE1ED01ED21ED41ED61ED81EDA1EDC1EDE1EE01EE21EE41EE61EE81EEA1EEC1EEE1EF01EF21EF41EF61EF81EFA1EFC1EFE1F08-1F0F1F18-1F1D1F28-1F2F1F38-1F3F1F48-1F4D1F591F5B1F5D1F5F1F68-1F6F1FB8-1FBB1FC8-1FCB1FD8-1FDB1FE8-1FEC1FF8-1FFB21022107210B-210D2110-211221152119-211D212421262128212A-212D2130-2133213E213F214521832C00-2C2E2C602C62-2C642C672C692C6B2C6D-2C702C722C752C7E-2C802C822C842C862C882C8A2C8C2C8E2C902C922C942C962C982C9A2C9C2C9E2CA02CA22CA42CA62CA82CAA2CAC2CAE2CB02CB22CB42CB62CB82CBA2CBC2CBE2CC02CC22CC42CC62CC82CCA2CCC2CCE2CD02CD22CD42CD62CD82CDA2CDC2CDE2CE02CE22CEB2CED2CF2A640A642A644A646A648A64AA64CA64EA650A652A654A656A658A65AA65CA65EA660A662A664A666A668A66AA66CA680A682A684A686A688A68AA68CA68EA690A692A694A696A722A724A726A728A72AA72CA72EA732A734A736A738A73AA73CA73EA740A742A744A746A748A74AA74CA74EA750A752A754A756A758A75AA75CA75EA760A762A764A766A768A76AA76CA76EA779A77BA77DA77EA780A782A784A786A78BA78DA790A792A7A0A7A2A7A4A7A6A7A8A7AAFF21-FF3A",
    Lt: "01C501C801CB01F21F88-1F8F1F98-1F9F1FA8-1FAF1FBC1FCC1FFC",
    Lm: "02B0-02C102C6-02D102E0-02E402EC02EE0374037A0559064006E506E607F407F507FA081A0824082809710E460EC610FC17D718431AA71C78-1C7D1D2C-1D6A1D781D9B-1DBF2071207F2090-209C2C7C2C7D2D6F2E2F30053031-3035303B309D309E30FC-30FEA015A4F8-A4FDA60CA67FA717-A71FA770A788A7F8A7F9A9CFAA70AADDAAF3AAF4FF70FF9EFF9F",
    Lo: "00AA00BA01BB01C0-01C3029405D0-05EA05F0-05F20620-063F0641-064A066E066F0671-06D306D506EE06EF06FA-06FC06FF07100712-072F074D-07A507B107CA-07EA0800-08150840-085808A008A2-08AC0904-0939093D09500958-09610972-09770979-097F0985-098C098F09900993-09A809AA-09B009B209B6-09B909BD09CE09DC09DD09DF-09E109F009F10A05-0A0A0A0F0A100A13-0A280A2A-0A300A320A330A350A360A380A390A59-0A5C0A5E0A72-0A740A85-0A8D0A8F-0A910A93-0AA80AAA-0AB00AB20AB30AB5-0AB90ABD0AD00AE00AE10B05-0B0C0B0F0B100B13-0B280B2A-0B300B320B330B35-0B390B3D0B5C0B5D0B5F-0B610B710B830B85-0B8A0B8E-0B900B92-0B950B990B9A0B9C0B9E0B9F0BA30BA40BA8-0BAA0BAE-0BB90BD00C05-0C0C0C0E-0C100C12-0C280C2A-0C330C35-0C390C3D0C580C590C600C610C85-0C8C0C8E-0C900C92-0CA80CAA-0CB30CB5-0CB90CBD0CDE0CE00CE10CF10CF20D05-0D0C0D0E-0D100D12-0D3A0D3D0D4E0D600D610D7A-0D7F0D85-0D960D9A-0DB10DB3-0DBB0DBD0DC0-0DC60E01-0E300E320E330E40-0E450E810E820E840E870E880E8A0E8D0E94-0E970E99-0E9F0EA1-0EA30EA50EA70EAA0EAB0EAD-0EB00EB20EB30EBD0EC0-0EC40EDC-0EDF0F000F40-0F470F49-0F6C0F88-0F8C1000-102A103F1050-1055105A-105D106110651066106E-10701075-1081108E10D0-10FA10FD-1248124A-124D1250-12561258125A-125D1260-1288128A-128D1290-12B012B2-12B512B8-12BE12C012C2-12C512C8-12D612D8-13101312-13151318-135A1380-138F13A0-13F41401-166C166F-167F1681-169A16A0-16EA1700-170C170E-17111720-17311740-17511760-176C176E-17701780-17B317DC1820-18421844-18771880-18A818AA18B0-18F51900-191C1950-196D1970-19741980-19AB19C1-19C71A00-1A161A20-1A541B05-1B331B45-1B4B1B83-1BA01BAE1BAF1BBA-1BE51C00-1C231C4D-1C4F1C5A-1C771CE9-1CEC1CEE-1CF11CF51CF62135-21382D30-2D672D80-2D962DA0-2DA62DA8-2DAE2DB0-2DB62DB8-2DBE2DC0-2DC62DC8-2DCE2DD0-2DD62DD8-2DDE3006303C3041-3096309F30A1-30FA30FF3105-312D3131-318E31A0-31BA31F0-31FF3400-4DB54E00-9FCCA000-A014A016-A48CA4D0-A4F7A500-A60BA610-A61FA62AA62BA66EA6A0-A6E5A7FB-A801A803-A805A807-A80AA80C-A822A840-A873A882-A8B3A8F2-A8F7A8FBA90A-A925A930-A946A960-A97CA984-A9B2AA00-AA28AA40-AA42AA44-AA4BAA60-AA6FAA71-AA76AA7AAA80-AAAFAAB1AAB5AAB6AAB9-AABDAAC0AAC2AADBAADCAAE0-AAEAAAF2AB01-AB06AB09-AB0EAB11-AB16AB20-AB26AB28-AB2EABC0-ABE2AC00-D7A3D7B0-D7C6D7CB-D7FBF900-FA6DFA70-FAD9FB1DFB1F-FB28FB2A-FB36FB38-FB3CFB3EFB40FB41FB43FB44FB46-FBB1FBD3-FD3DFD50-FD8FFD92-FDC7FDF0-FDFBFE70-FE74FE76-FEFCFF66-FF6FFF71-FF9DFFA0-FFBEFFC2-FFC7FFCA-FFCFFFD2-FFD7FFDA-FFDC",
    M: "0300-036F0483-04890591-05BD05BF05C105C205C405C505C70610-061A064B-065F067006D6-06DC06DF-06E406E706E806EA-06ED07110730-074A07A6-07B007EB-07F30816-0819081B-08230825-08270829-082D0859-085B08E4-08FE0900-0903093A-093C093E-094F0951-0957096209630981-098309BC09BE-09C409C709C809CB-09CD09D709E209E30A01-0A030A3C0A3E-0A420A470A480A4B-0A4D0A510A700A710A750A81-0A830ABC0ABE-0AC50AC7-0AC90ACB-0ACD0AE20AE30B01-0B030B3C0B3E-0B440B470B480B4B-0B4D0B560B570B620B630B820BBE-0BC20BC6-0BC80BCA-0BCD0BD70C01-0C030C3E-0C440C46-0C480C4A-0C4D0C550C560C620C630C820C830CBC0CBE-0CC40CC6-0CC80CCA-0CCD0CD50CD60CE20CE30D020D030D3E-0D440D46-0D480D4A-0D4D0D570D620D630D820D830DCA0DCF-0DD40DD60DD8-0DDF0DF20DF30E310E34-0E3A0E47-0E4E0EB10EB4-0EB90EBB0EBC0EC8-0ECD0F180F190F350F370F390F3E0F3F0F71-0F840F860F870F8D-0F970F99-0FBC0FC6102B-103E1056-1059105E-10601062-10641067-106D1071-10741082-108D108F109A-109D135D-135F1712-17141732-1734175217531772177317B4-17D317DD180B-180D18A91920-192B1930-193B19B0-19C019C819C91A17-1A1B1A55-1A5E1A60-1A7C1A7F1B00-1B041B34-1B441B6B-1B731B80-1B821BA1-1BAD1BE6-1BF31C24-1C371CD0-1CD21CD4-1CE81CED1CF2-1CF41DC0-1DE61DFC-1DFF20D0-20F02CEF-2CF12D7F2DE0-2DFF302A-302F3099309AA66F-A672A674-A67DA69FA6F0A6F1A802A806A80BA823-A827A880A881A8B4-A8C4A8E0-A8F1A926-A92DA947-A953A980-A983A9B3-A9C0AA29-AA36AA43AA4CAA4DAA7BAAB0AAB2-AAB4AAB7AAB8AABEAABFAAC1AAEB-AAEFAAF5AAF6ABE3-ABEAABECABEDFB1EFE00-FE0FFE20-FE26",
    Mn: "0300-036F0483-04870591-05BD05BF05C105C205C405C505C70610-061A064B-065F067006D6-06DC06DF-06E406E706E806EA-06ED07110730-074A07A6-07B007EB-07F30816-0819081B-08230825-08270829-082D0859-085B08E4-08FE0900-0902093A093C0941-0948094D0951-095709620963098109BC09C1-09C409CD09E209E30A010A020A3C0A410A420A470A480A4B-0A4D0A510A700A710A750A810A820ABC0AC1-0AC50AC70AC80ACD0AE20AE30B010B3C0B3F0B41-0B440B4D0B560B620B630B820BC00BCD0C3E-0C400C46-0C480C4A-0C4D0C550C560C620C630CBC0CBF0CC60CCC0CCD0CE20CE30D41-0D440D4D0D620D630DCA0DD2-0DD40DD60E310E34-0E3A0E47-0E4E0EB10EB4-0EB90EBB0EBC0EC8-0ECD0F180F190F350F370F390F71-0F7E0F80-0F840F860F870F8D-0F970F99-0FBC0FC6102D-10301032-10371039103A103D103E10581059105E-10601071-1074108210851086108D109D135D-135F1712-17141732-1734175217531772177317B417B517B7-17BD17C617C9-17D317DD180B-180D18A91920-19221927192819321939-193B1A171A181A561A58-1A5E1A601A621A65-1A6C1A73-1A7C1A7F1B00-1B031B341B36-1B3A1B3C1B421B6B-1B731B801B811BA2-1BA51BA81BA91BAB1BE61BE81BE91BED1BEF-1BF11C2C-1C331C361C371CD0-1CD21CD4-1CE01CE2-1CE81CED1CF41DC0-1DE61DFC-1DFF20D0-20DC20E120E5-20F02CEF-2CF12D7F2DE0-2DFF302A-302D3099309AA66FA674-A67DA69FA6F0A6F1A802A806A80BA825A826A8C4A8E0-A8F1A926-A92DA947-A951A980-A982A9B3A9B6-A9B9A9BCAA29-AA2EAA31AA32AA35AA36AA43AA4CAAB0AAB2-AAB4AAB7AAB8AABEAABFAAC1AAECAAEDAAF6ABE5ABE8ABEDFB1EFE00-FE0FFE20-FE26",
    Mc: "0903093B093E-09400949-094C094E094F0982098309BE-09C009C709C809CB09CC09D70A030A3E-0A400A830ABE-0AC00AC90ACB0ACC0B020B030B3E0B400B470B480B4B0B4C0B570BBE0BBF0BC10BC20BC6-0BC80BCA-0BCC0BD70C01-0C030C41-0C440C820C830CBE0CC0-0CC40CC70CC80CCA0CCB0CD50CD60D020D030D3E-0D400D46-0D480D4A-0D4C0D570D820D830DCF-0DD10DD8-0DDF0DF20DF30F3E0F3F0F7F102B102C10311038103B103C105610571062-10641067-106D108310841087-108C108F109A-109C17B617BE-17C517C717C81923-19261929-192B193019311933-193819B0-19C019C819C91A19-1A1B1A551A571A611A631A641A6D-1A721B041B351B3B1B3D-1B411B431B441B821BA11BA61BA71BAA1BAC1BAD1BE71BEA-1BEC1BEE1BF21BF31C24-1C2B1C341C351CE11CF21CF3302E302FA823A824A827A880A881A8B4-A8C3A952A953A983A9B4A9B5A9BAA9BBA9BD-A9C0AA2FAA30AA33AA34AA4DAA7BAAEBAAEEAAEFAAF5ABE3ABE4ABE6ABE7ABE9ABEAABEC",
    Me: "0488048920DD-20E020E2-20E4A670-A672",
    N: "0030-003900B200B300B900BC-00BE0660-066906F0-06F907C0-07C90966-096F09E6-09EF09F4-09F90A66-0A6F0AE6-0AEF0B66-0B6F0B72-0B770BE6-0BF20C66-0C6F0C78-0C7E0CE6-0CEF0D66-0D750E50-0E590ED0-0ED90F20-0F331040-10491090-10991369-137C16EE-16F017E0-17E917F0-17F91810-18191946-194F19D0-19DA1A80-1A891A90-1A991B50-1B591BB0-1BB91C40-1C491C50-1C5920702074-20792080-20892150-21822185-21892460-249B24EA-24FF2776-27932CFD30073021-30293038-303A3192-31953220-32293248-324F3251-325F3280-328932B1-32BFA620-A629A6E6-A6EFA830-A835A8D0-A8D9A900-A909A9D0-A9D9AA50-AA59ABF0-ABF9FF10-FF19",
    Nd: "0030-00390660-066906F0-06F907C0-07C90966-096F09E6-09EF0A66-0A6F0AE6-0AEF0B66-0B6F0BE6-0BEF0C66-0C6F0CE6-0CEF0D66-0D6F0E50-0E590ED0-0ED90F20-0F291040-10491090-109917E0-17E91810-18191946-194F19D0-19D91A80-1A891A90-1A991B50-1B591BB0-1BB91C40-1C491C50-1C59A620-A629A8D0-A8D9A900-A909A9D0-A9D9AA50-AA59ABF0-ABF9FF10-FF19",
    Nl: "16EE-16F02160-21822185-218830073021-30293038-303AA6E6-A6EF",
    No: "00B200B300B900BC-00BE09F4-09F90B72-0B770BF0-0BF20C78-0C7E0D70-0D750F2A-0F331369-137C17F0-17F919DA20702074-20792080-20892150-215F21892460-249B24EA-24FF2776-27932CFD3192-31953220-32293248-324F3251-325F3280-328932B1-32BFA830-A835",
    P: "0021-00230025-002A002C-002F003A003B003F0040005B-005D005F007B007D00A100A700AB00B600B700BB00BF037E0387055A-055F0589058A05BE05C005C305C605F305F40609060A060C060D061B061E061F066A-066D06D40700-070D07F7-07F90830-083E085E0964096509700AF00DF40E4F0E5A0E5B0F04-0F120F140F3A-0F3D0F850FD0-0FD40FD90FDA104A-104F10FB1360-13681400166D166E169B169C16EB-16ED1735173617D4-17D617D8-17DA1800-180A194419451A1E1A1F1AA0-1AA61AA8-1AAD1B5A-1B601BFC-1BFF1C3B-1C3F1C7E1C7F1CC0-1CC71CD32010-20272030-20432045-20512053-205E207D207E208D208E2329232A2768-277527C527C627E6-27EF2983-299829D8-29DB29FC29FD2CF9-2CFC2CFE2CFF2D702E00-2E2E2E30-2E3B3001-30033008-30113014-301F3030303D30A030FBA4FEA4FFA60D-A60FA673A67EA6F2-A6F7A874-A877A8CEA8CFA8F8-A8FAA92EA92FA95FA9C1-A9CDA9DEA9DFAA5C-AA5FAADEAADFAAF0AAF1ABEBFD3EFD3FFE10-FE19FE30-FE52FE54-FE61FE63FE68FE6AFE6BFF01-FF03FF05-FF0AFF0C-FF0FFF1AFF1BFF1FFF20FF3B-FF3DFF3FFF5BFF5DFF5F-FF65",
    Pd: "002D058A05BE140018062010-20152E172E1A2E3A2E3B301C303030A0FE31FE32FE58FE63FF0D",
    Ps: "0028005B007B0F3A0F3C169B201A201E2045207D208D23292768276A276C276E27702772277427C527E627E827EA27EC27EE2983298529872989298B298D298F299129932995299729D829DA29FC2E222E242E262E283008300A300C300E3010301430163018301A301DFD3EFE17FE35FE37FE39FE3BFE3DFE3FFE41FE43FE47FE59FE5BFE5DFF08FF3BFF5BFF5FFF62",
    Pe: "0029005D007D0F3B0F3D169C2046207E208E232A2769276B276D276F27712773277527C627E727E927EB27ED27EF298429862988298A298C298E2990299229942996299829D929DB29FD2E232E252E272E293009300B300D300F3011301530173019301B301E301FFD3FFE18FE36FE38FE3AFE3CFE3EFE40FE42FE44FE48FE5AFE5CFE5EFF09FF3DFF5DFF60FF63",
    Pi: "00AB2018201B201C201F20392E022E042E092E0C2E1C2E20",
    Pf: "00BB2019201D203A2E032E052E0A2E0D2E1D2E21",
    Pc: "005F203F20402054FE33FE34FE4D-FE4FFF3F",
    Po: "0021-00230025-0027002A002C002E002F003A003B003F0040005C00A100A700B600B700BF037E0387055A-055F058905C005C305C605F305F40609060A060C060D061B061E061F066A-066D06D40700-070D07F7-07F90830-083E085E0964096509700AF00DF40E4F0E5A0E5B0F04-0F120F140F850FD0-0FD40FD90FDA104A-104F10FB1360-1368166D166E16EB-16ED1735173617D4-17D617D8-17DA1800-18051807-180A194419451A1E1A1F1AA0-1AA61AA8-1AAD1B5A-1B601BFC-1BFF1C3B-1C3F1C7E1C7F1CC0-1CC71CD3201620172020-20272030-2038203B-203E2041-20432047-205120532055-205E2CF9-2CFC2CFE2CFF2D702E002E012E06-2E082E0B2E0E-2E162E182E192E1B2E1E2E1F2E2A-2E2E2E30-2E393001-3003303D30FBA4FEA4FFA60D-A60FA673A67EA6F2-A6F7A874-A877A8CEA8CFA8F8-A8FAA92EA92FA95FA9C1-A9CDA9DEA9DFAA5C-AA5FAADEAADFAAF0AAF1ABEBFE10-FE16FE19FE30FE45FE46FE49-FE4CFE50-FE52FE54-FE57FE5F-FE61FE68FE6AFE6BFF01-FF03FF05-FF07FF0AFF0CFF0EFF0FFF1AFF1BFF1FFF20FF3CFF61FF64FF65",
    S: "0024002B003C-003E005E0060007C007E00A2-00A600A800A900AC00AE-00B100B400B800D700F702C2-02C502D2-02DF02E5-02EB02ED02EF-02FF03750384038503F60482058F0606-0608060B060E060F06DE06E906FD06FE07F609F209F309FA09FB0AF10B700BF3-0BFA0C7F0D790E3F0F01-0F030F130F15-0F170F1A-0F1F0F340F360F380FBE-0FC50FC7-0FCC0FCE0FCF0FD5-0FD8109E109F1390-139917DB194019DE-19FF1B61-1B6A1B74-1B7C1FBD1FBF-1FC11FCD-1FCF1FDD-1FDF1FED-1FEF1FFD1FFE20442052207A-207C208A-208C20A0-20B9210021012103-21062108210921142116-2118211E-2123212521272129212E213A213B2140-2144214A-214D214F2190-2328232B-23F32400-24262440-244A249C-24E92500-26FF2701-27672794-27C427C7-27E527F0-29822999-29D729DC-29FB29FE-2B4C2B50-2B592CE5-2CEA2E80-2E992E9B-2EF32F00-2FD52FF0-2FFB300430123013302030363037303E303F309B309C319031913196-319F31C0-31E33200-321E322A-324732503260-327F328A-32B032C0-32FE3300-33FF4DC0-4DFFA490-A4C6A700-A716A720A721A789A78AA828-A82BA836-A839AA77-AA79FB29FBB2-FBC1FDFCFDFDFE62FE64-FE66FE69FF04FF0BFF1C-FF1EFF3EFF40FF5CFF5EFFE0-FFE6FFE8-FFEEFFFCFFFD",
    Sm: "002B003C-003E007C007E00AC00B100D700F703F60606-060820442052207A-207C208A-208C21182140-2144214B2190-2194219A219B21A021A321A621AE21CE21CF21D221D421F4-22FF2308-230B23202321237C239B-23B323DC-23E125B725C125F8-25FF266F27C0-27C427C7-27E527F0-27FF2900-29822999-29D729DC-29FB29FE-2AFF2B30-2B442B47-2B4CFB29FE62FE64-FE66FF0BFF1C-FF1EFF5CFF5EFFE2FFE9-FFEC",
    Sc: "002400A2-00A5058F060B09F209F309FB0AF10BF90E3F17DB20A0-20B9A838FDFCFE69FF04FFE0FFE1FFE5FFE6",
    Sk: "005E006000A800AF00B400B802C2-02C502D2-02DF02E5-02EB02ED02EF-02FF0375038403851FBD1FBF-1FC11FCD-1FCF1FDD-1FDF1FED-1FEF1FFD1FFE309B309CA700-A716A720A721A789A78AFBB2-FBC1FF3EFF40FFE3",
    So: "00A600A900AE00B00482060E060F06DE06E906FD06FE07F609FA0B700BF3-0BF80BFA0C7F0D790F01-0F030F130F15-0F170F1A-0F1F0F340F360F380FBE-0FC50FC7-0FCC0FCE0FCF0FD5-0FD8109E109F1390-1399194019DE-19FF1B61-1B6A1B74-1B7C210021012103-210621082109211421162117211E-2123212521272129212E213A213B214A214C214D214F2195-2199219C-219F21A121A221A421A521A7-21AD21AF-21CD21D021D121D321D5-21F32300-2307230C-231F2322-2328232B-237B237D-239A23B4-23DB23E2-23F32400-24262440-244A249C-24E92500-25B625B8-25C025C2-25F72600-266E2670-26FF2701-27672794-27BF2800-28FF2B00-2B2F2B452B462B50-2B592CE5-2CEA2E80-2E992E9B-2EF32F00-2FD52FF0-2FFB300430123013302030363037303E303F319031913196-319F31C0-31E33200-321E322A-324732503260-327F328A-32B032C0-32FE3300-33FF4DC0-4DFFA490-A4C6A828-A82BA836A837A839AA77-AA79FDFDFFE4FFE8FFEDFFEEFFFCFFFD",
    Z: "002000A01680180E2000-200A20282029202F205F3000",
    Zs: "002000A01680180E2000-200A202F205F3000",
    Zl: "2028",
    Zp: "2029",
    C: "0000-001F007F-009F00AD03780379037F-0383038B038D03A20528-05300557055805600588058B-058E059005C8-05CF05EB-05EF05F5-0605061C061D06DD070E070F074B074C07B2-07BF07FB-07FF082E082F083F085C085D085F-089F08A108AD-08E308FF097809800984098D098E0991099209A909B109B3-09B509BA09BB09C509C609C909CA09CF-09D609D8-09DB09DE09E409E509FC-0A000A040A0B-0A0E0A110A120A290A310A340A370A3A0A3B0A3D0A43-0A460A490A4A0A4E-0A500A52-0A580A5D0A5F-0A650A76-0A800A840A8E0A920AA90AB10AB40ABA0ABB0AC60ACA0ACE0ACF0AD1-0ADF0AE40AE50AF2-0B000B040B0D0B0E0B110B120B290B310B340B3A0B3B0B450B460B490B4A0B4E-0B550B58-0B5B0B5E0B640B650B78-0B810B840B8B-0B8D0B910B96-0B980B9B0B9D0BA0-0BA20BA5-0BA70BAB-0BAD0BBA-0BBD0BC3-0BC50BC90BCE0BCF0BD1-0BD60BD8-0BE50BFB-0C000C040C0D0C110C290C340C3A-0C3C0C450C490C4E-0C540C570C5A-0C5F0C640C650C70-0C770C800C810C840C8D0C910CA90CB40CBA0CBB0CC50CC90CCE-0CD40CD7-0CDD0CDF0CE40CE50CF00CF3-0D010D040D0D0D110D3B0D3C0D450D490D4F-0D560D58-0D5F0D640D650D76-0D780D800D810D840D97-0D990DB20DBC0DBE0DBF0DC7-0DC90DCB-0DCE0DD50DD70DE0-0DF10DF5-0E000E3B-0E3E0E5C-0E800E830E850E860E890E8B0E8C0E8E-0E930E980EA00EA40EA60EA80EA90EAC0EBA0EBE0EBF0EC50EC70ECE0ECF0EDA0EDB0EE0-0EFF0F480F6D-0F700F980FBD0FCD0FDB-0FFF10C610C8-10CC10CE10CF1249124E124F12571259125E125F1289128E128F12B112B612B712BF12C112C612C712D7131113161317135B135C137D-137F139A-139F13F5-13FF169D-169F16F1-16FF170D1715-171F1737-173F1754-175F176D17711774-177F17DE17DF17EA-17EF17FA-17FF180F181A-181F1878-187F18AB-18AF18F6-18FF191D-191F192C-192F193C-193F1941-1943196E196F1975-197F19AC-19AF19CA-19CF19DB-19DD1A1C1A1D1A5F1A7D1A7E1A8A-1A8F1A9A-1A9F1AAE-1AFF1B4C-1B4F1B7D-1B7F1BF4-1BFB1C38-1C3A1C4A-1C4C1C80-1CBF1CC8-1CCF1CF7-1CFF1DE7-1DFB1F161F171F1E1F1F1F461F471F4E1F4F1F581F5A1F5C1F5E1F7E1F7F1FB51FC51FD41FD51FDC1FF01FF11FF51FFF200B-200F202A-202E2060-206F20722073208F209D-209F20BA-20CF20F1-20FF218A-218F23F4-23FF2427-243F244B-245F27002B4D-2B4F2B5A-2BFF2C2F2C5F2CF4-2CF82D262D28-2D2C2D2E2D2F2D68-2D6E2D71-2D7E2D97-2D9F2DA72DAF2DB72DBF2DC72DCF2DD72DDF2E3C-2E7F2E9A2EF4-2EFF2FD6-2FEF2FFC-2FFF3040309730983100-3104312E-3130318F31BB-31BF31E4-31EF321F32FF4DB6-4DBF9FCD-9FFFA48D-A48FA4C7-A4CFA62C-A63FA698-A69EA6F8-A6FFA78FA794-A79FA7AB-A7F7A82C-A82FA83A-A83FA878-A87FA8C5-A8CDA8DA-A8DFA8FC-A8FFA954-A95EA97D-A97FA9CEA9DA-A9DDA9E0-A9FFAA37-AA3FAA4EAA4FAA5AAA5BAA7C-AA7FAAC3-AADAAAF7-AB00AB07AB08AB0FAB10AB17-AB1FAB27AB2F-ABBFABEEABEFABFA-ABFFD7A4-D7AFD7C7-D7CAD7FC-F8FFFA6EFA6FFADA-FAFFFB07-FB12FB18-FB1CFB37FB3DFB3FFB42FB45FBC2-FBD2FD40-FD4FFD90FD91FDC8-FDEFFDFEFDFFFE1A-FE1FFE27-FE2FFE53FE67FE6C-FE6FFE75FEFD-FF00FFBF-FFC1FFC8FFC9FFD0FFD1FFD8FFD9FFDD-FFDFFFE7FFEF-FFFBFFFEFFFF",
    Cc: "0000-001F007F-009F",
    Cf: "00AD0600-060406DD070F200B-200F202A-202E2060-2064206A-206FFEFFFFF9-FFFB",
    Co: "E000-F8FF",
    Cs: "D800-DFFF",
    Cn: "03780379037F-0383038B038D03A20528-05300557055805600588058B-058E059005C8-05CF05EB-05EF05F5-05FF0605061C061D070E074B074C07B2-07BF07FB-07FF082E082F083F085C085D085F-089F08A108AD-08E308FF097809800984098D098E0991099209A909B109B3-09B509BA09BB09C509C609C909CA09CF-09D609D8-09DB09DE09E409E509FC-0A000A040A0B-0A0E0A110A120A290A310A340A370A3A0A3B0A3D0A43-0A460A490A4A0A4E-0A500A52-0A580A5D0A5F-0A650A76-0A800A840A8E0A920AA90AB10AB40ABA0ABB0AC60ACA0ACE0ACF0AD1-0ADF0AE40AE50AF2-0B000B040B0D0B0E0B110B120B290B310B340B3A0B3B0B450B460B490B4A0B4E-0B550B58-0B5B0B5E0B640B650B78-0B810B840B8B-0B8D0B910B96-0B980B9B0B9D0BA0-0BA20BA5-0BA70BAB-0BAD0BBA-0BBD0BC3-0BC50BC90BCE0BCF0BD1-0BD60BD8-0BE50BFB-0C000C040C0D0C110C290C340C3A-0C3C0C450C490C4E-0C540C570C5A-0C5F0C640C650C70-0C770C800C810C840C8D0C910CA90CB40CBA0CBB0CC50CC90CCE-0CD40CD7-0CDD0CDF0CE40CE50CF00CF3-0D010D040D0D0D110D3B0D3C0D450D490D4F-0D560D58-0D5F0D640D650D76-0D780D800D810D840D97-0D990DB20DBC0DBE0DBF0DC7-0DC90DCB-0DCE0DD50DD70DE0-0DF10DF5-0E000E3B-0E3E0E5C-0E800E830E850E860E890E8B0E8C0E8E-0E930E980EA00EA40EA60EA80EA90EAC0EBA0EBE0EBF0EC50EC70ECE0ECF0EDA0EDB0EE0-0EFF0F480F6D-0F700F980FBD0FCD0FDB-0FFF10C610C8-10CC10CE10CF1249124E124F12571259125E125F1289128E128F12B112B612B712BF12C112C612C712D7131113161317135B135C137D-137F139A-139F13F5-13FF169D-169F16F1-16FF170D1715-171F1737-173F1754-175F176D17711774-177F17DE17DF17EA-17EF17FA-17FF180F181A-181F1878-187F18AB-18AF18F6-18FF191D-191F192C-192F193C-193F1941-1943196E196F1975-197F19AC-19AF19CA-19CF19DB-19DD1A1C1A1D1A5F1A7D1A7E1A8A-1A8F1A9A-1A9F1AAE-1AFF1B4C-1B4F1B7D-1B7F1BF4-1BFB1C38-1C3A1C4A-1C4C1C80-1CBF1CC8-1CCF1CF7-1CFF1DE7-1DFB1F161F171F1E1F1F1F461F471F4E1F4F1F581F5A1F5C1F5E1F7E1F7F1FB51FC51FD41FD51FDC1FF01FF11FF51FFF2065-206920722073208F209D-209F20BA-20CF20F1-20FF218A-218F23F4-23FF2427-243F244B-245F27002B4D-2B4F2B5A-2BFF2C2F2C5F2CF4-2CF82D262D28-2D2C2D2E2D2F2D68-2D6E2D71-2D7E2D97-2D9F2DA72DAF2DB72DBF2DC72DCF2DD72DDF2E3C-2E7F2E9A2EF4-2EFF2FD6-2FEF2FFC-2FFF3040309730983100-3104312E-3130318F31BB-31BF31E4-31EF321F32FF4DB6-4DBF9FCD-9FFFA48D-A48FA4C7-A4CFA62C-A63FA698-A69EA6F8-A6FFA78FA794-A79FA7AB-A7F7A82C-A82FA83A-A83FA878-A87FA8C5-A8CDA8DA-A8DFA8FC-A8FFA954-A95EA97D-A97FA9CEA9DA-A9DDA9E0-A9FFAA37-AA3FAA4EAA4FAA5AAA5BAA7C-AA7FAAC3-AADAAAF7-AB00AB07AB08AB0FAB10AB17-AB1FAB27AB2F-ABBFABEEABEFABFA-ABFFD7A4-D7AFD7C7-D7CAD7FC-D7FFFA6EFA6FFADA-FAFFFB07-FB12FB18-FB1CFB37FB3DFB3FFB42FB45FBC2-FBD2FD40-FD4FFD90FD91FDC8-FDEFFDFEFDFFFE1A-FE1FFE27-FE2FFE53FE67FE6C-FE6FFE75FEFDFEFEFF00FFBF-FFC1FFC8FFC9FFD0FFD1FFD8FFD9FFDD-FFDFFFE7FFEF-FFF8FFFEFFFF"
},
{
    //L: "Letter", // Included in the Unicode Base addon
    Ll: "Lowercase_Letter",
    Lu: "Uppercase_Letter",
    Lt: "Titlecase_Letter",
    Lm: "Modifier_Letter",
    Lo: "Other_Letter",
    M: "Mark",
    Mn: "Non_Spacing_Mark",
    Mc: "Spacing_Combining_Mark",
    Me: "Enclosing_Mark",
    N: "Number",
    Nd: "Decimal_Digit_Number",
    Nl: "Letter_Number",
    No: "Other_Number",
    P: "Punctuation",
    Pd: "Dash_Punctuation",
    Ps: "Open_Punctuation",
    Pe: "Close_Punctuation",
    Pi: "Initial_Punctuation",
    Pf: "Final_Punctuation",
    Pc: "Connector_Punctuation",
    Po: "Other_Punctuation",
    S: "Symbol",
    Sm: "Math_Symbol",
    Sc: "Currency_Symbol",
    Sk: "Modifier_Symbol",
    So: "Other_Symbol",
    Z: "Separator",
    Zs: "Space_Separator",
    Zl: "Line_Separator",
    Zp: "Paragraph_Separator",
    C: "Other",
    Cc: "Control",
    Cf: "Format",
    Co: "Private_Use",
    Cs: "Surrogate",
    Cn: "Unassigned"
});

if (!extensible)
    XRegExp.uninstall("extensibility"); // Revert to previous state

}());


/***** xregexp-unicode-scripts.js *****/

/*!
 * XRegExp Unicode Scripts v1.2.0-beta
 * Copyright 2010-2012 Steven Levithan <http://xregexp.com/>
 * Available under the MIT License
 * Uses Unicode 6.1 <http://unicode.org/Public/6.1.0/ucd/Scripts.txt>
 */

/**
 * Adds support for all Unicode scripts in the Basic Multilingual Plane (U+0000-U+FFFF).
 * E.g., `\p{Latin}`. Token names are case insensitive, and any spaces, hyphens, and underscores
 * are ignored.
 */
;(function () {
"use strict";

if (typeof XRegExp === "undefined" || typeof XRegExp.addUnicodePackage === "undefined") {
    throw new ReferenceError("XRegExp Unicode Base must be loaded before Unicode Scripts");
}

var extensible = XRegExp.isInstalled("extensibility");

if (!extensible)
    XRegExp.install("extensibility"); // Temporarily install

XRegExp.addUnicodePackage({
    Arabic: "0600-06040606-060B060D-061A061E0620-063F0641-064A0656-065E066A-066F0671-06DC06DE-06FF0750-077F08A008A2-08AC08E4-08FEFB50-FBC1FBD3-FD3DFD50-FD8FFD92-FDC7FDF0-FDFCFE70-FE74FE76-FEFC",
    Armenian: "0531-05560559-055F0561-0587058A058FFB13-FB17",
    Balinese: "1B00-1B4B1B50-1B7C",
    Bamum: "A6A0-A6F7",
    Batak: "1BC0-1BF31BFC-1BFF",
    Bengali: "0981-09830985-098C098F09900993-09A809AA-09B009B209B6-09B909BC-09C409C709C809CB-09CE09D709DC09DD09DF-09E309E6-09FB",
    Bopomofo: "02EA02EB3105-312D31A0-31BA",
    Braille: "2800-28FF",
    Buginese: "1A00-1A1B1A1E1A1F",
    Buhid: "1740-1753",
    Canadian_Aboriginal: "1400-167F18B0-18F5",
    Cham: "AA00-AA36AA40-AA4DAA50-AA59AA5C-AA5F",
    Cherokee: "13A0-13F4",
    Common: "0000-0040005B-0060007B-00A900AB-00B900BB-00BF00D700F702B9-02DF02E5-02E902EC-02FF0374037E038503870589060C061B061F06400660-066906DD096409650E3F0FD5-0FD810FB16EB-16ED173517361802180318051CD31CE11CE9-1CEC1CEE-1CF31CF51CF62000-200B200E-2064206A-20702074-207E2080-208E20A0-20B92100-21252127-2129212C-21312133-214D214F-215F21892190-23F32400-24262440-244A2460-26FF2701-27FF2900-2B4C2B50-2B592E00-2E3B2FF0-2FFB3000-300430063008-30203030-3037303C-303F309B309C30A030FB30FC3190-319F31C0-31E33220-325F327F-32CF3358-33FF4DC0-4DFFA700-A721A788-A78AA830-A839FD3EFD3FFDFDFE10-FE19FE30-FE52FE54-FE66FE68-FE6BFEFFFF01-FF20FF3B-FF40FF5B-FF65FF70FF9EFF9FFFE0-FFE6FFE8-FFEEFFF9-FFFD",
    Coptic: "03E2-03EF2C80-2CF32CF9-2CFF",
    Cyrillic: "0400-04840487-05271D2B1D782DE0-2DFFA640-A697A69F",
    Devanagari: "0900-09500953-09630966-09770979-097FA8E0-A8FB",
    Ethiopic: "1200-1248124A-124D1250-12561258125A-125D1260-1288128A-128D1290-12B012B2-12B512B8-12BE12C012C2-12C512C8-12D612D8-13101312-13151318-135A135D-137C1380-13992D80-2D962DA0-2DA62DA8-2DAE2DB0-2DB62DB8-2DBE2DC0-2DC62DC8-2DCE2DD0-2DD62DD8-2DDEAB01-AB06AB09-AB0EAB11-AB16AB20-AB26AB28-AB2E",
    Georgian: "10A0-10C510C710CD10D0-10FA10FC-10FF2D00-2D252D272D2D",
    Glagolitic: "2C00-2C2E2C30-2C5E",
    Greek: "0370-03730375-0377037A-037D038403860388-038A038C038E-03A103A3-03E103F0-03FF1D26-1D2A1D5D-1D611D66-1D6A1DBF1F00-1F151F18-1F1D1F20-1F451F48-1F4D1F50-1F571F591F5B1F5D1F5F-1F7D1F80-1FB41FB6-1FC41FC6-1FD31FD6-1FDB1FDD-1FEF1FF2-1FF41FF6-1FFE2126",
    Gujarati: "0A81-0A830A85-0A8D0A8F-0A910A93-0AA80AAA-0AB00AB20AB30AB5-0AB90ABC-0AC50AC7-0AC90ACB-0ACD0AD00AE0-0AE30AE6-0AF1",
    Gurmukhi: "0A01-0A030A05-0A0A0A0F0A100A13-0A280A2A-0A300A320A330A350A360A380A390A3C0A3E-0A420A470A480A4B-0A4D0A510A59-0A5C0A5E0A66-0A75",
    Han: "2E80-2E992E9B-2EF32F00-2FD5300530073021-30293038-303B3400-4DB54E00-9FCCF900-FA6DFA70-FAD9",
    Hangul: "1100-11FF302E302F3131-318E3200-321E3260-327EA960-A97CAC00-D7A3D7B0-D7C6D7CB-D7FBFFA0-FFBEFFC2-FFC7FFCA-FFCFFFD2-FFD7FFDA-FFDC",
    Hanunoo: "1720-1734",
    Hebrew: "0591-05C705D0-05EA05F0-05F4FB1D-FB36FB38-FB3CFB3EFB40FB41FB43FB44FB46-FB4F",
    Hiragana: "3041-3096309D-309F",
    Inherited: "0300-036F04850486064B-0655065F0670095109521CD0-1CD21CD4-1CE01CE2-1CE81CED1CF41DC0-1DE61DFC-1DFF200C200D20D0-20F0302A-302D3099309AFE00-FE0FFE20-FE26",
    Javanese: "A980-A9CDA9CF-A9D9A9DEA9DF",
    Kannada: "0C820C830C85-0C8C0C8E-0C900C92-0CA80CAA-0CB30CB5-0CB90CBC-0CC40CC6-0CC80CCA-0CCD0CD50CD60CDE0CE0-0CE30CE6-0CEF0CF10CF2",
    Katakana: "30A1-30FA30FD-30FF31F0-31FF32D0-32FE3300-3357FF66-FF6FFF71-FF9D",
    Kayah_Li: "A900-A92F",
    Khmer: "1780-17DD17E0-17E917F0-17F919E0-19FF",
    Lao: "0E810E820E840E870E880E8A0E8D0E94-0E970E99-0E9F0EA1-0EA30EA50EA70EAA0EAB0EAD-0EB90EBB-0EBD0EC0-0EC40EC60EC8-0ECD0ED0-0ED90EDC-0EDF",
    Latin: "0041-005A0061-007A00AA00BA00C0-00D600D8-00F600F8-02B802E0-02E41D00-1D251D2C-1D5C1D62-1D651D6B-1D771D79-1DBE1E00-1EFF2071207F2090-209C212A212B2132214E2160-21882C60-2C7FA722-A787A78B-A78EA790-A793A7A0-A7AAA7F8-A7FFFB00-FB06FF21-FF3AFF41-FF5A",
    Lepcha: "1C00-1C371C3B-1C491C4D-1C4F",
    Limbu: "1900-191C1920-192B1930-193B19401944-194F",
    Lisu: "A4D0-A4FF",
    Malayalam: "0D020D030D05-0D0C0D0E-0D100D12-0D3A0D3D-0D440D46-0D480D4A-0D4E0D570D60-0D630D66-0D750D79-0D7F",
    Mandaic: "0840-085B085E",
    Meetei_Mayek: "AAE0-AAF6ABC0-ABEDABF0-ABF9",
    Mongolian: "1800180118041806-180E1810-18191820-18771880-18AA",
    Myanmar: "1000-109FAA60-AA7B",
    New_Tai_Lue: "1980-19AB19B0-19C919D0-19DA19DE19DF",
    Nko: "07C0-07FA",
    Ogham: "1680-169C",
    Ol_Chiki: "1C50-1C7F",
    Oriya: "0B01-0B030B05-0B0C0B0F0B100B13-0B280B2A-0B300B320B330B35-0B390B3C-0B440B470B480B4B-0B4D0B560B570B5C0B5D0B5F-0B630B66-0B77",
    Phags_Pa: "A840-A877",
    Rejang: "A930-A953A95F",
    Runic: "16A0-16EA16EE-16F0",
    Samaritan: "0800-082D0830-083E",
    Saurashtra: "A880-A8C4A8CE-A8D9",
    Sinhala: "0D820D830D85-0D960D9A-0DB10DB3-0DBB0DBD0DC0-0DC60DCA0DCF-0DD40DD60DD8-0DDF0DF2-0DF4",
    Sundanese: "1B80-1BBF1CC0-1CC7",
    Syloti_Nagri: "A800-A82B",
    Syriac: "0700-070D070F-074A074D-074F",
    Tagalog: "1700-170C170E-1714",
    Tagbanwa: "1760-176C176E-177017721773",
    Tai_Le: "1950-196D1970-1974",
    Tai_Tham: "1A20-1A5E1A60-1A7C1A7F-1A891A90-1A991AA0-1AAD",
    Tai_Viet: "AA80-AAC2AADB-AADF",
    Tamil: "0B820B830B85-0B8A0B8E-0B900B92-0B950B990B9A0B9C0B9E0B9F0BA30BA40BA8-0BAA0BAE-0BB90BBE-0BC20BC6-0BC80BCA-0BCD0BD00BD70BE6-0BFA",
    Telugu: "0C01-0C030C05-0C0C0C0E-0C100C12-0C280C2A-0C330C35-0C390C3D-0C440C46-0C480C4A-0C4D0C550C560C580C590C60-0C630C66-0C6F0C78-0C7F",
    Thaana: "0780-07B1",
    Thai: "0E01-0E3A0E40-0E5B",
    Tibetan: "0F00-0F470F49-0F6C0F71-0F970F99-0FBC0FBE-0FCC0FCE-0FD40FD90FDA",
    Tifinagh: "2D30-2D672D6F2D702D7F",
    Vai: "A500-A62B",
    Yi: "A000-A48CA490-A4C6"
});

if (!extensible)
    XRegExp.uninstall("extensibility"); // Revert to previous state

}());


/***** xregexp-matchrecursive.js *****/

/*!
 * XRegExp Match Recursive v0.2.0-beta
 * Copyright 2009-2012 Steven Levithan <http://xregexp.com/>
 * Available under the MIT License
 */

/**
 * Returns matches between outermost left and right delimiters, or arrays of match parts and
 * position data. An error is thrown if delimiters are unbalanced within the data.
 * @param {String} str The string to search.
 * @param {String} left Left delimiter as an XRegExp pattern string.
 * @param {String} right Right delimiter as an XRegExp pattern string.
 * @param {String} [flags] Flags for the left and right delimiters. Use any of: `gimnsxy`.
 * @param {Object} [options] Lets you specify `valueNames` and `escapeChar` options.
 * @returns {Array} The list of matches.
 * @example
 *
 * // Basic usage
 * XRegExp.matchRecursive('(t((e))s)t()(ing)', '\\(', '\\)', 'g');
 *
 * // With valueNames and escapeChar
 * var str = '...{1}\\{{function(x,y){return y+x;}}';
 * XRegExp.matchRecursive(str, '{', '}', 'gi', {
 *     valueNames: ['between', 'left', 'match', 'right'],
 *     escapeChar: '\\'
 * });
 */
;XRegExp.matchRecursive = function (str, left, right, flags, options) {
    "use strict";

    flags = flags || "";
    options = options || {};
    var global = flags.indexOf("g") > -1,
        sticky = flags.indexOf("y") > -1;
    flags = flags.replace(/y/g, ""); // Flag y handled internally
    var left = XRegExp(left, flags),
        right = XRegExp(right, flags),
        escapeChar = options.escapeChar,
        vN = options.valueNames,
        output = [],
        openTokens = 0, delimStart = 0, delimEnd = 0, lastOuterEnd = 0,
        outerStart, innerStart, leftMatch, rightMatch, escaped, esc;

    if (escapeChar) {
        if (escapeChar.length > 1)
            throw new SyntaxError("can't use more than one escape character");
        if (/\\[1-9]/.test(right.source.replace(/\\[0\D]|\[(?:[^\\\]]|\\[\s\S])*]/g, "")))
            throw new SyntaxError("can't use escape character if backreference in delimiter");
        escaped = XRegExp.escape(escapeChar);
        esc = new RegExp(
            "(?:" + escaped + "[\\S\\s]|(?:(?!" + left.source + "|" + right.source + ")[^" + escaped + "])+)+",
            flags.replace(/[^im]+/g, "") // Flags gy not needed here; flags nsx handled by XRegExp
        );
    }

    while (true) {
        // If using an escape character, advance to the delimiter's next starting position,
        // skipping any escaped characters in between
        if (escapeChar)
            delimEnd += (XRegExp.exec(str, esc, delimEnd, /*sticky*/ true) || [""])[0].length;
        leftMatch = XRegExp.exec(str, left, delimEnd);
        rightMatch = XRegExp.exec(str, right, delimEnd);
        // Keep only the leftmost result
        if (leftMatch && rightMatch) {
            if (leftMatch.index <= rightMatch.index) rightMatch = null;
            else leftMatch = null;
        }
        /* Paths (LM:leftMatch, RM:rightMatch, OT:openTokens):
        LM | RM | OT | Result
        1  | 0  | 1  | loop
        1  | 0  | 0  | loop
        0  | 1  | 1  | loop
        0  | 1  | 0  | throw
        0  | 0  | 1  | throw
        0  | 0  | 0  | break
        * Doesn't include the sticky mode special case
        * Loop ends after the first completed match if `!global` */
        if (leftMatch || rightMatch) {
            delimStart = (leftMatch || rightMatch).index;
            delimEnd = delimStart + (leftMatch || rightMatch)[0].length;
        } else if (!openTokens) {
            break;
        }
        if (sticky && !openTokens && delimStart > lastOuterEnd)
            break;
        if (leftMatch) {
            if (!openTokens++) {
                outerStart = delimStart;
                innerStart = delimEnd;
            }
        } else if (rightMatch && openTokens) {
            if (!--openTokens) {
                if (vN) {
                    if (vN[0] && outerStart > lastOuterEnd)
                               output.push([vN[0], str.slice(lastOuterEnd, outerStart), lastOuterEnd, outerStart]);
                    if (vN[1]) output.push([vN[1], str.slice(outerStart,   innerStart), outerStart,   innerStart]);
                    if (vN[2]) output.push([vN[2], str.slice(innerStart,   delimStart), innerStart,   delimStart]);
                    if (vN[3]) output.push([vN[3], str.slice(delimStart,   delimEnd),   delimStart,   delimEnd]);
                } else {
                    output.push(str.slice(innerStart, delimStart));
                }
                lastOuterEnd = delimEnd;
                if (!global) break;
            }
        } else {
            throw new Error("string contains unbalanced delimiters");
        }
        // If the delimiter matched an empty string, avoid an infinite loop
        if (delimStart === delimEnd) delimEnd++;
    }

    if (global && !sticky && vN && vN[0] && str.length > lastOuterEnd)
        output.push([vN[0], str.slice(lastOuterEnd), lastOuterEnd, str.length]);

    return output;
};

