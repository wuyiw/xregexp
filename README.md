﻿[XRegExp](http://xregexp.com/)
==============================

XRegExp provides augmented, extensible, cross-browser JavaScript regular expressions. You get new syntax and flags beyond what browsers support natively, along with a collection of functions to make your client-side grepping and parsing a breeze. XRegExp also frees you from worrying about pesky inconsistencies in cross-browser regex handling and the dubious `lastIndex` property.

XRegExp is fully compliant with the regular expression flavor specified in ES3 and ES5. It works with Internet Explorer 5.5+, Firefox 1.5+, Safari 3+, Chrome, and Opera 9.5+.


## Performance

XRegExp regular expressions compile to native RegExp objects, thus there is little if any performance difference when using XRegExp objects with native regex methods. There is a small extra cost when *compiling* XRegExps. If you want, however, you can use `XRegExp.cache` to avoid incurring the compilation cost for a given pattern more than once. Doing so can even lead to XRegExp being faster than native regexes in synthetic tests that repeatedly compile the same regex.


## Usage examples

The following examples take advantage of new features in XRegExp v2.0.0-rc ([details](https://github.com/slevithan/XRegExp/wiki/Roadmap)):

~~~ js
// Using named capture and flag x (free-spacing and line comments)
var date = XRegExp('(?<year>  [0-9]{4}) -?  # year  \n\
                    (?<month> [0-9]{2}) -?  # month \n\
                    (?<day>   [0-9]{2})     # day   ', 'x');

// XRegExp.exec gives you named backreferences on the match result
var match = XRegExp.exec('2012-02-22', date);
match.day; // -> '22'

// It also includes optional pos and sticky arguments
var pos = 3, result = [];
while (match = XRegExp.exec('<1><2><3><4>5<6>', /<(\d+)>/, pos, 'sticky')) {
    result.push(match[1]);
    pos = match.index + match[0].length;
} // result -> ['2', '3', '4']

// XRegExp.replace allows named backreferences in replacements
XRegExp.replace('2012-02-22', date, '${month}/${day}/${year}'); // -> '02/22/2012'
XRegExp.replace('2012-02-22', date, function (match) {
    return match.month + '/' + match.day + '/' +match.year;
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
    return match.month + '/' + match.day + '/' +match.year;
}); // -> '02/22/2012'
date.exec('2012-02-22').day; // -> '22'

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
XRegExp.union(['a+b*c', 'skis', 'sleds', /(dogs)\1/, /(cats)\1/], 'i');
// -> /a\+b\*c|skis|sleds|(dogs)\1|(cats)\2/i
~~~

These examples should give you the flavor of what's possible, but XRegExp has more syntax, flags, utils, options, browser fixes, and general badassery that isn't shown here. You can even augment XRegExp's regular expression syntax with addons (see below) or write your own. See [xregexp.com](http://xregexp.com) for more details.


## XRegExp Unicode Base

First include the Unicode Base script:

~~~ html
<script src="xregexp.js"></script>
<script src="addons/unicode/unicode-base.js"></script>
~~~

Then you can do this:

~~~ js
var unicodeWord = XRegExp('^\\p{L}+$');
unicodeWord.test('Русский'); // -> true
unicodeWord.test('日本語'); // -> true
unicodeWord.test('العربية'); // -> true
~~~

The base script adds `\p{Letter}` and its alias `\p{L}`, but other Unicode categories, scripts, blocks, and properties require addon packages. Try these next examples after additionally including `unicode-scripts.js`:

~~~ js
XRegExp('^\\p{Hiragana}+$').test('ひらがな'); // -> true
XRegExp('^[\\p{Latin}\\p{Common}]+$').test('Über Café.'); // -> true
~~~

XRegExp uses Unicode 6.1's Basic Multilingual Plane.


## XRegExp.matchRecursive

First include the script:

~~~ html
<script src="xregexp.js"></script>
<script src="addons/matchrecursive.js"></script>
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

If `XRegExp.matchRecursive` sees an unbalanced delimiter in the target string, it throws an exception.


## XRegExp.build

First include the script:

~~~ html
<script src="xregexp.js"></script>
<script src="addons/build.js"></script>
~~~

You can then build regular expressions using named subpatterns, for readability and code reuse:

~~~ js
XRegExp.build('(?i)\\b{{month}}{{separator}}{{year}}\\b', {
    month: XRegExp.build('{{monthAbbr}}|{{monthName}}', {
        monthAbbr: /Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/,
        monthName: /January|February|March|April|May|June|July|August|September|October|November|December/
    }),
    separator: /,? /,
    year: /\d{4}/
});
~~~

The `{{…}}` syntax works only for regexes created by `XRegExp.build`. It can be escaped using `\{{…}}`. Named subpatterns can be provided as strings or regex objects. Their values are automatically wrapped in `(?:…)` so they can be quantified as a single unit and don't interfere with the surrounding pattern in unexpected ways. If present, a leading `^` and trailing unescaped `$` are stripped from subpatterns provided as regex objects. Flags can be provided via `XRegExp.build`'s optional third argument. Backreferences are not allowed within `XRegExp.build` patterns.

See also: *[Creating Grammatical Regexes Using XRegExp.build](http://blog.stevenlevithan.com/archives/grammatical-patterns-xregexp-build)*.


## XRegExp Prototype Methods

Include the script:

~~~ html
<script src="xregexp.js"></script>
<script src="addons/prototypes.js"></script>
~~~

New XRegExp regexes now gain a collection of useful methods: `apply`, `call`, `forEach`, `globalize`, `xexec`, and `xtest`.

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

Native `RegExp` objects copied by `XRegExp` are also augmented with any `XRegExp.prototype` methods. The following lines therefore work equivalently:

~~~ js
XRegExp('[a-z]', 'ig').xexec('abc');
XRegExp(/[a-z]/ig).xexec('abc');
XRegExp.globalize(/[a-z]/i).xexec('abc');
~~~


## &c

**Lookbehind:** Although not an official plugin, this [collection of short functions](https://gist.github.com/2387872) that use XRegExp make it easy to simulate infinite-length leading lookbehind.


## How to run tests on the server with npm

~~~ bash
npm install -g qunit  # needed to run the tests
npm test  # in the xregexp root directory
~~~

For non-npm users, just open `tests/index.html` in your browser.


## Changelog

* Historical changes: [Version history](http://xregexp.com/history/).
* Planned changes: [Roadmap](https://github.com/slevithan/XRegExp/wiki/Roadmap).


## About

XRegExp and addons copyright 2007-2012 by [Steven Levithan](http://stevenlevithan.com/).

Tools: Unicode range generators by [Mathias Bynens](http://mathiasbynens.be/). Source file concatenator by [Bjarke Walling](http://twitter.com/walling).

Prior art: `XRegExp.build` inspired by [Lea Verou](http://lea.verou.me/)'s [RegExp.create](http://lea.verou.me/2011/03/create-complex-regexps-more-easily/). `XRegExp.union` inspired by [Ruby](http://www.ruby-lang.org/). XRegExp's syntax extensions come from Perl, .NET, etc.

All code released under the [MIT License](http://mit-license.org/).

Fork me to show support, fix, and extend.

