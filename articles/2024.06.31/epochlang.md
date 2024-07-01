# Simplest Usable Configuration Language

This is Epoch, an incredibly simple config language. Just messing around with a formal language definition for now. The language's alphabet is comprised of unicode characters, \\\(\mathbb{U}\\\). The language needs to have:

- Tokens, made of characters and separated by a separator
- Scope (dictated by `(` and `)`)

Here is the formal grammar:
$$
\displaylines{S \\\
N = \lbrace V, X\rbrace \\\
\mathbb{X} = \lbrace \text{space}, \text{tab}, \text{newline} \rbrace\\\
\Sigma = \mathbb{U} - \mathbb{X} - \lbrace\ (, )\rbrace \\\
P = \begin{cases}
      S \rightarrow \varepsilon\ |\ SxS\ |\ S(S)\ |\ (S)S\ |\ T \\\ 
      T \rightarrow eT\ |\ e
\end{cases}
}
$$
There are two production rules, they are

> Start Rule: transforms S to one of
>
> - \\\(\varepsilon\\\)
> - S followed by a separator \\\(x \in \mathbb{X}\\\) followed by another S
> - S followed by (S)
> - (S) followed by S
> - Token Rule T



> Token Rule: transforms T to one of
>
> - Any member of \\\(e \in \Sigma\\\) followed by another T
> - Any member of \\\(e \in \Sigma\\\)

Because there are only non-terminal tokens on the LHS of all the production rules, this is a context-free grammar.

**Idea:** Every string valid in our language can be represented by a decision tree of which rules to apply starting from S. This might help us parse it.

## Examples

```
dave (
	id (oia3515jne1351foinai)
	age (30)
)

michael (
	id (08hqt084h30hg08hg428)
	age (24)
)

jenny ()
```

When we say we want to 'access' a token, what we're really saying is we are interested in every step in the subset of the decision tree used to generate the token. Example:

```
S -> S(S) -> S(S(S)) -> michael(S(S)) -> michael(age(S)) -> michael(age(24))
```

Here each repetitive application of the token production rule is considered one rule application.

### Querying

To query the string, we simply provide this subset we are interested in (the query), and return all children of the query.

`michael(age)` -> `24`

`dave` -> `id (oia3515jne1351foinai) age (30)`  

`jenny` -> `∅`

