from lark import Lark, Transformer, Token

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

# bval: "true" -> true
#     | "false" -> false
# boolean: "bool" WSP* "{" WSP* bval WSP* "}"

text = r"""list {str{item0}, str {ite
m1}, num { 3.14 },
num {3e8}}"""

print(TreeToJson().transform(json_parser.parse(text)))
