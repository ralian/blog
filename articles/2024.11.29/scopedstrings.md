# Scoped Strings

On the topic of language and grammar, I wanted to take a step back from formalisms and talk about an idea. The fundamental idea follows:

> Typing systems can be used for more than people realize, and applying them properly can simplify or even eliminate the need for some other language constructs.

As one example of this - _though, certainly not the only example_ - let's make a language with a string type, but no special production rules in the grammar for "string literals".

## A Simple Typing System

Borrowing the syntax of uniform initialization in C++, let's adopt the idea of following a variable declaration with a brace-enclosed initial value, for instance: `int a {42};`

For our purpose, we will omit the `;` and the variable name in our grammar. Every token will be anonymous. This effectively gives our language a paired list in each scope of types and values.

## String Literals

To be clear, we're not going to avoid null-terminated strings in the compiled output program. What we _are_ going to avoid is the single and double-quote wrapped char arrays found in most languages:

```
"Hello, world!"
'Hello, world!"
```

Instead, we will "reuse" the idea of scope to encapsulate our string literal. More exactly speaking, when we determine that the type represented by the scope is unambiguously a string (or char array, char list, char vector, what have you...) we will change to a much simpler grammar which accepts any tokens, with the exception of the scope closing character:

```
str {Hello, world!}
```

A decent regex to match this is `/str \{\X*?\}/`, although escape characters will break this. We will adopt C-style escape characters:

```
str {Hello, \{world\}!}
```

The regex to skip matching characters after a lone `\` (such that a literal `\\` escapes to a single backslash) is `(?<!\\)(\\\\)*?`.

Here we are just repurposing the backslash character to escape the next character in our input. You _might_ think that having unique opening and closing characters allows us to avoid escaping `{` in our strings, and you would be technically correct - but, we can use the idea of an inner scope for something special: formatting. More on this later.

## The Grammar, so Far

Let's take the regex we've done so far, and add in a 'list' type as well as some whitespace handling:

```
WSP: /[ \t\n\f\r]/

value: list | STRING

list: "list" WSP* "{" [value ("," WSP* value)*] "}"

STRING: "str" WSP* "{" /\X*?(?<!\\)(\\\\)*?/ "}"
```
Note that the use of `\X` instead of `.` means that the match group will include any whitespace/newlines _inside_ strings, so the grammar should accept the following input:

```
list {
    str {String 1!}
    str {String     \{2\}.}
    str {String
3?}
}
```
String 3 (at offset 2 in the list) should have a literal newline in it, sort of like a C-style raw string.

## Numeric Types and Transformers

Let's add another type to our grammar so our strings aren't lonely. I'm going to add a general numeric type, which I'm lifting verbatim from the [default library](https://github.com/lark-parser/lark/blob/master/lark/grammars/common.lark) in Lark: `/-?\d+(\.\d+)?([eE][+-]?\d+)?/`

We'll also add transformers so we can interpret the string and numeric values in Python:

```
class TreeToJson(Transformer):
    def string(self, s:str):
        return s[-1].lstrip("str").lstrip(" ").lstrip("{").rstrip("}")
    def number(self, n):
        return float(n[-1].lstrip("num").lstrip(" ").lstrip("{").rstrip("}"))

json_parser = Lark(r"""
WSP: /[ \t\n\f\r]/

value: list
    | STRING -> string
    | NUMBER -> number

list: "list" WSP* "{" [value ("," WSP* value)*] "}"

STRING: "str" WSP* "{" /(\s|\S)*?(?<!\\)(\\\\)*?/ "}"
NUMBER: "num" WSP* "{" WSP* /-?\d+(\.\d+)?([eE][+-]?\d+)?/ WSP* "}"
""", start='value')
```

I've created a full implementation that you can play around with [here].

> Note: For some reason, the default regex engine in Lark won't accept `\X`. I've had success with replacing it with `(\s|\S)`. There's probably a better option than this.

## Inner Scope and Format Strings

We can also use the idea of inner scope (unescaped matched `\{\X*?\}` pairs inside the string) to create format strings.

The implementation of this will get a bit complicated, and I'll have to leave it for later.

