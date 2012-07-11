﻿[XRegExp](http://xregexp.com/)
==============================

XRegExp provides augmented, extensible JavaScript regular expressions. You get new syntax, flags, and methods beyond what browsers support natively. XRegExp is also a regex utility belt with tools to make your client-side grepping simpler and more powerful, while freeing you from worrying about pesky cross-browser inconsistencies and the dubious `lastIndex` property.

XRegExp supports all native ES5 regular expression syntax. It's about 3.6 KB when minified and gzipped. It works with Internet Explorer 5.5+, Firefox 1.5+, Chrome, Safari 3+, and Opera 9.5+. You can also use it on the server with Node.js.


## Performance

XRegExp regexes compile to native `RegExp` regex objects, thus there is no performance difference between the two. There is a small extra cost when compiling XRegExps. If you want, you can use `XRegExp.cache` to avoid incurring the compilation cost again for a given pattern and flags, across your entire application.


## Usage examples

~~~ js
// Using named capture and flag x (free-spacing and line comments)
var date = XRegExp('(?<year>  [0-9]{4} ) -?  # year  \n\
                    (?<month> [0-9]{2} ) -?  # month \n\
                    (?<day>   [0-9]{2} )     # day   ', 'x');

// XRegExp.exec gives you named backreferences on the match result
var match = XRegExp.exec('2012-02-22', date);
match.year; // -> '2012'

// It also includes optional pos and sticky arguments
var pos = 3, result = [];
while (match = XRegExp.exec('<1><2><3><4>5<6>', /<(\d+)>/, pos, 'sticky')) {
    result.push(match[1]);
    pos = match.index + match[0].length;
} // result -> ['2', '3', '4']

// XRegExp.replace allows named backreferences in replacements
XRegExp.replace('2012-02-22', date, '${month}/${day}/${year}'); // -> '02/22/2012'
XRegExp.replace('2012-02-22', date, function (match) {
    return match.month + '/' + match.day + '/' + match.year;
}); // -> '02/22/2012'

// In fact, all XRegExps are RegExps and work perfectly with native methods
date.test('2012-02-22'); // -> true

// The *only* caveat is that named captures must be referred to using numbered backreferences
'2012-02-22'.replace(date, '$2/$3/$1'); // -> '02/22/2012'

// If you want, you can extend native methods so you don't have to worry about this
// Doing so also fixes numerous browser bugs in the native methods
XRegExp.install('natives');
'2012-02-22'.replace(date, '${month}/${day}/${year}'); // -> '02/22/2012'
'2012-02-22'.replace(date, function (match) {
    return match.month + '/' + match.day + '/' + match.year;
}); // -> '02/22/2012'
date.exec('2012-02-22').year; // -> '2012'

// Extract every other digit from a string using XRegExp.forEach
XRegExp.forEach('1a2345', /\d/, function (match, i) {
    if (i % 2) this.push(+match[0]);
}, []); // -> [2, 4]

// Get numbers within <b> tags using XRegExp.matchChain
XRegExp.matchChain('1 <b>2</b> 3 <b>4 a 56</b>', [
    XRegExp('(?is)<b>.*?</b>'),
    /\d+/
]); // -> ['2', '4', '56']

// You can also pass forward and return specific backreferences
var html = '<a href="http://xregexp.com/">XRegExp</a>\
            <a href="http://www.google.com/">Google</a>';
XRegExp.matchChain(html, [
    {regex: /<a href="([^"]+)">/i, backref: 1},
    {regex: XRegExp('(?i)^https?://(?<domain>[^/?#]+)'), backref: 'domain'}
]); // -> ['xregexp.com', 'www.google.com']

// XRegExp.union safely merges strings and regexes into a single pattern
XRegExp.union(['a+b*c', /(dogs)\1/, /(cats)\1/], 'i');
// -> /a\+b\*c|(dogs)\1|(cats)\2/i
~~~

These examples should give you the flavor of what's possible, but XRegExp has more syntax, flags, methods, options, and browser fixes that aren't shown here. You can even augment XRegExp's regular expression syntax with addons (see below) or write your own. See [xregexp.com](http://xregexp.com/) for more details.


## Addons

In browsers, you can either load addons individually, or bundle all addons together with XRegExp by loading `xregexp-all.js`. XRegExp's [npm](http://npmjs.org/) package uses `xregexp-all.js`, which means that the addons are always available when XRegExp is installed on the server using npm.


### Unicode

In browsers, first include the Unicode Base script:

~~~ html
<script src="src/xregexp.js"></script>
<script src="src/addons/unicode/unicode-base.js"></script>
~~~

Then you can do this:

~~~ js
var unicodeWord = XRegExp('^\\p{L}+$');
unicodeWord.test('Русский'); // -> true
unicodeWord.test('日本語'); // -> true
unicodeWord.test('العربية'); // -> true
~~~

The base script adds `\p{L}` and its full name `\p{Letter}`, but other Unicode categories, scripts, blocks, and properties require addon packages. Try these next examples after additionally including `unicode-scripts.js`:

~~~ js
XRegExp('^\\p{Hiragana}+$').test('ひらがな'); // -> true
XRegExp('^[\\p{Latin}\\p{Common}]+$').test('Über Café.'); // -> true
~~~

By default, `\p{..}` and `\P{..}` support code points up to `U+FFFF` (i.e., the Basic Multilingual Plane). You can opt-in to full 21-bit Unicode support (with code points up to `U+10FFFF`&mdash;XRegExp calls this *astral mode*) on a per-regex basis by using flag `A`, or you can do this implicitly for all regexes by running `XRegExp.install('astral')`. When in astral mode, `\p{..}` and `\P{..}` always match a full code point rather than a code unit, using surrogate pairs for code points above `U+FFFF`. Opting in to astral mode disables the use of `\p{..}` and `\P{..}` within character classes (use, e.g, `(?:\pL|\pM|[0-9])+` instead of `[\pL\pM0-9]+`).

~~~ js
// Using flag A. The test string uses a surrogate pair to represent U+1F4A9
XRegExp('^\\pS$', 'A').test('\uD83D\uDCA9'); // -> true

// Inline flag A
XRegExp('(?A)^\\pS$').test('\uD83D\uDCA9'); // -> true

// Implicit flag A
XRegExp.install('astral');
XRegExp('^\\pS$').test('\uD83D\uDCA9'); // -> true
~~~

XRegExp uses Unicode 6.2.0.


### XRegExp.build

In browsers, first include the script:

~~~ html
<script src="src/xregexp.js"></script>
<script src="src/addons/build.js"></script>
~~~

You can then build regular expressions using named subpatterns, for readability and pattern reuse:

~~~ js
var time = XRegExp.build('(?x)^ {{hours}} ({{minutes}}) $', {
    hours: XRegExp.build('{{h12}} : | {{h24}}', {
        h12: /1[0-2]|0?[1-9]/,
        h24: /2[0-3]|[01][0-9]/
    }, 'x'),
    minutes: /^[0-5][0-9]$/
});

time.test('10:59'); // -> true
XRegExp.exec('10:59', time).minutes; // -> '59'
~~~

Named subpatterns can be provided as strings or regex objects. A leading `^` and trailing unescaped `$` are stripped from subpatterns if both are present, which allows embedding independently-useful anchored patterns. `{{…}}` tokens can be quantified as a single unit. Backreferences in the outer pattern and provided subpatterns are automatically renumbered to work correctly within the larger combined pattern. The syntax `({{name}})` works as shorthand for named capture via `(?<name>{{name}})`. Named subpatterns cannot be embedded within character classes.

See also: *[Creating Grammatical Regexes Using XRegExp.build](http://blog.stevenlevithan.com/archives/grammatical-patterns-xregexp-build)*.


### XRegExp.matchRecursive

In browsers, first include the script:

~~~ html
<script src="src/xregexp.js"></script>
<script src="src/addons/matchrecursive.js"></script>
~~~

You can then match recursive constructs using XRegExp pattern strings as left and right delimiters:

~~~ js
var str = '(t((e))s)t()(ing)';
XRegExp.matchRecursive(str, '\\(', '\\)', 'g');
// -> ['t((e))s', '', 'ing']

// Extended information mode with valueNames
str = 'Here is <div> <div>an</div></div> example';
XRegExp.matchRecursive(str, '<div\\s*>', '</div>', 'gi', {
    valueNames: ['between', 'left', 'match', 'right']
});
/* -> [
{name: 'between', value: 'Here is ',       start: 0,  end: 8},
{name: 'left',    value: '<div>',          start: 8,  end: 13},
{name: 'match',   value: ' <div>an</div>', start: 13, end: 27},
{name: 'right',   value: '</div>',         start: 27, end: 33},
{name: 'between', value: ' example',       start: 33, end: 41}
] */

// Omitting unneeded parts with null valueNames, and using escapeChar
str = '...{1}\\{{function(x,y){return y+x;}}';
XRegExp.matchRecursive(str, '{', '}', 'g', {
    valueNames: ['literal', null, 'value', null],
    escapeChar: '\\'
});
/* -> [
{name: 'literal', value: '...', start: 0, end: 3},
{name: 'value',   value: '1',   start: 4, end: 5},
{name: 'literal', value: '\\{', start: 6, end: 8},
{name: 'value',   value: 'function(x,y){return y+x;}', start: 9, end: 35}
] */

// Sticky mode via flag y
str = '<1><<<2>>><3>4<5>';
XRegExp.matchRecursive(str, '<', '>', 'gy');
// -> ['1', '<<2>>', '3']
~~~

`XRegExp.matchRecursive` throws an error if it sees an unbalanced delimiter in the target string.


### Prototypes

In browsers, first include the script:

~~~ html
<script src="src/xregexp.js"></script>
<script src="src/addons/prototypes.js"></script>
~~~

New XRegExp regexes then gain a collection of useful methods: `apply`, `call`, `forEach`, `globalize`, `match`, `xexec`, and `xtest`.

~~~ js
// To demonstrate the call method, let's first create the function we'll be using...
function filter(array, fn) {
    var res = [];
    array.forEach(function (el) {if (fn.call(null, el)) res.push(el);});
    return res;
}
// Now we can filter arrays using functions and regexes
filter(['a', 'ba', 'ab', 'b'], XRegExp('^a')); // -> ['a', 'ab']
~~~

Native `RegExp` objects copied by `XRegExp` are augmented with any `XRegExp.prototype` methods. The following lines therefore work equivalently:

~~~ js
XRegExp('[a-z]', 'ig').xexec('abc');
XRegExp(/[a-z]/ig).xexec('abc');
XRegExp.globalize(/[a-z]/i).xexec('abc');
~~~


## Installation and usage

Load in browsers:

~~~ html
<script src="build/xregexp-min.js"></script>
~~~

Or, to bundle XRegExp with all of its addons:

~~~ html
<script src="build/xregexp-all-min.js"></script>
~~~

Load using [RequireJS](http://requirejs.org/):

~~~ js
require.config({
    paths: {
        xregexp: 'build/xregexp-all-min'
    }
});
require(['xregexp'], function (XRegExp) {
    // This function is called when xregexp-all-min.js is loaded
});
~~~

Install using [npm](http://npmjs.org/):

~~~ bash
npm install xregexp
~~~

Load in [Node.js](http://nodejs.org/):

~~~ js
var XRegExp = require('xregexp');
~~~


### Running tests on the server with npm

~~~ bash
npm install -g qunit  # needed to run the tests
npm test  # in the xregexp root
~~~

If XRegExp was not installed using npm, just open `tests/index.html` in your browser.


## Changelog

* Releases: [Version history](http://xregexp.com/history/).
* Upcoming: [Issue tracker](https://github.com/slevithan/XRegExp/issues), [Roadmap](https://github.com/slevithan/XRegExp/wiki/Roadmap).


## About

XRegExp and addons copyright 2007-2012 by [Steven Levithan](http://stevenlevithan.com/).

Tools: Unicode range generators by [Mathias Bynens](http://mathiasbynens.be/), and adapted from his [unicode-data](https://github.com/mathiasbynens/unicode-data) project. Source file concatenator by [Bjarke Walling](http://twitter.com/walling).

Prior art: `XRegExp.build` inspired by [Lea Verou](http://lea.verou.me/)'s [RegExp.create](http://lea.verou.me/2011/03/create-complex-regexps-more-easily/). `XRegExp.union` inspired by [Ruby](http://www.ruby-lang.org/). XRegExp's syntax extensions and flags come from Perl, .NET, etc.

All code released under the [MIT License](http://mit-license.org/).

Fork me to show support, fix, and extend.
