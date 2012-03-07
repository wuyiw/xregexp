/*!
 * XRegExp Match Recursive v0.2.0-dev
 * Copyright 2009-2012 Steven Levithan <http://xregexp.com/>
 * Available under the MIT License
*/

/**
 * Returns strings found between provided left and right delimiters (allowing
 * nested delimiters) or arrays of match parts and position data. An error is
 * thrown if delimiters are unbalanced within the data.
 * @param {String} str The string to search.
 * @param {String} left Left delimiter as an XRegExp pattern.
 * @param {String} right Right delimiter as an XRegExp pattern.
 * @param {String} flags Flags for the left and right delimiters. Use: gimsxy.
 * @param {Object} options Lets you specify valueNames and escapeChar options.
 * @returns {Array} The list of matches.
 * @example
 *
 * // basic usage
 * XRegExp.matchRecursive('(t((e))s)t()(ing)', '\\(', '\\)', 'g');
 *
 * // with valueNames and escapeChar
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
    flags = flags.replace(/y/g, ""); // flag y handled internally
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
            flags.replace(/[^im]+/g, "") // flags gsxy aren't needed here (sx handled by XRegExp)
        );
    }

    while (true) {
        // if using an escape character, advance to the next delimiter's
        // starting position, skipping any escaped characters
        if (escapeChar)
            delimEnd += (XRegExp.exec(str, esc, delimEnd, /*sticky*/ true) || [""])[0].length;
        leftMatch = XRegExp.exec(str, left, delimEnd);
        rightMatch = XRegExp.exec(str, right, delimEnd);
        // keep only the leftmost result
        if (leftMatch && rightMatch) {
            if (leftMatch.index <= rightMatch.index) rightMatch = null;
            else leftMatch = null;
        }
        /* paths (leftMatch, rightMatch, openTokens):
        LM | RM | OT | Result
        1  | 0  | 1  | loop
        1  | 0  | 0  | loop
        0  | 1  | 1  | loop
        0  | 1  | 0  | throw
        0  | 0  | 1  | throw
        0  | 0  | 0  | break
        * doesn't include the sticky mode special case
        * loop ends after first completed match if !global */
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
        // if the delimiter matched an empty string, avoid an infinite loop
        if (delimStart === delimEnd) delimEnd++;
    }

    if (global && !sticky && vN && vN[0] && str.length > lastOuterEnd)
        output.push([vN[0], str.slice(lastOuterEnd), lastOuterEnd, str.length]);

    return output;
};

