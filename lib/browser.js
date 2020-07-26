(function (factory) {
    typeof define === 'function' && define.amd ? define(factory) :
    factory();
}((function () { 'use strict';

    const defaultQuotedOptions = {
        escape: 92,
        throws: false
    };
    /**
     * Check if given code is a number
     */
    function isNumber(code) {
        return code > 47 && code < 58;
    }
    /**
     * Check if given character code is alpha code (letter through A to Z)
     */
    function isAlpha(code, from, to) {
        from = from || 65; // A
        to = to || 90; // Z
        code &= ~32; // quick hack to convert any char code to uppercase char code
        return code >= from && code <= to;
    }
    function isAlphaNumericWord(code) {
        return isNumber(code) || isAlphaWord(code);
    }
    function isAlphaWord(code) {
        return code === 95 /* _ */ || isAlpha(code);
    }
    /**
     * Check if given character code is a white-space character: a space character
     * or line breaks
     */
    function isWhiteSpace(code) {
        return code === 32 /* space */
            || code === 9 /* tab */
            || code === 160; /* non-breaking space */
    }
    /**
     * Check if given character code is a space character
     */
    function isSpace(code) {
        return isWhiteSpace(code)
            || code === 10 /* LF */
            || code === 13; /* CR */
    }
    /**
     * Consumes 'single' or "double"-quoted string from given string, if possible
     * @return `true` if quoted string was consumed. The contents of quoted string
     * will be available as `stream.current()`
     */
    function eatQuoted(stream, options) {
        options = Object.assign(Object.assign({}, defaultQuotedOptions), options);
        const start = stream.pos;
        const quote = stream.peek();
        if (stream.eat(isQuote)) {
            while (!stream.eof()) {
                switch (stream.next()) {
                    case quote:
                        stream.start = start;
                        return true;
                    case options.escape:
                        stream.next();
                        break;
                }
            }
            // If we’re here then stream wasn’t properly consumed.
            // Revert stream and decide what to do
            stream.pos = start;
            if (options.throws) {
                throw stream.error('Unable to consume quoted string');
            }
        }
        return false;
    }
    /**
     * Check if given character code is a quote character
     */
    function isQuote(code) {
        return code === 39 /* ' */ || code === 34 /* " */;
    }
    /**
     * Eats paired characters substring, for example `(foo)` or `[bar]`
     * @param open Character code of pair opening
     * @param close Character code of pair closing
     * @return Returns `true` if character pair was successfully consumed, it’s
     * content will be available as `stream.current()`
     */
    function eatPair(stream, open, close, options) {
        options = Object.assign(Object.assign({}, defaultQuotedOptions), options);
        const start = stream.pos;
        if (stream.eat(open)) {
            let stack = 1;
            let ch;
            while (!stream.eof()) {
                if (eatQuoted(stream, options)) {
                    continue;
                }
                ch = stream.next();
                if (ch === open) {
                    stack++;
                }
                else if (ch === close) {
                    stack--;
                    if (!stack) {
                        stream.start = start;
                        return true;
                    }
                }
                else if (ch === options.escape) {
                    stream.next();
                }
            }
            // If we’re here then paired character can’t be consumed
            stream.pos = start;
            if (options.throws) {
                throw stream.error(`Unable to find matching pair for ${String.fromCharCode(open)}`);
            }
        }
        return false;
    }

    /**
     * A streaming, character code-based string reader
     */
    class Scanner {
        constructor(str, start, end) {
            if (end == null && typeof str === 'string') {
                end = str.length;
            }
            this.string = str;
            this.pos = this.start = start || 0;
            this.end = end || 0;
        }
        /**
         * Returns true only if the stream is at the end of the file.
         */
        eof() {
            return this.pos >= this.end;
        }
        /**
         * Creates a new stream instance which is limited to given `start` and `end`
         * range. E.g. its `eof()` method will look at `end` property, not actual
         * stream end
         */
        limit(start, end) {
            return new Scanner(this.string, start, end);
        }
        /**
         * Returns the next character code in the stream without advancing it.
         * Will return NaN at the end of the file.
         */
        peek() {
            return this.string.charCodeAt(this.pos);
        }
        /**
         * Returns the next character in the stream and advances it.
         * Also returns <code>undefined</code> when no more characters are available.
         */
        next() {
            if (this.pos < this.string.length) {
                return this.string.charCodeAt(this.pos++);
            }
        }
        /**
         * `match` can be a character code or a function that takes a character code
         * and returns a boolean. If the next character in the stream 'matches'
         * the given argument, it is consumed and returned.
         * Otherwise, `false` is returned.
         */
        eat(match) {
            const ch = this.peek();
            const ok = typeof match === 'function' ? match(ch) : ch === match;
            if (ok) {
                this.next();
            }
            return ok;
        }
        /**
         * Repeatedly calls <code>eat</code> with the given argument, until it
         * fails. Returns <code>true</code> if any characters were eaten.
         */
        eatWhile(match) {
            const start = this.pos;
            while (!this.eof() && this.eat(match)) { /* */ }
            return this.pos !== start;
        }
        /**
         * Backs up the stream n characters. Backing it up further than the
         * start of the current token will cause things to break, so be careful.
         */
        backUp(n) {
            this.pos -= (n || 1);
        }
        /**
         * Get the string between the start of the current token and the
         * current stream position.
         */
        current() {
            return this.substring(this.start, this.pos);
        }
        /**
         * Returns substring for given range
         */
        substring(start, end) {
            return this.string.slice(start, end);
        }
        /**
         * Creates error object with current stream state
         */
        error(message, pos = this.pos) {
            return new ScannerError(`${message} at ${pos + 1}`, pos, this.string);
        }
    }
    class ScannerError extends Error {
        constructor(message, pos, str) {
            super(message);
            this.pos = pos;
            this.string = str;
        }
    }

    function tokenScanner(tokens) {
        return {
            tokens,
            start: 0,
            pos: 0,
            size: tokens.length
        };
    }
    function peek(scanner) {
        return scanner.tokens[scanner.pos];
    }
    function next(scanner) {
        return scanner.tokens[scanner.pos++];
    }
    function slice(scanner, from = scanner.start, to = scanner.pos) {
        return scanner.tokens.slice(from, to);
    }
    function readable(scanner) {
        return scanner.pos < scanner.size;
    }
    function consume(scanner, test) {
        const token = peek(scanner);
        if (token && test(token)) {
            scanner.pos++;
            return true;
        }
        return false;
    }
    function error(scanner, message, token = peek(scanner)) {
        if (token && token.start != null) {
            message += ` at ${token.start}`;
        }
        const err = new Error(message);
        err['pos'] = token && token.start;
        return err;
    }

    function abbreviation(abbr, options = {}) {
        const scanner = tokenScanner(abbr);
        const result = statements(scanner, options);
        if (readable(scanner)) {
            throw error(scanner, 'Unexpected character');
        }
        return result;
    }
    function statements(scanner, options) {
        const result = {
            type: 'TokenGroup',
            elements: []
        };
        let ctx = result;
        let node;
        const stack = [];
        while (readable(scanner)) {
            if (node = element(scanner, options) || group(scanner, options)) {
                ctx.elements.push(node);
                if (consume(scanner, isChildOperator)) {
                    stack.push(ctx);
                    ctx = node;
                }
                else if (consume(scanner, isSiblingOperator)) {
                    continue;
                }
                else if (consume(scanner, isClimbOperator)) {
                    do {
                        if (stack.length) {
                            ctx = stack.pop();
                        }
                    } while (consume(scanner, isClimbOperator));
                }
            }
            else {
                break;
            }
        }
        return result;
    }
    /**
     * Consumes group from given scanner
     */
    function group(scanner, options) {
        if (consume(scanner, isGroupStart)) {
            const result = statements(scanner, options);
            const token = next(scanner);
            if (isBracket(token, 'group', false)) {
                result.repeat = repeater(scanner);
            }
            return result;
        }
    }
    /**
     * Consumes single element from given scanner
     */
    function element(scanner, options) {
        let attr;
        const elem = {
            type: 'TokenElement',
            name: void 0,
            attributes: void 0,
            value: void 0,
            repeat: void 0,
            selfClose: false,
            elements: []
        };
        if (elementName(scanner, options)) {
            elem.name = slice(scanner);
        }
        while (readable(scanner)) {
            scanner.start = scanner.pos;
            if (!elem.repeat && !isEmpty(elem) && consume(scanner, isRepeater)) {
                elem.repeat = scanner.tokens[scanner.pos - 1];
            }
            else if (!elem.value && text(scanner)) {
                elem.value = getText(scanner);
            }
            else if (attr = shortAttribute(scanner, 'id', options) || shortAttribute(scanner, 'class', options) || attributeSet(scanner)) {
                if (!elem.attributes) {
                    elem.attributes = Array.isArray(attr) ? attr.slice() : [attr];
                }
                else {
                    elem.attributes = elem.attributes.concat(attr);
                }
            }
            else {
                if (!isEmpty(elem) && consume(scanner, isCloseOperator)) {
                    elem.selfClose = true;
                    if (!elem.repeat && consume(scanner, isRepeater)) {
                        elem.repeat = scanner.tokens[scanner.pos - 1];
                    }
                }
                break;
            }
        }
        return !isEmpty(elem) ? elem : void 0;
    }
    /**
     * Consumes attribute set from given scanner
     */
    function attributeSet(scanner) {
        if (consume(scanner, isAttributeSetStart)) {
            const attributes = [];
            let attr;
            while (readable(scanner)) {
                if (attr = attribute(scanner)) {
                    attributes.push(attr);
                }
                else if (consume(scanner, isAttributeSetEnd)) {
                    break;
                }
                else if (!consume(scanner, isWhiteSpace$1)) {
                    throw error(scanner, `Unexpected "${peek(scanner).type}" token`);
                }
            }
            return attributes;
        }
    }
    /**
     * Consumes attribute shorthand (class or id) from given scanner
     */
    function shortAttribute(scanner, type, options) {
        if (isOperator(peek(scanner), type)) {
            scanner.pos++;
            const attr = {
                name: [createLiteral(type)]
            };
            // Consume expression after shorthand start for React-like components
            if (options.jsx && text(scanner)) {
                attr.value = getText(scanner);
                attr.expression = true;
            }
            else {
                attr.value = literal(scanner) ? slice(scanner) : void 0;
            }
            return attr;
        }
    }
    /**
     * Consumes single attribute from given scanner
     */
    function attribute(scanner) {
        if (quoted(scanner)) {
            // Consumed quoted value: it’s a value for default attribute
            return {
                value: slice(scanner)
            };
        }
        if (literal(scanner, true)) {
            return {
                name: slice(scanner),
                value: consume(scanner, isEquals) && (quoted(scanner) || literal(scanner, true))
                    ? slice(scanner)
                    : void 0
            };
        }
    }
    function repeater(scanner) {
        return isRepeater(peek(scanner))
            ? scanner.tokens[scanner.pos++]
            : void 0;
    }
    /**
     * Consumes quoted value from given scanner, if possible
     */
    function quoted(scanner) {
        const start = scanner.pos;
        const quote = peek(scanner);
        if (isQuote$1(quote)) {
            scanner.pos++;
            while (readable(scanner)) {
                if (isQuote$1(next(scanner), quote.single)) {
                    scanner.start = start;
                    return true;
                }
            }
            throw error(scanner, 'Unclosed quote', quote);
        }
        return false;
    }
    /**
     * Consumes literal (unquoted value) from given scanner
     */
    function literal(scanner, allowBrackets) {
        const start = scanner.pos;
        const brackets = {
            attribute: 0,
            expression: 0,
            group: 0
        };
        while (readable(scanner)) {
            const token = peek(scanner);
            if (brackets.expression) {
                // If we’re inside expression, we should consume all content in it
                if (isBracket(token, 'expression')) {
                    brackets[token.context] += token.open ? 1 : -1;
                }
            }
            else if (isQuote$1(token) || isOperator(token) || isWhiteSpace$1(token) || isRepeater(token)) {
                break;
            }
            else if (isBracket(token)) {
                if (!allowBrackets) {
                    break;
                }
                if (token.open) {
                    brackets[token.context]++;
                }
                else if (!brackets[token.context]) {
                    // Stop if found unmatched closing brace: it must be handled
                    // by parent consumer
                    break;
                }
                else {
                    brackets[token.context]--;
                }
            }
            scanner.pos++;
        }
        if (start !== scanner.pos) {
            scanner.start = start;
            return true;
        }
        return false;
    }
    /**
     * Consumes element name from given scanner
     */
    function elementName(scanner, options) {
        const start = scanner.pos;
        if (options.jsx && consume(scanner, isCapitalizedLiteral)) {
            // Check for edge case: consume immediate capitalized class names
            // for React-like components, e.g. `Foo.Bar.Baz`
            while (readable(scanner)) {
                const { pos } = scanner;
                if (!consume(scanner, isClassNameOperator) || !consume(scanner, isCapitalizedLiteral)) {
                    scanner.pos = pos;
                    break;
                }
            }
        }
        while (readable(scanner) && consume(scanner, isElementName)) {
            // empty
        }
        if (scanner.pos !== start) {
            scanner.start = start;
            return true;
        }
        return false;
    }
    /**
     * Consumes text value from given scanner
     */
    function text(scanner) {
        const start = scanner.pos;
        if (consume(scanner, isTextStart)) {
            let brackets = 0;
            while (readable(scanner)) {
                const token = next(scanner);
                if (isBracket(token, 'expression')) {
                    if (token.open) {
                        brackets++;
                    }
                    else if (!brackets) {
                        break;
                    }
                    else {
                        brackets--;
                    }
                }
            }
            scanner.start = start;
            return true;
        }
        return false;
    }
    function getText(scanner) {
        let from = scanner.start;
        let to = scanner.pos;
        if (isBracket(scanner.tokens[from], 'expression', true)) {
            from++;
        }
        if (isBracket(scanner.tokens[to - 1], 'expression', false)) {
            to--;
        }
        return slice(scanner, from, to);
    }
    function isBracket(token, context, isOpen) {
        return Boolean(token && token.type === 'Bracket'
            && (!context || token.context === context)
            && (isOpen == null || token.open === isOpen));
    }
    function isOperator(token, type) {
        return Boolean(token && token.type === 'Operator' && (!type || token.operator === type));
    }
    function isQuote$1(token, isSingle) {
        return Boolean(token && token.type === 'Quote' && (isSingle == null || token.single === isSingle));
    }
    function isWhiteSpace$1(token) {
        return Boolean(token && token.type === 'WhiteSpace');
    }
    function isEquals(token) {
        return isOperator(token, 'equal');
    }
    function isRepeater(token) {
        return Boolean(token && token.type === 'Repeater');
    }
    function isLiteral(token) {
        return token.type === 'Literal';
    }
    function isCapitalizedLiteral(token) {
        if (isLiteral(token)) {
            const ch = token.value.charCodeAt(0);
            return ch >= 65 && ch <= 90;
        }
        return false;
    }
    function isElementName(token) {
        return token.type === 'Literal' || token.type === 'RepeaterNumber' || token.type === 'RepeaterPlaceholder';
    }
    function isClassNameOperator(token) {
        return isOperator(token, 'class');
    }
    function isAttributeSetStart(token) {
        return isBracket(token, 'attribute', true);
    }
    function isAttributeSetEnd(token) {
        return isBracket(token, 'attribute', false);
    }
    function isTextStart(token) {
        return isBracket(token, 'expression', true);
    }
    function isGroupStart(token) {
        return isBracket(token, 'group', true);
    }
    function createLiteral(value) {
        return { type: 'Literal', value };
    }
    function isEmpty(elem) {
        return !elem.name && !elem.value && !elem.attributes;
    }
    function isChildOperator(token) {
        return isOperator(token, 'child');
    }
    function isSiblingOperator(token) {
        return isOperator(token, 'sibling');
    }
    function isClimbOperator(token) {
        return isOperator(token, 'climb');
    }
    function isCloseOperator(token) {
        return isOperator(token, 'close');
    }

    /**
     * If consumes escape character, sets current stream range to escaped value
     */
    function escaped(scanner) {
        if (scanner.eat(92 /* Escape */)) {
            scanner.start = scanner.pos;
            if (!scanner.eof()) {
                scanner.pos++;
            }
            return true;
        }
        return false;
    }

    function tokenize(source) {
        const scanner = new Scanner(source);
        const result = [];
        const ctx = {
            group: 0,
            attribute: 0,
            expression: 0,
            quote: 0
        };
        let ch = 0;
        let token;
        while (!scanner.eof()) {
            ch = scanner.peek();
            token = getToken(scanner, ctx);
            if (token) {
                result.push(token);
                if (token.type === 'Quote') {
                    ctx.quote = ch === ctx.quote ? 0 : ch;
                }
                else if (token.type === 'Bracket') {
                    ctx[token.context] += token.open ? 1 : -1;
                }
            }
            else {
                throw scanner.error('Unexpected character');
            }
        }
        return result;
    }
    /**
     * Returns next token from given scanner, if possible
     */
    function getToken(scanner, ctx) {
        return field(scanner, ctx)
            || repeaterPlaceholder(scanner)
            || repeaterNumber(scanner)
            || repeater$1(scanner)
            || whiteSpace(scanner)
            || literal$1(scanner, ctx)
            || operator(scanner)
            || quote(scanner)
            || bracket(scanner);
    }
    /**
     * Consumes literal from given scanner
     */
    function literal$1(scanner, ctx) {
        const start = scanner.pos;
        let value = '';
        while (!scanner.eof()) {
            // Consume escaped sequence no matter of context
            if (escaped(scanner)) {
                value += scanner.current();
                continue;
            }
            const ch = scanner.peek();
            if (ch === ctx.quote || ch === 36 /* Dollar */ || isAllowedOperator(ch, ctx)) {
                // 1. Found matching quote
                // 2. The `$` character has special meaning in every context
                // 3. Depending on context, some characters should be treated as operators
                break;
            }
            if (ctx.expression && ch === 125 /* CurlyBracketClose */) {
                break;
            }
            if (!ctx.quote && !ctx.expression) {
                // Consuming element name
                if (!ctx.attribute && !isElementName$1(ch)) {
                    break;
                }
                if (isAllowedSpace(ch, ctx) || isAllowedRepeater(ch, ctx) || isQuote(ch) || bracketType(ch)) {
                    // Stop for characters not allowed in unquoted literal
                    break;
                }
            }
            value += scanner.string[scanner.pos++];
        }
        if (start !== scanner.pos) {
            scanner.start = start;
            return {
                type: 'Literal',
                value,
                start,
                end: scanner.pos
            };
        }
    }
    /**
     * Consumes white space characters as string literal from given scanner
     */
    function whiteSpace(scanner) {
        const start = scanner.pos;
        if (scanner.eatWhile(isSpace)) {
            return {
                type: 'WhiteSpace',
                start,
                end: scanner.pos
            };
        }
    }
    /**
     * Consumes quote from given scanner
     */
    function quote(scanner) {
        const ch = scanner.peek();
        if (isQuote(ch)) {
            return {
                type: 'Quote',
                single: ch === 39 /* SingleQuote */,
                start: scanner.pos++,
                end: scanner.pos
            };
        }
    }
    /**
     * Consumes bracket from given scanner
     */
    function bracket(scanner) {
        const ch = scanner.peek();
        const context = bracketType(ch);
        if (context) {
            return {
                type: 'Bracket',
                open: isOpenBracket(ch),
                context,
                start: scanner.pos++,
                end: scanner.pos
            };
        }
    }
    /**
     * Consumes operator from given scanner
     */
    function operator(scanner) {
        const op = operatorType(scanner.peek());
        if (op) {
            return {
                type: 'Operator',
                operator: op,
                start: scanner.pos++,
                end: scanner.pos
            };
        }
    }
    /**
     * Consumes node repeat token from current stream position and returns its
     * parsed value
     */
    function repeater$1(scanner) {
        const start = scanner.pos;
        if (scanner.eat(42 /* Asterisk */)) {
            scanner.start = scanner.pos;
            let count = 1;
            let implicit = false;
            if (scanner.eatWhile(isNumber)) {
                count = Number(scanner.current());
            }
            else {
                implicit = true;
            }
            return {
                type: 'Repeater',
                count,
                value: 0,
                implicit,
                start,
                end: scanner.pos
            };
        }
    }
    /**
     * Consumes repeater placeholder `$#` from given scanner
     */
    function repeaterPlaceholder(scanner) {
        const start = scanner.pos;
        if (scanner.eat(36 /* Dollar */) && scanner.eat(35 /* Hash */)) {
            return {
                type: 'RepeaterPlaceholder',
                value: void 0,
                start,
                end: scanner.pos
            };
        }
        scanner.pos = start;
    }
    /**
     * Consumes numbering token like `$` from given scanner state
     */
    function repeaterNumber(scanner) {
        const start = scanner.pos;
        if (scanner.eatWhile(36 /* Dollar */)) {
            const size = scanner.pos - start;
            let reverse = false;
            let base = 1;
            let parent = 0;
            if (scanner.eat(64 /* At */)) {
                // Consume numbering modifiers
                while (scanner.eat(94 /* Climb */)) {
                    parent++;
                }
                reverse = scanner.eat(45 /* Dash */);
                scanner.start = scanner.pos;
                if (scanner.eatWhile(isNumber)) {
                    base = Number(scanner.current());
                }
            }
            scanner.start = start;
            return {
                type: 'RepeaterNumber',
                size,
                reverse,
                base,
                parent,
                start,
                end: scanner.pos
            };
        }
    }
    function field(scanner, ctx) {
        const start = scanner.pos;
        // Fields are allowed inside expressions and attributes
        if ((ctx.expression || ctx.attribute) && scanner.eat(36 /* Dollar */) && scanner.eat(123 /* CurlyBracketOpen */)) {
            scanner.start = scanner.pos;
            let index;
            let name = '';
            if (scanner.eatWhile(isNumber)) {
                // It’s a field
                index = Number(scanner.current());
                name = scanner.eat(58 /* Colon */) ? consumePlaceholder(scanner) : '';
            }
            else if (isAlpha(scanner.peek())) {
                // It’s a variable
                name = consumePlaceholder(scanner);
            }
            if (scanner.eat(125 /* CurlyBracketClose */)) {
                return {
                    type: 'Field',
                    index, name,
                    start,
                    end: scanner.pos
                };
            }
            throw scanner.error('Expecting }');
        }
        // If we reached here then there’s no valid field here, revert
        // back to starting position
        scanner.pos = start;
    }
    /**
     * Consumes a placeholder: value right after `:` in field. Could be empty
     */
    function consumePlaceholder(stream) {
        const stack = [];
        stream.start = stream.pos;
        while (!stream.eof()) {
            if (stream.eat(123 /* CurlyBracketOpen */)) {
                stack.push(stream.pos);
            }
            else if (stream.eat(125 /* CurlyBracketClose */)) {
                if (!stack.length) {
                    stream.pos--;
                    break;
                }
                stack.pop();
            }
            else {
                stream.pos++;
            }
        }
        if (stack.length) {
            stream.pos = stack.pop();
            throw stream.error(`Expecting }`);
        }
        return stream.current();
    }
    /**
     * Check if given character code is an operator and it’s allowed in current context
     */
    function isAllowedOperator(ch, ctx) {
        const op = operatorType(ch);
        if (!op || ctx.quote || ctx.expression) {
            // No operators inside quoted values or expressions
            return false;
        }
        // Inside attributes, only `equals` is allowed
        return !ctx.attribute || op === 'equal';
    }
    /**
     * Check if given character is a space character and is allowed to be consumed
     * as a space token in current context
     */
    function isAllowedSpace(ch, ctx) {
        return isSpace(ch) && !ctx.expression;
    }
    /**
     * Check if given character can be consumed as repeater in current context
     */
    function isAllowedRepeater(ch, ctx) {
        return ch === 42 /* Asterisk */ && !ctx.attribute && !ctx.expression;
    }
    /**
     * If given character is a bracket, returns it’s type
     */
    function bracketType(ch) {
        if (ch === 40 /* RoundBracketOpen */ || ch === 41 /* RoundBracketClose */) {
            return 'group';
        }
        if (ch === 91 /* SquareBracketOpen */ || ch === 93 /* SquareBracketClose */) {
            return 'attribute';
        }
        if (ch === 123 /* CurlyBracketOpen */ || ch === 125 /* CurlyBracketClose */) {
            return 'expression';
        }
    }
    /**
     * If given character is an operator, returns it’s type
     */
    function operatorType(ch) {
        return (ch === 62 /* Child */ && 'child')
            || (ch === 43 /* Sibling */ && 'sibling')
            || (ch === 94 /* Climb */ && 'climb')
            || (ch === 46 /* Dot */ && 'class')
            || (ch === 35 /* Hash */ && 'id')
            || (ch === 47 /* Slash */ && 'close')
            || (ch === 61 /* Equals */ && 'equal')
            || void 0;
    }
    /**
     * Check if given character is an open bracket
     */
    function isOpenBracket(ch) {
        return ch === 123 /* CurlyBracketOpen */
            || ch === 91 /* SquareBracketOpen */
            || ch === 40 /* RoundBracketOpen */;
    }
    /**
     * Check if given character is allowed in element name
     */
    function isElementName$1(ch) {
        return isAlphaNumericWord(ch)
            || ch === 45 /* Dash */
            || ch === 58 /* Colon */
            || ch === 33 /* Excl */;
    }

    const operators = {
        child: '>',
        class: '.',
        climb: '^',
        id: '#',
        equal: '=',
        close: '/',
        sibling: '+'
    };
    const tokenVisitor = {
        Literal(token) {
            return token.value;
        },
        Quote(token) {
            return token.single ? '\'' : '"';
        },
        Bracket(token) {
            if (token.context === 'attribute') {
                return token.open ? '[' : ']';
            }
            else if (token.context === 'expression') {
                return token.open ? '{' : '}';
            }
            else {
                return token.open ? '(' : '}';
            }
        },
        Operator(token) {
            return operators[token.operator];
        },
        Field(token, state) {
            if (token.index != null) {
                // It’s a field: by default, return TextMate-compatible field
                return token.name
                    ? `\${${token.index}:${token.name}}`
                    : `\${${token.index}`;
            }
            else if (token.name) {
                // It’s a variable
                return state.getVariable(token.name);
            }
            return '';
        },
        RepeaterPlaceholder(token, state) {
            // Find closest implicit repeater
            let repeater;
            for (let i = state.repeaters.length - 1; i >= 0; i--) {
                if (state.repeaters[i].implicit) {
                    repeater = state.repeaters[i];
                    break;
                }
            }
            state.inserted = true;
            return state.getText(repeater && repeater.value);
        },
        RepeaterNumber(token, state) {
            let value = 1;
            const lastIx = state.repeaters.length - 1;
            // const repeaterIx = Math.max(0, state.repeaters.length - 1 - token.parent);
            const repeater = state.repeaters[lastIx];
            if (repeater) {
                value = token.reverse
                    ? token.base + repeater.count - repeater.value - 1
                    : token.base + repeater.value;
                if (token.parent) {
                    const parentIx = Math.max(0, lastIx - token.parent);
                    if (parentIx !== lastIx) {
                        const parentRepeater = state.repeaters[parentIx];
                        value += repeater.count * parentRepeater.value;
                    }
                }
            }
            let result = String(value);
            while (result.length < token.size) {
                result = '0' + result;
            }
            return result;
        },
        WhiteSpace() {
            return ' ';
        }
    };
    /**
     * Converts given value token to string
     */
    function stringify(token, state) {
        if (!tokenVisitor[token.type]) {
            throw new Error(`Unknown token ${token.type}`);
        }
        return tokenVisitor[token.type](token, state);
    }

    /**
     * Converts given token-based abbreviation into simplified and unrolled node-based
     * abbreviation
     */
    function convert(abbr, options = {}) {
        let textInserted = false;
        const result = {
            type: 'Abbreviation',
            children: convertGroup(abbr, {
                inserted: false,
                repeaters: [],
                text: options.text,
                repeatGuard: options.maxRepeat || Number.POSITIVE_INFINITY,
                getText(pos) {
                    textInserted = true;
                    const value = Array.isArray(options.text)
                        ? (pos != null ? options.text[pos] : options.text.join('\n'))
                        : options.text;
                    return value != null ? value : '';
                },
                getVariable(name) {
                    const varValue = options.variables && options.variables[name];
                    return varValue != null ? varValue : name;
                }
            })
        };
        if (options.text != null && !textInserted) {
            // Text given but no implicitly repeated elements: insert it into
            // deepest child
            const deepest = deepestNode(last(result.children));
            if (deepest) {
                const text = Array.isArray(options.text) ? options.text.join('\n') : options.text;
                insertText(deepest, text);
            }
        }
        return result;
    }
    /**
     * Converts given statement to abbreviation nodes
     */
    function convertStatement(node, state) {
        let result = [];
        if (node.repeat) {
            // Node is repeated: we should create copies of given node
            // and supply context token with actual repeater state
            const original = node.repeat;
            const repeat = Object.assign({}, original);
            repeat.count = repeat.implicit && Array.isArray(state.text)
                ? state.text.length
                : (repeat.count || 1);
            let items;
            state.repeaters.push(repeat);
            for (let i = 0; i < repeat.count; i++) {
                repeat.value = i;
                node.repeat = repeat;
                items = isGroup(node)
                    ? convertGroup(node, state)
                    : convertElement(node, state);
                if (repeat.implicit && !state.inserted) {
                    // It’s an implicit repeater but no repeater placeholders found inside,
                    // we should insert text into deepest node
                    const target = last(items);
                    const deepest = target && deepestNode(target);
                    if (deepest) {
                        insertText(deepest, state.getText(repeat.value));
                    }
                }
                result = result.concat(items);
                // We should output at least one repeated item even if it’s reached
                // repeat limit
                if (--state.repeatGuard <= 0) {
                    break;
                }
            }
            state.repeaters.pop();
            node.repeat = original;
            if (repeat.implicit) {
                state.inserted = true;
            }
        }
        else {
            result = result.concat(isGroup(node) ? convertGroup(node, state) : convertElement(node, state));
        }
        return result;
    }
    function convertElement(node, state) {
        let children = [];
        const elem = {
            type: 'AbbreviationNode',
            name: node.name && stringifyName(node.name, state),
            value: node.value && stringifyValue(node.value, state),
            attributes: void 0,
            children,
            repeat: node.repeat && Object.assign({}, node.repeat),
            selfClosing: node.selfClose,
        };
        let result = [elem];
        for (const child of node.elements) {
            children = children.concat(convertStatement(child, state));
        }
        if (node.attributes) {
            elem.attributes = [];
            for (const attr of node.attributes) {
                elem.attributes.push(convertAttribute(attr, state));
            }
        }
        // In case if current node is a text-only snippet without fields, we should
        // put all children as siblings
        if (!elem.name && !elem.attributes && elem.value && !elem.value.some(isField)) {
            // XXX it’s unclear that `children` is not bound to `elem`
            // due to concat operation
            result = result.concat(children);
        }
        else {
            elem.children = children;
        }
        return result;
    }
    function convertGroup(node, state) {
        let result = [];
        for (const child of node.elements) {
            result = result.concat(convertStatement(child, state));
        }
        if (node.repeat) {
            result = attachRepeater(result, node.repeat);
        }
        return result;
    }
    function convertAttribute(node, state) {
        let implied = false;
        let isBoolean = false;
        let valueType = node.expression ? 'expression' : 'raw';
        let value;
        const name = node.name && stringifyName(node.name, state);
        if (name && name[0] === '!') {
            implied = true;
        }
        if (name && name[name.length - 1] === '.') {
            isBoolean = true;
        }
        if (node.value) {
            const tokens = node.value.slice();
            if (isQuote$1(tokens[0])) {
                // It’s a quoted value: remove quotes from output but mark attribute
                // value as quoted
                const quote = tokens.shift();
                if (tokens.length && last(tokens).type === quote.type) {
                    tokens.pop();
                }
                valueType = quote.single ? 'singleQuote' : 'doubleQuote';
            }
            else if (isBracket(tokens[0], 'expression', true)) {
                // Value is expression: remove brackets but mark value type
                valueType = 'expression';
                tokens.shift();
                if (isBracket(last(tokens), 'expression', false)) {
                    tokens.pop();
                }
            }
            value = stringifyValue(tokens, state);
        }
        return {
            name: isBoolean || implied
                ? name.slice(implied ? 1 : 0, isBoolean ? -1 : void 0)
                : name,
            value,
            boolean: isBoolean,
            implied,
            valueType
        };
    }
    /**
     * Converts given token list to string
     */
    function stringifyName(tokens, state) {
        let str = '';
        for (let i = 0; i < tokens.length; i++) {
            str += stringify(tokens[i], state);
        }
        return str;
    }
    /**
     * Converts given token list to value list
     */
    function stringifyValue(tokens, state) {
        const result = [];
        let str = '';
        for (let i = 0, token; i < tokens.length; i++) {
            token = tokens[i];
            if (isField(token)) {
                // We should keep original fields in output since some editors has their
                // own syntax for field or doesn’t support fields at all so we should
                // capture actual field location in output stream
                if (str) {
                    result.push(str);
                    str = '';
                }
                result.push(token);
            }
            else {
                str += stringify(token, state);
            }
        }
        if (str) {
            result.push(str);
        }
        return result;
    }
    function isGroup(node) {
        return node.type === 'TokenGroup';
    }
    function isField(token) {
        return typeof token === 'object' && token.type === 'Field' && token.index != null;
    }
    function last(arr) {
        return arr[arr.length - 1];
    }
    function deepestNode(node) {
        return node.children.length ? deepestNode(last(node.children)) : node;
    }
    function insertText(node, text) {
        if (node.value) {
            const lastToken = last(node.value);
            if (typeof lastToken === 'string') {
                node.value[node.value.length - 1] += text;
            }
            else {
                node.value.push(text);
            }
        }
        else {
            node.value = [text];
        }
    }
    function attachRepeater(items, repeater) {
        for (const item of items) {
            if (!item.repeat) {
                item.repeat = Object.assign({}, repeater);
            }
        }
        return items;
    }

    /**
     * Parses given abbreviation into node tree
     */
    function parseAbbreviation(abbr, options) {
        try {
            const tokens = typeof abbr === 'string' ? tokenize(abbr) : abbr;
            return convert(abbreviation(tokens, options), options);
        }
        catch (err) {
            if (err instanceof ScannerError && typeof abbr === 'string') {
                err.message += `\n${abbr}\n${'-'.repeat(err.pos)}^`;
            }
            throw err;
        }
    }

    function tokenize$1(abbr, isValue) {
        let brackets = 0;
        let token;
        const scanner = new Scanner(abbr);
        const tokens = [];
        while (!scanner.eof()) {
            token = getToken$1(scanner, brackets === 0 && !isValue);
            if (!token) {
                throw scanner.error('Unexpected character');
            }
            if (token.type === 'Bracket') {
                if (!brackets && token.open) {
                    mergeTokens(scanner, tokens);
                }
                brackets += token.open ? 1 : -1;
                if (brackets < 0) {
                    throw scanner.error('Unexpected bracket', token.start);
                }
            }
            tokens.push(token);
            // Forcibly consume next operator after unit-less numeric value or color:
            // next dash `-` must be used as value delimiter
            if (shouldConsumeDashAfter(token) && (token = operator$1(scanner))) {
                tokens.push(token);
            }
        }
        return tokens;
    }
    /**
     * Returns next token from given scanner, if possible
     */
    function getToken$1(scanner, short) {
        return field$1(scanner)
            || numberValue(scanner)
            || colorValue(scanner)
            || stringValue(scanner)
            || bracket$1(scanner)
            || operator$1(scanner)
            || whiteSpace$1(scanner)
            || literal$2(scanner, short);
    }
    function field$1(scanner) {
        const start = scanner.pos;
        if (scanner.eat(36 /* Dollar */) && scanner.eat(123 /* CurlyBracketOpen */)) {
            scanner.start = scanner.pos;
            let index;
            let name = '';
            if (scanner.eatWhile(isNumber)) {
                // It’s a field
                index = Number(scanner.current());
                name = scanner.eat(58 /* Colon */) ? consumePlaceholder$1(scanner) : '';
            }
            else if (isAlpha(scanner.peek())) {
                // It’s a variable
                name = consumePlaceholder$1(scanner);
            }
            if (scanner.eat(125 /* CurlyBracketClose */)) {
                return {
                    type: 'Field',
                    index, name,
                    start,
                    end: scanner.pos
                };
            }
            throw scanner.error('Expecting }');
        }
        // If we reached here then there’s no valid field here, revert
        // back to starting position
        scanner.pos = start;
    }
    /**
     * Consumes a placeholder: value right after `:` in field. Could be empty
     */
    function consumePlaceholder$1(stream) {
        const stack = [];
        stream.start = stream.pos;
        while (!stream.eof()) {
            if (stream.eat(123 /* CurlyBracketOpen */)) {
                stack.push(stream.pos);
            }
            else if (stream.eat(125 /* CurlyBracketClose */)) {
                if (!stack.length) {
                    stream.pos--;
                    break;
                }
                stack.pop();
            }
            else {
                stream.pos++;
            }
        }
        if (stack.length) {
            stream.pos = stack.pop();
            throw stream.error(`Expecting }`);
        }
        return stream.current();
    }
    /**
     * Consumes literal from given scanner
     * @param short Use short notation for consuming value.
     * The difference between “short” and “full” notation is that first one uses
     * alpha characters only and used for extracting keywords from abbreviation,
     * while “full” notation also supports numbers and dashes
     */
    function literal$2(scanner, short) {
        const start = scanner.pos;
        if (scanner.eat(isIdentPrefix)) {
            // SCSS or LESS variable
            // NB a bit dirty hack: if abbreviation starts with identifier prefix,
            // consume alpha characters only to allow embedded variables
            scanner.eatWhile(start ? isKeyword : isLiteral$1);
        }
        else if (scanner.eat(isAlphaWord)) {
            scanner.eatWhile(short ? isLiteral$1 : isKeyword);
        }
        else {
            // Allow dots only at the beginning of literal
            scanner.eat(46 /* Dot */);
            scanner.eatWhile(isLiteral$1);
        }
        if (start !== scanner.pos) {
            scanner.start = start;
            return createLiteral$1(scanner, scanner.start = start);
        }
    }
    function createLiteral$1(scanner, start = scanner.start, end = scanner.pos) {
        return {
            type: 'Literal',
            value: scanner.substring(start, end),
            start,
            end
        };
    }
    /**
     * Consumes numeric CSS value (number with optional unit) from current stream,
     * if possible
     */
    function numberValue(scanner) {
        const start = scanner.pos;
        if (consumeNumber(scanner)) {
            scanner.start = start;
            const rawValue = scanner.current();
            // eat unit, which can be a % or alpha word
            scanner.start = scanner.pos;
            scanner.eat(37 /* Percent */) || scanner.eatWhile(isAlphaWord);
            return {
                type: 'NumberValue',
                value: Number(rawValue),
                rawValue,
                unit: scanner.current(),
                start,
                end: scanner.pos
            };
        }
    }
    /**
     * Consumes quoted string value from given scanner
     */
    function stringValue(scanner) {
        const ch = scanner.peek();
        const start = scanner.pos;
        let finished = false;
        if (isQuote(ch)) {
            scanner.pos++;
            while (!scanner.eof()) {
                // Do not throw error on malformed string
                if (scanner.eat(ch)) {
                    finished = true;
                    break;
                }
                else {
                    scanner.pos++;
                }
            }
            scanner.start = start;
            return {
                type: 'StringValue',
                value: scanner.substring(start + 1, scanner.pos - (finished ? 1 : 0)),
                quote: ch === 39 /* SingleQuote */ ? 'single' : 'double',
                start,
                end: scanner.pos
            };
        }
    }
    /**
     * Consumes a color token from given string
     */
    function colorValue(scanner) {
        // supported color variations:
        // #abc   → #aabbccc
        // #0     → #000000
        // #fff.5 → rgba(255, 255, 255, 0.5)
        // #t     → transparent
        const start = scanner.pos;
        if (scanner.eat(35 /* Hash */)) {
            const valueStart = scanner.pos;
            let color = '';
            let alpha = '';
            if (scanner.eatWhile(isHex)) {
                color = scanner.substring(valueStart, scanner.pos);
                alpha = colorAlpha(scanner);
            }
            else if (scanner.eat(116 /* Transparent */)) {
                color = '0';
                alpha = colorAlpha(scanner) || '0';
            }
            else {
                alpha = colorAlpha(scanner);
            }
            if (color || alpha || scanner.eof()) {
                const { r, g, b, a } = parseColor(color, alpha);
                return {
                    type: 'ColorValue',
                    r, g, b, a,
                    raw: scanner.substring(start + 1, scanner.pos),
                    start,
                    end: scanner.pos
                };
            }
            else {
                // Consumed # but no actual value: invalid color value, treat it as literal
                return createLiteral$1(scanner, start);
            }
        }
        scanner.pos = start;
    }
    /**
     * Consumes alpha value of color: `.1`
     */
    function colorAlpha(scanner) {
        const start = scanner.pos;
        if (scanner.eat(46 /* Dot */)) {
            scanner.start = start;
            if (scanner.eatWhile(isNumber)) {
                return scanner.current();
            }
            return '1';
        }
        return '';
    }
    /**
     * Consumes white space characters as string literal from given scanner
     */
    function whiteSpace$1(scanner) {
        const start = scanner.pos;
        if (scanner.eatWhile(isSpace)) {
            return {
                type: 'WhiteSpace',
                start,
                end: scanner.pos
            };
        }
    }
    /**
     * Consumes bracket from given scanner
     */
    function bracket$1(scanner) {
        const ch = scanner.peek();
        if (isBracket$1(ch)) {
            return {
                type: 'Bracket',
                open: ch === 40 /* RoundBracketOpen */,
                start: scanner.pos++,
                end: scanner.pos
            };
        }
    }
    /**
     * Consumes operator from given scanner
     */
    function operator$1(scanner) {
        const op = operatorType$1(scanner.peek());
        if (op) {
            return {
                type: 'Operator',
                operator: op,
                start: scanner.pos++,
                end: scanner.pos
            };
        }
    }
    /**
     * Eats number value from given stream
     * @return Returns `true` if number was consumed
     */
    function consumeNumber(stream) {
        const start = stream.pos;
        stream.eat(45 /* Dash */);
        const afterNegative = stream.pos;
        const hasDecimal = stream.eatWhile(isNumber);
        const prevPos = stream.pos;
        if (stream.eat(46 /* Dot */)) {
            // It’s perfectly valid to have numbers like `1.`, which enforces
            // value to float unit type
            const hasFloat = stream.eatWhile(isNumber);
            if (!hasDecimal && !hasFloat) {
                // Lone dot
                stream.pos = prevPos;
            }
        }
        // Edge case: consumed dash only: not a number, bail-out
        if (stream.pos === afterNegative) {
            stream.pos = start;
        }
        return stream.pos !== start;
    }
    function isIdentPrefix(code) {
        return code === 64 /* At */ || code === 36 /* Dollar */;
    }
    /**
     * If given character is an operator, returns it’s type
     */
    function operatorType$1(ch) {
        return (ch === 43 /* Sibling */ && "+" /* Sibling */)
            || (ch === 33 /* Excl */ && "!" /* Important */)
            || (ch === 44 /* Comma */ && "," /* ArgumentDelimiter */)
            || (ch === 58 /* Colon */ && ":" /* PropertyDelimiter */)
            || (ch === 45 /* Dash */ && "-" /* ValueDelimiter */)
            || void 0;
    }
    /**
     * Check if given code is a hex value (/0-9a-f/)
     */
    function isHex(code) {
        return isNumber(code) || isAlpha(code, 65, 70); // A-F
    }
    function isKeyword(code) {
        return isAlphaNumericWord(code) || code === 45 /* Dash */;
    }
    function isBracket$1(code) {
        return code === 40 /* RoundBracketOpen */ || code === 41 /* RoundBracketClose */;
    }
    function isLiteral$1(code) {
        return isAlphaWord(code) || code === 37 /* Percent */;
    }
    /**
     * Parses given color value from abbreviation into RGBA format
     */
    function parseColor(value, alpha) {
        let r = '0';
        let g = '0';
        let b = '0';
        let a = Number(alpha != null && alpha !== '' ? alpha : 1);
        if (value === 't') {
            a = 0;
        }
        else {
            switch (value.length) {
                case 0:
                    break;
                case 1:
                    r = g = b = value + value;
                    break;
                case 2:
                    r = g = b = value;
                    break;
                case 3:
                    r = value[0] + value[0];
                    g = value[1] + value[1];
                    b = value[2] + value[2];
                    break;
                default:
                    value += value;
                    r = value.slice(0, 2);
                    g = value.slice(2, 4);
                    b = value.slice(4, 6);
            }
        }
        return {
            r: parseInt(r, 16),
            g: parseInt(g, 16),
            b: parseInt(b, 16),
            a
        };
    }
    /**
     * Check if scanner reader must consume dash after given token.
     * Used in cases where user must explicitly separate numeric values
     */
    function shouldConsumeDashAfter(token) {
        return token.type === 'ColorValue' || (token.type === 'NumberValue' && !token.unit);
    }
    /**
     * Merges last adjacent tokens into a single literal.
     * This function is used to overcome edge case when function name was parsed
     * as a list of separate tokens. For example, a `scale3d()` value will be
     * parsed as literal and number tokens (`scale` and `3d`) which is a perfectly
     * valid abbreviation but undesired result. This function will detect last adjacent
     * literal and number values and combine them into single literal
     */
    function mergeTokens(scanner, tokens) {
        let start = 0;
        let end = 0;
        while (tokens.length) {
            const token = last$1(tokens);
            if (token.type === 'Literal' || token.type === 'NumberValue') {
                start = token.start;
                if (!end) {
                    end = token.end;
                }
                tokens.pop();
            }
            else {
                break;
            }
        }
        if (start !== end) {
            tokens.push(createLiteral$1(scanner, start, end));
        }
    }
    function last$1(arr) {
        return arr[arr.length - 1];
    }

    function tokenScanner$1(tokens) {
        return {
            tokens,
            start: 0,
            pos: 0,
            size: tokens.length
        };
    }
    function peek$1(scanner) {
        return scanner.tokens[scanner.pos];
    }
    function readable$1(scanner) {
        return scanner.pos < scanner.size;
    }
    function consume$1(scanner, test) {
        if (test(peek$1(scanner))) {
            scanner.pos++;
            return true;
        }
        return false;
    }
    function error$1(scanner, message, token = peek$1(scanner)) {
        if (token && token.start != null) {
            message += ` at ${token.start}`;
        }
        const err = new Error(message);
        err['pos'] = token && token.start;
        return err;
    }

    function parser(tokens, options = {}) {
        const scanner = tokenScanner$1(tokens);
        const result = [];
        let property;
        while (readable$1(scanner)) {
            if (property = consumeProperty(scanner, options)) {
                result.push(property);
            }
            else if (!consume$1(scanner, isSiblingOperator$1)) {
                throw error$1(scanner, 'Unexpected token');
            }
        }
        return result;
    }
    /**
     * Consumes single CSS property
     */
    function consumeProperty(scanner, options) {
        let name;
        let important = false;
        let valueFragment;
        const value = [];
        const token = peek$1(scanner);
        const valueMode = !!options.value;
        if (!valueMode && isLiteral$1$1(token) && !isFunctionStart(scanner)) {
            scanner.pos++;
            name = token.value;
            // Consume any following value delimiter after property name
            consume$1(scanner, isValueDelimiter);
        }
        // Skip whitespace right after property name, if any
        if (valueMode) {
            consume$1(scanner, isWhiteSpace$2);
        }
        while (readable$1(scanner)) {
            if (consume$1(scanner, isImportant)) {
                important = true;
            }
            else if (valueFragment = consumeValue(scanner, valueMode)) {
                value.push(valueFragment);
            }
            else if (!consume$1(scanner, isFragmentDelimiter)) {
                break;
            }
        }
        if (name || value.length || important) {
            return { name, value, important };
        }
    }
    /**
     * Consumes single value fragment, e.g. all value tokens before comma
     */
    function consumeValue(scanner, inArgument) {
        const result = [];
        let token;
        let args;
        while (readable$1(scanner)) {
            token = peek$1(scanner);
            if (isValue(token)) {
                scanner.pos++;
                if (isLiteral$1$1(token) && (args = consumeArguments(scanner))) {
                    result.push({
                        type: 'FunctionCall',
                        name: token.value,
                        arguments: args
                    });
                }
                else {
                    result.push(token);
                }
            }
            else if (isValueDelimiter(token) || (inArgument && isWhiteSpace$2(token))) {
                scanner.pos++;
            }
            else {
                break;
            }
        }
        return result.length
            ? { type: 'CSSValue', value: result }
            : void 0;
    }
    function consumeArguments(scanner) {
        const start = scanner.pos;
        if (consume$1(scanner, isOpenBracket$1)) {
            const args = [];
            let value;
            while (readable$1(scanner) && !consume$1(scanner, isCloseBracket)) {
                if (value = consumeValue(scanner, true)) {
                    args.push(value);
                }
                else if (!consume$1(scanner, isWhiteSpace$2) && !consume$1(scanner, isArgumentDelimiter)) {
                    throw error$1(scanner, 'Unexpected token');
                }
            }
            scanner.start = start;
            return args;
        }
    }
    function isLiteral$1$1(token) {
        return token && token.type === 'Literal';
    }
    function isBracket$1$1(token, open) {
        return token && token.type === 'Bracket' && (open == null || token.open === open);
    }
    function isOpenBracket$1(token) {
        return isBracket$1$1(token, true);
    }
    function isCloseBracket(token) {
        return isBracket$1$1(token, false);
    }
    function isWhiteSpace$2(token) {
        return token && token.type === 'WhiteSpace';
    }
    function isOperator$1(token, operator) {
        return token && token.type === 'Operator' && (!operator || token.operator === operator);
    }
    function isSiblingOperator$1(token) {
        return isOperator$1(token, "+" /* Sibling */);
    }
    function isArgumentDelimiter(token) {
        return isOperator$1(token, "," /* ArgumentDelimiter */);
    }
    function isFragmentDelimiter(token) {
        return isArgumentDelimiter(token);
    }
    function isImportant(token) {
        return isOperator$1(token, "!" /* Important */);
    }
    function isValue(token) {
        return token.type === 'StringValue'
            || token.type === 'ColorValue'
            || token.type === 'NumberValue'
            || token.type === 'Literal'
            || token.type === 'Field';
    }
    function isValueDelimiter(token) {
        return isOperator$1(token, ":" /* PropertyDelimiter */)
            || isOperator$1(token, "-" /* ValueDelimiter */);
    }
    function isFunctionStart(scanner) {
        const t1 = scanner.tokens[scanner.pos];
        const t2 = scanner.tokens[scanner.pos + 1];
        return t1 && t2 && isLiteral$1$1(t1) && t2.type === 'Bracket';
    }

    /**
     * Parses given abbreviation into property set
     */
    function parse(abbr, options) {
        try {
            const tokens = typeof abbr === 'string' ? tokenize$1(abbr, options && options.value) : abbr;
            return parser(tokens, options);
        }
        catch (err) {
            if (err instanceof ScannerError && typeof abbr === 'string') {
                err.message += `\n${abbr}\n${'-'.repeat(err.pos)}^`;
            }
            throw err;
        }
    }

    const defaultConfig = {
        mark: true,
        preview: true,
        autoRenameTags: true,
        markTagPairs: true,
        previewOpenTag: false,
        attributeQuotes: 'double',
        markupStyle: 'html',
        comments: false,
        commentsTemplate: '<!-- /[#ID][.CLASS] -->',
        bem: false
    };
    function getEmmetConfig(editor, opt) {
        if (!opt) {
            // @ts-ignore Bypass limited options, defined in typings
            opt = editor.getOption('emmet');
        }
        return Object.assign(Object.assign({}, defaultConfig), opt);
    }

    const defaultOptions = {
        xml: false,
        allTokens: false,
        special: {
            style: null,
            script: ['', 'text/javascript', 'application/x-javascript', 'javascript', 'typescript', 'ts', 'coffee', 'coffeescript']
        },
        empty: ['img', 'meta', 'link', 'br', 'base', 'hr', 'area', 'wbr', 'col', 'embed', 'input', 'param', 'source', 'track']
    };
    /** Options for `Scanner` utils */
    const opt = { throws: false };
    function createOptions(options = {}) {
        return Object.assign(Object.assign({}, defaultOptions), options);
    }
    /**
     * Converts given string into array of character codes
     */
    function toCharCodes(str) {
        return str.split('').map(ch => ch.charCodeAt(0));
    }
    /**
     * Consumes array of character codes from given scanner
     */
    function consumeArray(scanner, codes) {
        const start = scanner.pos;
        for (let i = 0; i < codes.length; i++) {
            if (!scanner.eat(codes[i])) {
                scanner.pos = start;
                return false;
            }
        }
        scanner.start = start;
        return true;
    }
    /**
     * Consumes section from given string which starts with `open` character codes
     * and ends with `close` character codes
     * @return Returns `true` if section was consumed
     */
    function consumeSection(scanner, open, close, allowUnclosed) {
        const start = scanner.pos;
        if (consumeArray(scanner, open)) {
            // consumed `<!--`, read next until we find ending part or reach the end of input
            while (!scanner.eof()) {
                if (consumeArray(scanner, close)) {
                    scanner.start = start;
                    return true;
                }
                scanner.pos++;
            }
            // unclosed section is allowed
            if (allowUnclosed) {
                scanner.start = start;
                return true;
            }
            scanner.pos = start;
            return false;
        }
        // unable to find section, revert to initial position
        scanner.pos = start;
        return false;
    }
    /**
     * Check if given character can be used as a start of tag name or attribute
     */
    function nameStartChar(ch) {
        // Limited XML spec: https://www.w3.org/TR/xml/#NT-NameStartChar
        return isAlpha(ch) || ch === 58 /* Colon */ || ch === 95 /* Underscore */
            || (ch >= 0xC0 && ch <= 0xD6)
            || (ch >= 0xD8 && ch <= 0xF6)
            || (ch >= 0xF8 && ch <= 0x2FF)
            || (ch >= 0x370 && ch <= 0x37D)
            || (ch >= 0x37F && ch <= 0x1FFF);
    }
    /**
     * Check if given character can be used in a tag or attribute name
     */
    function nameChar(ch) {
        // Limited XML spec: https://www.w3.org/TR/xml/#NT-NameChar
        return nameStartChar(ch) || ch === 45 /* Dash */ || ch === 46 /* Dot */ || isNumber(ch)
            || ch === 0xB7
            || (ch >= 0x0300 && ch <= 0x036F);
    }
    /**
     * Consumes identifier from given scanner
     */
    function ident(scanner) {
        const start = scanner.pos;
        if (scanner.eat(nameStartChar)) {
            scanner.eatWhile(nameChar);
            scanner.start = start;
            return true;
        }
        return false;
    }
    /**
     * Check if given code is tag terminator
     */
    function isTerminator(code) {
        return code === 62 /* RightAngle */ || code === 47 /* Slash */;
    }
    /**
     * Check if given character code is valid unquoted value
     */
    function isUnquoted(code) {
        return !isNaN(code) && !isQuote(code) && !isSpace(code) && !isTerminator(code);
    }
    /**
     * Consumes paired tokens (like `[` and `]`) with respect of nesting and embedded
     * quoted values
     * @return `true` if paired token was consumed
     */
    function consumePaired(scanner) {
        return eatPair(scanner, 60 /* LeftAngle */, 62 /* RightAngle */, opt)
            || eatPair(scanner, 40 /* LeftRound */, 41 /* RightRound */, opt)
            || eatPair(scanner, 91 /* LeftSquare */, 93 /* RightSquare */, opt)
            || eatPair(scanner, 123 /* LeftCurly */, 125 /* RightCurly */, opt);
    }
    /**
     * Returns unquoted value of given string
     */
    function getUnquotedValue(value) {
        // Trim quotes
        if (isQuote(value.charCodeAt(0))) {
            value = value.slice(1);
        }
        if (isQuote(value.charCodeAt(value.length - 1))) {
            value = value.slice(0, -1);
        }
        return value;
    }

    /**
     * Parses given string as list of HTML attributes.
     * @param src A fragment to parse. If `name` argument is provided, it must be an
     * opening tag (`<a foo="bar">`), otherwise it should be a fragment between element
     * name and tag closing angle (`foo="bar"`)
     * @param name Tag name
     */
    function attributes(src, name) {
        const result = [];
        let start = 0;
        let end = src.length;
        if (name) {
            start = name.length + 1;
            end -= src.slice(-2) === '/>' ? 2 : 1;
        }
        const scanner = new Scanner(src, start, end);
        while (!scanner.eof()) {
            scanner.eatWhile(isSpace);
            if (attributeName(scanner)) {
                const token = {
                    name: scanner.current(),
                    nameStart: scanner.start,
                    nameEnd: scanner.pos
                };
                if (scanner.eat(61 /* Equals */) && attributeValue(scanner)) {
                    token.value = scanner.current();
                    token.valueStart = scanner.start;
                    token.valueEnd = scanner.pos;
                }
                result.push(token);
            }
            else {
                // Do not break on invalid attributes: we are not validating parser
                scanner.pos++;
            }
        }
        return result;
    }
    /**
     * Consumes attribute name from given scanner context
     */
    function attributeName(scanner) {
        const start = scanner.pos;
        if (scanner.eat(42 /* Asterisk */) || scanner.eat(35 /* Hash */)) {
            // Angular-style directives: `<section *ngIf="showSection">`, `<video #movieplayer ...>`
            ident(scanner);
            scanner.start = start;
            return true;
        }
        // Attribute name could be a regular name or expression:
        // React-style – `<div {...props}>`
        // Angular-style – `<div [ng-for]>` or `<div *ng-for>`
        return consumePaired(scanner) || ident(scanner);
    }
    /**
     * Consumes attribute value
     */
    function attributeValue(scanner) {
        // Supported attribute values are quoted, React-like expressions (`{foo}`)
        // or unquoted literals
        return eatQuoted(scanner, opt) || consumePaired(scanner) || unquoted(scanner);
    }
    /**
     * Returns clean (unquoted) value of `name` attribute
     */
    function getAttributeValue(attrs, name) {
        for (let i = 0; i < attrs.length; i++) {
            const attr = attrs[i];
            if (attr.name === name) {
                return attr.value && getUnquotedValue(attr.value);
            }
        }
    }
    /**
     * Consumes unquoted value
     */
    function unquoted(scanner) {
        const start = scanner.pos;
        if (scanner.eatWhile(isUnquoted)) {
            scanner.start = start;
            return true;
        }
    }

    const cdataOpen = toCharCodes('<![CDATA[');
    const cdataClose = toCharCodes(']]>');
    const commentOpen = toCharCodes('<!--');
    const commentClose = toCharCodes('-->');
    const piStart = toCharCodes('<?');
    const piEnd = toCharCodes('?>');
    const erbStart = toCharCodes('<%');
    const erbEnd = toCharCodes('%>');
    /**
     * Performs fast scan of given source code: for each tag found it invokes callback
     * with tag name, its type (open, close, self-close) and range in original source.
     * Unlike regular scanner, fast scanner doesn’t provide info about attributes to
     * reduce object allocations hence increase performance.
     * If `callback` returns `false`, scanner stops parsing.
     * @param special List of “special” HTML tags which should be ignored. Most likely
     * it’s a "script" and "style" tags.
     */
    function scan(source, callback, options) {
        const scanner = new Scanner(source);
        const special = options ? options.special : null;
        const allTokens = options ? options.allTokens : false;
        let type;
        let name;
        let nameStart;
        let nameEnd;
        let nameCodes;
        let found = false;
        let piName = null;
        while (!scanner.eof()) {
            const start = scanner.pos;
            if (cdata(scanner)) {
                if (allTokens && callback('#cdata', 4 /* CData */, scanner.start, scanner.pos) === false) {
                    break;
                }
            }
            else if (comment(scanner)) {
                if (allTokens && callback('#comment', 6 /* Comment */, scanner.start, scanner.pos) === false) {
                    break;
                }
            }
            else if (erb(scanner)) {
                if (allTokens && callback('#erb', 7 /* ERB */, scanner.start, scanner.pos) === false) {
                    break;
                }
            }
            else if (piName = processingInstruction(scanner)) {
                if (allTokens && callback(piName, 5 /* ProcessingInstruction */, scanner.start, scanner.pos) === false) {
                    break;
                }
            }
            else if (scanner.eat(60 /* LeftAngle */)) {
                // Maybe a tag name?
                type = scanner.eat(47 /* Slash */) ? 2 /* Close */ : 1 /* Open */;
                nameStart = scanner.pos;
                if (ident(scanner)) {
                    // Consumed tag name
                    nameEnd = scanner.pos;
                    if (type !== 2 /* Close */) {
                        skipAttributes(scanner);
                        scanner.eatWhile(isSpace);
                        if (scanner.eat(47 /* Slash */)) {
                            type = 3 /* SelfClose */;
                        }
                    }
                    if (scanner.eat(62 /* RightAngle */)) {
                        // Tag properly closed
                        name = scanner.substring(nameStart, nameEnd);
                        if (callback(name, type, start, scanner.pos) === false) {
                            break;
                        }
                        if (type === 1 /* Open */ && special && isSpecial(special, name, source, start, scanner.pos)) {
                            // Found opening tag of special element: we should skip
                            // scanner contents until we find closing tag
                            nameCodes = toCharCodes(name);
                            found = false;
                            while (!scanner.eof()) {
                                if (consumeClosing(scanner, nameCodes)) {
                                    found = true;
                                    break;
                                }
                                scanner.pos++;
                            }
                            if (found && callback(name, 2 /* Close */, scanner.start, scanner.pos) === false) {
                                break;
                            }
                        }
                    }
                }
            }
            else {
                scanner.pos++;
            }
        }
    }
    /**
     * Skips attributes in current tag context
     */
    function skipAttributes(scanner) {
        while (!scanner.eof()) {
            scanner.eatWhile(isSpace);
            if (attributeName(scanner)) {
                if (scanner.eat(61 /* Equals */)) {
                    attributeValue(scanner);
                }
            }
            else if (isTerminator(scanner.peek())) {
                break;
            }
            else {
                scanner.pos++;
            }
        }
    }
    /**
     * Consumes closing tag with given name from scanner
     */
    function consumeClosing(scanner, name) {
        const start = scanner.pos;
        if (scanner.eat(60 /* LeftAngle */) && scanner.eat(47 /* Slash */) && consumeArray(scanner, name) && scanner.eat(62 /* RightAngle */)) {
            scanner.start = start;
            return true;
        }
        scanner.pos = start;
        return false;
    }
    /**
     * Consumes CDATA from given scanner
     */
    function cdata(scanner) {
        return consumeSection(scanner, cdataOpen, cdataClose, true);
    }
    /**
     * Consumes comments from given scanner
     */
    function comment(scanner) {
        return consumeSection(scanner, commentOpen, commentClose, true);
    }
    /**
     * Consumes processing instruction from given scanner. If consumed, returns
     * processing instruction name
     */
    function processingInstruction(scanner) {
        const start = scanner.pos;
        if (consumeArray(scanner, piStart) && ident(scanner)) {
            const name = scanner.current();
            while (!scanner.eof()) {
                if (consumeArray(scanner, piEnd)) {
                    break;
                }
                eatQuoted(scanner) || scanner.pos++;
            }
            scanner.start = start;
            return name;
        }
        scanner.pos = start;
        return null;
    }
    /**
     * Consumes ERB-style entity: `<% ... %>` or `<%= ... %>`
     */
    function erb(scanner) {
        const start = scanner.pos;
        if (consumeArray(scanner, erbStart)) {
            while (!scanner.eof()) {
                if (consumeArray(scanner, erbEnd)) {
                    break;
                }
                eatQuoted(scanner) || scanner.pos++;
            }
            scanner.start = start;
            return true;
        }
        scanner.pos = start;
        return false;
    }
    /**
     * Check if given tag name should be considered as special
     */
    function isSpecial(special, name, source, start, end) {
        if (name in special) {
            const typeValues = special[name];
            if (!Array.isArray(typeValues)) {
                return true;
            }
            const attrs = attributes(source.substring(start + name.length + 1, end - 1));
            return typeValues.includes(getAttributeValue(attrs, 'type') || '');
        }
        return false;
    }

    /**
     * Finds matched tag for given `pos` location in XML/HTML `source`
     */
    function match(source, pos, opt) {
        // Since we expect large input document, we’ll use pooling technique
        // for storing tag data to reduce memory pressure and improve performance
        const pool = [];
        const stack = [];
        const options = createOptions(opt);
        let result = null;
        scan(source, (name, type, start, end) => {
            if (type === 1 /* Open */ && isSelfClose(name, options)) {
                // Found empty element in HTML mode, mark is as self-closing
                type = 3 /* SelfClose */;
            }
            if (type === 1 /* Open */) {
                // Allocate tag object from pool
                stack.push(allocTag(pool, name, start, end));
            }
            else if (type === 3 /* SelfClose */) {
                if (start < pos && pos < end) {
                    // Matched given self-closing tag
                    result = {
                        name,
                        attributes: getAttributes(source, start, end, name),
                        open: [start, end]
                    };
                    return false;
                }
            }
            else {
                const tag = last$2(stack);
                if (tag && tag.name === name) {
                    // Matching closing tag found
                    if (tag.start < pos && pos < end) {
                        result = {
                            name,
                            attributes: getAttributes(source, tag.start, tag.end, name),
                            open: [tag.start, tag.end],
                            close: [start, end]
                        };
                        return false;
                    }
                    else if (stack.length) {
                        // Release tag object for further re-use
                        releaseTag(pool, stack.pop());
                    }
                }
            }
        }, options);
        stack.length = pool.length = 0;
        return result;
    }
    /**
     * Returns balanced tag model: a list of all XML/HTML tags that could possibly match
     * given location when moving in outward direction
     */
    function balancedOutward(source, pos, opt) {
        const pool = [];
        const stack = [];
        const options = createOptions(opt);
        const result = [];
        scan(source, (name, type, start, end) => {
            if (type === 2 /* Close */) {
                const tag = last$2(stack);
                if (tag && tag.name === name) { // XXX check for invalid tag names?
                    // Matching closing tag found, check if matched pair is a candidate
                    // for outward balancing
                    if (tag.start < pos && pos < end) {
                        result.push({
                            name,
                            open: [tag.start, tag.end],
                            close: [start, end]
                        });
                    }
                    // Release tag object for further re-use
                    releaseTag(pool, stack.pop());
                }
            }
            else if (type === 3 /* SelfClose */ || isSelfClose(name, options)) {
                if (start < pos && pos < end) {
                    // Matched self-closed tag
                    result.push({ name, open: [start, end] });
                }
            }
            else {
                stack.push(allocTag(pool, name, start, end));
            }
        }, options);
        stack.length = pool.length = 0;
        return result;
    }
    /**
     * Returns balanced tag model: a list of all XML/HTML tags that could possibly match
     * given location when moving in inward direction
     */
    function balancedInward(source, pos, opt) {
        // Collecting tags for inward balancing is a bit trickier: we have to store
        // first child of every matched tag until we find the one that matches given
        // location
        const pool = [];
        const stack = [];
        const options = createOptions(opt);
        const result = [];
        const alloc = (name, start, end) => {
            if (pool.length) {
                const tag = pool.pop();
                tag.name = name;
                tag.ranges.push(start, end);
                return tag;
            }
            return { name, ranges: [start, end] };
        };
        const release = (tag) => {
            tag.ranges.length = 0;
            tag.firstChild = void 0;
            pool.push(tag);
        };
        scan(source, (name, type, start, end) => {
            if (type === 2 /* Close */) {
                if (!stack.length) {
                    // Some sort of lone closing tag, ignore it
                    return;
                }
                let tag = last$2(stack);
                if (tag.name === name) { // XXX check for invalid tag names?
                    // Matching closing tag found, check if matched pair is a candidate
                    // for outward balancing
                    if (tag.ranges[0] <= pos && pos <= end) {
                        result.push({
                            name,
                            open: tag.ranges.slice(0, 2),
                            close: [start, end]
                        });
                        while (tag.firstChild) {
                            const child = tag.firstChild;
                            const res = {
                                name: child.name,
                                open: child.ranges.slice(0, 2)
                            };
                            if (child.ranges.length > 2) {
                                res.close = child.ranges.slice(2, 4);
                            }
                            result.push(res);
                            release(tag);
                            tag = child;
                        }
                        return false;
                    }
                    else {
                        stack.pop();
                        const parent = last$2(stack);
                        if (parent && !parent.firstChild) {
                            // No first child in parent node: store current tag
                            tag.ranges.push(start, end);
                            parent.firstChild = tag;
                        }
                        else {
                            release(tag);
                        }
                    }
                }
            }
            else if (type === 3 /* SelfClose */ || isSelfClose(name, options)) {
                if (start < pos && pos < end) {
                    // Matched self-closed tag, no need to look further
                    result.push({ name, open: [start, end] });
                    return false;
                }
                const parent = last$2(stack);
                if (parent && !parent.firstChild) {
                    parent.firstChild = alloc(name, start, end);
                }
            }
            else {
                stack.push(alloc(name, start, end));
            }
        }, options);
        stack.length = pool.length = 0;
        return result;
    }
    function allocTag(pool, name, start, end) {
        if (pool.length) {
            const tag = pool.pop();
            tag.name = name;
            tag.start = start;
            tag.end = end;
            return tag;
        }
        return { name, start, end };
    }
    function releaseTag(pool, tag) {
        pool.push(tag);
    }
    /**
     * Returns parsed attributes from given source
     */
    function getAttributes(source, start, end, name) {
        const tokens = attributes(source.slice(start, end), name);
        tokens.forEach(attr => {
            attr.nameStart += start;
            attr.nameEnd += start;
            if (attr.value != null) {
                attr.valueStart += start;
                attr.valueEnd += start;
            }
        });
        return tokens;
    }
    /**
     * Check if given tag is self-close for current parsing context
     */
    function isSelfClose(name, options) {
        return !options.xml && options.empty.includes(name);
    }
    function last$2(arr) {
        return arr.length ? arr[arr.length - 1] : null;
    }

    /**
     * Performs fast scan of given stylesheet (CSS, LESS, SCSS) source code and runs
     * callback for each token and its range found. The goal of this parser is to quickly
     * determine document structure: selector, property, value and block end.
     * It doesn’t provide detailed info about CSS atoms like compound selectors,
     * operators, quoted string etc. to reduce memory allocations: this data can be
     * parsed later on demand.
     */
    function scan$1(source, callback) {
        const scanner = new Scanner(source);
        const state = {
            start: -1,
            end: -1,
            propertyStart: -1,
            propertyEnd: -1,
            propertyDelimiter: -1,
            expression: 0,
        };
        let blockEnd;
        const notify = (type, delimiter = scanner.start, start = state.start, end = state.end) => {
            return callback(type, start, end, delimiter) === false;
        };
        while (!scanner.eof()) {
            if (comment$1(scanner) || whitespace(scanner)) {
                continue;
            }
            scanner.start = scanner.pos;
            if ((blockEnd = scanner.eat(125 /* RightCurly */)) || scanner.eat(59 /* Semicolon */)) {
                // Block or property end
                if (state.propertyStart !== -1) {
                    // We have pending property
                    if (notify("propertyName" /* PropertyName */, state.propertyDelimiter, state.propertyStart, state.propertyEnd)) {
                        return;
                    }
                    if (state.start === -1) {
                        // Explicit property value state: emit empty value
                        state.start = state.end = scanner.start;
                    }
                    if (notify("propertyValue" /* PropertyValue */)) {
                        return;
                    }
                }
                else if (state.start !== -1 && notify("propertyName" /* PropertyName */)) {
                    // Flush consumed token
                    return;
                }
                if (blockEnd) {
                    state.start = scanner.start;
                    state.end = scanner.pos;
                    if (notify("blockEnd" /* BlockEnd */)) {
                        return;
                    }
                }
                reset(state);
            }
            else if (scanner.eat(123 /* LeftCurly */)) {
                // Block start
                if (state.start === -1 && state.propertyStart === -1) {
                    // No consumed selector, emit empty value as selector start
                    state.start = state.end = scanner.pos;
                }
                if (state.propertyStart !== -1) {
                    // Now we know that value that looks like property name-value pair
                    // was actually a selector
                    state.start = state.propertyStart;
                }
                if (notify("selector" /* Selector */)) {
                    return;
                }
                reset(state);
            }
            else if (scanner.eat(58 /* Colon */) && !isKnownSelectorColon(scanner, state)) {
                // Colon could be one of the following:
                // — property delimiter: `foo: bar`, must be in block context
                // — variable delimiter: `$foo: bar`, could be anywhere
                // — pseudo-selector: `a:hover`, could be anywhere (for LESS and SCSS)
                // — media query expression: `min-width: 100px`, must be inside expression context
                // Since I can’t easily detect `:` meaning for sure, we’ll update state
                // to accumulate possible property name-value pair or selector
                if (state.propertyStart === -1) {
                    state.propertyStart = state.start;
                }
                state.propertyEnd = state.end;
                state.propertyDelimiter = scanner.pos - 1;
                state.start = state.end = -1;
            }
            else {
                if (state.start === -1) {
                    state.start = scanner.pos;
                }
                if (scanner.eat(40 /* LeftRound */)) {
                    state.expression++;
                }
                else if (scanner.eat(41 /* RightRound */)) {
                    state.expression--;
                }
                else if (!literal$3(scanner)) {
                    scanner.pos++;
                }
                state.end = scanner.pos;
            }
        }
        if (state.propertyStart !== -1) {
            // Pending property name
            if (notify("propertyName" /* PropertyName */, state.propertyDelimiter, state.propertyStart, state.propertyEnd)) {
                return;
            }
        }
        if (state.start !== -1) {
            // There’s pending token in state
            notify(state.propertyStart !== -1 ? "propertyValue" /* PropertyValue */ : "propertyName" /* PropertyName */, -1);
        }
    }
    function whitespace(scanner) {
        return scanner.eatWhile(isSpace);
    }
    /**
     * Consumes CSS comments from scanner: `/*  * /`
     * It’s possible that comment may not have closing part
     */
    function comment$1(scanner) {
        const start = scanner.pos;
        if (scanner.eat(47 /* Slash */) && scanner.eat(42 /* Asterisk */)) {
            scanner.start = start;
            while (!scanner.eof()) {
                if (scanner.eat(42 /* Asterisk */)) {
                    if (scanner.eat(47 /* Slash */)) {
                        return true;
                    }
                    continue;
                }
                scanner.pos++;
            }
            return true;
        }
        else {
            scanner.pos = start;
        }
        return false;
    }
    /**
     * Consumes single- or double-quoted string literal
     */
    function literal$3(scanner) {
        const ch = scanner.peek();
        if (isQuote(ch)) {
            scanner.start = scanner.pos++;
            while (!scanner.eof()) {
                if (scanner.eat(ch) || scanner.eat(10 /* LF */) || scanner.eat(13 /* CR */)) {
                    break;
                }
                // Skip escape character, if any
                scanner.eat(92 /* Backslash */);
                scanner.pos++;
            }
            // Do not throw if string is incomplete
            return true;
        }
    }
    function reset(state) {
        state.start = state.end = state.propertyStart = state.propertyEnd = state.propertyDelimiter = -1;
    }
    /**
     * Check if current state is a known selector context for `:` delimiter
     */
    function isKnownSelectorColon(scanner, state) {
        // Either inside expression like `(min-width: 10px)` or pseudo-element `::before`
        return state.expression || scanner.eatWhile(58 /* Colon */);
    }

    // NB: no `Minus` operator, it must be handled differently
    const operators$1 = [
        43 /* Plus */, 47 /* Division */, 42 /* Multiplication */,
        44 /* Comma */
    ];
    /**
     * Splits given CSS value into token list
     */
    function splitValue(value, offset = 0) {
        let start = -1;
        let expression = 0;
        let pos = 0;
        const result = [];
        const scanner = new Scanner(value);
        while (!scanner.eof()) {
            pos = scanner.pos;
            if (scanner.eat(isSpace) || scanner.eat(isOperator$2) || isMinusOperator(scanner)) {
                // Use space as value delimiter but only if not in expression context,
                // e.g. `1 2` are distinct values but `(1 2)` not
                if (!expression && start !== -1) {
                    result.push([offset + start, offset + pos]);
                    start = -1;
                }
                scanner.eatWhile(isSpace);
            }
            else {
                if (start === -1) {
                    start = scanner.pos;
                }
                if (scanner.eat(40 /* LeftRound */)) {
                    expression++;
                }
                else if (scanner.eat(41 /* RightRound */)) {
                    expression--;
                }
                else if (!literal$3(scanner)) {
                    scanner.pos++;
                }
            }
        }
        if (start !== -1 && start !== scanner.pos) {
            result.push([offset + start, offset + scanner.pos]);
        }
        return result;
    }
    function isOperator$2(ch) {
        return operators$1.includes(ch);
    }
    /**
     * Check if current scanner state is at minus operator
     */
    function isMinusOperator(scanner) {
        // Minus operator is tricky since CSS supports dashes in keyword names like
        // `no-repeat`
        const start = scanner.pos;
        if (scanner.eat(45 /* Minus */) && scanner.eat(isSpace)) {
            return true;
        }
        scanner.pos = start;
        return false;
    }

    function match$1(source, pos) {
        const pool = [];
        const stack = [];
        let result = null;
        let pendingProperty = null;
        const releasePending = () => {
            if (pendingProperty) {
                releaseRange(pool, pendingProperty);
                pendingProperty = null;
            }
        };
        scan$1(source, (type, start, end, delimiter) => {
            if (type === "selector" /* Selector */) {
                releasePending();
                stack.push(allocRange(pool, start, end, delimiter));
            }
            else if (type === "blockEnd" /* BlockEnd */) {
                releasePending();
                const parent = stack.pop();
                if (parent && parent[0] < pos && pos < end) {
                    result = {
                        type: 'selector',
                        start: parent[0],
                        end,
                        bodyStart: parent[2] + 1,
                        bodyEnd: start
                    };
                    return false;
                }
            }
            else if (type === "propertyName" /* PropertyName */) {
                releasePending();
                pendingProperty = allocRange(pool, start, end, delimiter);
            }
            else if (type === "propertyValue" /* PropertyValue */) {
                if (pendingProperty && pendingProperty[0] < pos && pos < end) {
                    result = {
                        type: 'property',
                        start: pendingProperty[0],
                        end: delimiter + 1,
                        bodyStart: start,
                        bodyEnd: end
                    };
                    return false;
                }
                releasePending();
            }
        });
        return result;
    }
    /**
     * Returns balanced CSS model: a list of all ranges that could possibly match
     * given location when moving in outward direction
     */
    function balancedOutward$1(source, pos) {
        const pool = [];
        const stack = [];
        const result = [];
        let property = null;
        scan$1(source, (type, start, end, delimiter) => {
            if (type === "selector" /* Selector */) {
                stack.push(allocRange(pool, start, end, delimiter));
            }
            else if (type === "blockEnd" /* BlockEnd */) {
                const left = stack.pop();
                if (left && left[0] < pos && end > pos) {
                    // Matching section found
                    const inner = innerRange(source, left[2] + 1, start);
                    inner && push(result, inner);
                    push(result, [left[0], end]);
                }
                left && releaseRange(pool, left);
                if (!stack.length) {
                    return false;
                }
            }
            else if (type === "propertyName" /* PropertyName */) {
                property && releaseRange(pool, property);
                property = allocRange(pool, start, end, delimiter);
            }
            else if (type === "propertyValue" /* PropertyValue */) {
                if (property && property[0] < pos && Math.max(delimiter, end) > pos) {
                    // Push full token and value range
                    push(result, [start, end]);
                    push(result, [property[0], delimiter !== -1 ? delimiter + 1 : end]);
                }
            }
            if (type !== "propertyName" /* PropertyName */ && property) {
                releaseRange(pool, property);
                property = null;
            }
        });
        return result;
    }
    /**
     * Returns balanced CSS selectors: a list of all ranges that could possibly match
     * given location when moving in inward direction
     */
    function balancedInward$1(source, pos) {
        // Collecting ranges for inward balancing is a bit trickier: we have to store
        // first child of every matched selector until we find the one that matches given
        // location
        const pool = [];
        const stack = [];
        const result = [];
        let pendingProperty = null;
        const alloc = (start, end, delimiter) => {
            if (pool.length) {
                const range = pool.pop();
                range.start = start;
                range.end = end;
                range.delimiter = delimiter;
                return range;
            }
            return { start, end, delimiter, firstChild: null };
        };
        const release = (range) => {
            range.firstChild = null;
            pool.push(range);
        };
        const releasePending = () => {
            if (pendingProperty) {
                release(pendingProperty);
                pendingProperty = null;
            }
        };
        /**
         * Pushes given inward range as a first child of current selector only if it’s
         * not set yet
         */
        const pushChild = (start, end, delimiter) => {
            const parent = last$3(stack);
            if (parent && !parent.firstChild) {
                parent.firstChild = alloc(start, end, delimiter);
            }
        };
        scan$1(source, (type, start, end, delimiter) => {
            if (type === "blockEnd" /* BlockEnd */) {
                releasePending();
                let range = stack.pop();
                if (!range) {
                    // Some sort of lone closing brace, ignore it
                    return;
                }
                if (range.start <= pos && pos <= end) {
                    // Matching selector found: add it and its inner range into result
                    let inner = innerRange(source, range.delimiter + 1, start);
                    push(result, [range.start, end]);
                    inner && push(result, inner);
                    while (range.firstChild) {
                        const child = range.firstChild;
                        inner = innerRange(source, child.delimiter + 1, child.end - 1);
                        push(result, [child.start, child.end]);
                        inner && push(result, inner);
                        range = child;
                    }
                    return false;
                }
                else {
                    const parent = last$3(stack);
                    if (parent && !parent.firstChild) {
                        // No first child in parent node: store current selector
                        range.end = end;
                        parent.firstChild = range;
                    }
                    else {
                        release(range);
                    }
                }
            }
            else if (type === "propertyName" /* PropertyName */) {
                releasePending();
                pendingProperty = alloc(start, end, delimiter);
                pushChild(start, end, delimiter);
            }
            else if (type === "propertyValue" /* PropertyValue */) {
                if (pendingProperty) {
                    if (pendingProperty.start <= pos && end >= pos) {
                        // Direct hit into property, no need to look further
                        push(result, [pendingProperty.start, delimiter + 1]);
                        push(result, [start, end]);
                        releasePending();
                        return false;
                    }
                    const parent = last$3(stack);
                    if (parent && parent.firstChild && parent.firstChild.start === pendingProperty.start) {
                        // First child is an expected property name, update its range
                        // to include property value
                        parent.firstChild.end = delimiter !== -1 ? delimiter + 1 : end;
                    }
                    releasePending();
                }
            }
            else {
                // Selector start
                stack.push(alloc(start, end, delimiter));
                releasePending();
            }
        });
        stack.length = pool.length = 0;
        return result;
    }
    /**
     * Returns inner range for given selector bounds: narrows it to first non-empty
     * region. If resulting region is empty, returns `null`
     */
    function innerRange(source, start, end) {
        while (start < end && isSpace(source.charCodeAt(start))) {
            start++;
        }
        while (end > start && isSpace(source.charCodeAt(end - 1))) {
            end--;
        }
        return start !== end ? [start, end] : null;
    }
    function allocRange(pool, start, end, delimiter) {
        if (pool.length) {
            const range = pool.pop();
            range[0] = start;
            range[1] = end;
            range[2] = delimiter;
            return range;
        }
        return [start, end, delimiter];
    }
    function releaseRange(pool, range) {
        range && pool.push(range);
        return null;
    }
    function push(ranges, range) {
        const prev = ranges.length ? ranges[ranges.length - 1] : null;
        if ((!prev || prev[0] !== range[0] || prev[1] !== range[1]) && range[0] !== range[1]) {
            ranges.push(range);
        }
    }
    function last$3(arr) {
        return arr.length ? arr[arr.length - 1] : null;
    }

    /**
     * Merges attributes in current node: de-duplicates attributes with the same name
     * and merges class names
     */
    function mergeAttributes(node, config) {
        if (!node.attributes) {
            return;
        }
        const attributes = [];
        const lookup = {};
        for (const attr of node.attributes) {
            if (attr.name) {
                const attrName = attr.name;
                if (attrName in lookup) {
                    const prev = lookup[attrName];
                    if (attrName === 'class') {
                        prev.value = mergeValue(prev.value, attr.value, ' ');
                    }
                    else {
                        mergeDeclarations(prev, attr, config);
                    }
                }
                else {
                    // Create new attribute instance so we can safely modify it later
                    attributes.push(lookup[attrName] = Object.assign({}, attr));
                }
            }
            else {
                attributes.push(attr);
            }
        }
        node.attributes = attributes;
    }
    /**
     * Merges two token lists into single list. Adjacent strings are merged together
     */
    function mergeValue(prev, next, glue) {
        if (prev && next) {
            if (prev.length && glue) {
                append(prev, glue);
            }
            for (const t of next) {
                append(prev, t);
            }
            return prev;
        }
        const result = prev || next;
        return result && result.slice();
    }
    /**
     * Merges data from `src` attribute into `dest` and returns it
     */
    function mergeDeclarations(dest, src, config) {
        dest.name = src.name;
        if (!config.options['output.reverseAttributes']) {
            dest.value = src.value;
        }
        // Keep high-priority properties
        if (!dest.implied) {
            dest.implied = src.implied;
        }
        if (!dest.boolean) {
            dest.boolean = src.boolean;
        }
        if (dest.valueType !== 'expression') {
            dest.valueType = src.valueType;
        }
        return dest;
    }
    function append(tokens, value) {
        const lastIx = tokens.length - 1;
        if (typeof tokens[lastIx] === 'string' && typeof value === 'string') {
            tokens[lastIx] += value;
        }
        else {
            tokens.push(value);
        }
    }

    /**
     * Walks over each child node of given markup abbreviation AST node (not including
     * given one) and invokes `fn` on each node.
     * The `fn` callback accepts context node, list of ancestor nodes and optional
     * state object
     */
    function walk(node, fn, state) {
        const ancestors = [node];
        const callback = (ctx) => {
            fn(ctx, ancestors, state);
            ancestors.push(ctx);
            ctx.children.forEach(callback);
            ancestors.pop();
        };
        node.children.forEach(callback);
    }
    /**
     * Finds node which is the deepest for in current node or node itself.
     */
    function findDeepest(node) {
        let parent;
        while (node.children.length) {
            parent = node;
            node = node.children[node.children.length - 1];
        }
        return { parent, node };
    }
    function isNode(node) {
        return node.type === 'AbbreviationNode';
    }

    /**
     * Finds matching snippet from `registry` and resolves it into a parsed abbreviation.
     * Resolved node is then updated or replaced with matched abbreviation tree.
     *
     * A HTML registry basically contains aliases to another Emmet abbreviations,
     * e.g. a predefined set of name, attributes and so on, possibly a complex
     * abbreviation with multiple elements. So we have to get snippet, parse it
     * and recursively resolve it.
     */
    function resolveSnippets(abbr, config) {
        const stack = [];
        const reversed = config.options['output.reverseAttributes'];
        const resolve = (child) => {
            const snippet = child.name && config.snippets[child.name];
            // A snippet in stack means circular reference.
            // It can be either a user error or a perfectly valid snippet like
            // "img": "img[src alt]/", e.g. an element with predefined shape.
            // In any case, simply stop parsing and keep element as is
            if (!snippet || stack.includes(snippet)) {
                return null;
            }
            const snippetAbbr = parseAbbreviation(snippet, config);
            stack.push(snippet);
            walkResolve(snippetAbbr, resolve);
            stack.pop();
            // Add attributes from current node into every top-level node of parsed abbreviation
            for (const topNode of snippetAbbr.children) {
                if (child.attributes) {
                    const from = topNode.attributes || [];
                    const to = child.attributes || [];
                    topNode.attributes = reversed ? to.concat(from) : from.concat(to);
                }
                mergeNodes(child, topNode);
            }
            return snippetAbbr;
        };
        walkResolve(abbr, resolve);
        return abbr;
    }
    function walkResolve(node, resolve, config) {
        let children = [];
        for (const child of node.children) {
            const resolved = resolve(child);
            if (resolved) {
                children = children.concat(resolved.children);
                const deepest = findDeepest(resolved);
                if (isNode(deepest.node)) {
                    deepest.node.children = deepest.node.children.concat(walkResolve(child, resolve));
                }
            }
            else {
                children.push(child);
                child.children = walkResolve(child, resolve);
            }
        }
        return node.children = children;
    }
    /**
     * Adds data from first node into second node
     */
    function mergeNodes(from, to) {
        if (from.selfClosing) {
            to.selfClosing = true;
        }
        if (from.value != null) {
            to.value = from.value;
        }
        if (from.repeat) {
            to.repeat = from.repeat;
        }
    }

    function createOutputStream(options, level = 0) {
        return {
            options,
            value: '',
            level,
            offset: 0,
            line: 0,
            column: 0
        };
    }
    /**
     * Pushes plain string into output stream without newline processing
     */
    function push$1(stream, text) {
        const processText = stream.options['output.text'];
        _push(stream, processText(text, stream.offset, stream.line, stream.column));
    }
    /**
     * Pushes given string with possible newline formatting into output
     */
    function pushString(stream, value) {
        // If given value contains newlines, we should push content line-by-line and
        // use `pushNewline()` to maintain proper line/column state
        const lines = splitByLines(value);
        for (let i = 0, il = lines.length - 1; i <= il; i++) {
            push$1(stream, lines[i]);
            if (i !== il) {
                pushNewline(stream, true);
            }
        }
    }
    /**
     * Pushes new line into given output stream
     */
    function pushNewline(stream, indent) {
        const baseIndent = stream.options['output.baseIndent'];
        const newline = stream.options['output.newline'];
        push$1(stream, newline + baseIndent);
        stream.line++;
        stream.column = baseIndent.length;
        if (indent) {
            pushIndent(stream, indent === true ? stream.level : indent);
        }
    }
    /**
     * Adds indentation of `size` to current output stream
     */
    function pushIndent(stream, size = stream.level) {
        const indent = stream.options['output.indent'];
        push$1(stream, indent.repeat(Math.max(size, 0)));
    }
    /**
     * Pushes field/tabstop into output stream
     */
    function pushField(stream, index, placeholder) {
        const field = stream.options['output.field'];
        // NB: use `_push` instead of `push` to skip text processing
        _push(stream, field(index, placeholder, stream.offset, stream.line, stream.column));
    }
    /**
     * Returns given tag name formatted according to given config
     */
    function tagName(name, config) {
        return strCase(name, config.options['output.tagCase']);
    }
    /**
     * Returns given attribute name formatted according to given config
     */
    function attrName(name, config) {
        return strCase(name, config.options['output.attributeCase']);
    }
    /**
     * Returns character for quoting value of given attribute
     */
    function attrQuote(attr, config, isOpen) {
        if (attr.valueType === 'expression') {
            return isOpen ? '{' : '}';
        }
        return config.options['output.attributeQuotes'] === 'single' ? '\'' : '"';
    }
    /**
     * Check if given attribute is boolean
     */
    function isBooleanAttribute(attr, config) {
        return attr.boolean
            || config.options['output.booleanAttributes'].includes((attr.name || '').toLowerCase());
    }
    /**
     * Returns a token for self-closing tag, depending on current options
     */
    function selfClose(config) {
        switch (config.options['output.selfClosingStyle']) {
            case 'xhtml': return ' /';
            case 'xml': return '/';
            default: return '';
        }
    }
    /**
     * Check if given tag name belongs to inline-level element
     * @param node Parsed node or tag name
     */
    function isInline(node, config) {
        if (typeof node === 'string') {
            return config.options.inlineElements.includes(node.toLowerCase());
        }
        // inline node is a node either with inline-level name or text-only node
        return node.name ? isInline(node.name, config) : Boolean(node.value && !node.attributes);
    }
    /**
     * Splits given text by lines
     */
    function splitByLines(text) {
        return text.split(/\r\n|\r|\n/g);
    }
    /**
     * Pushes raw string into output stream without any processing
     */
    function _push(stream, text) {
        stream.value += text;
        stream.offset += text.length;
        stream.column += text.length;
    }
    function strCase(str, type) {
        if (type) {
            return type === 'upper' ? str.toUpperCase() : str.toLowerCase();
        }
        return str;
    }

    const elementMap = {
        p: 'span',
        ul: 'li',
        ol: 'li',
        table: 'tr',
        tr: 'td',
        tbody: 'tr',
        thead: 'tr',
        tfoot: 'tr',
        colgroup: 'col',
        select: 'option',
        optgroup: 'option',
        audio: 'source',
        video: 'source',
        object: 'param',
        map: 'area'
    };
    function implicitTag(node, ancestors, config) {
        if (!node.name && node.attributes) {
            resolveImplicitTag(node, ancestors, config);
        }
    }
    function resolveImplicitTag(node, ancestors, config) {
        const parent = getParentElement(ancestors);
        const contextName = config.context ? config.context.name : '';
        const parentName = lowercase(parent ? parent.name : contextName);
        node.name = elementMap[parentName]
            || (isInline(parentName, config) ? 'span' : 'div');
    }
    function lowercase(str) {
        return (str || '').toLowerCase();
    }
    /**
     * Returns closest element node from given ancestors list
     */
    function getParentElement(ancestors) {
        for (let i = ancestors.length - 1; i >= 0; i--) {
            const elem = ancestors[i];
            if (isNode(elem)) {
                return elem;
            }
        }
    }

    var latin = {
    	"common": ["lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipisicing", "elit"],
    	"words": ["exercitationem", "perferendis", "perspiciatis", "laborum", "eveniet",
    		"sunt", "iure", "nam", "nobis", "eum", "cum", "officiis", "excepturi",
    		"odio", "consectetur", "quasi", "aut", "quisquam", "vel", "eligendi",
    		"itaque", "non", "odit", "tempore", "quaerat", "dignissimos",
    		"facilis", "neque", "nihil", "expedita", "vitae", "vero", "ipsum",
    		"nisi", "animi", "cumque", "pariatur", "velit", "modi", "natus",
    		"iusto", "eaque", "sequi", "illo", "sed", "ex", "et", "voluptatibus",
    		"tempora", "veritatis", "ratione", "assumenda", "incidunt", "nostrum",
    		"placeat", "aliquid", "fuga", "provident", "praesentium", "rem",
    		"necessitatibus", "suscipit", "adipisci", "quidem", "possimus",
    		"voluptas", "debitis", "sint", "accusantium", "unde", "sapiente",
    		"voluptate", "qui", "aspernatur", "laudantium", "soluta", "amet",
    		"quo", "aliquam", "saepe", "culpa", "libero", "ipsa", "dicta",
    		"reiciendis", "nesciunt", "doloribus", "autem", "impedit", "minima",
    		"maiores", "repudiandae", "ipsam", "obcaecati", "ullam", "enim",
    		"totam", "delectus", "ducimus", "quis", "voluptates", "dolores",
    		"molestiae", "harum", "dolorem", "quia", "voluptatem", "molestias",
    		"magni", "distinctio", "omnis", "illum", "dolorum", "voluptatum", "ea",
    		"quas", "quam", "corporis", "quae", "blanditiis", "atque", "deserunt",
    		"laboriosam", "earum", "consequuntur", "hic", "cupiditate",
    		"quibusdam", "accusamus", "ut", "rerum", "error", "minus", "eius",
    		"ab", "ad", "nemo", "fugit", "officia", "at", "in", "id", "quos",
    		"reprehenderit", "numquam", "iste", "fugiat", "sit", "inventore",
    		"beatae", "repellendus", "magnam", "recusandae", "quod", "explicabo",
    		"doloremque", "aperiam", "consequatur", "asperiores", "commodi",
    		"optio", "dolor", "labore", "temporibus", "repellat", "veniam",
    		"architecto", "est", "esse", "mollitia", "nulla", "a", "similique",
    		"eos", "alias", "dolore", "tenetur", "deleniti", "porro", "facere",
    		"maxime", "corrupti"]
    };

    var ru = {
    	"common": ["далеко-далеко", "за", "словесными", "горами", "в стране", "гласных", "и согласных", "живут", "рыбные", "тексты"],
    	"words": ["вдали", "от всех", "они", "буквенных", "домах", "на берегу", "семантика",
    		"большого", "языкового", "океана", "маленький", "ручеек", "даль",
    		"журчит", "по всей", "обеспечивает", "ее","всеми", "необходимыми",
    		"правилами", "эта", "парадигматическая", "страна", "которой", "жаренные",
    		"предложения", "залетают", "прямо", "рот", "даже", "всемогущая",
    		"пунктуация", "не", "имеет", "власти", "над", "рыбными", "текстами",
    		"ведущими", "безорфографичный", "образ", "жизни", "однажды", "одна",
    		"маленькая", "строчка","рыбного", "текста", "имени", "lorem", "ipsum",
    		"решила", "выйти", "большой", "мир", "грамматики", "великий", "оксмокс",
    		"предупреждал", "о", "злых", "запятых", "диких", "знаках", "вопроса",
    		"коварных", "точках", "запятой", "но", "текст", "дал", "сбить",
    		"себя", "толку", "он", "собрал", "семь", "своих", "заглавных", "букв",
    		"подпоясал", "инициал", "за", "пояс", "пустился", "дорогу",
    		"взобравшись", "первую", "вершину", "курсивных", "гор", "бросил",
    		"последний", "взгляд", "назад", "силуэт", "своего", "родного", "города",
    		"буквоград", "заголовок", "деревни", "алфавит", "подзаголовок", "своего",
    		"переулка", "грустный", "реторический", "вопрос", "скатился", "его",
    		"щеке", "продолжил", "свой", "путь", "дороге", "встретил", "рукопись",
    		"она", "предупредила",  "моей", "все", "переписывается", "несколько",
    		"раз", "единственное", "что", "меня", "осталось", "это", "приставка",
    		"возвращайся", "ты", "лучше", "свою", "безопасную", "страну", "послушавшись",
    		"рукописи", "наш", "продолжил", "свой", "путь", "вскоре", "ему",
    		"повстречался", "коварный", "составитель", "рекламных", "текстов",
    		"напоивший", "языком", "речью", "заманивший", "свое", "агентство",
    		"которое", "использовало", "снова", "снова", "своих", "проектах",
    		"если", "переписали", "то", "живет", "там", "до", "сих", "пор"]
    };

    var sp = {
    	"common": ["mujer", "uno", "dolor", "más", "de", "poder", "mismo", "si"],
    	"words": ["ejercicio", "preferencia", "perspicacia", "laboral", "paño",
    		"suntuoso", "molde", "namibia", "planeador", "mirar", "demás", "oficinista", "excepción",
    		"odio", "consecuencia", "casi", "auto", "chicharra", "velo", "elixir",
    		"ataque", "no", "odio", "temporal", "cuórum", "dignísimo",
    		"facilismo", "letra", "nihilista", "expedición", "alma", "alveolar", "aparte",
    		"león", "animal", "como", "paria", "belleza", "modo", "natividad",
    		"justo", "ataque", "séquito", "pillo", "sed", "ex", "y", "voluminoso",
    		"temporalidad", "verdades", "racional", "asunción", "incidente", "marejada",
    		"placenta", "amanecer", "fuga", "previsor", "presentación", "lejos",
    		"necesariamente", "sospechoso", "adiposidad", "quindío", "pócima",
    		"voluble", "débito", "sintió", "accesorio", "falda", "sapiencia",
    		"volutas", "queso", "permacultura", "laudo", "soluciones", "entero",
    		"pan", "litro", "tonelada", "culpa", "libertario", "mosca", "dictado",
    		"reincidente", "nascimiento", "dolor", "escolar", "impedimento", "mínima",
    		"mayores", "repugnante", "dulce", "obcecado", "montaña", "enigma",
    		"total", "deletéreo", "décima", "cábala", "fotografía", "dolores",
    		"molesto", "olvido", "paciencia", "resiliencia", "voluntad", "molestias",
    		"magnífico", "distinción", "ovni", "marejada", "cerro", "torre", "y",
    		"abogada", "manantial", "corporal", "agua", "crepúsculo", "ataque", "desierto",
    		"laboriosamente", "angustia", "afortunado", "alma", "encefalograma",
    		"materialidad", "cosas", "o", "renuncia", "error", "menos", "conejo",
    		"abadía", "analfabeto", "remo", "fugacidad", "oficio", "en", "almácigo", "vos", "pan",
    		"represión", "números", "triste", "refugiado", "trote", "inventor",
    		"corchea", "repelente", "magma", "recusado", "patrón", "explícito",
    		"paloma", "síndrome", "inmune", "autoinmune", "comodidad",
    		"ley", "vietnamita", "demonio", "tasmania", "repeler", "apéndice",
    		"arquitecto", "columna", "yugo", "computador", "mula", "a", "propósito",
    		"fantasía", "alias", "rayo", "tenedor", "deleznable", "ventana", "cara",
    		"anemia", "corrupto"]
    };

    const vocabularies = { ru, sp, latin };
    const reLorem = /^lorem([a-z]*)(\d*)(-\d*)?$/i;
    function lorem(node, ancestors, config) {
        let m;
        if (node.name && (m = node.name.match(reLorem))) {
            const db = vocabularies[m[1]] || vocabularies.latin;
            const minWordCount = m[2] ? Math.max(1, Number(m[2])) : 30;
            const maxWordCount = m[3] ? Math.max(minWordCount, Number(m[3].slice(1))) : minWordCount;
            const wordCount = rand(minWordCount, maxWordCount);
            const repeat = node.repeat || findRepeater(ancestors);
            node.name = node.attributes = void 0;
            node.value = [paragraph(db, wordCount, !repeat || repeat.value === 0)];
            if (node.repeat && ancestors.length > 1) {
                resolveImplicitTag(node, ancestors, config);
            }
        }
    }
    /**
     * Returns random integer between <code>from</code> and <code>to</code> values
     */
    function rand(from, to) {
        return Math.floor(Math.random() * (to - from) + from);
    }
    function sample(arr, count) {
        const len = arr.length;
        const iterations = Math.min(len, count);
        const result = [];
        while (result.length < iterations) {
            const str = arr[rand(0, len)];
            if (!result.includes(str)) {
                result.push(str);
            }
        }
        return result;
    }
    function choice(val) {
        return val[rand(0, val.length - 1)];
    }
    function sentence(words, end) {
        if (words.length) {
            words = [capitalize(words[0])].concat(words.slice(1));
        }
        return words.join(' ') + (end || choice('?!...')); // more dots than question marks
    }
    function capitalize(word) {
        return word[0].toUpperCase() + word.slice(1);
    }
    /**
     * Insert commas at randomly selected words. This function modifies values
     * inside `words` array
     */
    function insertCommas(words) {
        if (words.length < 2) {
            return words;
        }
        words = words.slice();
        const len = words.length;
        const hasComma = /,$/;
        let totalCommas = 0;
        if (len > 3 && len <= 6) {
            totalCommas = rand(0, 1);
        }
        else if (len > 6 && len <= 12) {
            totalCommas = rand(0, 2);
        }
        else {
            totalCommas = rand(1, 4);
        }
        for (let i = 0, pos; i < totalCommas; i++) {
            pos = rand(0, len - 2);
            if (!hasComma.test(words[pos])) {
                words[pos] += ',';
            }
        }
        return words;
    }
    /**
     * Generate a paragraph of "Lorem ipsum" text
     * @param dict Words dictionary
     * @param wordCount Words count in paragraph
     * @param startWithCommon Should paragraph start with common "lorem ipsum" sentence.
     */
    function paragraph(dict, wordCount, startWithCommon) {
        const result = [];
        let totalWords = 0;
        let words;
        if (startWithCommon && dict.common) {
            words = dict.common.slice(0, wordCount);
            totalWords += words.length;
            result.push(sentence(insertCommas(words), '.'));
        }
        while (totalWords < wordCount) {
            words = sample(dict.words, Math.min(rand(2, 30), wordCount - totalWords));
            totalWords += words.length;
            result.push(sentence(insertCommas(words)));
        }
        return result.join(' ');
    }
    function findRepeater(ancestors) {
        for (let i = ancestors.length - 1; i >= 0; i--) {
            const element = ancestors[i];
            if (element.type === 'AbbreviationNode' && element.repeat) {
                return element.repeat;
            }
        }
    }

    /**
     * JSX transformer: replaces `class` and `for` attributes with `className` and
     * `htmlFor` attributes respectively
     */
    function jsx(node) {
        if (node.attributes) {
            node.attributes.forEach(rename);
        }
    }
    function rename(attr) {
        if (attr.name === 'class') {
            attr.name = 'className';
        }
        else if (attr.name === 'for') {
            attr.name = 'htmlFor';
        }
    }

    /**
     * XSL transformer: removes `select` attributes from certain nodes that contain
     * children
     */
    function xsl(node) {
        if (matchesName(node.name) && node.attributes && (node.children.length || node.value)) {
            node.attributes = node.attributes.filter(isAllowed);
        }
    }
    function isAllowed(attr) {
        return attr.name !== 'select';
    }
    function matchesName(name) {
        return name === 'xsl:variable' || name === 'xsl:with-param';
    }

    const reElement = /^(-+)([a-z0-9]+[a-z0-9-]*)/i;
    const reModifier = /^(_+)([a-z0-9]+[a-z0-9-_]*)/i;
    const blockCandidates1 = (className) => /^[a-z]\-/i.test(className);
    const blockCandidates2 = (className) => /^[a-z]/i.test(className);
    function bem(node, ancestors, config) {
        expandClassNames(node);
        expandShortNotation(node, ancestors, config);
    }
    /**
     * Expands existing class names in BEM notation in given `node`.
     * For example, if node contains `b__el_mod` class name, this method ensures
     * that element contains `b__el` class as well
     */
    function expandClassNames(node) {
        const data = getBEMData(node);
        const classNames = [];
        for (const cl of data.classNames) {
            // remove all modifiers and element prefixes from class name to get a base element name
            const ix = cl.indexOf('_');
            if (ix > 0 && !cl.startsWith('-')) {
                classNames.push(cl.slice(0, ix));
                classNames.push(cl.slice(ix));
            }
            else {
                classNames.push(cl);
            }
        }
        if (classNames.length) {
            data.classNames = classNames.filter(uniqueClass);
            data.block = findBlockName(data.classNames);
            updateClass(node, data.classNames.join(' '));
        }
    }
    /**
     * Expands short BEM notation, e.g. `-element` and `_modifier`
     */
    function expandShortNotation(node, ancestors, config) {
        const data = getBEMData(node);
        const classNames = [];
        const { options } = config;
        const path = ancestors.slice(1).concat(node);
        for (let cl of data.classNames) {
            let prefix = '';
            let m;
            const originalClass = cl;
            // parse element definition (could be only one)
            if (m = cl.match(reElement)) {
                prefix = getBlockName(path, m[1].length, config.context) + options['bem.element'] + m[2];
                classNames.push(prefix);
                cl = cl.slice(m[0].length);
            }
            // parse modifiers definitions
            if (m = cl.match(reModifier)) {
                if (!prefix) {
                    prefix = getBlockName(path, m[1].length);
                    classNames.push(prefix);
                }
                classNames.push(`${prefix}${options['bem.modifier']}${m[2]}`);
                cl = cl.slice(m[0].length);
            }
            if (cl === originalClass) {
                // class name wasn’t modified: it’s not a BEM-specific class,
                // add it as-is into output
                classNames.push(originalClass);
            }
        }
        const arrClassNames = classNames.filter(uniqueClass);
        if (arrClassNames.length) {
            updateClass(node, arrClassNames.join(' '));
        }
    }
    /**
     * Returns BEM data from given abbreviation node
     */
    function getBEMData(node) {
        if (!node._bem) {
            let classValue = '';
            if (node.attributes) {
                for (const attr of node.attributes) {
                    if (attr.name === 'class' && attr.value) {
                        classValue = stringifyValue$1(attr.value);
                        break;
                    }
                }
            }
            node._bem = parseBEM(classValue);
        }
        return node._bem;
    }
    function getBEMDataFromContext(context) {
        if (!context._bem) {
            context._bem = parseBEM(context.attributes && context.attributes.class || '');
        }
        return context._bem;
    }
    /**
     * Parses BEM data from given class name
     */
    function parseBEM(classValue) {
        const classNames = classValue ? classValue.split(/\s+/) : [];
        return {
            classNames,
            block: findBlockName(classNames)
        };
    }
    /**
     * Returns block name for given `node` by `prefix`, which tells the depth of
     * of parent node lookup
     */
    function getBlockName(ancestors, depth = 0, context) {
        const maxParentIx = 0;
        let parentIx = Math.max(ancestors.length - depth, maxParentIx);
        do {
            const parent = ancestors[parentIx];
            if (parent) {
                const data = getBEMData(parent);
                if (data.block) {
                    return data.block;
                }
            }
        } while (maxParentIx < parentIx--);
        if (context) {
            const data = getBEMDataFromContext(context);
            if (data.block) {
                return data.block;
            }
        }
        return '';
    }
    function findBlockName(classNames) {
        return find(classNames, blockCandidates1)
            || find(classNames, blockCandidates2)
            || void 0;
    }
    /**
     * Finds class name from given list which may be used as block name
     */
    function find(classNames, filter) {
        for (const cl of classNames) {
            if (reElement.test(cl) || reModifier.test(cl)) {
                break;
            }
            if (filter(cl)) {
                return cl;
            }
        }
    }
    function updateClass(node, value) {
        for (const attr of node.attributes) {
            if (attr.name === 'class') {
                attr.value = [value];
                break;
            }
        }
    }
    function stringifyValue$1(value) {
        let result = '';
        for (const t of value) {
            result += typeof t === 'string' ? t : t.name;
        }
        return result;
    }
    function uniqueClass(item, ix, arr) {
        return !!item && arr.indexOf(item) === ix;
    }

    function walk$1(abbr, visitor, state) {
        const callback = (ctx, index, items) => {
            const { parent, current } = state;
            state.parent = current;
            state.current = ctx;
            visitor(ctx, index, items, state, next);
            state.current = current;
            state.parent = parent;
        };
        const next = (node, index, items) => {
            state.ancestors.push(state.current);
            callback(node, index, items);
            state.ancestors.pop();
        };
        abbr.children.forEach(callback);
    }
    function createWalkState(config) {
        return {
            // @ts-ignore: Will set value in iterator
            current: null,
            parent: void 0,
            ancestors: [],
            config,
            field: 1,
            out: createOutputStream(config.options)
        };
    }

    const caret = [{ type: 'Field', index: 0, name: '' }];
    /**
     * Check if given node is a snippet: a node without name and attributes
     */
    function isSnippet(node) {
        return node ? !node.name && !node.attributes : false;
    }
    /**
     * Check if given node is inline-level element, e.g. element with explicitly
     * defined node name
     */
    function isInlineElement(node, config) {
        return node ? isInline(node, config) : false;
    }
    /**
     * Check if given value token is a field
     */
    function isField$1(token) {
        return typeof token === 'object' && token.type === 'Field';
    }
    function pushTokens(tokens, state) {
        const { out } = state;
        let largestIndex = -1;
        for (const t of tokens) {
            if (typeof t === 'string') {
                pushString(out, t);
            }
            else {
                pushField(out, state.field + t.index, t.name);
                if (t.index > largestIndex) {
                    largestIndex = t.index;
                }
            }
        }
        if (largestIndex !== -1) {
            state.field += largestIndex + 1;
        }
    }
    /**
     * Splits given value token by lines: returns array where each entry is a token list
     * for a single line
     */
    function splitByLines$1(tokens) {
        const result = [];
        let line = [];
        for (const t of tokens) {
            if (typeof t === 'string') {
                const lines = t.split(/\r\n?|\n/g);
                line.push(lines.shift() || '');
                while (lines.length) {
                    result.push(line);
                    line = [lines.shift() || ''];
                }
            }
            else {
                line.push(t);
            }
        }
        line.length && result.push(line);
        return result;
    }
    /**
     * Check if given attribute should be outputted
     */
    function shouldOutputAttribute(attr) {
        // In case if attribute is implied, check if it has a defined value:
        // either non-empty value or quoted empty value
        return !attr.implied || attr.valueType !== 'raw' || (!!attr.value && attr.value.length > 0);
    }

    /**
     * Splits given string into template tokens.
     * Template is a string which contains placeholders which are uppercase names
     * between `[` and `]`, for example: `[PLACEHOLDER]`.
     * Unlike other templates, a placeholder may contain extra characters before and
     * after name: `[%PLACEHOLDER.]`. If data for `PLACEHOLDER` is defined, it will
     * be outputted with with these extra character, otherwise will be completely omitted.
     */
    function template(text) {
        const tokens = [];
        const scanner = { pos: 0, text };
        let placeholder;
        let offset = scanner.pos;
        let pos = scanner.pos;
        while (scanner.pos < scanner.text.length) {
            pos = scanner.pos;
            if (placeholder = consumePlaceholder$2(scanner)) {
                if (offset !== scanner.pos) {
                    tokens.push(text.slice(offset, pos));
                }
                tokens.push(placeholder);
                offset = scanner.pos;
            }
            else {
                scanner.pos++;
            }
        }
        if (offset !== scanner.pos) {
            tokens.push(text.slice(offset));
        }
        return tokens;
    }
    /**
     * Consumes placeholder like `[#ID]` from given scanner
     */
    function consumePlaceholder$2(scanner) {
        if (peek$2(scanner) === 91 /* Start */) {
            const start = ++scanner.pos;
            let namePos = start;
            let afterPos = start;
            let stack = 1;
            while (scanner.pos < scanner.text.length) {
                const code = peek$2(scanner);
                if (isTokenStart(code)) {
                    namePos = scanner.pos;
                    while (isToken(peek$2(scanner))) {
                        scanner.pos++;
                    }
                    afterPos = scanner.pos;
                }
                else {
                    if (code === 91 /* Start */) {
                        stack++;
                    }
                    else if (code === 93 /* End */) {
                        if (--stack === 0) {
                            return {
                                before: scanner.text.slice(start, namePos),
                                after: scanner.text.slice(afterPos, scanner.pos++),
                                name: scanner.text.slice(namePos, afterPos)
                            };
                        }
                    }
                    scanner.pos++;
                }
            }
        }
    }
    function peek$2(scanner, pos = scanner.pos) {
        return scanner.text.charCodeAt(pos);
    }
    function isTokenStart(code) {
        return code >= 65 && code <= 90; // A-Z
    }
    function isToken(code) {
        return isTokenStart(code)
            || (code > 47 && code < 58) /* 0-9 */
            || code === 95 /* Underscore */
            || code === 45 /* Dash */;
    }

    function createCommentState(config) {
        const { options } = config;
        return {
            enabled: options['comment.enabled'],
            trigger: options['comment.trigger'],
            before: options['comment.before'] ? template(options['comment.before']) : void 0,
            after: options['comment.after'] ? template(options['comment.after']) : void 0
        };
    }
    /**
     * Adds comment prefix for given node, if required
     */
    function commentNodeBefore(node, state) {
        if (shouldComment(node, state) && state.comment.before) {
            output(node, state.comment.before, state);
        }
    }
    /**
     * Adds comment suffix for given node, if required
     */
    function commentNodeAfter(node, state) {
        if (shouldComment(node, state) && state.comment.after) {
            output(node, state.comment.after, state);
        }
    }
    /**
     * Check if given node should be commented
     */
    function shouldComment(node, state) {
        const { comment } = state;
        if (!comment.enabled || !comment.trigger || !node.name || !node.attributes) {
            return false;
        }
        for (const attr of node.attributes) {
            if (attr.name && comment.trigger.includes(attr.name)) {
                return true;
            }
        }
        return false;
    }
    /**
     * Pushes given template tokens into output stream
     */
    function output(node, tokens, state) {
        const attrs = {};
        const { out } = state;
        // Collect attributes payload
        for (const attr of node.attributes) {
            if (attr.name && attr.value) {
                attrs[attr.name.toUpperCase()] = attr.value;
            }
        }
        // Output parsed tokens
        for (const token of tokens) {
            if (typeof token === 'string') {
                pushString(out, token);
            }
            else if (attrs[token.name]) {
                pushString(out, token.before);
                pushTokens(attrs[token.name], state);
                pushString(out, token.after);
            }
        }
    }

    function html(abbr, config) {
        const state = createWalkState(config);
        state.comment = createCommentState(config);
        walk$1(abbr, element$1, state);
        return state.out.value;
    }
    /**
     * Outputs `node` content to output stream of `state`
     * @param node Context node
     * @param index Index of `node` in `items`
     * @param items List of `node`’s siblings
     * @param state Current walk state
     */
    function element$1(node, index, items, state, next) {
        const { out, config } = state;
        const format = shouldFormat(node, index, items, state);
        // Pick offset level for current node
        const level = getIndent(state);
        out.level += level;
        format && pushNewline(out, true);
        if (node.name) {
            const name = tagName(node.name, config);
            commentNodeBefore(node, state);
            pushString(out, `<${name}`);
            if (node.attributes) {
                for (const attr of node.attributes) {
                    if (shouldOutputAttribute(attr)) {
                        pushAttribute(attr, state);
                    }
                }
            }
            if (node.selfClosing && !node.children.length && !node.value) {
                pushString(out, `${selfClose(config)}>`);
            }
            else {
                pushString(out, '>');
                if (!pushSnippet(node, state, next)) {
                    if (node.value) {
                        const innerFormat = node.value.some(hasNewline);
                        innerFormat && pushNewline(state.out, ++out.level);
                        pushTokens(node.value, state);
                        innerFormat && pushNewline(state.out, --out.level);
                    }
                    node.children.forEach(next);
                    if (!node.value && !node.children.length) {
                        const innerFormat = config.options['output.formatLeafNode']
                            || config.options['output.formatForce'].includes(node.name);
                        innerFormat && pushNewline(state.out, ++out.level);
                        pushTokens(caret, state);
                        innerFormat && pushNewline(state.out, --out.level);
                    }
                }
                pushString(out, `</${name}>`);
                commentNodeAfter(node, state);
            }
        }
        else if (!pushSnippet(node, state, next) && node.value) {
            // A text-only node (snippet)
            pushTokens(node.value, state);
            node.children.forEach(next);
        }
        if (format && index === items.length - 1 && state.parent) {
            const offset = isSnippet(state.parent) ? 0 : 1;
            pushNewline(out, out.level - offset);
        }
        out.level -= level;
    }
    /**
     * Outputs given attribute’s content into output stream
     */
    function pushAttribute(attr, state) {
        const { out, config } = state;
        if (attr.name) {
            const name = attrName(attr.name, config);
            const lQuote = attrQuote(attr, config, true);
            const rQuote = attrQuote(attr, config);
            let value = attr.value;
            if (isBooleanAttribute(attr, config) && !value) {
                // If attribute value is omitted and it’s a boolean value, check for
                // `compactBoolean` option: if it’s disabled, set value to attribute name
                // (XML style)
                if (!config.options['output.compactBoolean']) {
                    value = [name];
                }
            }
            else if (!value) {
                value = caret;
            }
            pushString(out, ' ' + name);
            if (value) {
                pushString(out, '=' + lQuote);
                pushTokens(value, state);
                pushString(out, rQuote);
            }
            else if (config.options['output.selfClosingStyle'] !== 'html') {
                pushString(out, '=' + lQuote + rQuote);
            }
        }
    }
    function pushSnippet(node, state, next) {
        if (node.value && node.children.length) {
            // We have a value and child nodes. In case if value contains fields,
            // we should output children as a content of first field
            const fieldIx = node.value.findIndex(isField$1);
            if (fieldIx !== -1) {
                pushTokens(node.value.slice(0, fieldIx), state);
                const line = state.out.line;
                let pos = fieldIx + 1;
                node.children.forEach(next);
                // If there was a line change, trim leading whitespace for better result
                if (state.out.line !== line && typeof node.value[pos] === 'string') {
                    pushString(state.out, node.value[pos++].trimLeft());
                }
                pushTokens(node.value.slice(pos), state);
                return true;
            }
        }
        return false;
    }
    /**
     * Check if given node should be formatted in its parent context
     */
    function shouldFormat(node, index, items, state) {
        const { config, parent } = state;
        if (!config.options['output.format']) {
            return false;
        }
        if (index === 0 && !parent) {
            // Do not format very first node
            return false;
        }
        // Do not format single child of snippet
        if (parent && isSnippet(parent) && items.length === 1) {
            return false;
        }
        /**
         * Adjacent text-only/snippet nodes
         */
        if (isSnippet(node)) {
            // Adjacent text-only/snippet nodes
            const format = isSnippet(items[index - 1]) || isSnippet(items[index + 1])
                // Has newlines: looks like wrapping code fragment
                || node.value.some(hasNewline)
                // Format as wrapper: contains children which will be outputted as field content
                || (node.value.some(isField$1) && node.children.length);
            if (format) {
                return true;
            }
        }
        if (isInline(node, config)) {
            // Check if inline node is the next sibling of block-level node
            if (index === 0) {
                // First node in parent: format if it’s followed by a block-level element
                for (let i = 0; i < items.length; i++) {
                    if (!isInline(items[i], config)) {
                        return true;
                    }
                }
            }
            else if (!isInline(items[index - 1], config)) {
                // Node is right after block-level element
                return true;
            }
            if (config.options['output.inlineBreak']) {
                // check for adjacent inline elements before and after current element
                let adjacentInline = 1;
                let before = index;
                let after = index;
                while (isInlineElement(items[--before], config)) {
                    adjacentInline++;
                }
                while (isInlineElement(items[++after], config)) {
                    adjacentInline++;
                }
                if (adjacentInline >= config.options['output.inlineBreak']) {
                    return true;
                }
            }
            // Edge case: inline node contains node that should receive formatting
            for (let i = 0, il = node.children.length; i < il; i++) {
                if (shouldFormat(node.children[i], i, node.children, state)) {
                    return true;
                }
            }
            return false;
        }
        return true;
    }
    /**
     * Returns indentation offset for given node
     */
    function getIndent(state) {
        const { config, parent } = state;
        if (!parent || isSnippet(parent) || (parent.name && config.options['output.formatSkip'].includes(parent.name))) {
            return 0;
        }
        return 1;
    }
    /**
     * Check if given node value contains newlines
     */
    function hasNewline(value) {
        return typeof value === 'string' && /\r|\n/.test(value);
    }

    function indentFormat(abbr, config, options) {
        const state = createWalkState(config);
        state.options = options || {};
        walk$1(abbr, element$1$1, state);
        return state.out.value;
    }
    /**
     * Outputs `node` content to output stream of `state`
     * @param node Context node
     * @param index Index of `node` in `items`
     * @param items List of `node`’s siblings
     * @param state Current walk state
     */
    function element$1$1(node, index, items, state, next) {
        const { out, options } = state;
        const { primary, secondary } = collectAttributes(node);
        // Pick offset level for current node
        const level = state.parent ? 1 : 0;
        out.level += level;
        // Do not indent top-level elements
        if (shouldFormat$1(node, index, items, state)) {
            pushNewline(out, true);
        }
        if (node.name && (node.name !== 'div' || !primary.length)) {
            pushString(out, (options.beforeName || '') + node.name + (options.afterName || ''));
        }
        pushPrimaryAttributes(primary, state);
        pushSecondaryAttributes(secondary.filter(shouldOutputAttribute), state);
        if (node.selfClosing && !node.value && !node.children.length) {
            if (state.options.selfClose) {
                pushString(out, state.options.selfClose);
            }
        }
        else {
            pushValue(node, state);
            node.children.forEach(next);
        }
        out.level -= level;
    }
    /**
     * From given node, collects all attributes as `primary` (id, class) and
     * `secondary` (all the rest) lists. In most indent-based syntaxes, primary attribute
     * has special syntax
     */
    function collectAttributes(node) {
        const primary = [];
        const secondary = [];
        if (node.attributes) {
            for (const attr of node.attributes) {
                if (isPrimaryAttribute(attr)) {
                    primary.push(attr);
                }
                else {
                    secondary.push(attr);
                }
            }
        }
        return { primary, secondary };
    }
    /**
     * Outputs given attributes as primary into output stream
     */
    function pushPrimaryAttributes(attrs, state) {
        for (const attr of attrs) {
            if (attr.value) {
                if (attr.name === 'class') {
                    pushString(state.out, '.');
                    // All whitespace characters must be replaced with dots in class names
                    const tokens = attr.value.map(t => typeof t === 'string' ? t.replace(/\s+/g, '.') : t);
                    pushTokens(tokens, state);
                }
                else {
                    // ID attribute
                    pushString(state.out, '#');
                    pushTokens(attr.value, state);
                }
            }
        }
    }
    /**
     * Outputs given attributes as secondary into output stream
     */
    function pushSecondaryAttributes(attrs, state) {
        if (attrs.length) {
            const { out, config, options } = state;
            options.beforeAttribute && pushString(out, options.beforeAttribute);
            for (let i = 0; i < attrs.length; i++) {
                const attr = attrs[i];
                pushString(out, attrName(attr.name || '', config));
                if (isBooleanAttribute(attr, config) && !attr.value) {
                    if (!config.options['output.compactBoolean'] && options.booleanValue) {
                        pushString(out, '=' + options.booleanValue);
                    }
                }
                else {
                    pushString(out, '=' + attrQuote(attr, config, true));
                    pushTokens(attr.value || caret, state);
                    pushString(out, attrQuote(attr, config));
                }
                if (i !== attrs.length - 1 && options.glueAttribute) {
                    pushString(out, options.glueAttribute);
                }
            }
            options.afterAttribute && pushString(out, options.afterAttribute);
        }
    }
    /**
     * Outputs given node value into state output stream
     */
    function pushValue(node, state) {
        // We should either output value or add caret but for leaf nodes only (no children)
        if (!node.value && node.children.length) {
            return;
        }
        const value = node.value || caret;
        const lines = splitByLines$1(value);
        const { out, options } = state;
        if (lines.length === 1) {
            if (node.name || node.attributes) {
                push$1(out, ' ');
            }
            pushTokens(value, state);
        }
        else {
            // We should format multi-line value with terminating `|` character
            // and same line length
            const lineLengths = [];
            let maxLength = 0;
            // Calculate lengths of all lines and max line length
            for (const line of lines) {
                const len = valueLength(line);
                lineLengths.push(len);
                if (len > maxLength) {
                    maxLength = len;
                }
            }
            // Output each line, padded to max length
            out.level++;
            for (let i = 0; i < lines.length; i++) {
                pushNewline(out, true);
                options.beforeTextLine && push$1(out, options.beforeTextLine);
                pushTokens(lines[i], state);
                if (options.afterTextLine) {
                    push$1(out, ' '.repeat(maxLength - lineLengths[i]));
                    push$1(out, options.afterTextLine);
                }
            }
            out.level--;
        }
    }
    function isPrimaryAttribute(attr) {
        return attr.name === 'class' || attr.name === 'id';
    }
    /**
     * Calculates string length from given tokens
     */
    function valueLength(tokens) {
        let len = 0;
        for (const token of tokens) {
            len += typeof token === 'string' ? token.length : token.name.length;
        }
        return len;
    }
    function shouldFormat$1(node, index, items, state) {
        // Do not format first top-level element or snippets
        if (!state.parent && index === 0) {
            return false;
        }
        return !isSnippet(node);
    }

    function haml(abbr, config) {
        return indentFormat(abbr, config, {
            beforeName: '%',
            beforeAttribute: '(',
            afterAttribute: ')',
            glueAttribute: ' ',
            afterTextLine: ' |',
            booleanValue: 'true',
            selfClose: '/'
        });
    }

    function slim(abbr, config) {
        return indentFormat(abbr, config, {
            beforeAttribute: ' ',
            glueAttribute: ' ',
            beforeTextLine: '| ',
            selfClose: '/'
        });
    }

    function pug(abbr, config) {
        return indentFormat(abbr, config, {
            beforeAttribute: '(',
            afterAttribute: ')',
            glueAttribute: ', ',
            beforeTextLine: '| ',
            selfClose: config.options['output.selfClosingStyle'] === 'xml' ? '/' : ''
        });
    }

    const formatters = { html, haml, slim, pug };
    /**
     * Parses given Emmet abbreviation into a final abbreviation tree with all
     * required transformations applied
     */
    function parse$1(abbr, config) {
        if (typeof abbr === 'string') {
            let parseOpt = config;
            if (config.options['jsx.enabled']) {
                parseOpt = Object.assign(Object.assign({}, parseOpt), { jsx: true });
            }
            abbr = parseAbbreviation(abbr, parseOpt);
        }
        // Run abbreviation resolve in two passes:
        // 1. Map each node to snippets, which are abbreviations as well. A single snippet
        // may produce multiple nodes
        // 2. Transform every resolved node
        abbr = resolveSnippets(abbr, config);
        walk(abbr, transform, config);
        return abbr;
    }
    /**
     * Converts given abbreviation to string according to provided `config`
     */
    function stringify$1(abbr, config) {
        const formatter = formatters[config.syntax] || html;
        return formatter(abbr, config);
    }
    /**
     * Modifies given node and prepares it for output
     */
    function transform(node, ancestors, config) {
        implicitTag(node, ancestors, config);
        mergeAttributes(node, config);
        lorem(node, ancestors, config);
        if (config.syntax === 'xsl') {
            xsl(node);
        }
        if (config.options['jsx.enabled']) {
            jsx(node);
        }
        if (config.options['bem.enabled']) {
            bem(node, ancestors, config);
        }
    }

    const reProperty = /^([a-z-]+)(?:\s*:\s*([^\n\r;]+?);*)?$/;
    const opt$1 = { value: true };
    /**
     * Creates structure for holding resolved CSS snippet
     */
    function createSnippet(key, value) {
        // A snippet could be a raw text snippet (e.g. arbitrary text string) or a
        // CSS property with possible values separated by `|`.
        // In latter case, we have to parse snippet as CSS abbreviation
        const m = value.match(reProperty);
        if (m) {
            const keywords = {};
            const parsed = m[2] ? m[2].split('|').map(parseValue) : [];
            for (const item of parsed) {
                for (const cssVal of item) {
                    collectKeywords(cssVal, keywords);
                }
            }
            return {
                type: "Property" /* Property */,
                key,
                property: m[1],
                value: parsed,
                keywords,
                dependencies: []
            };
        }
        return { type: "Raw" /* Raw */, key, value };
    }
    /**
     * Nests more specific CSS properties into shorthand ones, e.g.
     * `background-position-x` -> `background-position` -> `background`
     */
    function nest(snippets) {
        snippets = snippets.slice().sort(snippetsSort);
        const stack = [];
        let prev;
        // For sorted list of CSS properties, create dependency graph where each
        // shorthand property contains its more specific one, e.g.
        // background -> background-position -> background-position-x
        for (const cur of snippets.filter(isProperty)) {
            // Check if current property belongs to one from parent stack.
            // Since `snippets` array is sorted, items are perfectly aligned
            // from shorthands to more specific variants
            while (stack.length) {
                prev = stack[stack.length - 1];
                if (cur.property.startsWith(prev.property)
                    && cur.property.charCodeAt(prev.property.length) === 45 /* - */) {
                    prev.dependencies.push(cur);
                    stack.push(cur);
                    break;
                }
                stack.pop();
            }
            if (!stack.length) {
                stack.push(cur);
            }
        }
        return snippets;
    }
    /**
     * A sorting function for array of snippets
     */
    function snippetsSort(a, b) {
        if (a.key === b.key) {
            return 0;
        }
        return a.key < b.key ? -1 : 1;
    }
    function parseValue(value) {
        return parse(value.trim(), opt$1)[0].value;
    }
    function isProperty(snippet) {
        return snippet.type === "Property" /* Property */;
    }
    function collectKeywords(cssVal, dest) {
        for (const v of cssVal.value) {
            if (v.type === 'Literal') {
                dest[v.value] = v;
            }
            else if (v.type === 'FunctionCall') {
                dest[v.name] = v;
            }
            else if (v.type === 'Field') {
                // Create literal from field, if available
                const value = v.name.trim();
                if (value) {
                    dest[value] = { type: 'Literal', value };
                }
            }
        }
    }

    /**
     * Calculates how close `str1` matches `str2` using fuzzy match.
     * How matching works:
     * – first characters of both `str1` and `str2` *must* match
     * – `str1` length larger than `str2` length is allowed only when `unmatched` is true
     * – ideal match is when `str1` equals to `str2` (score: 1)
     * – next best match is `str2` starts with `str1` (score: 1 × percent of matched characters)
     * – other scores depend on how close characters of `str1` to the beginning of `str2`
     * @param partialMatch Allow length `str1` to be greater than `str2` length
     */
    function scoreMatch(str1, str2, partialMatch = false) {
        str1 = str1.toLowerCase();
        str2 = str2.toLowerCase();
        if (str1 === str2) {
            return 1;
        }
        // Both strings MUST start with the same character
        if (!str1 || !str2 || str1.charCodeAt(0) !== str2.charCodeAt(0)) {
            return 0;
        }
        const str1Len = str1.length;
        const str2Len = str2.length;
        if (!partialMatch && str1Len > str2Len) {
            return 0;
        }
        // Characters from `str1` which are closer to the beginning of a `str2` should
        // have higher score.
        // For example, if `str2` is `abcde`, it’s max score is:
        // 5 + 4 + 3 + 2 + 1 = 15 (sum of character positions in reverse order)
        // Matching `abd` against `abcde` should produce:
        // 5 + 4 + 2 = 11
        // Acronym bonus for match right after `-`. Matching `abd` against `abc-de`
        // should produce:
        // 6 + 5 + 4 (use `d` position in `abd`, not in abc-de`)
        const minLength = Math.min(str1Len, str2Len);
        const maxLength = Math.max(str1Len, str2Len);
        let i = 1;
        let j = 1;
        let score = maxLength;
        let ch1 = 0;
        let ch2 = 0;
        let found = false;
        let acronym = false;
        while (i < str1Len) {
            ch1 = str1.charCodeAt(i);
            found = false;
            acronym = false;
            while (j < str2Len) {
                ch2 = str2.charCodeAt(j);
                if (ch1 === ch2) {
                    found = true;
                    score += maxLength - (acronym ? i : j);
                    break;
                }
                // add acronym bonus for exactly next match after unmatched `-`
                acronym = ch2 === 45 /* - */;
                j++;
            }
            if (!found) {
                if (!partialMatch) {
                    return 0;
                }
                break;
            }
            i++;
        }
        const matchRatio = i / maxLength;
        const delta = maxLength - minLength;
        const maxScore = sum(maxLength) - sum(delta);
        return (score * matchRatio) / maxScore;
    }
    /**
     * Calculates sum of first `n` numbers, e.g. 1+2+3+...n
     */
    function sum(n) {
        return n * (n + 1) / 2;
    }

    function color(token, shortHex) {
        if (!token.r && !token.g && !token.b && !token.a) {
            return 'transparent';
        }
        else if (token.a === 1) {
            return asHex(token, shortHex);
        }
        return asRGB(token);
    }
    /**
     * Output given color as hex value
     * @param short Produce short value (e.g. #fff instead of #ffffff), if possible
     */
    function asHex(token, short) {
        const fn = (short && isShortHex(token.r) && isShortHex(token.g) && isShortHex(token.b))
            ? toShortHex : toHex;
        return '#' + fn(token.r) + fn(token.g) + fn(token.b);
    }
    /**
     * Output current color as `rgba?(...)` CSS color
     */
    function asRGB(token) {
        const values = [token.r, token.g, token.b];
        if (token.a !== 1) {
            values.push(frac(token.a, 8));
        }
        return `${values.length === 3 ? 'rgb' : 'rgba'}(${values.join(', ')})`;
    }
    function frac(num, digits = 4) {
        return num.toFixed(digits).replace(/\.?0+$/, '');
    }
    function isShortHex(hex) {
        return !(hex % 17);
    }
    function toShortHex(num) {
        return (num >> 4).toString(16);
    }
    function toHex(num) {
        return pad(num.toString(16), 2);
    }
    function pad(value, len) {
        while (value.length < len) {
            value = '0' + value;
        }
        return value;
    }

    function css(abbr, config) {
        const out = createOutputStream(config.options);
        const format = config.options['output.format'];
        for (let i = 0; i < abbr.length; i++) {
            if (format && i !== 0) {
                pushNewline(out, true);
            }
            property(abbr[i], out, config);
        }
        return out.value;
    }
    /**
     * Outputs given abbreviation node into output stream
     */
    function property(node, out, config) {
        const isJSON = config.options['stylesheet.json'];
        if (node.name) {
            // It’s a CSS property
            const name = isJSON ? toCamelCase(node.name) : node.name;
            pushString(out, name + config.options['stylesheet.between']);
            if (node.value.length) {
                propertyValue(node, out, config);
            }
            else {
                pushField(out, 0, '');
            }
            if (isJSON) {
                // For CSS-in-JS, always finalize property with comma
                // NB: seems like `important` is not available in CSS-in-JS syntaxes
                push$1(out, ',');
            }
            else {
                outputImportant(node, out, true);
                push$1(out, config.options['stylesheet.after']);
            }
        }
        else {
            // It’s a regular snippet, output plain tokens without any additional formatting
            for (const cssVal of node.value) {
                for (const v of cssVal.value) {
                    outputToken(v, out, config);
                }
            }
            outputImportant(node, out, node.value.length > 0);
        }
    }
    function propertyValue(node, out, config) {
        const isJSON = config.options['stylesheet.json'];
        const num = isJSON ? getSingleNumeric(node) : null;
        if (num && (!num.unit || num.unit === 'px')) {
            // For CSS-in-JS, if property contains single numeric value, output it
            // as JS number
            push$1(out, String(num.value));
        }
        else {
            const quote = getQuote(config);
            isJSON && push$1(out, quote);
            for (let i = 0; i < node.value.length; i++) {
                if (i !== 0) {
                    push$1(out, ', ');
                }
                outputValue(node.value[i], out, config);
            }
            isJSON && push$1(out, quote);
        }
    }
    function outputImportant(node, out, separator) {
        if (node.important) {
            if (separator) {
                push$1(out, ' ');
            }
            push$1(out, '!important');
        }
    }
    function outputValue(value, out, config) {
        for (let i = 0, prevEnd = -1; i < value.value.length; i++) {
            const token = value.value[i];
            // Handle edge case: a field is written close to previous token like this: `foo${bar}`.
            // We should not add delimiter here
            if (i !== 0 && (token.type !== 'Field' || token.start !== prevEnd)) {
                push$1(out, ' ');
            }
            outputToken(token, out, config);
            prevEnd = token['end'];
        }
    }
    function outputToken(token, out, config) {
        if (token.type === 'ColorValue') {
            push$1(out, color(token, config.options['stylesheet.shortHex']));
        }
        else if (token.type === 'Literal') {
            pushString(out, token.value);
        }
        else if (token.type === 'NumberValue') {
            pushString(out, frac(token.value, 4) + token.unit);
        }
        else if (token.type === 'StringValue') {
            const quote = token.quote === 'double' ? '"' : '\'';
            pushString(out, quote + token.value + quote);
        }
        else if (token.type === 'Field') {
            pushField(out, token.index, token.name);
        }
        else if (token.type === 'FunctionCall') {
            push$1(out, token.name + '(');
            for (let i = 0; i < token.arguments.length; i++) {
                if (i) {
                    push$1(out, ', ');
                }
                outputValue(token.arguments[i], out, config);
            }
            push$1(out, ')');
        }
    }
    /**
     * If value of given property is a single numeric value, returns this token
     */
    function getSingleNumeric(node) {
        if (node.value.length === 1) {
            const cssVal = node.value[0];
            if (cssVal.value.length === 1 && cssVal.value[0].type === 'NumberValue') {
                return cssVal.value[0];
            }
        }
    }
    /**
     * Converts kebab-case string to camelCase
     */
    function toCamelCase(str) {
        return str.replace(/\-(\w)/g, (_, letter) => letter.toUpperCase());
    }
    function getQuote(config) {
        return config.options['stylesheet.jsonDoubleQuotes'] ? '"' : '\'';
    }

    const gradientName = 'lg';
    /**
     * Parses given Emmet abbreviation into a final abbreviation tree with all
     * required transformations applied
     */
    function parse$1$1(abbr, config) {
        var _a;
        const snippets = ((_a = config.cache) === null || _a === void 0 ? void 0 : _a.stylesheetSnippets) || convertSnippets(config.snippets);
        if (config.cache) {
            config.cache.stylesheetSnippets = snippets;
        }
        if (typeof abbr === 'string') {
            abbr = parse(abbr, { value: isValueScope(config) });
        }
        const filteredSnippets = getSnippetsForScope(snippets, config);
        for (const node of abbr) {
            resolveNode(node, filteredSnippets, config);
        }
        return abbr;
    }
    /**
     * Converts given raw snippets into internal snippets representation
     */
    function convertSnippets(snippets) {
        const result = [];
        for (const key of Object.keys(snippets)) {
            result.push(createSnippet(key, snippets[key]));
        }
        return nest(result);
    }
    /**
     * Resolves given node: finds matched CSS snippets using fuzzy match and resolves
     * keyword aliases from node value
     */
    function resolveNode(node, snippets, config) {
        if (!resolveGradient(node, config)) {
            const score = config.options['stylesheet.fuzzySearchMinScore'];
            if (isValueScope(config)) {
                // Resolve as value of given CSS property
                const propName = config.context.name;
                const snippet = snippets.find(s => s.type === "Property" /* Property */ && s.property === propName);
                resolveValueKeywords(node, config, snippet, score);
            }
            else if (node.name) {
                const snippet = findBestMatch(node.name, snippets, score, true);
                if (snippet) {
                    if (snippet.type === "Property" /* Property */) {
                        resolveAsProperty(node, snippet, config);
                    }
                    else {
                        resolveAsSnippet(node, snippet);
                    }
                }
            }
        }
        if (node.name || config.context) {
            // Resolve numeric values for CSS properties only
            resolveNumericValue(node, config);
        }
        return node;
    }
    /**
     * Resolves CSS gradient shortcut from given property, if possible
     */
    function resolveGradient(node, config) {
        let gradientFn = null;
        const cssVal = node.value.length === 1 ? node.value[0] : null;
        if (cssVal && cssVal.value.length === 1) {
            const v = cssVal.value[0];
            if (v.type === 'FunctionCall' && v.name === gradientName) {
                gradientFn = v;
            }
        }
        if (gradientFn || node.name === gradientName) {
            if (!gradientFn) {
                gradientFn = {
                    type: 'FunctionCall',
                    name: 'linear-gradient',
                    arguments: [cssValue(field$2(0, ''))]
                };
            }
            else {
                gradientFn = Object.assign(Object.assign({}, gradientFn), { name: 'linear-gradient' });
            }
            if (!config.context) {
                node.name = 'background-image';
            }
            node.value = [cssValue(gradientFn)];
            return true;
        }
        return false;
    }
    /**
     * Resolves given parsed abbreviation node as CSS property
     */
    function resolveAsProperty(node, snippet, config) {
        const abbr = node.name;
        // Check for unmatched part of abbreviation
        // For example, in `dib` abbreviation the matched part is `d` and `ib` should
        // be considered as inline value. If unmatched fragment exists, we should check
        // if it matches actual value of snippet. If either explicit value is specified
        // or unmatched fragment did not resolve to to a keyword, we should consider
        // matched snippet as invalid
        const inlineValue = getUnmatchedPart(abbr, snippet.key);
        if (inlineValue) {
            if (node.value.length) {
                // Already have value: unmatched part indicates matched snippet is invalid
                return node;
            }
            const kw = resolveKeyword(inlineValue, config, snippet);
            if (!kw) {
                return node;
            }
            node.value.push(cssValue(kw));
        }
        node.name = snippet.property;
        if (node.value.length) {
            // Replace keyword alias from current abbreviation node with matched keyword
            resolveValueKeywords(node, config, snippet);
        }
        else if (snippet.value.length) {
            const defaultValue = snippet.value[0];
            // https://github.com/emmetio/emmet/issues/558
            // We should auto-select inserted value only if there’s multiple value
            // choice
            node.value = snippet.value.length === 1 || defaultValue.some(hasField)
                ? defaultValue
                : defaultValue.map(n => wrapWithField(n, config));
        }
        return node;
    }
    function resolveValueKeywords(node, config, snippet, minScore) {
        for (const cssVal of node.value) {
            const value = [];
            for (const token of cssVal.value) {
                if (token.type === 'Literal') {
                    value.push(resolveKeyword(token.value, config, snippet, minScore) || token);
                }
                else if (token.type === 'FunctionCall') {
                    // For function calls, we should find matching function call
                    // and merge arguments
                    const match = resolveKeyword(token.name, config, snippet, minScore);
                    if (match && match.type === 'FunctionCall') {
                        value.push(Object.assign(Object.assign({}, match), { arguments: token.arguments.concat(match.arguments.slice(token.arguments.length)) }));
                    }
                    else {
                        value.push(token);
                    }
                }
                else {
                    value.push(token);
                }
            }
            cssVal.value = value;
        }
    }
    /**
     * Resolves given parsed abbreviation node as a snippet: a plain code chunk
     */
    function resolveAsSnippet(node, snippet) {
        // When resolving snippets, we have to do the following:
        // 1. Replace field placeholders with actual field tokens.
        // 2. If input values given, put them instead of fields
        let offset = 0;
        let m;
        const reField = /\$\{(\d+)(:[^}]+)?\}/g;
        const inputValue = node.value[0];
        const outputValue = [];
        while (m = reField.exec(snippet.value)) {
            if (offset !== m.index) {
                outputValue.push(literal$4(snippet.value.slice(offset, m.index)));
            }
            offset = m.index + m[0].length;
            if (inputValue && inputValue.value.length) {
                outputValue.push(inputValue.value.shift());
            }
            else {
                outputValue.push(field$2(Number(m[1]), m[2] ? m[2].slice(1) : ''));
            }
        }
        const tail = snippet.value.slice(offset);
        if (tail) {
            outputValue.push(literal$4(tail));
        }
        node.name = void 0;
        node.value = [cssValue(...outputValue)];
        return node;
    }
    /**
     * Finds best matching item from `items` array
     * @param abbr  Abbreviation to match
     * @param items List of items for match
     * @param minScore The minimum score the best matched item should have to be a valid match.
     */
    function findBestMatch(abbr, items, minScore = 0, partialMatch = false) {
        let matchedItem = null;
        let maxScore = 0;
        for (const item of items) {
            const score = scoreMatch(abbr, getScoringPart(item), partialMatch);
            if (score === 1) {
                // direct hit, no need to look further
                return item;
            }
            if (score && score >= maxScore) {
                maxScore = score;
                matchedItem = item;
            }
        }
        return maxScore >= minScore ? matchedItem : null;
    }
    function getScoringPart(item) {
        return typeof item === 'string' ? item : item.key;
    }
    /**
     * Returns a part of `abbr` that wasn’t directly matched against `str`.
     * For example, if abbreviation `poas` is matched against `position`,
     * the unmatched part will be `as` since `a` wasn’t found in string stream
     */
    function getUnmatchedPart(abbr, str) {
        for (let i = 0, lastPos = 0; i < abbr.length; i++) {
            lastPos = str.indexOf(abbr[i], lastPos);
            if (lastPos === -1) {
                return abbr.slice(i);
            }
            lastPos++;
        }
        return '';
    }
    /**
     * Resolves given keyword shorthand into matched snippet keyword or global keyword,
     * if possible
     */
    function resolveKeyword(kw, config, snippet, minScore) {
        let ref;
        if (snippet) {
            if (ref = findBestMatch(kw, Object.keys(snippet.keywords), minScore)) {
                return snippet.keywords[ref];
            }
            for (const dep of snippet.dependencies) {
                if (ref = findBestMatch(kw, Object.keys(dep.keywords), minScore)) {
                    return dep.keywords[ref];
                }
            }
        }
        if (ref = findBestMatch(kw, config.options['stylesheet.keywords'], minScore)) {
            return literal$4(ref);
        }
        return null;
    }
    /**
     * Resolves numeric values in given abbreviation node
     */
    function resolveNumericValue(node, config) {
        const aliases = config.options['stylesheet.unitAliases'];
        const unitless = config.options['stylesheet.unitless'];
        for (const v of node.value) {
            for (const t of v.value) {
                if (t.type === 'NumberValue') {
                    if (t.unit) {
                        t.unit = aliases[t.unit] || t.unit;
                    }
                    else if (t.value !== 0 && !unitless.includes(node.name)) {
                        t.unit = t.rawValue.includes('.')
                            ? config.options['stylesheet.floatUnit']
                            : config.options['stylesheet.intUnit'];
                    }
                }
            }
        }
    }
    /**
     * Constructs CSS value token
     */
    function cssValue(...args) {
        return {
            type: 'CSSValue',
            value: args
        };
    }
    /**
     * Constructs literal token
     */
    function literal$4(value) {
        return { type: 'Literal', value };
    }
    /**
     * Constructs field token
     */
    function field$2(index, name) {
        return { type: 'Field', index, name };
    }
    /**
     * Check if given value contains fields
     */
    function hasField(value) {
        for (const v of value.value) {
            if (v.type === 'Field' || (v.type === 'FunctionCall' && v.arguments.some(hasField))) {
                return true;
            }
        }
        return false;
    }
    /**
     * Wraps tokens of given abbreviation with fields
     */
    function wrapWithField(node, config, state = { index: 1 }) {
        let value = [];
        for (const v of node.value) {
            switch (v.type) {
                case 'ColorValue':
                    value.push(field$2(state.index++, color(v, config.options['stylesheet.shortHex'])));
                    break;
                case 'Literal':
                    value.push(field$2(state.index++, v.value));
                    break;
                case 'NumberValue':
                    value.push(field$2(state.index++, `${v.value}${v.unit}`));
                    break;
                case 'StringValue':
                    const q = v.quote === 'single' ? '\'' : '"';
                    value.push(field$2(state.index++, q + v.value + q));
                    break;
                case 'FunctionCall':
                    value.push(field$2(state.index++, v.name), literal$4('('));
                    for (let i = 0, il = v.arguments.length; i < il; i++) {
                        value = value.concat(wrapWithField(v.arguments[i], config, state).value);
                        if (i !== il - 1) {
                            value.push(literal$4(', '));
                        }
                    }
                    value.push(literal$4(')'));
                    break;
                default:
                    value.push(v);
            }
        }
        return Object.assign(Object.assign({}, node), { value });
    }
    /**
     * Check if abbreviation should be expanded in CSS value context
     */
    function isValueScope(config) {
        if (config.context) {
            return config.context.name === "@@value" /* Value */ || !config.context.name.startsWith('@@');
        }
        return false;
    }
    /**
     * Returns snippets for given scope
     */
    function getSnippetsForScope(snippets, config) {
        if (config.context) {
            if (config.context.name === "@@section" /* Section */) {
                return snippets.filter(s => s.type === "Raw" /* Raw */);
            }
            if (config.context.name === "@@property" /* Property */) {
                return snippets.filter(s => s.type === "Property" /* Property */);
            }
        }
        return snippets;
    }

    var markupSnippets = {
    	"a": "a[href]",
    	"a:blank": "a[href='http://${0}' target='_blank' rel='noopener noreferrer']",
    	"a:link": "a[href='http://${0}']",
    	"a:mail": "a[href='mailto:${0}']",
    	"a:tel": "a[href='tel:+${0}']",
    	"abbr": "abbr[title]",
    	"acr|acronym": "acronym[title]",
    	"base": "base[href]/",
    	"basefont": "basefont/",
    	"br": "br/",
    	"frame": "frame/",
    	"hr": "hr/",
    	"bdo": "bdo[dir]",
    	"bdo:r": "bdo[dir=rtl]",
    	"bdo:l": "bdo[dir=ltr]",
    	"col": "col/",
    	"link": "link[rel=stylesheet href]/",
    	"link:css": "link[href='${1:style}.css']",
    	"link:print": "link[href='${1:print}.css' media=print]",
    	"link:favicon": "link[rel='shortcut icon' type=image/x-icon href='${1:favicon.ico}']",
    	"link:mf|link:manifest": "link[rel='manifest' href='${1:manifest.json}']",
    	"link:touch": "link[rel=apple-touch-icon href='${1:favicon.png}']",
    	"link:rss": "link[rel=alternate type=application/rss+xml title=RSS href='${1:rss.xml}']",
    	"link:atom": "link[rel=alternate type=application/atom+xml title=Atom href='${1:atom.xml}']",
    	"link:im|link:import": "link[rel=import href='${1:component}.html']",
    	"meta": "meta/",
    	"meta:utf": "meta[http-equiv=Content-Type content='text/html;charset=UTF-8']",
    	"meta:vp": "meta[name=viewport content='width=${1:device-width}, initial-scale=${2:1.0}']",
    	"meta:compat": "meta[http-equiv=X-UA-Compatible content='${1:IE=7}']",
    	"meta:edge": "meta:compat[content='${1:ie=edge}']",
    	"meta:redirect": "meta[http-equiv=refresh content='0; url=${1:http://example.com}']",
    	"meta:kw": "meta[name=keywords content]",
    	"meta:desc": "meta[name=description content]",
    	"style": "style",
    	"script": "script",
    	"script:src": "script[src]",
    	"img": "img[src alt]/",
    	"img:s|img:srcset": "img[srcset src alt]",
    	"img:z|img:sizes": "img[sizes srcset src alt]",
    	"picture": "picture",
    	"src|source": "source/",
    	"src:sc|source:src": "source[src type]",
    	"src:s|source:srcset": "source[srcset]",
    	"src:t|source:type": "source[srcset type='${1:image/}']",
    	"src:z|source:sizes": "source[sizes srcset]",
    	"src:m|source:media": "source[media='(${1:min-width: })' srcset]",
    	"src:mt|source:media:type": "source:media[type='${2:image/}']",
    	"src:mz|source:media:sizes": "source:media[sizes srcset]",
    	"src:zt|source:sizes:type": "source[sizes srcset type='${1:image/}']",
    	"iframe": "iframe[src frameborder=0]",
    	"embed": "embed[src type]/",
    	"object": "object[data type]",
    	"param": "param[name value]/",
    	"map": "map[name]",
    	"area": "area[shape coords href alt]/",
    	"area:d": "area[shape=default]",
    	"area:c": "area[shape=circle]",
    	"area:r": "area[shape=rect]",
    	"area:p": "area[shape=poly]",
    	"form": "form[action]",
    	"form:get": "form[method=get]",
    	"form:post": "form[method=post]",
    	"label": "label[for]",
    	"input": "input[type=${1:text}]/",
    	"inp": "input[name=${1} id=${1}]",
    	"input:h|input:hidden": "input[type=hidden name]",
    	"input:t|input:text": "inp[type=text]",
    	"input:search": "inp[type=search]",
    	"input:email": "inp[type=email]",
    	"input:url": "inp[type=url]",
    	"input:p|input:password": "inp[type=password]",
    	"input:datetime": "inp[type=datetime]",
    	"input:date": "inp[type=date]",
    	"input:datetime-local": "inp[type=datetime-local]",
    	"input:month": "inp[type=month]",
    	"input:week": "inp[type=week]",
    	"input:time": "inp[type=time]",
    	"input:tel": "inp[type=tel]",
    	"input:number": "inp[type=number]",
    	"input:color": "inp[type=color]",
    	"input:c|input:checkbox": "inp[type=checkbox]",
    	"input:r|input:radio": "inp[type=radio]",
    	"input:range": "inp[type=range]",
    	"input:f|input:file": "inp[type=file]",
    	"input:s|input:submit": "input[type=submit value]",
    	"input:i|input:image": "input[type=image src alt]",
    	"input:b|input:button": "input[type=button value]",
    	"input:reset": "input:button[type=reset]",
    	"isindex": "isindex/",
    	"select": "select[name=${1} id=${1}]",
    	"select:d|select:disabled": "select[disabled.]",
    	"opt|option": "option[value]",
    	"textarea": "textarea[name=${1} id=${1} cols=${2:30} rows=${3:10}]",
    	"marquee": "marquee[behavior direction]",
    	"menu:c|menu:context": "menu[type=context]",
    	"menu:t|menu:toolbar": "menu[type=toolbar]",
    	"video": "video[src]",
    	"audio": "audio[src]",
    	"html:xml": "html[xmlns=http://www.w3.org/1999/xhtml]",
    	"keygen": "keygen/",
    	"command": "command/",
    	"btn:s|button:s|button:submit" : "button[type=submit]",
    	"btn:r|button:r|button:reset" : "button[type=reset]",
    	"btn:d|button:d|button:disabled" : "button[disabled.]",
    	"fst:d|fset:d|fieldset:d|fieldset:disabled" : "fieldset[disabled.]",

    	"bq": "blockquote",
    	"fig": "figure",
    	"figc": "figcaption",
    	"pic": "picture",
    	"ifr": "iframe",
    	"emb": "embed",
    	"obj": "object",
    	"cap": "caption",
    	"colg": "colgroup",
    	"fst": "fieldset",
    	"btn": "button",
    	"optg": "optgroup",
    	"tarea": "textarea",
    	"leg": "legend",
    	"sect": "section",
    	"art": "article",
    	"hdr": "header",
    	"ftr": "footer",
    	"adr": "address",
    	"dlg": "dialog",
    	"str": "strong",
    	"prog": "progress",
    	"mn": "main",
    	"tem": "template",
    	"fset": "fieldset",
    	"datag": "datagrid",
    	"datal": "datalist",
    	"kg": "keygen",
    	"out": "output",
    	"det": "details",
    	"sum": "summary",
    	"cmd": "command",

    	"ri:d|ri:dpr": "img:s",
    	"ri:v|ri:viewport": "img:z",
    	"ri:a|ri:art": "pic>src:m+img",
    	"ri:t|ri:type": "pic>src:t+img",

    	"!!!": "{<!DOCTYPE html>}",
    	"doc": "html[lang=${lang}]>(head>meta[charset=${charset}]+meta:vp+title{${1:Document}})+body",
    	"!|html:5": "!!!+doc",

    	"c": "{<!-- ${0} -->}",
    	"cc:ie": "{<!--[if IE]>${0}<![endif]-->}",
    	"cc:noie": "{<!--[if !IE]><!-->${0}<!--<![endif]-->}"
    };

    var stylesheetSnippets = {
    	"@f": "@font-face {\n\tfont-family: ${1};\n\tsrc: url(${1});\n}",
    	"@ff": "@font-face {\n\tfont-family: '${1:FontName}';\n\tsrc: url('${2:FileName}.eot');\n\tsrc: url('${2:FileName}.eot?#iefix') format('embedded-opentype'),\n\t\t url('${2:FileName}.woff') format('woff'),\n\t\t url('${2:FileName}.ttf') format('truetype'),\n\t\t url('${2:FileName}.svg#${1:FontName}') format('svg');\n\tfont-style: ${3:normal};\n\tfont-weight: ${4:normal};\n}",
    	"@i|@import": "@import url(${0});",
    	"@kf": "@keyframes ${1:identifier} {\n\t${2}\n}",
    	"@m|@media": "@media ${1:screen} {\n\t${0}\n}",
    	"ac": "align-content:start|end|flex-start|flex-end|center|space-between|space-around|stretch|space-evenly",
    	"ai": "align-items:start|end|flex-start|flex-end|center|baseline|stretch",
    	"anim": "animation:${1:name} ${2:duration} ${3:timing-function} ${4:delay} ${5:iteration-count} ${6:direction} ${7:fill-mode}",
    	"animdel": "animation-delay:time",
    	"animdir": "animation-direction:normal|reverse|alternate|alternate-reverse",
    	"animdur": "animation-duration:${1:0}s",
    	"animfm": "animation-fill-mode:both|forwards|backwards",
    	"animic": "animation-iteration-count:1|infinite",
    	"animn": "animation-name",
    	"animps": "animation-play-state:running|paused",
    	"animtf": "animation-timing-function:linear|ease|ease-in|ease-out|ease-in-out|cubic-bezier(${1:0.1}, ${2:0.7}, ${3:1.0}, ${3:0.1})",
    	"ap": "appearance:none",
    	"as": "align-self:start|end|auto|flex-start|flex-end|center|baseline|stretch",
    	"b": "bottom",
    	"bd": "border:${1:1px} ${2:solid} ${3:#000}",
    	"bdb": "border-bottom:${1:1px} ${2:solid} ${3:#000}",
    	"bdbc": "border-bottom-color:${1:#000}",
    	"bdbi": "border-bottom-image:url(${0})",
    	"bdbk": "border-break:close",
    	"bdbli": "border-bottom-left-image:url(${0})|continue",
    	"bdblrs": "border-bottom-left-radius",
    	"bdbri": "border-bottom-right-image:url(${0})|continue",
    	"bdbrrs": "border-bottom-right-radius",
    	"bdbs": "border-bottom-style",
    	"bdbw": "border-bottom-width",
    	"bdc": "border-color:${1:#000}",
    	"bdci": "border-corner-image:url(${0})|continue",
    	"bdcl": "border-collapse:collapse|separate",
    	"bdf": "border-fit:repeat|clip|scale|stretch|overwrite|overflow|space",
    	"bdi": "border-image:url(${0})",
    	"bdl": "border-left:${1:1px} ${2:solid} ${3:#000}",
    	"bdlc": "border-left-color:${1:#000}",
    	"bdlen": "border-length",
    	"bdli": "border-left-image:url(${0})",
    	"bdls": "border-left-style",
    	"bdlw": "border-left-width",
    	"bdr": "border-right:${1:1px} ${2:solid} ${3:#000}",
    	"bdrc": "border-right-color:${1:#000}",
    	"bdri": "border-right-image:url(${0})",
    	"bdrs": "border-radius",
    	"bdrst": "border-right-style",
    	"bdrw": "border-right-width",
    	"bds": "border-style:none|hidden|dotted|dashed|solid|double|dot-dash|dot-dot-dash|wave|groove|ridge|inset|outset",
    	"bdsp": "border-spacing",
    	"bdt": "border-top:${1:1px} ${2:solid} ${3:#000}",
    	"bdtc": "border-top-color:${1:#000}",
    	"bdti": "border-top-image:url(${0})",
    	"bdtli": "border-top-left-image:url(${0})|continue",
    	"bdtlrs": "border-top-left-radius",
    	"bdtri": "border-top-right-image:url(${0})|continue",
    	"bdtrrs": "border-top-right-radius",
    	"bdts": "border-top-style",
    	"bdtw": "border-top-width",
    	"bdw": "border-width",
    	"bfv": "backface-visibility:hidden|visible",
    	"bg": "background:${1:#000}",
    	"bga": "background-attachment:fixed|scroll",
    	"bgbk": "background-break:bounding-box|each-box|continuous",
    	"bgc": "background-color:#${1:fff}",
    	"bgcp": "background-clip:padding-box|border-box|content-box|no-clip",
    	"bgi": "background-image:url(${0})",
    	"bgo": "background-origin:padding-box|border-box|content-box",
    	"bgp": "background-position:${1:0} ${2:0}",
    	"bgpx": "background-position-x",
    	"bgpy": "background-position-y",
    	"bgr": "background-repeat:no-repeat|repeat-x|repeat-y|space|round",
    	"bgsz": "background-size:contain|cover",
    	"bxsh": "box-shadow:${1:inset }${2:hoff} ${3:voff} ${4:blur} ${5:#000}|none",
    	"bxsz": "box-sizing:border-box|content-box|border-box",
    	"c": "color:${1:#000}",
    	"cl": "clear:both|left|right|none",
    	"cm": "/* ${0} */",
    	"cnt": "content:'${0}'|normal|open-quote|no-open-quote|close-quote|no-close-quote|attr(${0})|counter(${0})|counters(${0})",
    	"coi": "counter-increment",
    	"colm": "columns",
    	"colmc": "column-count",
    	"colmf": "column-fill",
    	"colmg": "column-gap",
    	"colmr": "column-rule",
    	"colmrc": "column-rule-color",
    	"colmrs": "column-rule-style",
    	"colmrw": "column-rule-width",
    	"colms": "column-span",
    	"colmw": "column-width",
    	"cor": "counter-reset",
    	"cp": "clip:auto|rect(${1:top} ${2:right} ${3:bottom} ${4:left})",
    	"cps": "caption-side:top|bottom",
    	"cur": "cursor:pointer|auto|default|crosshair|hand|help|move|pointer|text",
    	"d": "display:grid|inline-grid|subgrid|block|none|flex|inline-flex|inline|inline-block|list-item|run-in|compact|table|inline-table|table-caption|table-column|table-column-group|table-header-group|table-footer-group|table-row|table-row-group|table-cell|ruby|ruby-base|ruby-base-group|ruby-text|ruby-text-group",
    	"ec": "empty-cells:show|hide",
    	"f": "font:${1:1em} ${2:sans-serif}",
    	"fd": "font-display:auto|block|swap|fallback|optional",
    	"fef": "font-effect:none|engrave|emboss|outline",
    	"fem": "font-emphasize",
    	"femp": "font-emphasize-position:before|after",
    	"fems": "font-emphasize-style:none|accent|dot|circle|disc",
    	"ff": "font-family:serif|sans-serif|cursive|fantasy|monospace",
    	"fft": "font-family:\"Times New Roman\", Times, Baskerville, Georgia, serif",
    	"ffa": "font-family:Arial, \"Helvetica Neue\", Helvetica, sans-serif",
    	"ffv": "font-family:Verdana, Geneva, sans-serif",
    	"fl": "float:left|right|none",
    	"fs": "font-style:italic|normal|oblique",
    	"fsm": "font-smoothing:antialiased|subpixel-antialiased|none",
    	"fst": "font-stretch:normal|ultra-condensed|extra-condensed|condensed|semi-condensed|semi-expanded|expanded|extra-expanded|ultra-expanded",
    	"fv": "font-variant:normal|small-caps",
    	"fvs": "font-variation-settings:normal|inherit|initial|unset",
    	"fw": "font-weight:normal|bold|bolder|lighter",
    	"fx": "flex",
    	"fxb": "flex-basis:fill|max-content|min-content|fit-content|content",
    	"fxd": "flex-direction:row|row-reverse|column|column-reverse",
    	"fxf": "flex-flow",
    	"fxg": "flex-grow",
    	"fxsh": "flex-shrink",
    	"fxw": "flex-wrap:nowrap|wrap|wrap-reverse",
    	"fsz": "font-size",
    	"fsza": "font-size-adjust",
    	"gtc": "grid-template-columns:repeat()|minmax()",
    	"gtr": "grid-template-rows:repeat()|minmax()",
    	"gta": "grid-template-areas",
    	"gt": "grid-template",
    	"gg": "grid-gap",
    	"gcg": "grid-column-gap",
    	"grg": "grid-row-gap",
    	"gac": "grid-auto-columns:auto|minmax()",
    	"gar": "grid-auto-rows:auto|minmax()",
    	"gaf": "grid-auto-flow:row|column|dense|inherit|initial|unset",
    	"gd": "grid",
    	"gc": "grid-column",
    	"gcs": "grid-column-start",
    	"gce": "grid-column-end",
    	"gr": "grid-row",
    	"grs": "grid-row-start",
    	"gre": "grid-row-end",
    	"ga": "grid-area",
    	"h": "height",
    	"jc": "justify-content:start|end|stretch|flex-start|flex-end|center|space-between|space-around|space-evenly",
    	"ji": "justify-items:start|end|center|stretch",
    	"js": "justify-self:start|end|center|stretch",
    	"l": "left",
    	"lg": "background-image:linear-gradient(${1})",
    	"lh": "line-height",
    	"lis": "list-style",
    	"lisi": "list-style-image",
    	"lisp": "list-style-position:inside|outside",
    	"list": "list-style-type:disc|circle|square|decimal|decimal-leading-zero|lower-roman|upper-roman",
    	"lts": "letter-spacing:normal",
    	"m": "margin",
    	"mah": "max-height",
    	"mar": "max-resolution",
    	"maw": "max-width",
    	"mb": "margin-bottom",
    	"mih": "min-height",
    	"mir": "min-resolution",
    	"miw": "min-width",
    	"ml": "margin-left",
    	"mr": "margin-right",
    	"mt": "margin-top",
    	"ol": "outline",
    	"olc": "outline-color:${1:#000}|invert",
    	"olo": "outline-offset",
    	"ols": "outline-style:none|dotted|dashed|solid|double|groove|ridge|inset|outset",
    	"olw": "outline-width|thin|medium|thick",
    	"op": "opacity",
    	"ord": "order",
    	"ori": "orientation:landscape|portrait",
    	"orp": "orphans",
    	"ov": "overflow:hidden|visible|hidden|scroll|auto",
    	"ovs": "overflow-style:scrollbar|auto|scrollbar|panner|move|marquee",
    	"ovx": "overflow-x:hidden|visible|hidden|scroll|auto",
    	"ovy": "overflow-y:hidden|visible|hidden|scroll|auto",
    	"p": "padding",
    	"pb": "padding-bottom",
    	"pgba": "page-break-after:auto|always|left|right",
    	"pgbb": "page-break-before:auto|always|left|right",
    	"pgbi": "page-break-inside:auto|avoid",
    	"pl": "padding-left",
    	"pos": "position:relative|absolute|relative|fixed|static",
    	"pr": "padding-right",
    	"pt": "padding-top",
    	"q": "quotes",
    	"qen": "quotes:'\\201C' '\\201D' '\\2018' '\\2019'",
    	"qru": "quotes:'\\00AB' '\\00BB' '\\201E' '\\201C'",
    	"r": "right",
    	"rsz": "resize:none|both|horizontal|vertical",
    	"t": "top",
    	"ta": "text-align:left|center|right|justify",
    	"tal": "text-align-last:left|center|right",
    	"tbl": "table-layout:fixed",
    	"td": "text-decoration:none|underline|overline|line-through",
    	"te": "text-emphasis:none|accent|dot|circle|disc|before|after",
    	"th": "text-height:auto|font-size|text-size|max-size",
    	"ti": "text-indent",
    	"tj": "text-justify:auto|inter-word|inter-ideograph|inter-cluster|distribute|kashida|tibetan",
    	"to": "text-outline:${1:0} ${2:0} ${3:#000}",
    	"tov": "text-overflow:ellipsis|clip",
    	"tr": "text-replace",
    	"trf": "transform:${1}|skewX(${1:angle})|skewY(${1:angle})|scale(${1:x}, ${2:y})|scaleX(${1:x})|scaleY(${1:y})|scaleZ(${1:z})|scale3d(${1:x}, ${2:y}, ${3:z})|rotate(${1:angle})|rotateX(${1:angle})|rotateY(${1:angle})|rotateZ(${1:angle})|translate(${1:x}, ${2:y})|translateX(${1:x})|translateY(${1:y})|translateZ(${1:z})|translate3d(${1:tx}, ${2:ty}, ${3:tz})",
    	"trfo": "transform-origin",
    	"trfs": "transform-style:preserve-3d",
    	"trs": "transition:${1:prop} ${2:time}",
    	"trsde": "transition-delay:${1:time}",
    	"trsdu": "transition-duration:${1:time}",
    	"trsp": "transition-property:${1:prop}",
    	"trstf": "transition-timing-function:${1:fn}",
    	"tsh": "text-shadow:${1:hoff} ${2:voff} ${3:blur} ${4:#000}",
    	"tt": "text-transform:uppercase|lowercase|capitalize|none",
    	"tw": "text-wrap:none|normal|unrestricted|suppress",
    	"us": "user-select:none",
    	"v": "visibility:hidden|visible|collapse",
    	"va": "vertical-align:top|super|text-top|middle|baseline|bottom|text-bottom|sub",
    	"w": "width",
    	"whs": "white-space:nowrap|pre|pre-wrap|pre-line|normal",
    	"whsc": "white-space-collapse:normal|keep-all|loose|break-strict|break-all",
    	"wid": "widows",
    	"wm": "writing-mode:lr-tb|lr-tb|lr-bt|rl-tb|rl-bt|tb-rl|tb-lr|bt-lr|bt-rl",
    	"wob": "word-break:normal|keep-all|break-all",
    	"wos": "word-spacing",
    	"wow": "word-wrap:none|unrestricted|suppress|break-word|normal",
    	"z": "z-index",
    	"zom": "zoom:1"
    };

    var xslSnippets = {
        "tm|tmatch": "xsl:template[match mode]",
        "tn|tname": "xsl:template[name]",
        "call": "xsl:call-template[name]",
        "ap": "xsl:apply-templates[select mode]",
        "api": "xsl:apply-imports",
        "imp": "xsl:import[href]",
        "inc": "xsl:include[href]",
        "ch": "xsl:choose",
        "wh|xsl:when": "xsl:when[test]",
        "ot": "xsl:otherwise",
        "if": "xsl:if[test]",
        "par": "xsl:param[name]",
        "pare": "xsl:param[name select]",
        "var": "xsl:variable[name]",
        "vare": "xsl:variable[name select]",
        "wp": "xsl:with-param[name select]",
        "key": "xsl:key[name match use]",
        "elem": "xsl:element[name]",
        "attr": "xsl:attribute[name]",
        "attrs": "xsl:attribute-set[name]",
        "cp": "xsl:copy[select]",
        "co": "xsl:copy-of[select]",
        "val": "xsl:value-of[select]",
        "for|each": "xsl:for-each[select]",
        "tex": "xsl:text",
        "com": "xsl:comment",
        "msg": "xsl:message[terminate=no]",
        "fall": "xsl:fallback",
        "num": "xsl:number[value]",
        "nam": "namespace-alias[stylesheet-prefix result-prefix]",
        "pres": "xsl:preserve-space[elements]",
        "strip": "xsl:strip-space[elements]",
        "proc": "xsl:processing-instruction[name]",
        "sort": "xsl:sort[select order]",
        "choose": "xsl:choose>xsl:when+xsl:otherwise",
        "xsl": "!!!+xsl:stylesheet[version=1.0 xmlns:xsl=http://www.w3.org/1999/XSL/Transform]>{\n|}",
        "!!!": "{<?xml version=\"1.0\" encoding=\"UTF-8\"?>}"
    };

    var pugSnippets = {
    	"!!!": "{doctype html}"
    };

    var variables = {
    	"lang": "en",
    	"locale": "en-US",
    	"charset": "UTF-8",
    	"indentation": "\t",
    	"newline": "\n"
    };

    /**
     * Default syntaxes for abbreviation types
     */
    const defaultSyntaxes = {
        markup: 'html',
        stylesheet: 'css'
    };
    const defaultOptions$1 = {
        'inlineElements': [
            'a', 'abbr', 'acronym', 'applet', 'b', 'basefont', 'bdo',
            'big', 'br', 'button', 'cite', 'code', 'del', 'dfn', 'em', 'font', 'i',
            'iframe', 'img', 'input', 'ins', 'kbd', 'label', 'map', 'object', 'q',
            's', 'samp', 'select', 'small', 'span', 'strike', 'strong', 'sub', 'sup',
            'textarea', 'tt', 'u', 'var'
        ],
        'output.indent': '\t',
        'output.baseIndent': '',
        'output.newline': '\n',
        'output.tagCase': '',
        'output.attributeCase': '',
        'output.attributeQuotes': 'double',
        'output.format': true,
        'output.formatLeafNode': false,
        'output.formatSkip': ['html'],
        'output.formatForce': ['body'],
        'output.inlineBreak': 3,
        'output.compactBoolean': false,
        'output.booleanAttributes': [
            'contenteditable', 'seamless', 'async', 'autofocus',
            'autoplay', 'checked', 'controls', 'defer', 'disabled', 'formnovalidate',
            'hidden', 'ismap', 'loop', 'multiple', 'muted', 'novalidate', 'readonly',
            'required', 'reversed', 'selected', 'typemustmatch'
        ],
        'output.reverseAttributes': false,
        'output.selfClosingStyle': 'html',
        'output.field': (index, placeholder) => placeholder,
        'output.text': text => text,
        'comment.enabled': false,
        'comment.trigger': ['id', 'class'],
        'comment.before': '',
        'comment.after': '\n<!-- /[#ID][.CLASS] -->',
        'bem.enabled': false,
        'bem.element': '__',
        'bem.modifier': '_',
        'jsx.enabled': false,
        'stylesheet.keywords': ['auto', 'inherit', 'unset'],
        'stylesheet.unitless': ['z-index', 'line-height', 'opacity', 'font-weight', 'zoom', 'flex', 'flex-grow', 'flex-shrink'],
        'stylesheet.shortHex': true,
        'stylesheet.between': ': ',
        'stylesheet.after': ';',
        'stylesheet.intUnit': 'px',
        'stylesheet.floatUnit': 'em',
        'stylesheet.unitAliases': { e: 'em', p: '%', x: 'ex', r: 'rem' },
        'stylesheet.json': false,
        'stylesheet.jsonDoubleQuotes': false,
        'stylesheet.fuzzySearchMinScore': 0
    };
    const defaultConfig$1 = {
        type: 'markup',
        syntax: 'html',
        variables,
        snippets: {},
        options: defaultOptions$1
    };
    /**
     * Default per-syntax config
     */
    const syntaxConfig = {
        markup: {
            snippets: parseSnippets(markupSnippets),
        },
        xhtml: {
            options: {
                'output.selfClosingStyle': 'xhtml'
            }
        },
        xml: {
            options: {
                'output.selfClosingStyle': 'xml'
            }
        },
        xsl: {
            snippets: parseSnippets(xslSnippets),
            options: {
                'output.selfClosingStyle': 'xml'
            }
        },
        jsx: {
            options: {
                'jsx.enabled': true
            }
        },
        pug: {
            snippets: parseSnippets(pugSnippets)
        },
        stylesheet: {
            snippets: parseSnippets(stylesheetSnippets)
        },
        sass: {
            options: {
                'stylesheet.after': ''
            }
        },
        stylus: {
            options: {
                'stylesheet.between': ' ',
                'stylesheet.after': '',
            }
        }
    };
    /**
     * Parses raw snippets definitions with possibly multiple keys into a plan
     * snippet map
     */
    function parseSnippets(snippets) {
        const result = {};
        Object.keys(snippets).forEach(k => {
            for (const name of k.split('|')) {
                result[name] = snippets[k];
            }
        });
        return result;
    }
    function resolveConfig(config = {}, globals = {}) {
        const type = config.type || 'markup';
        const syntax = config.syntax || defaultSyntaxes[type];
        return Object.assign(Object.assign(Object.assign({}, defaultConfig$1), config), { type,
            syntax, variables: mergedData(type, syntax, 'variables', config, globals), snippets: mergedData(type, syntax, 'snippets', config, globals), options: mergedData(type, syntax, 'options', config, globals) });
    }
    function mergedData(type, syntax, key, config, globals = {}) {
        const typeDefaults = syntaxConfig[type];
        const typeOverride = globals[type];
        const syntaxDefaults = syntaxConfig[syntax];
        const syntaxOverride = globals[syntax];
        return Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, defaultConfig$1[key]), (typeDefaults && typeDefaults[key])), (syntaxDefaults && syntaxDefaults[key])), (typeOverride && typeOverride[key])), (syntaxOverride && syntaxOverride[key])), config[key]);
    }

    /**
     * Creates structure for scanning given string in backward direction
     */
    function backwardScanner(text, start = 0) {
        return { text, start, pos: text.length };
    }
    /**
     * Check if given scanner position is at start of scanned text
     */
    function sol(scanner) {
        return scanner.pos === scanner.start;
    }
    /**
     * “Peeks” character code an current scanner location without advancing it
     */
    function peek$1$1(scanner, offset = 0) {
        return scanner.text.charCodeAt(scanner.pos - 1 + offset);
    }
    /**
     * Returns current character code and moves character location one symbol back
     */
    function previous(scanner) {
        if (!sol(scanner)) {
            return scanner.text.charCodeAt(--scanner.pos);
        }
    }
    /**
     * Consumes current character code if it matches given `match` code or function
     */
    function consume$2(scanner, match) {
        if (sol(scanner)) {
            return false;
        }
        const ok = typeof match === 'function'
            ? match(peek$1$1(scanner))
            : match === peek$1$1(scanner);
        if (ok) {
            scanner.pos--;
        }
        return !!ok;
    }
    function consumeWhile(scanner, match) {
        const start = scanner.pos;
        while (consume$2(scanner, match)) {
            // empty
        }
        return scanner.pos < start;
    }

    /**
     * Check if given character code is a quote
     */
    function isQuote$2(c) {
        return c === 39 /* SingleQuote */ || c === 34 /* DoubleQuote */;
    }
    /**
     * Consumes quoted value, if possible
     * @return Returns `true` is value was consumed
     */
    function consumeQuoted(scanner) {
        const start = scanner.pos;
        const quote = previous(scanner);
        if (isQuote$2(quote)) {
            while (!sol(scanner)) {
                if (previous(scanner) === quote && peek$1$1(scanner) !== 92 /* Escape */) {
                    return true;
                }
            }
        }
        scanner.pos = start;
        return false;
    }

    const bracePairs = {
        [91 /* SquareL */]: 93 /* SquareR */,
        [40 /* RoundL */]: 41 /* RoundR */,
        [123 /* CurlyL */]: 125 /* CurlyR */,
    };

    /**
     * Check if given reader’s current position points at the end of HTML tag
     */
    function isHtml(scanner) {
        const start = scanner.pos;
        if (!consume$2(scanner, 62 /* AngleRight */)) {
            return false;
        }
        let ok = false;
        consume$2(scanner, 47 /* Slash */); // possibly self-closed element
        while (!sol(scanner)) {
            consumeWhile(scanner, isWhiteSpace$3);
            if (consumeIdent(scanner)) {
                // ate identifier: could be a tag name, boolean attribute or unquoted
                // attribute value
                if (consume$2(scanner, 47 /* Slash */)) {
                    // either closing tag or invalid tag
                    ok = consume$2(scanner, 60 /* AngleLeft */);
                    break;
                }
                else if (consume$2(scanner, 60 /* AngleLeft */)) {
                    // opening tag
                    ok = true;
                    break;
                }
                else if (consume$2(scanner, isWhiteSpace$3)) {
                    // boolean attribute
                    continue;
                }
                else if (consume$2(scanner, 61 /* Equals */)) {
                    // simple unquoted value or invalid attribute
                    if (consumeIdent(scanner)) {
                        continue;
                    }
                    break;
                }
                else if (consumeAttributeWithUnquotedValue(scanner)) {
                    // identifier was a part of unquoted value
                    ok = true;
                    break;
                }
                // invalid tag
                break;
            }
            if (consumeAttribute(scanner)) {
                continue;
            }
            break;
        }
        scanner.pos = start;
        return ok;
    }
    /**
     * Consumes HTML attribute from given string.
     * @return `true` if attribute was consumed.
     */
    function consumeAttribute(scanner) {
        return consumeAttributeWithQuotedValue(scanner) || consumeAttributeWithUnquotedValue(scanner);
    }
    function consumeAttributeWithQuotedValue(scanner) {
        const start = scanner.pos;
        if (consumeQuoted(scanner) && consume$2(scanner, 61 /* Equals */) && consumeIdent(scanner)) {
            return true;
        }
        scanner.pos = start;
        return false;
    }
    function consumeAttributeWithUnquotedValue(scanner) {
        const start = scanner.pos;
        const stack = [];
        while (!sol(scanner)) {
            const ch = peek$1$1(scanner);
            if (isCloseBracket$1(ch)) {
                stack.push(ch);
            }
            else if (isOpenBracket$2(ch)) {
                if (stack.pop() !== bracePairs[ch]) {
                    // Unexpected open bracket
                    break;
                }
            }
            else if (!isUnquotedValue(ch)) {
                break;
            }
            scanner.pos--;
        }
        if (start !== scanner.pos && consume$2(scanner, 61 /* Equals */) && consumeIdent(scanner)) {
            return true;
        }
        scanner.pos = start;
        return false;
    }
    /**
     * Consumes HTML identifier from stream
     */
    function consumeIdent(scanner) {
        return consumeWhile(scanner, isIdent);
    }
    /**
     * Check if given character code belongs to HTML identifier
     */
    function isIdent(ch) {
        return ch === 58 /* Colon */ || ch === 45 /* Dash */ || isAlpha$1(ch) || isNumber$1(ch);
    }
    /**
     * Check if given character code is alpha code (letter though A to Z)
     */
    function isAlpha$1(ch) {
        ch &= ~32; // quick hack to convert any char code to uppercase char code
        return ch >= 65 && ch <= 90; // A-Z
    }
    /**
     * Check if given code is a number
     */
    function isNumber$1(ch) {
        return ch > 47 && ch < 58;
    }
    /**
     * Check if given code is a whitespace
     */
    function isWhiteSpace$3(ch) {
        return ch === 32 /* Space */ || ch === 9 /* Tab */;
    }
    /**
     * Check if given code may belong to unquoted attribute value
     */
    function isUnquotedValue(ch) {
        return !isNaN(ch) && ch !== 61 /* Equals */ && !isWhiteSpace$3(ch) && !isQuote$2(ch);
    }
    function isOpenBracket$2(ch) {
        return ch === 123 /* CurlyL */ || ch === 40 /* RoundL */ || ch === 91 /* SquareL */;
    }
    function isCloseBracket$1(ch) {
        return ch === 125 /* CurlyR */ || ch === 41 /* RoundR */ || ch === 93 /* SquareR */;
    }

    const code = (ch) => ch.charCodeAt(0);
    const specialChars = '#.*:$-_!@%^+>/'.split('').map(code);
    const defaultOptions$1$1 = {
        type: 'markup',
        lookAhead: true,
        prefix: ''
    };
    /**
     * Extracts Emmet abbreviation from given string.
     * The goal of this module is to extract abbreviation from current editor’s line,
     * e.g. like this: `<span>.foo[title=bar|]</span>` -> `.foo[title=bar]`, where
     * `|` is a current caret position.
     * @param line A text line where abbreviation should be expanded
     * @param pos Caret position in line. If not given, uses end of line
     * @param options Extracting options
     */
    function extractAbbreviation(line, pos = line.length, options = {}) {
        // make sure `pos` is within line range
        const opt = Object.assign(Object.assign({}, defaultOptions$1$1), options);
        pos = Math.min(line.length, Math.max(0, pos == null ? line.length : pos));
        if (opt.lookAhead) {
            pos = offsetPastAutoClosed(line, pos, opt);
        }
        let ch;
        const start = getStartOffset(line, pos, opt.prefix || '');
        if (start === -1) {
            return void 0;
        }
        const scanner = backwardScanner(line, start);
        scanner.pos = pos;
        const stack = [];
        while (!sol(scanner)) {
            ch = peek$1$1(scanner);
            if (stack.includes(125 /* CurlyR */)) {
                if (ch === 125 /* CurlyR */) {
                    stack.push(ch);
                    scanner.pos--;
                    continue;
                }
                if (ch !== 123 /* CurlyL */) {
                    scanner.pos--;
                    continue;
                }
            }
            if (isCloseBrace(ch, opt.type)) {
                stack.push(ch);
            }
            else if (isOpenBrace(ch, opt.type)) {
                if (stack.pop() !== bracePairs[ch]) {
                    // unexpected brace
                    break;
                }
            }
            else if (stack.includes(93 /* SquareR */) || stack.includes(125 /* CurlyR */)) {
                // respect all characters inside attribute sets or text nodes
                scanner.pos--;
                continue;
            }
            else if (isHtml(scanner) || !isAbbreviation(ch)) {
                break;
            }
            scanner.pos--;
        }
        if (!stack.length && scanner.pos !== pos) {
            // Found something, remove some invalid symbols from the
            // beginning and return abbreviation
            const abbreviation = line.slice(scanner.pos, pos).replace(/^[*+>^]+/, '');
            return {
                abbreviation,
                location: pos - abbreviation.length,
                start: options.prefix
                    ? start - options.prefix.length
                    : pos - abbreviation.length,
                end: pos
            };
        }
    }
    /**
     * Returns new `line` index which is right after characters beyound `pos` that
     * editor will likely automatically close, e.g. }, ], and quotes
     */
    function offsetPastAutoClosed(line, pos, options) {
        // closing quote is allowed only as a next character
        if (isQuote$2(line.charCodeAt(pos))) {
            pos++;
        }
        // offset pointer until non-autoclosed character is found
        while (isCloseBrace(line.charCodeAt(pos), options.type)) {
            pos++;
        }
        return pos;
    }
    /**
     * Returns start offset (left limit) in `line` where we should stop looking for
     * abbreviation: it’s nearest to `pos` location of `prefix` token
     */
    function getStartOffset(line, pos, prefix) {
        if (!prefix) {
            return 0;
        }
        const scanner = backwardScanner(line);
        const compiledPrefix = prefix.split('').map(code);
        scanner.pos = pos;
        let result;
        while (!sol(scanner)) {
            if (consumePair(scanner, 93 /* SquareR */, 91 /* SquareL */) || consumePair(scanner, 125 /* CurlyR */, 123 /* CurlyL */)) {
                continue;
            }
            result = scanner.pos;
            if (consumeArray$1(scanner, compiledPrefix)) {
                return result;
            }
            scanner.pos--;
        }
        return -1;
    }
    /**
     * Consumes full character pair, if possible
     */
    function consumePair(scanner, close, open) {
        const start = scanner.pos;
        if (consume$2(scanner, close)) {
            while (!sol(scanner)) {
                if (consume$2(scanner, open)) {
                    return true;
                }
                scanner.pos--;
            }
        }
        scanner.pos = start;
        return false;
    }
    /**
     * Consumes all character codes from given array, right-to-left, if possible
     */
    function consumeArray$1(scanner, arr) {
        const start = scanner.pos;
        let consumed = false;
        for (let i = arr.length - 1; i >= 0 && !sol(scanner); i--) {
            if (!consume$2(scanner, arr[i])) {
                break;
            }
            consumed = i === 0;
        }
        if (!consumed) {
            scanner.pos = start;
        }
        return consumed;
    }
    function isAbbreviation(ch) {
        return (ch > 64 && ch < 91) // uppercase letter
            || (ch > 96 && ch < 123) // lowercase letter
            || (ch > 47 && ch < 58) // number
            || specialChars.includes(ch); // special character
    }
    function isOpenBrace(ch, syntax) {
        return ch === 40 /* RoundL */ || (syntax === 'markup' && (ch === 91 /* SquareL */ || ch === 123 /* CurlyL */));
    }
    function isCloseBrace(ch, syntax) {
        return ch === 41 /* RoundR */ || (syntax === 'markup' && (ch === 93 /* SquareR */ || ch === 125 /* CurlyR */));
    }

    function expandAbbreviation(abbr, config) {
        const resolvedConfig = resolveConfig(config);
        return resolvedConfig.type === 'stylesheet'
            ? stylesheet(abbr, resolvedConfig)
            : markup(abbr, resolvedConfig);
    }
    /**
     * Expands given *markup* abbreviation (e.g. regular Emmet abbreviation that
     * produces structured output like HTML) and outputs it according to options
     * provided in config
     */
    function markup(abbr, config) {
        return stringify$1(parse$1(abbr, config), config);
    }
    /**
     * Expands given *stylesheet* abbreviation (a special Emmet abbreviation designed for
     * stylesheet languages like CSS, SASS etc.) and outputs it according to options
     * provided in config
     */
    function stylesheet(abbr, config) {
        return css(parse$1$1(abbr, config), config);
    }

    const pairs = {
        '{': '}',
        '[': ']',
        '(': ')'
    };
    const pairsEnd = [];
    for (const key of Object.keys(pairs)) {
        pairsEnd.push(pairs[key]);
    }
    /**
     * Returns `true` if given character code is a space
     */
    function isSpace$1(code) {
        return code === 32 /* space */
            || code === 9 /* tab */
            || code === 160 /* non-breaking space */
            || code === 10 /* LF */
            || code === 13; /* CR */
    }
    function pushRange(ranges, range) {
        const prev = ranges[ranges.length - 1];
        if (range && range[0] !== range[1] && (!prev || prev[0] !== range[0] || prev[1] !== range[1])) {
            ranges.push(range);
        }
    }
    /**
     * Returns ranges of tokens in given value. Tokens are space-separated words.
     */
    function tokenList(value, offset = 0) {
        const ranges = [];
        const len = value.length;
        let pos = 0;
        let start = 0;
        let end = 0;
        while (pos < len) {
            end = pos;
            const ch = value.charCodeAt(pos++);
            if (isSpace$1(ch)) {
                if (start !== end) {
                    ranges.push([offset + start, offset + end]);
                }
                while (isSpace$1(value.charCodeAt(pos))) {
                    pos++;
                }
                start = pos;
            }
        }
        if (start !== pos) {
            ranges.push([offset + start, offset + pos]);
        }
        return ranges;
    }
    /**
     * Check if given character is a quote
     */
    function isQuote$3(ch) {
        return ch === '"' || ch === '\'';
    }
    /**
     * Returns value of given attribute, parsed by Emmet HTML matcher
     */
    function attributeValue$1(attr) {
        const { value } = attr;
        return value && isQuoted(value)
            ? value.slice(1, -1)
            : value;
    }
    function attributeValueRange(tag, attr, offset = 0) {
        let valueStart = attr.valueStart;
        let valueEnd = attr.valueEnd;
        if (isQuote$3(tag[valueStart])) {
            valueStart++;
        }
        if (isQuote$3(tag[valueEnd - 1]) && valueEnd > valueStart) {
            valueEnd--;
        }
        return [offset + valueStart, offset + valueEnd];
    }
    /**
     * Check if given value is either quoted or written as expression
     */
    function isQuoted(value) {
        return !!value && (isQuotedString(value) || isExprString(value));
    }
    /**
     * Check if given string is quoted with single or double quotes
     */
    function isQuotedString(str) {
        return str.length > 1 && isQuote$3(str[0]) && str[0] === str.slice(-1);
    }
    /**
     * Check if given string contains expression, e.g. wrapped with `{` and `}`
     */
    function isExprString(str) {
        return str[0] === '{' && str.slice(-1) === '}';
    }
    /**
     * Returns last element of given array
     */
    function last$4(arr) {
        return arr.length > 0 ? arr[arr.length - 1] : undefined;
    }
    /**
     * Returns list of matched tags in given source code
     */
    function getTagMatches(code, options) {
        const opt = createOptions(options);
        const stack = [];
        const result = [];
        scan(code, (name, type, start, end) => {
            if (type === 3 /* SelfClose */) {
                result.push({ name, open: [start, end] });
            }
            else if (type === 1 /* Open */) {
                const item = { name, open: [start, end] };
                stack.push(item);
                result.push(item);
            }
            else {
                // Handle closing tag
                while (stack.length) {
                    const item = stack.pop();
                    if (item.name === name) {
                        item.close = [start, end];
                        break;
                    }
                }
            }
        }, opt);
        return result;
    }
    /**
     * Finds tag match for given position
     */
    function findTagMatch(source, pos, options) {
        if (typeof source === 'string') {
            source = getTagMatches(source, options);
        }
        let candidate;
        source.some(match => {
            const start = match.open[0];
            const end = match.close ? match.close[1] : match.open[1];
            if (pos < start) {
                // All the following tags will be after given position, stop searching
                return true;
            }
            if (pos > start && pos < end) {
                candidate = match;
            }
        });
        return candidate;
    }
    /**
     * Returns list of ranges for Select Next/Previous Item action
     */
    function selectItemHTML(code, pos, isPrev) {
        return isPrev ? selectPreviousItem(code, pos) : selectNextItem(code, pos);
    }
    /**
     * Returns list of ranges for Select Next Item action
     */
    function selectNextItem(code, pos) {
        let result = void 0;
        // Find open or self-closing tag, closest to given position
        scan(code, (name, type, start, end) => {
            if ((type === 1 /* Open */ || type === 3 /* SelfClose */) && end > pos) {
                // Found open or self-closing tag
                result = getTagSelectionModel(code, name, start, end);
                return false;
            }
        });
        return result;
    }
    /**
     * Returns list of ranges for Select Previous Item action
     */
    function selectPreviousItem(code, pos) {
        let lastType = null;
        let lastName = '';
        let lastStart = -1;
        let lastEnd = -1;
        // We should find the closest open or self-closing tag left to given `pos`.
        scan(code, (name, type, start, end) => {
            if (start >= pos) {
                return false;
            }
            if (type === 1 /* Open */ || type === 3 /* SelfClose */) {
                // Found open or self-closing tag
                lastName = name;
                lastType = type;
                lastStart = start;
                lastEnd = end;
            }
        });
        if (lastType !== null) {
            return getTagSelectionModel(code, lastName, lastStart, lastEnd);
        }
    }
    /**
     * Parses open or self-closing tag in `start:end` range of `code` and returns its
     * model for selecting items
     * @param code Document source code
     * @param name Name of matched tag
     */
    function getTagSelectionModel(code, name, start, end) {
        const ranges = [
            // Add tag name range
            [start + 1, start + 1 + name.length]
        ];
        // Parse and add attributes ranges
        const tagSrc = code.slice(start, end);
        for (const attr of attributes(tagSrc, name)) {
            if (attr.value != null) {
                // Attribute with value
                pushRange(ranges, [start + attr.nameStart, start + attr.valueEnd]);
                // Add (unquoted) value range
                const val = valueRange(attr);
                if (val[0] !== val[1]) {
                    pushRange(ranges, [start + val[0], start + val[1]]);
                    if (attr.name === 'class') {
                        // For class names, split value into space-separated tokens
                        const tokens = tokenList(tagSrc.slice(val[0], val[1]), start + val[0]);
                        for (const token of tokens) {
                            pushRange(ranges, token);
                        }
                    }
                }
            }
            else {
                // Attribute without value (boolean)
                pushRange(ranges, [start + attr.nameStart, start + attr.nameEnd]);
            }
        }
        return { start, end, ranges };
    }
    /**
     * Returns value range of given attribute. Value range is unquoted.
     */
    function valueRange(attr) {
        const value = attr.value;
        const ch = value[0];
        const lastCh = value[value.length - 1];
        if (ch === '"' || ch === '\'') {
            return [
                attr.valueStart + 1,
                attr.valueEnd - (lastCh === ch ? 1 : 0)
            ];
        }
        if (ch === '{' && lastCh === '}') {
            return [
                attr.valueStart + 1,
                attr.valueEnd - 1
            ];
        }
        return [attr.valueStart, attr.valueEnd];
    }
    /**
     * Returns list of ranges for Select Next/Previous CSS Item  action
     */
    function selectItemCSS(code, pos, isPrev) {
        return isPrev ? selectPreviousItem$1(code, pos) : selectNextItem$1(code, pos);
    }
    /**
     * Returns regions for selecting next item in CSS
     */
    function selectNextItem$1(code, pos) {
        let result = void 0;
        let pendingProperty = void 0;
        scan$1(code, (type, start, end, delimiter) => {
            if (start < pos) {
                return;
            }
            if (type === "selector" /* Selector */) {
                result = { start, end, ranges: [[start, end]] };
                return false;
            }
            else if (type === "propertyName" /* PropertyName */) {
                pendingProperty = [start, end, delimiter];
            }
            else if (type === "propertyValue" /* PropertyValue */) {
                result = {
                    start,
                    end: delimiter !== -1 ? delimiter + 1 : end,
                    ranges: []
                };
                if (pendingProperty) {
                    // Full property range
                    result.start = pendingProperty[0];
                    pushRange(result.ranges, [pendingProperty[0], result.end]);
                }
                // Full value range
                pushRange(result.ranges, [start, end]);
                // Value fragments
                for (const r of splitValue(code.substring(start, end))) {
                    pushRange(result.ranges, [r[0] + start, r[1] + start]);
                }
                return false;
            }
            else if (pendingProperty) {
                result = {
                    start: pendingProperty[0],
                    end: pendingProperty[1],
                    ranges: [[pendingProperty[0], pendingProperty[1]]]
                };
                return false;
            }
        });
        return result;
    }
    /**
     * Returns regions for selecting previous item in CSS
     */
    function selectPreviousItem$1(code, pos) {
        const state = {
            type: null,
            start: -1,
            end: -1,
            valueStart: -1,
            valueEnd: -1,
            valueDelimiter: -1,
        };
        scan$1(code, (type, start, end, delimiter) => {
            // Accumulate context until we reach given position
            if (start >= pos && type !== "propertyValue" /* PropertyValue */) {
                return false;
            }
            if (type === "selector" /* Selector */ || type === "propertyName" /* PropertyName */) {
                state.start = start;
                state.end = end;
                state.type = type;
                state.valueStart = state.valueEnd = state.valueDelimiter = -1;
            }
            else if (type === "propertyValue" /* PropertyValue */) {
                state.valueStart = start;
                state.valueEnd = end;
                state.valueDelimiter = delimiter;
            }
        });
        if (state.type === "selector" /* Selector */) {
            return {
                start: state.start,
                end: state.end,
                ranges: [[state.start, state.end]]
            };
        }
        if (state.type === "propertyName" /* PropertyName */) {
            const result = {
                start: state.start,
                end: state.end,
                ranges: []
            };
            if (state.valueStart !== -1) {
                result.end = state.valueDelimiter !== -1 ? state.valueDelimiter + 1 : state.valueEnd;
                // Full property range
                pushRange(result.ranges, [state.start, result.end]);
                // Full value range
                pushRange(result.ranges, [state.valueStart, state.valueEnd]);
                // Value fragments
                for (const r of splitValue(code.substring(state.valueStart, state.valueEnd))) {
                    pushRange(result.ranges, [r[0] + state.valueStart, r[1] + state.valueStart]);
                }
            }
            else {
                pushRange(result.ranges, [state.start, state.end]);
            }
            return result;
        }
    }

    /**
     * Returns HTML context for given location in source code
     */
    function getHTMLContext(code, pos, opt = {}) {
        const result = {
            type: 'html',
            ancestors: [],
            current: null,
            css: null
        };
        // Since we expect large input document, we’ll use pooling technique
        // for storing tag data to reduce memory pressure and improve performance
        const pool = [];
        const stack = [];
        const options = createOptions({ xml: opt.xml, allTokens: true });
        scan(code, (name, type, start, end) => {
            if (start >= pos) {
                // Moved beyond location, stop parsing
                return false;
            }
            if (start < pos && pos < end) {
                // Direct hit on element
                result.current = { name, type, range: [start, end] };
                return false;
            }
            if (type === 1 /* Open */ && isSelfClose$1(name, options)) {
                // Found empty element in HTML mode, mark is as self-closing
                type = 3 /* SelfClose */;
            }
            if (type === 1 /* Open */) {
                // Allocate tag object from pool
                stack.push(allocItem(pool, name, type, start, end));
            }
            else if (type === 2 /* Close */ && stack.length && last$4(stack).name === name) {
                // Release tag object for further re-use
                releaseItem(pool, stack.pop());
            }
        }, options);
        // Record stack elements as ancestors
        stack.forEach(item => {
            result.ancestors.push({
                name: item.name,
                range: [item.start, item.end]
            });
        });
        if (!opt.skipCSS) {
            // Detect if position is inside CSS context
            result.css = detectCSSContextFromHTML(code, pos, result);
        }
        return result;
    }
    /**
     * Returns CSS context for given location in source code
     */
    function getCSSContext(code, pos, embedded) {
        const result = {
            type: 'css',
            ancestors: [],
            current: null,
            inline: false,
            embedded
        };
        const pool = [];
        const stack = [];
        scan$1(code, (type, start, end) => {
            if (start >= pos) {
                // Token behind specified location, stop parsing
                return false;
            }
            if (start < pos && pos <= end) {
                // Direct hit on token
                result.current = {
                    name: code.slice(start, end),
                    type,
                    range: [start, end]
                };
                return false;
            }
            switch (type) {
                case "selector" /* Selector */:
                case "propertyName" /* PropertyName */:
                    stack.push(allocItem(pool, code.slice(start, end), type, start, end));
                    break;
                case "propertyValue" /* PropertyValue */:
                case "blockEnd" /* BlockEnd */:
                    stack.pop();
                    break;
            }
        });
        stack.forEach(item => {
            result.ancestors.push({
                name: item.name,
                type: item.type,
                range: [item.start, item.end]
            });
        });
        return result;
    }
    /**
     * Returns embedded stylesheet syntax from given HTML context
     */
    function getEmbeddedStyleSyntax(code, ctx) {
        const parent = last$4(ctx.ancestors);
        if (parent && parent.name === 'style') {
            for (const attr of attributes(code.slice(parent.range[0], parent.range[1]), parent.name)) {
                if (attr.name === 'type') {
                    return attributeValue$1(attr);
                }
            }
        }
    }
    /**
     * Returns context for Emmet abbreviation from given HTML context
     */
    function getMarkupAbbreviationContext(code, ctx) {
        const parent = last$4(ctx.ancestors);
        if (parent) {
            const attrs = {};
            for (const attr of attributes(code.slice(parent.range[0], parent.range[1]), parent.name)) {
                attrs[attr.name] = attributeValue$1(attr) || '';
            }
            return {
                name: parent.name,
                attributes: attrs
            };
        }
    }
    /**
     * Returns context for Emmet abbreviation from given CSS context
     */
    function getStylesheetAbbreviationContext(ctx) {
        if (ctx.inline) {
            return { name: "@@property" /* Property */ };
        }
        const parent = last$4(ctx.ancestors);
        let scope = "@@global" /* Global */;
        if (ctx.current) {
            if (ctx.current.type === "propertyValue" /* PropertyValue */ && parent) {
                scope = parent.name;
            }
            else if ((ctx.current.type === "selector" /* Selector */ || ctx.current.type === "propertyName" /* PropertyName */) && !parent) {
                scope = "@@section" /* Section */;
            }
        }
        return {
            name: scope
        };
    }
    /**
     * Tries to detect CSS context from given HTML context and returns it
     */
    function detectCSSContextFromHTML(code, pos, ctx) {
        let cssCtx = null;
        if (ctx.current) {
            // Maybe inline CSS?
            const elem = ctx.current;
            if (elem.type === 1 /* Open */ || elem.type === 2 /* Close */) {
                const tag = code.slice(elem.range[0], elem.range[1]);
                attributes(tag, elem.name).some(attr => {
                    if (attr.name === 'style' && attr.value != null) {
                        const [valueStart, valueEnd] = attributeValueRange(tag, attr, elem.range[0]);
                        if (pos >= valueStart && pos <= valueEnd) {
                            cssCtx = getCSSContext(code.slice(valueStart, valueEnd), pos - valueStart, [valueStart, valueEnd]);
                            applyOffset(cssCtx, valueStart);
                            cssCtx.inline = true;
                            return true;
                        }
                    }
                });
            }
        }
        else if (ctx.ancestors.length) {
            // Maybe inside `<style>` element?
            const parent = last$4(ctx.ancestors);
            if (parent.name === 'style') {
                // Find closing </style> tag
                const styleStart = parent.range[1];
                let styleEnd = code.length;
                scan(code.slice(parent.range[1]), (name, type, start) => {
                    if (name === parent.name && type === 2 /* Close */) {
                        styleEnd = start + styleStart;
                        return false;
                    }
                });
                cssCtx = getCSSContext(code.slice(styleStart, styleEnd), pos - styleStart, [styleStart, styleEnd]);
                applyOffset(cssCtx, styleStart);
            }
        }
        return cssCtx;
    }
    /**
     * Check if given tag is self-close for current parsing context
     */
    function isSelfClose$1(name, options) {
        return !options.xml && options.empty.includes(name);
    }
    function allocItem(pool, name, type, start, end) {
        if (pool.length) {
            const tag = pool.pop();
            tag.name = name;
            tag.type = type;
            tag.start = start;
            tag.end = end;
            return tag;
        }
        return { name, type, start, end };
    }
    function releaseItem(pool, item) {
        pool.push(item);
    }
    function applyOffset(ctx, offset) {
        ctx.ancestors.forEach(item => {
            offsetRange(item.range, offset);
        });
        if (ctx.current) {
            offsetRange(ctx.current.range, offset);
        }
    }
    function offsetRange(range, offset) {
        range[0] += offset;
        range[1] += offset;
    }

    const JSX_PREFIX = '<';
    const reJSXAbbrStart = /^[a-zA-Z.#\[\(]$/;
    const reWordBound = /^[\s>;"\']?[a-zA-Z.#!@\[\(]$/;
    const reStylesheetWordBound = /^[\s;"\']?[a-zA-Z!@]$/;
    /**
     * Controller for tracking Emmet abbreviations in editor as user types.
     * Controller designed to be extended ad-hoc in editor plugins, overriding some
     * methods `mark()` to match editor behavior
     */
    class AbbreviationTrackingController {
        constructor() {
            this.cache = new Map();
            this.trackers = new Map();
            this.lastPos = new Map();
        }
        /**
         * Returns last known location of caret in given editor
         */
        getLastPost(editor) {
            return this.lastPos.get(editor.id);
        }
        /**
         * Sets last known caret location for given editor
         */
        setLastPos(editor, pos) {
            this.lastPos.set(editor.id, pos);
        }
        /**
         * Returns abbreviation tracker for given editor, if any
         */
        getTracker(editor) {
            return this.trackers.get(editor.id);
        }
        /**
         * Detects if user is typing abbreviation at given location
         */
        typingAbbreviation(editor, pos) {
            var _a;
            // Start tracking only if user starts abbreviation typing: entered first
            // character at the word bound
            // NB: get last 2 characters: first should be a word bound(or empty),
            // second must be abbreviation start
            const prefix = editor.substr(Math.max(0, pos - 2), pos);
            const syntax = editor.syntax();
            let start = -1;
            let end = pos;
            let offset = 0;
            if (editor.isJSX(syntax)) {
                // In JSX, abbreviations should be prefixed
                if (prefix.length === 2 && prefix[0] === JSX_PREFIX && reJSXAbbrStart.test(prefix[1])) {
                    start = pos - 2;
                    offset = JSX_PREFIX.length;
                }
            }
            else if (reWordBound.test(prefix)) {
                start = pos - 1;
            }
            if (start >= 0) {
                // Check if there’s paired character
                const lastCh = prefix[prefix.length - 1];
                if (lastCh in pairs && editor.substr(pos, pos + 1) === pairs[lastCh]) {
                    end++;
                }
                const config = this.getActivationContext(editor, pos);
                if (config) {
                    if (config.type === 'stylesheet' && !reStylesheetWordBound.test(prefix)) {
                        // Additional check for stylesheet abbreviation start: it’s slightly
                        // differs from markup prefix, but we need activation context
                        // to ensure that context under caret is CSS
                        return;
                    }
                    const tracker = this.startTracking(editor, start, end, { offset, config });
                    if (tracker && tracker.type === "abbreviation" /* Abbreviation */ && ((_a = config.context) === null || _a === void 0 ? void 0 : _a.name) === "@@section" /* Section */) {
                        // Make a silly check for section context: if user start typing
                        // CSS selector at the end of file, it will be treated as property
                        // name and provide unrelated completion by default.
                        // We should check if captured abbreviation actually matched
                        // snippet to continue. Otherwise, ignore this abbreviation.
                        // By default, unresolved abbreviations are converted to CSS properties,
                        // e.g. `a` → `a: ;`. If that’s the case, stop tracking
                        const { abbreviation, preview } = tracker;
                        if (preview.startsWith(abbreviation) && /^:\s*;?$/.test(preview.slice(abbreviation.length))) {
                            this.stopTracking(editor);
                            return;
                        }
                    }
                    return tracker;
                }
            }
        }
        /**
         * Starts abbreviation tracking for given editor
         * @param start Location of abbreviation start
         * @param pos Current caret position, must be greater that `start`
         */
        startTracking(editor, start, pos, params) {
            const config = (params === null || params === void 0 ? void 0 : params.config) || editor.config(start);
            const tracker = this.createTracker(editor, [start, pos], Object.assign({ config }, params));
            if (tracker) {
                this.trackers.set(editor.id, tracker);
                return tracker;
            }
            this.trackers.delete(editor.id);
        }
        /**
         * Stops abbreviation tracking in given editor instance
         */
        stopTracking(editor, params) {
            const tracker = this.getTracker(editor);
            if (tracker) {
                editor.unmark(tracker);
                if (tracker.forced && !(params === null || params === void 0 ? void 0 : params.skipRemove)) {
                    // Contents of forced abbreviation must be removed
                    editor.replace('', tracker.range[0], tracker.range[1]);
                }
                if (params === null || params === void 0 ? void 0 : params.force) {
                    this.cache.delete(editor.id);
                }
                else {
                    // Store tracker in history to restore it if user continues editing
                    this.storeTracker(editor, tracker);
                }
                this.trackers.delete(editor.id);
            }
        }
        /**
         * Creates abbreviation tracker for given range in editor. Parses contents
         * of abbreviation in range and returns either valid abbreviation tracker,
         * error tracker or `null` if abbreviation cannot be created from given range
         */
        createTracker(editor, range, params) {
            if (range[0] >= range[1]) {
                // Invalid range
                return null;
            }
            let abbreviation = editor.substr(range[0], range[1]);
            const { config } = params;
            if (params.offset) {
                abbreviation = abbreviation.slice(params.offset);
            }
            // Basic validation: do not allow empty abbreviations
            // or newlines in abbreviations
            if (!abbreviation || /[\r\n]/.test(abbreviation)) {
                return null;
            }
            const base = {
                abbreviation,
                range,
                config,
                forced: !!params.forced,
                offset: params.offset || 0,
                lastPos: range[1],
                lastLength: editor.size(),
            };
            try {
                let parsedAbbr;
                let simple = false;
                if (config.type === 'stylesheet') {
                    parsedAbbr = parse(abbreviation);
                }
                else {
                    parsedAbbr = parseAbbreviation(abbreviation, {
                        jsx: config.syntax === 'jsx'
                    });
                    simple = this.isSimpleMarkupAbbreviation(parsedAbbr);
                }
                const previewConfig = editor.previewConfig(config);
                return Object.assign(Object.assign({}, base), { type: "abbreviation" /* Abbreviation */, simple, preview: expandAbbreviation(parsedAbbr, previewConfig) });
            }
            catch (error) {
                return Object.assign(Object.assign({}, base), { type: "error" /* Error */, error });
            }
        }
        /**
         * Stores given tracker in separate cache to restore later
         */
        storeTracker(editor, tracker) {
            this.cache.set(editor.id, tracker);
        }
        /**
         * Returns stored tracker for given editor proxy, if any
         */
        getStoredTracker(editor) {
            return this.cache.get(editor.id);
        }
        /**
         * Tries to restore abbreviation tracker for given editor at specified position
         */
        restoreTracker(editor, pos) {
            const tracker = this.getStoredTracker(editor);
            if (tracker && tracker.range[0] <= pos && tracker.range[1] >= pos) {
                // Tracker can be restored at given location. Make sure it’s contents matches
                // contents of editor at the same location. If it doesn’t, reset stored tracker
                // since it’s not valid anymore
                this.cache.delete(editor.id);
                const [from, to] = tracker.range;
                if (editor.substr(from + tracker.offset, to) === tracker.abbreviation) {
                    this.trackers.set(editor.id, tracker);
                    return tracker;
                }
            }
        }
        /**
         * Handle content change in given editor instance
         */
        handleChange(editor, pos) {
            const tracker = this.getTracker(editor);
            const editorLastPos = this.getLastPost(editor);
            this.setLastPos(editor, pos);
            if (!tracker) {
                // No active tracker, check if we user is actually typing it
                if (editorLastPos != null && editorLastPos === pos - 1 && editor.allowTracking(pos)) {
                    return this.typingAbbreviation(editor, pos);
                }
                return;
            }
            const { lastPos } = tracker;
            let { range } = tracker;
            if (lastPos < range[0] || lastPos > range[1]) {
                // Updated content outside abbreviation: reset tracker
                this.stopTracking(editor);
                return;
            }
            const length = editor.size();
            const delta = length - tracker.lastLength;
            range = range.slice();
            // Modify range and validate it: if it leads to invalid abbreviation, reset tracker
            updateRange(range, delta, lastPos);
            // Handle edge case: empty forced abbreviation is allowed
            if (range[0] === range[1] && tracker.forced) {
                tracker.abbreviation = '';
                return tracker;
            }
            const nextTracker = this.createTracker(editor, range, tracker);
            if (!nextTracker || (!tracker.forced && !isValidTracker(nextTracker, range, pos))) {
                this.stopTracking(editor);
                return;
            }
            nextTracker.lastPos = pos;
            this.trackers.set(editor.id, nextTracker);
            editor.mark(nextTracker);
            return nextTracker;
        }
        /**
         * Handle selection (caret) change in given editor instance
         */
        handleSelectionChange(editor, pos) {
            this.setLastPos(editor, pos);
            const tracker = this.getTracker(editor) || this.restoreTracker(editor, pos);
            if (tracker) {
                tracker.lastPos = pos;
                return tracker;
            }
        }
        /**
         * Detects and returns valid abbreviation activation context for given location
         * in editor which can be used for abbreviation expanding.
         * For example, in given HTML code:
         * `<div title="Sample" style="">Hello world</div>`
         * it’s not allowed to expand abbreviations inside `<div ...>` or `</div>`,
         * yet it’s allowed inside `style` attribute and between tags.
         *
         * This method ensures that given `pos` is inside location allowed for expanding
         * abbreviations and returns context data about it.
         *
         * Default implementation works for any editor since it uses own parsers for HTML
         * and CSS but might be slow: if your editor supports low-level access to document
         * parse tree or tokens, authors should override this method and provide alternative
         * based on editor native features.
         */
        getActivationContext(editor, pos) {
            const syntax = editor.syntax();
            const content = editor.substr();
            if (editor.isCSS(syntax)) {
                return this.getCSSActivationContext(editor, pos, syntax, getCSSContext(content, pos));
            }
            if (editor.isHTML(syntax)) {
                const ctx = getHTMLContext(content, pos, { xml: editor.isXML(syntax) });
                if (ctx.css) {
                    return this.getCSSActivationContext(editor, pos, getEmbeddedStyleSyntax(content, ctx) || 'css', ctx.css);
                }
                if (!ctx.current) {
                    return {
                        syntax,
                        type: 'markup',
                        context: getMarkupAbbreviationContext(content, ctx),
                        options: editor.outputOptions(pos)
                    };
                }
            }
            else {
                return {
                    syntax,
                    type: editor.syntaxType(syntax)
                };
            }
        }
        getCSSActivationContext(editor, pos, syntax, ctx) {
            // CSS abbreviations can be activated only when a character is entered, e.g.
            // it should be either property name or value.
            // In come cases, a first character of selector should also be considered
            // as activation context
            if (!ctx.current) {
                return void 0;
            }
            const allowedContext = ctx.current.type === "propertyName" /* PropertyName */
                || ctx.current.type === "propertyValue" /* PropertyValue */
                || this.isTypingBeforeSelector(editor, pos, ctx);
            if (allowedContext) {
                return {
                    syntax,
                    type: 'stylesheet',
                    context: getStylesheetAbbreviationContext(ctx),
                    options: editor.outputOptions(pos, ctx.inline)
                };
            }
        }
        /**
         * Handle edge case: start typing abbreviation before selector. In this case,
         * entered character becomes part of selector
         * Activate only if it’s a nested section and it’s a first character of selector
         */
        isTypingBeforeSelector(editor, pos, { current }) {
            if (current && current.type === "selector" /* Selector */ && current.range[0] === pos - 1) {
                // Typing abbreviation before selector is tricky one:
                // ensure it’s on its own line
                const line = editor.substr(current.range[0], current.range[1]).split(/[\n\r]/)[0];
                return line.trim().length === 1;
            }
            return false;
        }
        /**
         * Check if given parsed markup abbreviation is simple.A simple abbreviation
         * may not be displayed to user as preview to reduce distraction
         */
        isSimpleMarkupAbbreviation(abbr) {
            if (abbr.children.length === 1 && !abbr.children[0].children.length) {
                // Single element: might be a HTML element or text snippet
                const first = abbr.children[0];
                // XXX silly check for common snippets like `!`. Should read contents
                // of expanded abbreviation instead
                return !first.name || /^[a-z]/i.test(first.name);
            }
            return !abbr.children.length;
        }
        /**
         * Method should be called when given editor instance will be no longer
         * available to clean up cached data
         */
        disposeEditor(editor) {
            this.cache.delete(editor.id);
            this.trackers.delete(editor.id);
            this.lastPos.delete(editor.id);
        }
    }
    function updateRange(range, delta, lastPos) {
        if (delta < 0) {
            // Content removed
            if (lastPos === range[0]) {
                // Updated content at the abbreviation edge
                range[0] += delta;
                range[1] += delta;
            }
            else if (range[0] < lastPos && lastPos <= range[1]) {
                range[1] += delta;
            }
        }
        else if (delta > 0 && range[0] <= lastPos && lastPos <= range[1]) {
            // Content inserted
            range[1] += delta;
        }
        return range;
    }
    /**
     * Check if given tracker is in valid state for keeping it marked
     */
    function isValidTracker(tracker, range, pos) {
        if (tracker.type === "error" /* Error */) {
            if (range[1] === pos) {
                // Last entered character is invalid
                return false;
            }
            const { abbreviation } = tracker;
            const start = range[0];
            let targetPos = range[1];
            while (targetPos > start) {
                if (pairsEnd.includes(abbreviation[targetPos - start - 1])) {
                    targetPos--;
                }
                else {
                    break;
                }
            }
            return targetPos !== pos;
        }
        return true;
    }

    /** Characters to indicate tab stop start and end in generated snippet */
    const tabStopStart = String.fromCodePoint(0xFFF0);
    const tabStopEnd = String.fromCodePoint(0xFFF1);
    const stateKey = '$$emmet';
    const pairs$1 = {
        '{': '}',
        '[': ']',
        '(': ')'
    };
    for (const key of Object.keys(pairs$1)) {
    }
    let idCounter = 0;
    /**
     * Returns copy of region which starts and ends at non-space character
     */
    function narrowToNonSpace(editor, range) {
        const text = substr(editor, range);
        let startOffset = 0;
        let endOffset = text.length;
        while (startOffset < endOffset && isSpace$2(text[startOffset])) {
            startOffset++;
        }
        while (endOffset > startOffset && isSpace$2(text[endOffset - 1])) {
            endOffset--;
        }
        return [range[0] + startOffset, range[0] + endOffset];
    }
    /**
     * Replaces given range in editor with snippet contents
     */
    function replaceWithSnippet(editor, range, snippet) {
        let fieldStartIx = snippet.indexOf(tabStopStart);
        let fieldEndIx = snippet.indexOf(tabStopEnd);
        let selFrom;
        let selTo;
        if (fieldStartIx !== -1 && fieldEndIx !== -1) {
            selFrom = range[0] + fieldStartIx;
            selTo = range[0] + fieldEndIx - tabStopStart.length;
            snippet = snippet.slice(0, fieldStartIx)
                + snippet.slice(fieldStartIx + tabStopStart.length, fieldEndIx)
                + snippet.slice(fieldEndIx + tabStopEnd.length);
        }
        else if (fieldStartIx !== -1) {
            selFrom = range[0] + fieldStartIx;
            snippet = snippet.slice(0, fieldStartIx)
                + snippet.slice(fieldStartIx + tabStopStart.length);
        }
        return editor.operation(() => {
            const [from, to] = toRange(editor, range);
            editor.replaceRange(snippet, from, to);
            // Position cursor
            if (selFrom != null) {
                const selFromPos = editor.posFromIndex(selFrom);
                const selToPos = selTo != null ? editor.posFromIndex(selTo) : void 0;
                if (selToPos) {
                    editor.setSelection(selFromPos, selToPos);
                }
                else {
                    editor.setCursor(selFromPos);
                }
            }
            return true;
        });
    }
    /**
     * Returns current caret position for single selection
     */
    function getCaret(editor) {
        const pos = editor.getCursor();
        return editor.indexFromPos(pos);
    }
    /**
     * Returns full text content of given editor
     */
    function getContent(editor) {
        return editor.getValue();
    }
    /**
     * Returns substring of given editor content for specified range
     */
    function substr(editor, range) {
        const [from, to] = toRange(editor, range);
        return editor.getRange(from, to);
    }
    /**
     * Converts given index range to editor’s position range
     */
    function toRange(editor, range) {
        return [
            editor.posFromIndex(range[0]),
            editor.posFromIndex(range[1])
        ];
    }
    /**
     * Returns value of given attribute, parsed by Emmet HTML matcher
     */
    function attributeValue$2(attr) {
        const { value } = attr;
        return value && isQuoted$1(value)
            ? value.slice(1, -1)
            : value;
    }
    /**
     * Check if given value is either quoted or written as expression
     */
    function isQuoted$1(value) {
        return !!value && (isQuotedString$1(value) || isExprString$1(value));
    }
    function isQuote$4(ch) {
        return ch === '"' || ch === "'";
    }
    /**
     * Check if given string is quoted with single or double quotes
     */
    function isQuotedString$1(str) {
        return str.length > 1 && isQuote$4(str[0]) && str[0] === str.slice(-1);
    }
    /**
     * Check if given string contains expression, e.g. wrapped with `{` and `}`
     */
    function isExprString$1(str) {
        return str[0] === '{' && str.slice(-1) === '}';
    }
    function isSpace$2(ch) {
        return /^[\s\n\r]+$/.test(ch);
    }
    function htmlEscape(str) {
        const replaceMap = {
            '<': '&lt;',
            '>': '&gt;',
            '&': '&amp;',
        };
        return str.replace(/[<>&]/g, ch => replaceMap[ch]);
    }
    /**
     * Returns special object for bypassing command handling
     */
    function pass(editor) {
        return editor.constructor['Pass'];
    }
    /**
     * Converts given CodeMirror range to text range
     */
    function textRange(editor, range) {
        const head = editor.indexFromPos(range.head);
        const anchor = editor.indexFromPos(range.anchor);
        return [
            Math.min(head, anchor),
            Math.max(head, anchor)
        ];
    }
    /**
     * Check if `a` and `b` contains the same range
     */
    function rangesEqual(a, b) {
        return a[0] === b[0] && a[1] === b[1];
    }
    /**
     * Check if range `a` fully contains range `b`
     */
    function rangeContains(a, b) {
        return a[0] <= b[0] && a[1] >= b[1];
    }
    /**
     * Check if given range is empty
     */
    function rangeEmpty(r) {
        return r[0] === r[1];
    }
    /**
     * Generates snippet with error pointer
     */
    function errorSnippet(err, baseClass = 'emmet-error-snippet') {
        const msg = err.message.split('\n')[0];
        const spacer = ' '.repeat(err.pos || 0);
        return `<div class="${baseClass}">
        <div class="${baseClass}-ptr">
            <div class="${baseClass}-line"></div>
            <div class="${baseClass}-tip"></div>
            <div class="${baseClass}-spacer">${spacer}</div>
        </div>
        <div class="${baseClass}-message">${htmlEscape(msg.replace(/\s+at\s+\d+$/, ''))}</div>
    </div>`;
    }
    /**
     * Returns last element in given array
     */
    function last$5(arr) {
        return arr.length > 0 ? arr[arr.length - 1] : undefined;
    }
    /**
     * Check if given editor instance has internal Emmet state
     */
    function hasInternalState(editor) {
        return stateKey in editor;
    }
    /**
     * Returns internal Emmet state for given editor instance
     */
    function getInternalState(editor) {
        if (!hasInternalState(editor)) {
            editor[stateKey] = { id: String(idCounter++) };
        }
        return editor[stateKey];
    }

    const xmlSyntaxes = ['xml', 'xsl', 'jsx'];
    const htmlSyntaxes = ['html', 'htmlmixed', 'vue'];
    const cssSyntaxes = ['css', 'scss', 'less'];
    const jsxSyntaxes = ['jsx', 'tsx'];
    const markupSyntaxes = ['haml', 'jade', 'pug', 'slim'].concat(htmlSyntaxes, xmlSyntaxes, jsxSyntaxes);
    const stylesheetSyntaxes = ['sass', 'sss', 'stylus', 'postcss'].concat(cssSyntaxes);
    /**
     * Returns Emmet syntax info for given location in view.
     * Syntax info is an abbreviation type (either 'markup' or 'stylesheet') and syntax
     * name, which is used to apply syntax-specific options for output.
     *
     * By default, if given location doesn’t match any known context, this method
     * returns `null`, but if `fallback` argument is provided, it returns data for
     * given fallback syntax
     */
    function syntaxInfo(editor, pos) {
        let syntax = docSyntax(editor);
        let inline;
        let context;
        if (isHTML(syntax)) {
            const content = getContent(editor);
            context = getHTMLContext(content, pos, {
                xml: isXML(syntax)
            });
            if (context.css) {
                // `pos` is in embedded CSS
                syntax = getEmbeddedStyleSyntax$1(content, context) || 'css';
                inline = context.css.inline;
                context = context.css;
            }
        }
        else if (isCSS(syntax)) {
            context = getCSSContext(getContent(editor), pos);
        }
        return {
            type: getSyntaxType(syntax),
            syntax,
            inline,
            context
        };
    }
    /**
     * Returns syntax for given position in editor
     */
    function syntaxFromPos(editor, pos) {
        const p = editor.posFromIndex(pos);
        const mode = editor.getModeAt(p);
        if (mode && mode.name === 'xml') {
            // XML mode is used for styling HTML as well
            return mode.configuration || mode.name;
        }
        return mode && mode.name;
    }
    /**
     * Returns main editor syntax
     */
    function docSyntax(editor) {
        const mode = editor.getMode();
        if (mode) {
            return mode.name === 'htmlmixed' ? 'html' : (mode.name || '');
        }
        return '';
    }
    /**
     * Returns Emmet abbreviation type for given syntax
     */
    function getSyntaxType(syntax) {
        return syntax && stylesheetSyntaxes.includes(syntax) ? 'stylesheet' : 'markup';
    }
    /**
     * Check if given syntax is XML dialect
     */
    function isXML(syntax) {
        return syntax ? xmlSyntaxes.includes(syntax) : false;
    }
    /**
     * Check if given syntax is HTML dialect (including XML)
     */
    function isHTML(syntax) {
        return syntax
            ? htmlSyntaxes.includes(syntax) || isXML(syntax)
            : false;
    }
    /**
     * Check if given syntax name is supported by Emmet
     */
    function isSupported(syntax) {
        return syntax
            ? markupSyntaxes.includes(syntax) || stylesheetSyntaxes.includes(syntax)
            : false;
    }
    /**
     * Check if given syntax is a CSS dialect. Note that it’s not the same as stylesheet
     * syntax: for example, SASS is a stylesheet but not CSS dialect (but SCSS is)
     */
    function isCSS(syntax) {
        return syntax ? cssSyntaxes.includes(syntax) : false;
    }
    /**
     * Check if given syntax is JSX dialect
     */
    function isJSX(syntax) {
        return syntax ? jsxSyntaxes.includes(syntax) : false;
    }
    /**
     * Check if given option if enabled for specified syntax
     */
    function enabledForSyntax(opt, info) {
        if (opt === true) {
            return true;
        }
        if (Array.isArray(opt)) {
            const candidates = [info.type, info.syntax];
            if (info.inline) {
                candidates.push(`${info.type}-inline`, `${info.syntax}-inline`);
            }
            return candidates.some(c => opt.includes(c));
        }
        return false;
    }
    /**
     * Returns embedded stylesheet syntax from given HTML context
     */
    function getEmbeddedStyleSyntax$1(code, ctx) {
        const parent = last$5(ctx.ancestors);
        if (parent && parent.name === 'style') {
            for (const attr of attributes(code.slice(parent.range[0], parent.range[1]), parent.name)) {
                if (attr.name === 'type') {
                    return attributeValue$2(attr);
                }
            }
        }
    }
    /**
     * Returns context for Emmet abbreviation from given HTML context
     */
    function getMarkupAbbreviationContext$1(code, ctx) {
        const parent = last$5(ctx.ancestors);
        if (parent) {
            const attrs = {};
            for (const attr of attributes(code.slice(parent.range[0], parent.range[1]), parent.name)) {
                attrs[attr.name] = attributeValue$2(attr) || '';
            }
            return {
                name: parent.name,
                attributes: attrs
            };
        }
    }
    /**
     * Returns context for Emmet abbreviation from given CSS context
     */
    function getStylesheetAbbreviationContext$1(ctx) {
        if (ctx.inline) {
            return { name: "@@property" /* Property */ };
        }
        const parent = last$5(ctx.ancestors);
        let scope = "@@global" /* Global */;
        if (ctx.current) {
            if (ctx.current.type === "propertyValue" /* PropertyValue */ && parent) {
                scope = parent.name;
            }
            else if ((ctx.current.type === "selector" /* Selector */ || ctx.current.type === "propertyName" /* PropertyName */) && !parent) {
                scope = "@@section" /* Section */;
            }
        }
        return {
            name: scope
        };
    }

    const nullary = token("null" /* Null */, 0);
    /**
     * Parses given expression in forward direction
     */
    function parse$2(expr) {
        const scanner = typeof expr === 'string' ? new Scanner(expr) : expr;
        let ch;
        let priority = 0;
        let expected = (1 /* Primary */ | 4 /* LParen */ | 16 /* Sign */);
        const tokens = [];
        while (!scanner.eof()) {
            scanner.eatWhile(isWhiteSpace);
            scanner.start = scanner.pos;
            if (consumeNumber$1(scanner)) {
                if ((expected & 1 /* Primary */) === 0) {
                    error$2('Unexpected number', scanner);
                }
                tokens.push(number(scanner.current()));
                expected = (2 /* Operator */ | 8 /* RParen */);
            }
            else if (isOperator$3(scanner.peek())) {
                ch = scanner.next();
                if (isSign(ch) && (expected & 16 /* Sign */)) {
                    if (isNegativeSign(ch)) {
                        tokens.push(op1(ch, priority));
                    }
                    expected = (1 /* Primary */ | 4 /* LParen */ | 16 /* Sign */);
                }
                else {
                    if ((expected & 2 /* Operator */) === 0) {
                        error$2('Unexpected operator', scanner);
                    }
                    tokens.push(op2(ch, priority));
                    expected = (1 /* Primary */ | 4 /* LParen */ | 16 /* Sign */);
                }
            }
            else if (scanner.eat(40 /* LeftParenthesis */)) {
                if ((expected & 4 /* LParen */) === 0) {
                    error$2('Unexpected "("', scanner);
                }
                priority += 10;
                expected = (1 /* Primary */ | 4 /* LParen */ | 16 /* Sign */ | 32 /* NullaryCall */);
            }
            else if (scanner.eat(41 /* RightParenthesis */)) {
                priority -= 10;
                if (expected & 32 /* NullaryCall */) {
                    tokens.push(nullary);
                }
                else if ((expected & 8 /* RParen */) === 0) {
                    error$2('Unexpected ")"', scanner);
                }
                expected = (2 /* Operator */ | 8 /* RParen */ | 4 /* LParen */);
            }
            else {
                error$2('Unknown character', scanner);
            }
        }
        if (priority < 0 || priority >= 10) {
            error$2('Unmatched "()"', scanner);
        }
        const result = orderTokens(tokens);
        if (result === null) {
            error$2('Parity', scanner);
        }
        return result;
    }
    /**
     * Consumes number from given stream
     * @return Returns `true` if number was consumed
     */
    function consumeNumber$1(scanner) {
        const start = scanner.pos;
        if (scanner.eat(46 /* Dot */) && scanner.eatWhile(isNumber)) {
            // short decimal notation: .025
            return true;
        }
        if (scanner.eatWhile(isNumber) && (!scanner.eat(46 /* Dot */) || scanner.eatWhile(isNumber))) {
            // either integer or decimal: 10, 10.25
            return true;
        }
        scanner.pos = start;
        return false;
    }
    /**
     * Orders parsed tokens (operands and operators) in given array so that they are
     * laid off in order of execution
     */
    function orderTokens(tokens) {
        const operators = [];
        const operands = [];
        let nOperators = 0;
        for (let i = 0; i < tokens.length; i++) {
            const t = tokens[i];
            if (t.type === "num" /* Number */) {
                operands.push(t);
            }
            else {
                nOperators += t.type === "op1" /* Op1 */ ? 1 : 2;
                while (operators.length) {
                    if (t.priority <= operators[operators.length - 1].priority) {
                        operands.push(operators.pop());
                    }
                    else {
                        break;
                    }
                }
                operators.push(t);
            }
        }
        return nOperators + 1 === operands.length + operators.length
            ? operands.concat(operators.reverse())
            : null /* parity */;
    }
    /**
     * Number token factory
     */
    function number(value, priority) {
        return token("num" /* Number */, parseFloat(value), priority);
    }
    /**
     * Unary operator factory
     * @param value    Operator  character code
     * @param priority Operator execution priority
     */
    function op1(value, priority = 0) {
        if (value === 45 /* Minus */) {
            priority += 2;
        }
        return token("op1" /* Op1 */, value, priority);
    }
    /**
     * Binary operator factory
     * @param value Operator  character code
     * @param priority Operator execution priority
     */
    function op2(value, priority = 0) {
        if (value === 42 /* Multiply */) {
            priority += 1;
        }
        else if (value === 47 /* Divide */ || value === 92 /* IntDivide */) {
            priority += 2;
        }
        return token("op2" /* Op2 */, value, priority);
    }
    function error$2(name, scanner) {
        if (scanner) {
            name += ` at column ${scanner.pos} of expression`;
        }
        throw new Error(name);
    }
    function isSign(ch) {
        return isPositiveSign(ch) || isNegativeSign(ch);
    }
    function isPositiveSign(ch) {
        return ch === 43 /* Plus */;
    }
    function isNegativeSign(ch) {
        return ch === 45 /* Minus */;
    }
    function isOperator$3(ch) {
        return ch === 43 /* Plus */ || ch === 45 /* Minus */ || ch === 42 /* Multiply */
            || ch === 47 /* Divide */ || ch === 92 /* IntDivide */;
    }
    function token(type, value, priority = 0) {
        return { type, value, priority };
    }

    const defaultOptions$2 = {
        lookAhead: true,
        whitespace: true
    };
    function extract(text, pos = text.length, options) {
        const opt = Object.assign(Object.assign({}, defaultOptions$2), options);
        const scanner = { text, pos };
        let ch;
        if (opt.lookAhead && cur(scanner) === 41 /* RightParenthesis */) {
            // Basically, we should consume right parenthesis only with optional whitespace
            scanner.pos++;
            const len = text.length;
            while (scanner.pos < len) {
                ch = cur(scanner);
                if (ch !== 41 /* RightParenthesis */ && !(opt.whitespace && isSpace(ch))) {
                    break;
                }
                scanner.pos++;
            }
        }
        const end = scanner.pos;
        let braces = 0;
        while (scanner.pos >= 0) {
            if (number$1(scanner)) {
                continue;
            }
            ch = prev(scanner);
            if (ch === 41 /* RightParenthesis */) {
                braces++;
            }
            else if (ch === 40 /* LeftParenthesis */) {
                if (!braces) {
                    break;
                }
                braces--;
            }
            else if (!((opt.whitespace && isSpace(ch)) || isSign(ch) || isOperator$3(ch))) {
                break;
            }
            scanner.pos--;
        }
        if (scanner.pos !== end && !braces) {
            // Trim whitespace
            while (isSpace(cur(scanner))) {
                scanner.pos++;
            }
            return [scanner.pos, end];
        }
        return null;
    }
    /**
     * Backward-consumes number from given scanner, if possible
     */
    function number$1(scanner) {
        if (isNumber(prev(scanner))) {
            scanner.pos--;
            let dot = false;
            let ch;
            while (scanner.pos >= 0) {
                ch = prev(scanner);
                if (ch === 46 /* . */) {
                    if (dot) {
                        // Decimal delimiter already consumed, abort
                        break;
                    }
                    dot = true;
                }
                else if (!isNumber(ch)) {
                    break;
                }
                scanner.pos--;
            }
            return true;
        }
        return false;
    }
    function prev(scanner) {
        return scanner.text.charCodeAt(scanner.pos - 1);
    }
    function cur(scanner) {
        return scanner.text.charCodeAt(scanner.pos);
    }

    const ops1 = {
        [45 /* Minus */]: num => -num
    };
    const ops2 = {
        [43 /* Plus */]: (a, b) => a + b,
        [45 /* Minus */]: (a, b) => a - b,
        [42 /* Multiply */]: (a, b) => a * b,
        [47 /* Divide */]: (a, b) => a / b,
        [92 /* IntDivide */]: (a, b) => Math.floor(a / b)
    };
    /**
     * Evaluates given math expression
     * @param expr Expression to evaluate
     */
    function evaluate(expr) {
        if (!Array.isArray(expr)) {
            expr = parse$2(expr);
        }
        if (!expr || !expr.length) {
            return null;
        }
        const nStack = [];
        let n1;
        let n2;
        let f;
        for (let i = 0, il = expr.length; i < il; i++) {
            const token = expr[i];
            if (token.type === "num" /* Number */) {
                nStack.push(token.value);
            }
            else if (token.type === "op2" /* Op2 */) {
                n2 = nStack.pop();
                n1 = nStack.pop();
                f = ops2[token.value];
                nStack.push(f(n1, n2));
            }
            else if (token.type === "op1" /* Op1 */) {
                n1 = nStack.pop();
                f = ops1[token.value];
                nStack.push(f(n1));
            }
            else {
                throw new Error('Invalid expression');
            }
        }
        if (nStack.length > 1) {
            throw new Error('Invalid Expression (parity)');
        }
        return nStack[0];
    }

    function getOutputOptions(editor, pos, inline) {
        const posObj = pos != null ? editor.posFromIndex(pos) : editor.getCursor();
        const syntax = docSyntax(editor) || 'html';
        const config = getEmmetConfig(editor);
        const opt = {
            'output.baseIndent': lineIndent(editor, posObj.line),
            'output.indent': getIndentation(editor),
            'output.field': field$3(),
            'output.format': !inline,
            'output.attributeQuotes': config.attributeQuotes
        };
        if (syntax === 'html') {
            opt['output.selfClosingStyle'] = config.markupStyle;
            opt['output.compactBoolean'] = config.markupStyle === 'html';
        }
        if (isHTML(syntax)) {
            if (config.comments) {
                opt['comment.enabled'] = true;
                if (config.commentsTemplate) {
                    opt['comment.after'] = config.commentsTemplate;
                }
            }
            opt['bem.enabled'] = config.bem;
            opt['stylesheet.shortHex'] = config.shortHex;
        }
        return opt;
    }
    /**
     * Produces tabstop for CodeMirror editor
     */
    function field$3() {
        let handled = false;
        return (index, placeholder) => {
            if (!handled) {
                handled = true;
                return placeholder
                    ? tabStopStart + placeholder + tabStopEnd
                    : tabStopStart;
            }
            return '';
        };
    }
    /**
     * Returns indentation of given line
     */
    function lineIndent(editor, line) {
        const lineStr = editor.getLine(line);
        const indent = lineStr.match(/^\s+/);
        return indent ? indent[0] : '';
    }
    /**
     * Returns token used for single indentation in given editor
     */
    function getIndentation(editor) {
        if (!editor.getOption('indentWithTabs')) {
            return ' '.repeat(editor.getOption('indentUnit') || 0);
        }
        return '\t';
    }

    /**
     * Cache for storing internal Emmet data.
     * TODO reset whenever user settings are changed
     */
    let cache = {};
    /**
     * Expands given abbreviation into code snippet
     */
    function expand(editor, abbr, config) {
        let opt = { cache };
        const outputOpt = {
            'output.field': field$3(),
            'output.format': !config || !config['inline'],
        };
        if (config) {
            Object.assign(opt, config);
            if (config.options) {
                Object.assign(outputOpt, config.options);
            }
        }
        opt.options = outputOpt;
        const pluginConfig = getEmmetConfig(editor);
        if (pluginConfig.config) {
            opt = resolveConfig(opt, pluginConfig.config);
        }
        return expandAbbreviation(abbr, opt);
    }
    /**
     * Extracts abbreviation from given source code by detecting actual syntax context.
     * For example, if host syntax is HTML, it tries to detect if location is inside
     * embedded CSS.
     *
     * It also detects if abbreviation is allowed at given location: HTML tags,
     * CSS selectors may not contain abbreviations.
     * @param code Code from which abbreviation should be extracted
     * @param pos Location at which abbreviation should be expanded
     * @param syntax Syntax of abbreviation to expand
     */
    function extract$1(code, pos, type = 'markup', options) {
        return extractAbbreviation(code, pos, Object.assign({ lookAhead: type !== 'stylesheet', type }, options));
    }
    /**
     * Returns list of tags for balancing for given code
     */
    function balance(code, pos, inward = false, xml = false) {
        const options = { xml };
        return inward
            ? balancedInward(code, pos, options)
            : balancedOutward(code, pos, options);
    }
    /**
     * Returns list of selector/property ranges for balancing for given code
     */
    function balanceCSS(code, pos, inward) {
        return inward
            ? balancedInward$1(code, pos)
            : balancedOutward$1(code, pos);
    }
    /**
     * Returns model for selecting next/previous item
     */
    function selectItem(code, pos, isCSS, isPrevious) {
        return isCSS
            ? selectItemCSS(code, pos, isPrevious)
            : selectItemHTML(code, pos, isPrevious);
    }
    /**
     * Finds and evaluates math expression at given position in line
     */
    function evaluateMath(code, pos, options) {
        const expr = extract(code, pos, options);
        if (expr) {
            try {
                const [start, end] = expr;
                const result = evaluate(code.slice(start, end));
                if (result) {
                    return {
                        start, end, result,
                        snippet: result.toFixed(4).replace(/\.?0+$/, '')
                    };
                }
            }
            catch (err) {
                console.error(err);
            }
        }
    }
    /**
     * Returns matched HTML/XML tag for given point in view
     */
    function getTagContext(editor, pos, xml) {
        const content = getContent(editor);
        let ctx;
        if (xml == null) {
            // Autodetect XML dialect
            const mode = editor.getMode();
            xml = mode ? isXML(mode.name) : false;
        }
        const matchedTag = match(content, pos, { xml });
        if (matchedTag) {
            const { open, close } = matchedTag;
            ctx = {
                name: matchedTag.name,
                open,
                close
            };
            if (matchedTag.attributes) {
                ctx.attributes = {};
                matchedTag.attributes.forEach(attr => {
                    let value = attr.value;
                    if (value && isQuotedString$1(value)) {
                        value = value.slice(1, -1);
                    }
                    ctx.attributes[attr.name] = value == null ? null : value;
                });
            }
        }
        return ctx;
    }
    /**
     * Returns Emmet options for given character location in editor
     */
    function getOptions(editor, pos) {
        const info = syntaxInfo(editor, pos);
        const { context } = info;
        const config = {
            type: info.type,
            syntax: info.syntax || 'html',
            options: getOutputOptions(editor, pos, info.inline)
        };
        if (context) {
            const content = getContent(editor);
            // Set context from syntax info
            if (context.type === 'html' && context.ancestors.length) {
                config.context = getMarkupAbbreviationContext$1(content, context);
            }
            else if (context.type === 'css') {
                config.context = getStylesheetAbbreviationContext$1(context);
            }
        }
        return config;
    }

    /** Class name for Emmet abbreviation marker in editor */
    const markClass = 'emmet-abbreviation';
    /** Class name for Emmet abbreviation preview in editor */
    const previewClass = 'emmet-abbreviation-preview';
    class CMEditorProxy {
        constructor() {
            this.marker = null;
            this.preview = null;
            this.forcedMarker = null;
        }
        get id() {
            return getInternalState(this.cm).id;
        }
        substr(from, to) {
            const value = this.cm.getValue();
            if (from === undefined && to === undefined) {
                return value;
            }
            return value.slice(from || 0, to);
        }
        replace(value, from, to) {
            this.cm.replaceRange(value, this.cm.posFromIndex(from), this.cm.posFromIndex(to));
        }
        syntax() {
            return docSyntax(this.cm);
        }
        size() {
            return this.cm.getValue().length;
        }
        config(pos) {
            return getOptions(this.cm, pos);
        }
        outputOptions(pos, inline) {
            return getOutputOptions(this.cm, pos, inline);
        }
        previewConfig(config) {
            return Object.assign(Object.assign({}, config), { options: Object.assign(Object.assign({}, config.options), { 'output.field': previewField, 'output.indent': '  ', 'output.baseIndent': '' }) });
        }
        allowTracking(pos) {
            return allowTracking(this.cm, pos);
        }
        mark(tracker) {
            const { cm } = this;
            this.disposeMarker();
            const [from, to] = toRange(cm, tracker.range);
            this.marker = cm.markText(from, to, {
                inclusiveLeft: true,
                inclusiveRight: true,
                clearWhenEmpty: false,
                className: markClass
            });
            if (tracker.forced && !this.forcedMarker) {
                this.forcedMarker = document.createElement('div');
                this.forcedMarker.className = `${markClass}-marker`;
                cm.addWidget(from, this.forcedMarker, false);
            }
        }
        unmark() {
            this.disposeMarker();
            this.hidePreview();
        }
        showPreview(tracker) {
            const { cm } = this;
            const config = getEmmetConfig(cm);
            // Check if we should display preview
            if (!enabledForSyntax(config.preview, syntaxInfo(cm, tracker.range[0]))) {
                return;
            }
            let content;
            let isError = false;
            if (tracker.type === "error" /* Error */) {
                content = errorSnippet(tracker.error);
                isError = true;
            }
            else if (tracker.forced || !tracker.simple) {
                content = tracker.preview;
            }
            if (content) {
                if (!this.preview) {
                    const previewElem = document.createElement('div');
                    previewElem.className = previewClass;
                    const pos = cm.posFromIndex(tracker.range[0]);
                    if (config.attachPreview) {
                        config.attachPreview(cm, previewElem, pos);
                    }
                    else {
                        cm.addWidget(pos, previewElem, false);
                    }
                    // @ts-ignore
                    this.preview = new this.cm.constructor(previewElem, {
                        mode: cm.getOption('mode'),
                        readOnly: 'nocursor',
                        lineNumbers: false
                    });
                    const errElement = document.createElement('div');
                    errElement.className = `${previewClass}-error`;
                    previewElem.appendChild(errElement);
                }
                const wrapper = this.preview.getWrapperElement().parentElement;
                wrapper.classList.toggle('has-error', isError);
                if (isError) {
                    wrapper.querySelector(`.${previewClass}-error`).innerHTML = content;
                }
                else {
                    this.preview.setValue(content);
                }
            }
            else {
                this.hidePreview();
            }
        }
        hidePreview() {
            if (this.preview) {
                this.preview.getWrapperElement().parentElement.remove();
                this.preview = null;
            }
        }
        /**
         * Check if given syntax is a CSS dialect (including SCSS, LESS etc)
         */
        isCSS(syntax) {
            return isCSS(syntax);
        }
        syntaxType(syntax) {
            return getSyntaxType(syntax);
        }
        /**
         * Check if given syntax is a HTML dialect. HTML dialects also support embedded
         * stylesheets in `<style>` tga or `style=""` attribute
         */
        isHTML(syntax) {
            return isHTML(syntax);
        }
        /**
         * Check if given syntax is a XML dialect. Unlike HTML, XML dialects doesn’t
         * support embedded stylesheets
         */
        isXML(syntax) {
            return isXML(syntax);
        }
        /**
         * Check if given syntax is a JSX dialect
         */
        isJSX(syntax) {
            return isJSX(syntax);
        }
        /**
         * Runs given callback in context of given editor
         */
        run(editor, callback) {
            const { cm } = this;
            this.cm = editor;
            const result = callback();
            this.cm = cm;
            return result;
        }
        disposeMarker() {
            if (this.marker) {
                this.marker.clear();
                this.marker = null;
            }
            if (this.forcedMarker) {
                this.forcedMarker.remove();
                this.forcedMarker = null;
            }
        }
    }
    function previewField(index, placeholder) {
        return placeholder;
    }
    const proxy = new CMEditorProxy();
    const controller = new AbbreviationTrackingController();
    function initAbbreviationTracker(editor) {
        const onChange = (ed) => {
            proxy.run(ed, () => {
                controller.handleChange(proxy, getCaret(ed));
            });
        };
        const onSelectionChange = (ed) => {
            proxy.run(ed, () => {
                const caret = getCaret(ed);
                if (!isEnabled(ed, caret)) {
                    return;
                }
                const tracker = controller.handleSelectionChange(proxy, caret);
                if (tracker) {
                    if (contains(tracker, caret)) {
                        proxy.showPreview(tracker);
                    }
                    else {
                        proxy.hidePreview();
                    }
                }
            });
        };
        editor.on('change', onChange);
        editor.on('focus', onSelectionChange);
        editor.on('cursorActivity', onSelectionChange);
        return () => {
            proxy.run(editor, () => controller.disposeEditor(proxy));
            editor.off('change', onChange);
            editor.off('focus', onSelectionChange);
            editor.off('cursorActivity', onSelectionChange);
        };
    }
    /**
     * Runs given function in context of abbreviation tracker
     */
    function runInTrackerContext(editor, callback) {
        return proxy.run(editor, () => callback(controller, proxy));
    }
    /**
     * Check if abbreviation tracking is allowed in editor at given location
     */
    function allowTracking(editor, pos) {
        if (isEnabled(editor, pos)) {
            const syntax = syntaxFromPos(editor, pos);
            return syntax ? isSupported(syntax) || isJSX(syntax) : false;
        }
        return false;
    }
    /**
     * Check if Emmet auto-complete is enabled
     */
    function isEnabled(editor, pos) {
        const config = getEmmetConfig(editor);
        return enabledForSyntax(config.mark, syntaxInfo(editor, pos));
    }
    /**
     * If allowed, tries to extract abbreviation from given completion context
     */
    function extractTracker(editor, pos) {
        return proxy.run(editor, () => {
            const syntax = proxy.syntax();
            const prefix = proxy.isJSX(syntax) ? JSX_PREFIX : '';
            const config = controller.getActivationContext(proxy, pos);
            const abbr = extract$1(proxy.substr(), pos, getSyntaxType(config === null || config === void 0 ? void 0 : config.syntax), { prefix });
            if (abbr) {
                const tracker = controller.startTracking(proxy, abbr.start, abbr.end, {
                    offset: prefix.length,
                    config
                });
                if (tracker) {
                    proxy.showPreview(tracker);
                }
                return tracker;
            }
        });
    }
    /**
     * Returns abbreviation tracker for given editor, if any
     */
    function getTracker(editor) {
        return proxy.run(editor, () => controller.getTracker(proxy));
    }
    /**
     * Start abbreviation tracking in given editor for given range
     */
    function startTracking(editor, start, pos, params) {
        return proxy.run(editor, () => {
            const tracker = controller.startTracking(proxy, start, pos, params);
            if (tracker) {
                proxy.showPreview(tracker);
            }
            return tracker;
        });
    }
    /**
     * Stops abbreviation tracking in given editor
     */
    function stopTracking(editor, params) {
        return proxy.run(editor, () => controller.stopTracking(proxy, params));
    }
    /**
     * Returns completion item, suitable for auto-hint CodeMirror module,
     * with tracked abbreviation for it
     */
    function getCompletion(editor, pos) {
        const tracker = getTracker(editor) || extractTracker(editor, pos);
        if (tracker && contains(tracker, pos) && tracker.type === "abbreviation" /* Abbreviation */) {
            const { abbreviation, preview } = tracker;
            return {
                text: abbreviation,
                displayText: preview,
                hint: () => {
                    stopTracking(editor);
                    const snippet = expand(editor, abbreviation, tracker.config);
                    replaceWithSnippet(editor, tracker.range, snippet);
                },
                from: editor.posFromIndex(tracker.range[0]),
                to: editor.posFromIndex(tracker.range[1]),
            };
        }
    }
    /**
     * Restore tracker on undo, if possible
     */
    function restoreOnUndo(editor, pos, abbr) {
        proxy.run(editor, () => {
            const lastTracker = controller.getStoredTracker(proxy);
            if (lastTracker) {
                const shouldRestore = lastTracker.type === "abbreviation" /* Abbreviation */
                    && abbr === lastTracker.abbreviation
                    && lastTracker.range[0] === pos;
                if (shouldRestore) {
                    controller.restoreTracker(proxy, pos);
                }
            }
        });
    }
    /**
     * Check if tracker range contains given position
     */
    function contains(tracker, pos) {
        return pos >= tracker.range[0] && pos <= tracker.range[1];
    }

    const openTagMark = 'emmet-open-tag';
    const closeTagMark = 'emmet-close-tag';
    /**
     * Setup editor for tag matching
     */
    function markTagMatches(editor) {
        let tags = null;
        let lastMatch;
        let tagPreview = null;
        /**
         * Displays tag preview as given location, if possible
         */
        function showTagPreview(ed, pos, preview) {
            // Check if we already have preview at given location
            if (!tagPreview || tagPreview.dataset.pos !== String(pos)) {
                hidePreview();
                tagPreview = createPreviewWidget(ed, pos, preview);
            }
        }
        function hidePreview() {
            if (tagPreview) {
                tagPreview.remove();
                tagPreview = null;
            }
        }
        const onCursorActivity = (ed) => {
            if (!tags) {
                tags = getTagMatches(ed.getValue());
            }
            const caret = getCaret(ed);
            let match = findTagMatch(tags, caret);
            if (match) {
                if (!match.preview) {
                    match.preview = generatePreview(ed, match);
                }
                if (shouldDisplayTagPreview(ed, match, caret)) {
                    showTagPreview(ed, match.close[1], match.preview);
                }
                else {
                    hidePreview();
                }
                // Replace full tag match with name-only match
                const nLen = match.name.length;
                match = Object.assign(Object.assign({}, match), { open: [match.open[0] + 1, match.open[0] + 1 + nLen] });
                if (match.close) {
                    match.close = [match.close[0] + 2, match.close[0] + 2 + nLen];
                }
            }
            if (match && (!lastMatch || !rangesEqual(lastMatch.open, match.open))) {
                clearTagMarks(ed);
                markTagMatch(ed, match);
            }
            else if (!match && lastMatch) {
                clearTagMarks(ed);
            }
            lastMatch = match;
        };
        const onChange = (editor) => {
            tags = null;
            if (getEmmetConfig(editor).autoRenameTags) {
                const { open, close } = getTagMarks(editor);
                if (open && close) {
                    const cursor = editor.getCursor();
                    const openRange = open.find();
                    const closeRange = close.find();
                    let shouldReset = false;
                    if (containsPos(openRange, cursor)) {
                        // Update happened inside open tag, update close tag as well
                        shouldReset = updateTag(editor, openRange, closeRange);
                    }
                    else if (containsPos(closeRange, cursor)) {
                        // Update happened inside close tag, update open tag as well
                        shouldReset = updateTag(editor, closeRange, openRange);
                    }
                    if (shouldReset) {
                        // Reset last match & marker to find and re-mark new location
                        clearTagMarks(editor);
                        lastMatch = null;
                    }
                }
            }
        };
        editor.on('cursorActivity', onCursorActivity);
        editor.on('change', onChange);
        return () => {
            clearTagMarks(editor);
            hidePreview();
            editor.off('cursorActivity', onCursorActivity);
            editor.off('cursorActivity', onChange);
            tags = lastMatch = null;
        };
    }
    function shouldDisplayTagPreview(editor, match, caret) {
        return match.close && match.preview && getEmmetConfig(editor).previewOpenTag
            && caret > match.close[0] && caret < match.close[1];
    }
    /**
     * Marks given tag match in editor
     */
    function markTagMatch(editor, { open, close, preview }) {
        createTagMark(editor, editor.posFromIndex(open[0]), editor.posFromIndex(open[1]), openTagMark);
        if (close) {
            createTagMark(editor, editor.posFromIndex(close[0]), editor.posFromIndex(close[1]), closeTagMark);
        }
    }
    /**
     * Removes any existing tag marks in editor
     */
    function clearTagMarks(editor) {
        const { open, close } = getTagMarks(editor);
        open && open.clear();
        close && close.clear();
    }
    /**
     * Returns open and close tag marks in editor, if available
     */
    function getTagMarks(editor) {
        let open;
        let close;
        editor.getAllMarks().forEach(mark => {
            if (mark['className'] === openTagMark) {
                open = mark;
            }
            else if (mark['className'] === closeTagMark) {
                close = mark;
            }
        });
        return { open, close };
    }
    function createTagMark(editor, from, to, className, attributes) {
        return editor.markText(from, to, {
            className,
            inclusiveLeft: true,
            inclusiveRight: true,
            clearWhenEmpty: false,
            // @ts-ignore `attributes` key is supported
            attributes
        });
    }
    /**
     * Updates content of `dest` range with valid tag name from `source` range.
     * @returns `true` if tag markers must be updated
     */
    function updateTag(editor, source, dest) {
        const name = editor.getRange(source.from, source.to);
        const m = name.match(/[\w:.-]+/);
        const newName = m ? m[0] : '';
        if (editor.getRange(dest.from, dest.to) !== newName) {
            editor.replaceRange(newName, dest.from, dest.to);
        }
        return name !== newName;
    }
    function createPreviewWidget(editor, pos, preview) {
        const elem = document.createElement('div');
        elem.className = 'emmet-tag-preview';
        elem.innerText = preview;
        elem.dataset.pos = String(pos);
        editor.addWidget(editor.posFromIndex(pos), elem, false);
        return elem;
    }
    /**
     * Generates open tag preview for given tag match
     */
    function generatePreview(editor, match) {
        let className = '';
        let id = '';
        const attrs = [];
        attributes(substr(editor, match.open), match.name).forEach(attr => {
            if (attr.name === 'class' && attr.value) {
                className = '.' + unquoted$1(attr.value).replace(/\s+/g, '.');
            }
            else if (attr.name === 'id' && attr.value) {
                id = '#' + unquoted$1(attr.value);
            }
            else {
                attrs.push(attr.value ? `${attr.name}=${attr.value}` : attr.name);
            }
        });
        const attrString = attrs.length ? `[${attrs.join(' ')}]` : '';
        const suffix = id + className + attrString;
        return suffix ? match.name + suffix : '';
    }
    function unquoted$1(str) {
        return isQuotedString$1(str) ? str.slice(1, -1) : str;
    }
    /**
     * Check if given range contains point
     * @param exclude Exclude range end and start
     */
    function containsPos(range, pos, exclude) {
        return exclude
            ? comparePos(pos, range.from) > 0 && comparePos(pos, range.to) < 0
            : comparePos(pos, range.from) >= 0 && comparePos(pos, range.to) <= 0;
    }
    function comparePos(a, b) {
        return a.line - b.line || a.ch - b.ch;
    }

    function error$3(message, scanner) {
        const err = new Error(message);
        err.ch = scanner.pos;
        return err;
    }
    function unexpectedCharacter(stream, state, message = 'Unexpected character') {
        state.parseError = error$3(message.replace(/\s+at\s+\d+$/, ''), stream);
        stream.skipToEnd();
        return 'invalidchar';
    }
    function last$6(arr) {
        return arr[arr.length - 1];
    }

    function emmetAbbreviationMode() {
        return {
            startState() {
                return {
                    attribute: 0,
                    expression: 0,
                    group: 0,
                    quote: 0,
                    braces: [],
                    tokens: [],
                    scanner: new Scanner('')
                };
            },
            token(stream, state) {
                const { scanner } = state;
                scanner.string = stream.string;
                scanner.pos = stream.pos;
                scanner.start = stream.start;
                scanner.end = stream.string.length;
                const ch = scanner.peek();
                const token = getToken(scanner, state);
                if (!token) {
                    return unexpectedCharacter(stream, state);
                }
                stream.pos = scanner.pos;
                if (token.type === 'Quote') {
                    state.quote = ch === state.quote ? 0 : ch;
                }
                else if (token.type === 'Bracket') {
                    if (token.open) {
                        state[token.context]++;
                        state.braces.push(token);
                    }
                    else {
                        state[token.context]--;
                        const lastBrace = last$6(state.braces);
                        if (lastBrace && lastBrace.context === token.context) {
                            state.braces.pop();
                        }
                    }
                }
                // Report if closing braces are missing at the end of abbreviation
                if (stream.eol() && state.braces.length && !state.parseError) {
                    const pos = last$6(state.braces).start;
                    state.parseError = error$3(`No closing brace at ${pos}`, stream);
                    return null;
                }
                const name = getTokenName(token, state);
                state.tokens.push(token);
                return name;
            }
        };
    }
    /**
     * Returns scope name for given token
     */
    function getTokenName(token, state) {
        const prev = last$6(state.tokens);
        switch (token.type) {
            case 'Bracket':
                return `bracket`;
            case 'Field':
                return 'variable-2';
            case 'Literal':
                if (state.attribute) {
                    if (prev && prev.type === 'Operator' && prev.operator === 'equal') {
                        return 'string-2';
                    }
                    return state.quote ? 'string' : 'attribute';
                }
                if (state.quote) {
                    return 'string';
                }
                if (prev && prev.type === 'Operator') {
                    if (prev.operator === 'class') {
                        return 'variable-2';
                    }
                    if (prev.operator === 'id') {
                        return 'variable-3';
                    }
                }
                return 'tag';
            case 'Operator':
                if (token.operator === 'class') {
                    return 'variable-2';
                }
                if (token.operator === 'id') {
                    return 'variable-3';
                }
                return `operator ${token.operator}`;
            case 'Repeater':
            case 'RepeaterPlaceholder':
                return 'meta';
            case 'Quote':
                return 'string';
            case 'RepeaterNumber':
                return 'number';
        }
        return '';
    }

    function emmetAbbreviationMode$1() {
        return {
            startState() {
                return {
                    brackets: 0,
                    tokens: [],
                    scanner: new Scanner('')
                };
            },
            token(stream, state) {
                const { scanner } = state;
                scanner.string = stream.string;
                scanner.pos = stream.pos;
                scanner.start = stream.start;
                scanner.end = stream.string.length;
                const token = getToken$1(scanner, state.brackets === 0);
                if (!token) {
                    return unexpectedCharacter(stream, state);
                }
                if (token.type === 'Bracket') {
                    state.brackets += token.open ? 1 : -1;
                    if (state.brackets < 0) {
                        return unexpectedCharacter(stream, state, 'Unexpected bracket');
                    }
                }
                stream.pos = scanner.pos;
                const name = getTokenName$1(token);
                state.tokens.push(token);
                return name;
            }
        };
    }
    /**
     * Returns scope name for given token
     */
    function getTokenName$1(token, state) {
        switch (token.type) {
            case 'Bracket':
                return `bracket`;
            case 'Field':
                return 'variable-2';
            case 'Literal':
                return 'tag';
            case 'Operator':
                return `operator ${token.operator}`;
            case 'ColorValue':
                return 'variable-3';
            case 'NumberValue':
                return 'number';
            case 'StringValue':
                return 'string';
        }
        return null;
    }

    /**
     * Emmet snippet name parsing mode
     */
    function snippetNameMode() {
        return {
            token(stream) {
                if (stream.eatWhile(ident$1)) {
                    return 'tag';
                }
                if (stream.eat(separator)) {
                    return 'operator';
                }
                stream.skipToEnd();
                return 'invalidchar';
            }
        };
    }
    function ident$1(ch) {
        return /[a-zA-Z0-9-_$@!:]/.test(ch);
    }
    function separator(ch) {
        return ch === '|';
    }

    // import { getActivationContext } from '../abbreviation';
    function expandAbbreviation$1(editor, tabKey) {
        if (editor.somethingSelected()) {
            return pass(editor);
        }
        if (tabKey) {
            return expandAbbreviationWithTab(editor);
        }
        const caret = getCaret(editor);
        const pos = editor.posFromIndex(caret);
        const line = editor.getLine(pos.line);
        const options = getOptions(editor, caret);
        const abbr = extract$1(line, pos.ch, getSyntaxType(options.syntax));
        if (abbr) {
            const offset = caret - pos.ch;
            runExpand(editor, abbr.abbreviation, [abbr.start + offset, abbr.end + offset], options);
        }
    }
    function expandAbbreviationWithTab(editor) {
        // With Tab key, we should either expand tracked abbreviation
        // or extract abbreviation from current location if abbreviation marking
        // is not available
        const caret = getCaret(editor);
        if (getEmmetConfig(editor).mark) {
            const tracker = getTracker(editor);
            if (tracker && contains(tracker, caret) && tracker.type === "abbreviation" /* Abbreviation */) {
                runExpand(editor, tracker.abbreviation, tracker.range, tracker.config);
                stopTracking(editor, { skipRemove: true });
                return;
            }
            return pass(editor);
        }
        return runInTrackerContext(editor, (controller, proxy) => {
            const options = controller.getActivationContext(proxy, caret);
            if (options) {
                const pos = editor.posFromIndex(caret);
                const line = editor.getLine(pos.line);
                const abbr = extract$1(line, pos.ch, getSyntaxType(options.syntax));
                if (abbr) {
                    const offset = caret - pos.ch;
                    runExpand(editor, abbr.abbreviation, [abbr.start + offset, abbr.end + offset], options);
                    return;
                }
            }
            return pass(editor);
        });
    }
    function runExpand(editor, abbr, range, options) {
        const snippet = expand(editor, abbr, options);
        replaceWithSnippet(editor, range, snippet);
    }

    function resetAbbreviation(editor) {
        const tracker = getTracker(editor);
        if (tracker) {
            stopTracking(editor, { force: true });
        }
        else {
            return pass(editor);
        }
    }

    function captureAbbreviation(editor) {
        stopTracking(editor);
        extractTracker(editor, getCaret(editor));
    }

    function enterAbbreviationMode(editor) {
        let tracker = getTracker(editor);
        stopTracking(editor);
        if (tracker && tracker.forced) {
            // Already have forced abbreviation: act as toggler
            return;
        }
        const [from, to] = textRange(editor, editor.listSelections()[0]);
        tracker = startTracking(editor, from, to, { forced: true });
        if (from !== to) {
            editor.setSelection(editor.posFromIndex(to));
        }
    }

    function insertLineBreak(editor) {
        const between = editor.listSelections().map(sel => betweenTags(editor, sel.anchor, sel.head));
        if (!between.some(Boolean)) {
            return pass(editor);
        }
        editor.operation(() => {
            const sels = editor.listSelections();
            // @ts-ignore Invalid docs for Document
            const nl = editor.getDoc().lineSeparator();
            const indent = getIndentation(editor);
            // Step 1: insert newlines either single or double depending on selection
            const nextSels = [];
            for (let i = sels.length - 1; i >= 0; i--) {
                const sel = sels[i];
                const base = lineIndent(editor, sel.anchor.line);
                let nextIndent = base;
                if (between[i]) {
                    nextIndent += indent;
                    editor.replaceRange(nl + nextIndent + nl + base, sel.anchor, sel.head);
                }
                else {
                    editor.replaceRange(nl + base, sel.anchor, sel.head);
                }
                const nextPos = {
                    line: sel.anchor.line + 1,
                    ch: nextIndent.length
                };
                nextSels.unshift({ anchor: nextPos, head: nextPos });
            }
            editor.setSelections(nextSels);
        });
    }
    /**
     * Check if given range is a single caret between tags
     */
    function betweenTags(editor, anchor, head) {
        if (equalCursorPos(anchor, head)) {
            const mode = editor.getModeAt(anchor);
            if (mode.name === 'xml') {
                const left = editor.getTokenAt(anchor);
                const right = editor.getTokenAt(Object.assign({}, anchor, { ch: anchor.ch + 1 }));
                return left.type === 'tag bracket' && left.string === '>'
                    && right.type === 'tag bracket' && right.string === '</';
            }
        }
    }
    // Compare two positions, return 0 if they are the same, a negative
    // number when a is less, and a positive number otherwise.
    function cmp(a, b) {
        return a.line - b.line || a.ch - b.ch;
    }
    function equalCursorPos(a, b) {
        return a.sticky === b.sticky && cmp(a, b) === 0;
    }

    const baseClass = 'emmet-panel';
    const errClass = 'emmet-error';
    function wrapWithAbbreviation(editor) {
        const syntax = docSyntax(editor);
        const caret = getCaret(editor);
        const context = getTagContext(editor, caret, isXML(syntax));
        const wrapRange = getWrapRange(editor, getSelection(editor), context);
        const options = getOptions(editor, wrapRange[0]);
        options.text = getContent$1(editor, wrapRange, true);
        let panel = createInputPanel();
        let input = panel.querySelector('input');
        let errContainer = panel.querySelector(`.${baseClass}-error`);
        let updated = false;
        function onInput(evt) {
            evt && evt.stopPropagation();
            undo();
            const abbr = input.value.trim();
            if (!abbr) {
                return;
            }
            try {
                const snippet = expand(editor, abbr, options);
                replaceWithSnippet(editor, wrapRange, snippet);
                updated = true;
                if (panel.classList.contains(errClass)) {
                    errContainer.innerHTML = '';
                    panel.classList.remove(errClass);
                }
            }
            catch (err) {
                updated = false;
                panel.classList.add(errClass);
                errContainer.innerHTML = errorSnippet(err);
                console.error(err);
            }
        }
        function onKeyDown(evt) {
            if (evt.keyCode === 27 /* ESC */) {
                evt.stopPropagation();
                evt.preventDefault();
                cancel();
            }
            else if (evt.keyCode === 13 /* Enter */) {
                evt.stopPropagation();
                evt.preventDefault();
                submit();
            }
        }
        function undo() {
            if (updated) {
                editor.undo();
            }
        }
        function cancel() {
            undo();
            dispose();
            editor.focus();
        }
        function submit() {
            // Changes should already be applied to editor
            dispose();
            editor.focus();
        }
        function dispose() {
            input.removeEventListener('input', onInput);
            input.removeEventListener('change', onInput);
            input.removeEventListener('paste', onInput);
            input.removeEventListener('keydown', onKeyDown);
            input.removeEventListener('blur', cancel);
            panel.remove();
            // @ts-ignore Dispose element references
            panel = input = errContainer = null;
        }
        // Expose internals to programmatically submit or cancel command
        panel['emmet'] = { submit, cancel, update: onInput };
        input.addEventListener('input', onInput);
        input.addEventListener('change', onInput);
        input.addEventListener('paste', onInput);
        input.addEventListener('keydown', onKeyDown);
        editor.getWrapperElement().appendChild(panel);
        input.focus();
    }
    function createInputPanel() {
        const elem = document.createElement('div');
        elem.className = baseClass;
        elem.innerHTML = `<div class="${baseClass}-wrapper">
        <input type="text" placeholder="Enter abbreviation" autofocus />
        <div class="${baseClass}-error"></div>
    </div>`;
        return elem;
    }
    function getWrapRange(editor, range, context) {
        if (range[0] === range[1] && context) {
            // No selection means user wants to wrap current tag container
            const { open, close } = context;
            const pos = range[0];
            // Check how given point relates to matched tag:
            // if it's in either open or close tag, we should wrap tag itself,
            // otherwise we should wrap its contents
            if (inRange(open, pos) || (close && inRange(close, pos))) {
                return [open[0], close ? close[1] : open[1]];
            }
            if (close) {
                return narrowToNonSpace(editor, [open[1], close[0]]);
            }
        }
        return range;
    }
    /**
     * Returns contents of given region, properly de-indented
     */
    function getContent$1(editor, range, lines = false) {
        const pos = editor.posFromIndex(range[0]);
        const baseIndent = lineIndent(editor, pos.line);
        const srcLines = substr(editor, range).split('\n');
        const destLines = srcLines.map(line => {
            return line.startsWith(baseIndent)
                ? line.slice(baseIndent.length)
                : line;
        });
        return lines ? destLines : destLines.join('\n');
    }
    function inRange(range, pt) {
        return range[0] < pt && pt < range[1];
    }
    function getSelection(editor) {
        return textRange(editor, editor.listSelections()[0]);
    }

    function balanceAction(editor, inward) {
        const syntax = docSyntax(editor);
        if (isHTML(syntax) || isCSS(syntax)) {
            const ranges = inward
                ? balanceActionInward(editor, syntax)
                : balanceActionOutward(editor, syntax);
            editor.setSelections(ranges.map(r => ({
                anchor: editor.posFromIndex(r[0]),
                head: editor.posFromIndex(r[1]),
            })));
        }
        else {
            return pass(editor);
        }
    }
    /**
     * Pushes given `range` into `ranges` list on if it’s not the same as last one
     */
    function pushRange$1(ranges, range) {
        const last = ranges[ranges.length - 1];
        if (!last || !rangesEqual(last, range)) {
            ranges.push(range);
        }
    }
    /**
     * Returns regions for balancing
     */
    function getRanges(editor, pos, syntax, inward) {
        const content = getContent(editor);
        if (isCSS(syntax)) {
            return balanceCSS(content, pos, inward);
        }
        const result = [];
        const tags = balance(content, pos, inward, isXML(syntax));
        for (const tag of tags) {
            if (tag.close) {
                // Inner range
                pushRange$1(result, [tag.open[1], tag.close[0]]);
                // Outer range
                pushRange$1(result, [tag.open[0], tag.close[1]]);
            }
            else {
                pushRange$1(result, [tag.open[0], tag.open[1]]);
            }
        }
        return result.sort((a, b) => {
            return inward ? a[0] - b[0] : b[0] - a[0];
        });
    }
    /**
     * Returns inward balanced ranges from current view's selection
     */
    function balanceActionInward(editor, syntax) {
        const result = [];
        for (const sel of editor.listSelections()) {
            const selRange = textRange(editor, sel);
            const ranges = getRanges(editor, selRange[0], syntax, true);
            // Try to find range which equals to selection: we should pick leftmost
            let ix = ranges.findIndex(r => rangesEqual(selRange, r));
            let targetRange;
            if (ix < ranges.length - 1) {
                targetRange = ranges[ix + 1];
            }
            else if (ix !== -1) {
                // No match found, pick closest region
                targetRange = ranges.find(r => rangeContains(r, selRange));
            }
            result.push(targetRange || selRange);
        }
        return result;
    }
    /**
     * Returns outward balanced ranges from current view's selection
     */
    function balanceActionOutward(editor, syntax) {
        const result = [];
        for (const sel of editor.listSelections()) {
            const selRange = textRange(editor, sel);
            const ranges = getRanges(editor, selRange[0], syntax);
            const targetRange = ranges.find(r => rangeContains(r, selRange) && r[1] > selRange[1]);
            result.push(targetRange || selRange);
        }
        return result;
    }

    const htmlComment = ['<!--', '-->'];
    const cssComment = ['/*', '*/'];
    function comment$2(editor) {
        const selection = editor.listSelections().slice().reverse();
        editor.operation(() => {
            for (const sel of selection) {
                const selRange = textRange(editor, sel);
                const { syntax } = syntaxInfo(editor, selRange[0]);
                const tokens = syntax && isCSS(syntax) ? cssComment : htmlComment;
                const block = getRangeForComment(editor, selRange[0]);
                if (block && block.commentStart) {
                    // Caret inside comment, strip it
                    removeComment(editor, block);
                }
                else if (block && rangeEmpty(selRange)) {
                    // Wrap block with comments but remove inner comments first
                    let removed = 0;
                    for (const c of getCommentRegions(editor, block.range, tokens).reverse()) {
                        removed += removeComment(editor, c);
                    }
                    addComment(editor, [block.range[0], block.range[1] - removed], tokens);
                }
                else if (!rangeEmpty(selRange)) {
                    // No matching block, comment selection
                    addComment(editor, selRange, tokens);
                }
                else {
                    // No matching block, comment line
                    const line = editor.getLine(sel.anchor.line);
                    const lineRange = textRange(editor, {
                        anchor: { line: sel.anchor.line, ch: 0 },
                        head: { line: sel.anchor.line, ch: line.length },
                    });
                    addComment(editor, narrowToNonSpace(editor, lineRange), tokens);
                }
            }
        });
    }
    /**
     * Removes comment markers from given region. Returns amount of characters removed
     */
    function removeComment(editor, { range, commentStart, commentEnd }) {
        const text = substr(editor, range);
        if (commentStart && text.startsWith(commentStart)) {
            let startOffset = commentStart.length;
            let endOffset = commentEnd && text.endsWith(commentEnd)
                ? commentEnd.length
                : 0;
            // Narrow down offsets for whitespace
            if (isSpace$2(text[startOffset])) {
                startOffset += 1;
            }
            if (endOffset && isSpace$2(text[text.length - endOffset - 1])) {
                endOffset += 1;
            }
            const r1 = toRange(editor, [range[1] - endOffset, range[1]]);
            const r2 = toRange(editor, [range[0], range[0] + startOffset]);
            editor.replaceRange('', r1[0], r1[1]);
            editor.replaceRange('', r2[0], r2[1]);
            return startOffset + endOffset;
        }
        return 0;
    }
    /**
     * Adds comments around given range
     */
    function addComment(editor, range, tokens) {
        const [from, to] = toRange(editor, range);
        editor.replaceRange(' ' + tokens[1], to, to);
        editor.replaceRange(tokens[0] + ' ', from, from);
    }
    /**
     * Finds comments inside given region and returns their regions
     */
    function getCommentRegions(editor, range, tokens) {
        const result = [];
        const text = substr(editor, range);
        let start = range[0];
        let offset = 0;
        while (true) {
            const commentStart = text.indexOf(tokens[0], offset);
            if (commentStart !== -1) {
                offset = commentStart + tokens[0].length;
                // Find comment end
                const commentEnd = text.indexOf(tokens[1], offset);
                if (commentEnd !== -1) {
                    offset = commentEnd + tokens[1].length;
                    result.push({
                        range: [start + commentStart, start + offset],
                        commentStart: tokens[0],
                        commentEnd: tokens[1],
                    });
                }
            }
            else {
                break;
            }
        }
        return result;
    }
    function getRangeForComment(editor, pos) {
        const { syntax } = syntaxInfo(editor, pos);
        if (!syntax) {
            return;
        }
        if (isHTML(syntax)) {
            return getHTMLBlockRange(getContent(editor), pos, isXML(syntax));
        }
        if (isCSS(syntax)) {
            const content = getContent(editor);
            const comment = findCSSComment(content, pos);
            if (comment) {
                return comment;
            }
            const css = match$1(content, pos);
            if (css) {
                return {
                    range: [css.start, css.end]
                };
            }
        }
    }
    /**
     * Returns range for comment toggling
     */
    function getHTMLBlockRange(source, pos, xml = false) {
        // Since we expect large input document, we’ll use pooling technique
        // for storing tag data to reduce memory pressure and improve performance
        const pool = [];
        const stack = [];
        const options = createOptions({ xml, allTokens: true });
        let result;
        scan(source, (name, type, start, end) => {
            if (type === 1 /* Open */ && isSelfClose$2(name, options)) {
                // Found empty element in HTML mode, mark is as self-closing
                type = 3 /* SelfClose */;
            }
            if (type === 1 /* Open */) {
                // Allocate tag object from pool
                stack.push(allocTag$1(pool, name, start, end));
            }
            else if (type === 3 /* SelfClose */) {
                if (start < pos && pos < end) {
                    // Matched given self-closing tag
                    result = { range: [start, end] };
                    return false;
                }
            }
            else if (type === 2 /* Close */) {
                const tag = last$7(stack);
                if (tag && tag.name === name) {
                    // Matching closing tag found
                    if (tag.start < pos && pos < end) {
                        result = {
                            range: [tag.start, end],
                        };
                        return false;
                    }
                    else if (stack.length) {
                        // Release tag object for further re-use
                        releaseTag$1(pool, stack.pop());
                    }
                }
            }
            else if (start < pos && pos < end) {
                // Found other token that matches given location
                result = { range: [start, end] };
                if (type === 6 /* Comment */) {
                    result.commentStart = htmlComment[0];
                    result.commentEnd = htmlComment[1];
                }
                return false;
            }
        }, options);
        stack.length = pool.length = 0;
        return result;
    }
    /**
     * If given `pos` location is inside CSS comment in given `code`, returns its
     * range
     */
    function findCSSComment(code, pos) {
        const scanner = new Scanner(code);
        while (!scanner.eof() && pos > scanner.pos) {
            const start = scanner.pos;
            if (consumeSeq2(scanner, 47 /* Slash */, 42 /* Asterisk */)) {
                // Consumed multiline comment start
                while (!scanner.eof() && !consumeSeq2(scanner, 42 /* Asterisk */, 47 /* Slash */)) {
                    scanner.pos++;
                }
                if (start < pos && pos < scanner.pos) {
                    return {
                        range: [start, scanner.pos],
                        commentStart: cssComment[0],
                        commentEnd: cssComment[1],
                    };
                }
            }
            else if (consumeSeq2(scanner, 47 /* Slash */, 47 /* Slash */)) {
                // Consumed single-line comment
                while (!scanner.eof() && !scanner.eat(13 /* CR */) && !scanner.eat(10 /* LF */)) {
                    scanner.pos++;
                }
                if (start < pos && pos < scanner.pos) {
                    return {
                        range: [start, scanner.pos],
                        commentStart: '//',
                    };
                }
            }
            else {
                scanner.pos++;
            }
        }
    }
    /**
     * Returns `true` if both `ch1` and `ch2` where consumed
     */
    function consumeSeq2(scanner, ch1, ch2) {
        const { pos } = scanner;
        if (scanner.eat(ch1) && scanner.eat(ch2)) {
            return true;
        }
        scanner.pos = pos;
        return false;
    }
    /**
     * Check if given tag is self-close for current parsing context
     */
    function isSelfClose$2(name, options) {
        return !options.xml && options.empty.includes(name);
    }
    function allocTag$1(pool, name, start, end) {
        if (pool.length) {
            const tag = pool.pop();
            tag.name = name;
            tag.start = start;
            tag.end = end;
            return tag;
        }
        return { name, start, end };
    }
    function releaseTag$1(pool, tag) {
        pool.push(tag);
    }
    function last$7(arr) {
        return arr.length ? arr[arr.length - 1] : null;
    }

    function evaluateMathCommand(editor) {
        const cursor = editor.getCursor();
        const line = editor.getLine(cursor.line);
        const expr = evaluateMath(line, cursor.ch);
        if (expr) {
            const from = { line: cursor.line, ch: expr.start };
            const to = { line: cursor.line, ch: expr.end };
            editor.replaceRange(expr.snippet, from, to);
        }
    }

    function goToEditPoint(editor, inc) {
        const caret = getCaret(editor);
        const pos = findNewEditPoint(editor, caret + inc, inc);
        if (pos != null) {
            editor.setCursor(editor.posFromIndex(pos));
        }
    }
    function findNewEditPoint(editor, pos, inc) {
        const doc = getContent(editor);
        const docSize = doc.length;
        let curPos = pos;
        while (curPos < docSize && curPos >= 0) {
            curPos += inc;
            const cur = doc[curPos];
            const next = doc[curPos + 1];
            const prev = doc[curPos - 1];
            if (isQuote$4(cur) && next === cur && prev === '=') {
                // Empty attribute value
                return curPos + 1;
            }
            if (cur === '<' && prev === '>') {
                // Between tags
                return curPos;
            }
            if (isNewLine(cur)) {
                const pt = editor.posFromIndex(curPos);
                const line = editor.getLine(pt.line);
                if (!line || isSpace$2(line)) {
                    // Empty line
                    return editor.indexFromPos({
                        line: pt.line,
                        ch: line.length
                    });
                }
            }
        }
    }
    function isNewLine(ch) {
        return ch === '\r' || ch === '\n';
    }

    function goToTagPair(editor) {
        let caret = getCaret(editor);
        const nextRange = [caret, Math.min(caret + 1, editor.getValue().length)];
        if (substr(editor, nextRange) === '<') {
            caret++;
        }
        const { syntax } = syntaxInfo(editor, caret);
        if (isHTML(syntax)) {
            const ctx = getTagContext(editor, caret, isXML(syntax));
            if (ctx && ctx.open && ctx.close) {
                const { open, close } = ctx;
                const nextPos = open[0] <= caret && caret < open[1]
                    ? close[0]
                    : open[0];
                editor.setCursor(editor.posFromIndex(nextPos));
            }
        }
    }

    function incrementNumber(editor, delta = 1) {
        editor.operation(() => {
            const nextRanges = editor.listSelections().slice().reverse().map(sel => {
                let selRange = textRange(editor, sel);
                if (rangeEmpty(selRange)) {
                    // No selection, extract number
                    const line = editor.getLine(sel.anchor.line);
                    const offset = sel.anchor.ch;
                    const numRange = extractNumber(line, offset);
                    if (numRange) {
                        selRange = [
                            selRange[0] - offset + numRange[0],
                            selRange[0] - offset + numRange[1],
                        ];
                    }
                }
                if (!rangeEmpty(selRange)) {
                    // Try to update value in given region
                    let value = updateNumber(substr(editor, selRange), delta);
                    replaceWithSnippet(editor, selRange, value);
                    sel = {
                        anchor: editor.posFromIndex(selRange[0]),
                        head: editor.posFromIndex(selRange[0] + value.length)
                    };
                }
                return sel;
            });
            editor.setSelections(nextRanges);
        });
    }
    /**
     * Extracts number from text at given location
     */
    function extractNumber(text, pos) {
        let hasDot = false;
        let end = pos;
        let start = pos;
        let ch;
        const len = text.length;
        // Read ahead for possible numbers
        while (end < len) {
            ch = text.charCodeAt(end);
            if (isDot(ch)) {
                if (hasDot) {
                    break;
                }
                hasDot = true;
            }
            else if (!isNumber(ch)) {
                break;
            }
            end++;
        }
        // Read backward for possible numerics
        while (start >= 0) {
            ch = text.charCodeAt(start - 1);
            if (isDot(ch)) {
                if (hasDot) {
                    break;
                }
                hasDot = true;
            }
            else if (!isNumber(ch)) {
                break;
            }
            start--;
        }
        // Negative number?
        if (start > 0 && text[start - 1] === '-') {
            start--;
        }
        if (start !== end) {
            return [start, end];
        }
    }
    function updateNumber(num, delta, precision = 3) {
        const value = parseFloat(num) + delta;
        if (isNaN(value)) {
            return num;
        }
        const neg = value < 0;
        let result = Math.abs(value).toFixed(precision);
        // Trim trailing zeroes and optionally decimal number
        result = result.replace(/\.?0+$/, '');
        // Trim leading zero if input value doesn't have it
        if ((num[0] === '.' || num.startsWith('-.')) && result[0] === '0') {
            result = result.slice(1);
        }
        return (neg ? '-' : '') + result;
    }
    function isDot(ch) {
        return ch === 46;
    }

    function removeTagCommand(editor) {
        editor.operation(() => {
            const nextRanges = editor.listSelections().slice().reverse().map(sel => {
                const tag = getTagContext(editor, editor.indexFromPos(sel.anchor));
                if (tag) {
                    removeTag(editor, tag);
                    const pos = editor.posFromIndex(tag.open[0]);
                    return {
                        anchor: pos,
                        head: pos
                    };
                }
                return sel;
            });
            editor.setSelections(nextRanges);
        });
    }
    function removeTag(editor, { open, close }) {
        if (close) {
            // Remove open and close tag and dedent inner content
            const innerRange = narrowToNonSpace(editor, [open[1], close[0]]);
            if (!rangeEmpty(innerRange)) {
                // Gracefully remove open and close tags and tweak indentation on tag contents
                replaceWithSnippet(editor, [innerRange[1], close[1]], '');
                const start = editor.posFromIndex(open[0]);
                const end = editor.posFromIndex(close[1]);
                if (start.line !== end.line) {
                    // Skip two lines: first one for open tag, on second one
                    // indentation will be removed with open tag
                    let line = start.line + 2;
                    const baseIndent = getLineIndent(editor, open[0]);
                    const innerIndent = getLineIndent(editor, innerRange[0]);
                    while (line <= end.line) {
                        const lineStart = editor.indexFromPos({ line, ch: 0 });
                        const indentRange = [lineStart, lineStart + innerIndent.length];
                        if (isSpace$2(substr(editor, indentRange))) {
                            console.log('replace "%s" with "%s"', substr(editor, indentRange), baseIndent);
                            replaceWithSnippet(editor, indentRange, baseIndent);
                        }
                        line++;
                    }
                }
                replaceWithSnippet(editor, [open[0], innerRange[0]], '');
            }
            else {
                replaceWithSnippet(editor, [open[0], close[1]], '');
            }
        }
        else {
            replaceWithSnippet(editor, open, '');
        }
    }
    /**
     * Returns indentation for line found from given character location
     */
    function getLineIndent(editor, ix) {
        return lineIndent(editor, editor.posFromIndex(ix).line);
    }

    function selectItemCommand(editor, isPrev = false) {
        const syntax = docSyntax(editor);
        if (!isCSS(syntax) && !isHTML(syntax)) {
            return;
        }
        const sel = editor.listSelections()[0];
        const selRange = textRange(editor, sel);
        const code = getContent(editor);
        let model = selectItem(code, selRange[0], isCSS(syntax), isPrev);
        if (model) {
            let range = findRange(selRange, model.ranges, isPrev);
            if (!range) {
                // Out of available selection range, move to next item
                const nextPos = isPrev ? model.start : model.end;
                model = selectItem(code, nextPos, isCSS(syntax), isPrev);
                if (model) {
                    range = findRange(selRange, model.ranges, isPrev);
                }
            }
            if (range) {
                const [from, to] = toRange(editor, range);
                editor.setSelection(from, to);
            }
        }
    }
    function findRange(sel, ranges, reverse = false) {
        if (reverse) {
            ranges = ranges.slice().reverse();
        }
        let getNext = false;
        let candidate;
        for (const r of ranges) {
            if (getNext) {
                return r;
            }
            if (rangesEqual(r, sel)) {
                // This range is currently selected, request next
                getNext = true;
            }
            else if (!candidate && (rangeContains(r, sel) || (reverse && r[0] <= sel[0]) || (!reverse && r[0] >= sel[0]))) {
                candidate = r;
            }
        }
        if (!getNext) {
            return candidate;
        }
    }

    function splitJoinTag(editor) {
        const selections = editor.listSelections().slice().reverse();
        const nextRanges = [];
        editor.operation(() => {
            for (const sel of selections) {
                const pos = editor.indexFromPos(sel.anchor);
                const { syntax } = syntaxInfo(editor, pos);
                const tag = getTagContext(editor, pos, isXML(syntax));
                if (tag) {
                    const { open, close } = tag;
                    if (close) {
                        // Join tag: remove tag contents, if any, and add closing slash
                        replaceWithSnippet(editor, [open[1], close[1]], '');
                        let closing = isSpace$2(getChar(editor, open[1] - 2)) ? '/' : ' /';
                        replaceWithSnippet(editor, [open[1] - 1, open[1] - 1], closing);
                        nextRanges.push(createRange(editor, open[1] + closing.length));
                    }
                    else {
                        // Split tag: add closing part and remove closing slash
                        const endTag = `</${tag.name}>`;
                        replaceWithSnippet(editor, [open[1], open[1]], endTag);
                        if (getChar(editor, open[1] - 2) === '/') {
                            let start = open[1] - 2;
                            let end = open[1] - 1;
                            if (isSpace$2(getChar(editor, start - 1))) {
                                start--;
                            }
                            replaceWithSnippet(editor, [start, end], '');
                            nextRanges.push(createRange(editor, open[1] - end + start));
                        }
                        else {
                            nextRanges.push(createRange(editor, open[1]));
                        }
                    }
                }
                else {
                    nextRanges.push(sel);
                }
            }
            editor.setSelections(nextRanges);
        });
    }
    function getChar(editor, pos) {
        return substr(editor, [pos, pos + 1]);
    }
    function createRange(editor, pos) {
        const p = editor.posFromIndex(pos);
        return {
            anchor: p,
            head: p
        };
    }

    /**
     * Registers Emmet extension on given CodeMirror constructor.
     * This file is designed to be imported somehow into the app (CommonJS, ES6,
     * Rollup/Webpack/whatever). If you simply want to add a <script> into your page
     * that registers Emmet extension on global CodeMirror constructor, use
     * `browser.js` instead
     */
    function registerEmmetExtension(CM) {
        // Register Emmet commands
        Object.assign(CM.commands, {
            emmetExpandAbbreviation: (editor) => expandAbbreviation$1(editor, true),
            emmetExpandAbbreviationAll: (editor) => expandAbbreviation$1(editor, false),
            emmetCaptureAbbreviation: captureAbbreviation,
            emmetResetAbbreviation: resetAbbreviation,
            emmetEnterAbbreviationMode: enterAbbreviationMode,
            emmetInsertLineBreak: insertLineBreak,
            emmetWrapWithAbbreviation: wrapWithAbbreviation,
            emmetBalance: balanceAction,
            emmetBalanceInward: (editor) => balanceAction(editor, true),
            emmetToggleComment: comment$2,
            emmetEvaluateMath: evaluateMathCommand,
            emmetGoToNextEditPoint: (editor) => goToEditPoint(editor, 1),
            emmetGoToPreviousEditPoint: (editor) => goToEditPoint(editor, -1),
            emmetGoToTagPair: goToTagPair,
            emmetIncrementNumber1: (editor) => incrementNumber(editor, 1),
            emmetIncrementNumber01: (editor) => incrementNumber(editor, .1),
            emmetIncrementNumber10: (editor) => incrementNumber(editor, 10),
            emmetDecrementNumber1: (editor) => incrementNumber(editor, -1),
            emmetDecrementNumber01: (editor) => incrementNumber(editor, -.1),
            emmetDecrementNumber10: (editor) => incrementNumber(editor, -10),
            emmetRemoveTag: removeTagCommand,
            emmetSelectNextItem: (editor) => selectItemCommand(editor),
            emmetSelectPreviousItem: (editor) => selectItemCommand(editor, true),
            emmetSplitJoinTag: splitJoinTag,
        });
        // Track options change
        CM.defineOption('emmet', defaultConfig, (editor, value) => {
            if (!hasInternalState(editor)) {
                editor.on('change', undoTracker);
                editor.on('change', pasteTracker);
            }
            const state = getInternalState(editor);
            value = getEmmetConfig(editor, value);
            if (value.mark && !state.tracker) {
                state.tracker = initAbbreviationTracker(editor);
            }
            else if (!value.mark && state.tracker) {
                state.tracker();
                state.tracker = null;
            }
            if (value.markTagPairs && !state.tagMatch) {
                state.tagMatch = markTagMatches(editor);
            }
            else if (!value.markTagPairs && state.tagMatch) {
                state.tagMatch();
                state.tagMatch = null;
            }
        });
        CM.defineMode('emmet-abbreviation', emmetAbbreviationMode);
        CM.defineMode('emmet-css-abbreviation', emmetAbbreviationMode$1);
        CM.defineMode('emmet-snippet', snippetNameMode);
        // Expose `expandAbbreviation` method to all instances to allow
        // programmatic usage based on current Emmet options
        CM.defineExtension('expandAbbreviation', function (abbr, options = getOptions(this, 0)) {
            return expand(this, abbr, options);
        });
        CM.defineExtension('emmetOptions', function (pos = 0) {
            return getOptions(this, pos);
        });
        CM.defineExtension('parseAbbreviation', function (abbr, type) {
            if (type === 'stylesheet') {
                return parser(tokenize$1(abbr));
            }
            else {
                return abbreviation(tokenize(abbr), { jsx: type === 'jsx' });
            }
        });
        CM.defineExtension('getEmmetCompletion', function (pos) {
            if (typeof pos !== 'number') {
                pos = this.indexFromPos(pos);
            }
            return getCompletion(this, pos);
        });
    }
    /**
     * Undo tracker, if possible
     */
    function undoTracker(editor, change) {
        if (change.origin === 'undo' && change.text.length === 1) {
            const pos = editor.indexFromPos(change.from);
            const abbr = change.text[0];
            restoreOnUndo(editor, pos, abbr);
        }
    }
    /**
     * Capture abbreviation on paste, if possible
     */
    function pasteTracker(editor, change) {
        if (change.origin === 'paste' && change.text.length === 1 && allowTracking(editor, editor.indexFromPos(change.from))) {
            // Try to capture abbreviation on paste
            const pos = editor.indexFromPos(change.from) + change.text[0].length;
            extractTracker(editor, pos);
        }
    }

    if (typeof window.CodeMirror !== 'undefined') {
        registerEmmetExtension(window.CodeMirror);
    }

})));
//# sourceMappingURL=browser.js.map
