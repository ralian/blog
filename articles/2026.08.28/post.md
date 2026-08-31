# Python for the C++ Developer

This is part one in an orientation to Python. The target audience is experienced users of other languages; especially compiled languages, and especially-especially C++. This is not an overview of the basics... there will be basic concepts, but we will proceed in an order that answers the questions of "what makes Python interesting and useful" rather than "how do I use Python?" This is an _orientation_ rather than a _tutorial_ and is definitely not a _programming tutorial_. It is designed to _orient_ you.

With that disclaimer out of the way, let's dive in!

## What *is* Python?

Python is a [REPL](https://en.wikipedia.org/wiki/Read%E2%80%93eval%E2%80%93print_loop) language. [Just like C++](https://root.cern/cling/). (Kidding.)

Python has strong, dynamic typing. Under the hood, the type checking is property-based rather than inheritance-based (often referred to as [Duck typing](https://en.wikipedia.org/wiki/Duck_typing)). Duck typing is more of an informal implementation detail and does not change anything about how _strong_ or _weak_ the type system is.

Even though there is no enforced static typing, there are static type checkers (`mypy`) which can be used to check type correctness - not unlike how most compiled languages enforce some form of type correctness on interfaces, functions, and contracts at compile time. There are some subtle differences and exceptions that can hinder `mypy`'s ability to check correctness: namely the `Any` type which should generally be avoided, and situations with self-modifying code... but, the truth is that Python is a language that *can* and *should* be statically type checked.

Unlike C++ with its "Big Three" compilers, or many other languages like SQL that have dozens or more implementations and engines, Python has one *main* interpreter, [cpython](https://github.com/python/cpython). (There are exceptions to this, like PyPy or MicroPython but usually anyone using Python is running `cpython`.) Check out [this list](https://www.python.org/download/alternatives/) if you are interested - many of the lesser known interpreters are designed for interesting problem domains.

It is designed by a committee, the Python Steering Council, and the directives are published as PEPs, Python Enhancement Proposals. A key difference between the Python committee and say, the C++ and C committees, is that the Python PEPs cover tooling to a much greater degree than C++ does, which is usually none at all. That's how you end up with things like, say, a medical equipment company running your language's most ubiquitous build tool.

For instance, here are some interesting and important PEPs, all still relevant until decided otherwise by the committee:
- [PEP 20](https://peps.python.org/pep-0020/) - The Zen of Python
- [PEP 8](https://peps.python.org/pep-0008/) - Style Guide for Python Code
- [PEP 485](https://peps.python.org/pep-0484/) - Type Hints
- [PEP 609](https://peps.python.org/pep-0609/) - Python Packaging Authority (PyPA) Governance
- [PEP 621](https://peps.python.org/pep-0621/) - Storing project metadata in `pyproject.toml`

That last one, on the format of the package file, has actually been slightly moved to a formal spec on packaging.python.org.

It can be an advantage and disadvantage; Like Cargo to Rust, Python _did_ have one main package manager, `pip`; this package manager was actually shipped as a python module in the standard library. Using it could be tricky since some things changed from Python 2 to 3.

Even though there is an official package manager, there are unofficial tools which support the same package format and are used in place of `pip`. `Conda` and `Poetry` are two mature tools that have seen relative popularity vs. `pip`. `uv` is a more recent tool that has seen widespread adoption; it is mature as well, but only much more recently - the first release was in 2024.

## Did someone say "Standard Library"?

Yes, Python has a [standard library](https://docs.python.org/3/library/index.html) too! It has some great packages that would probably never make it into something like the C++ standard library. It's also not perfect of course, and lacks some things other languages get for free. It sounds obvious but it's really just designed to solve a different problem set out of the box... like any language.

It also has some things that you should ignore for practical purposes. Mainly here, I am referring to the parsers, `xml` and `json`. These _are_ good libraries, but they are designed for correctness rather than the intersection of correctness and speed. For xml parsing you should use `beautifulsoup` and for json you should use `orjson`... but do your own research on what parser's performance is right for your specific problem, of course. Often for very small configuration files, using the standard library is fine.

## Native code, parallelism, and the GIL

Python has existed long enough that multi-core processors were not a consideration early on in the language's design. Early Python did have multithreading; but, as with multithreading in native code at the time, this was mainly a feature created for separation of concerns between threads. Having interruptible threads allows for interrupt handlers to trip things like input handling code or timers.

When multi-core processors became available for Python users, having simultaneously active threads led to the possibility of simultaneous writes to [PyObject's reference counting](https://github.com/python/cpython/blob/main/Objects/object.c#L2726-L2756) to corrupt the heap. The safest approach was to introduce a global mutex held by the thread executing at the moment. This locked CPU-intensive tasks to a single thread, but has advantages of simplicity, easier correctness and determinism guarantees, and no slowdowns due to more cache misses of having per-object locks.

Of course, this does not make Python useless for parallel processing tasks. The `multiprocessing` module was introduced for parallelization by spawning additional `python` instances; subprocesses could be spawned under a single `python` process; or, if all else fails, calling into native code from a Python function could be used to create additional threads for the process not beholden to the GIL (at your own peril, of course!)

When you call mathematical processing functions in popular Python math libraries like `numpy`, you are almost always calling into native code at some point in the chain - hence, using these libraries on large amounts of data is usually much simpler than rolling your own implementation when possible. That combination of ease of use with the power of native libraries is also where the joke (which isn't one, really) about how easy it is to train a neural network in Python came from:

```python
import torch

# 1. Generate random inputs (X) and targets (Y)
X, Y = torch.randn(100, 10), torch.randn(100, 1)

# 2. Build the network, loss function, and optimizer
model = torch.nn.Sequential(torch.nn.Linear(10, 5), torch.nn.ReLU(), torch.nn.Linear(5, 1))
criterion = torch.nn.MSELoss()
opt = torch.optim.SGD(model.parameters(), lr=0.01)

# 3. Train the network for 20 epochs
for epoch in range(20):
	opt.zero_grad() # Reset gradients
	loss = criterion(model(X), Y) # Forward pass + calculate loss
	loss.backward() # Backward pass (Backpropagation) opt.step()
```

Of course, you can make a function of arbitrary complexity in any language, and calling it is trivial. But what is surprising about this example is how easy it is to get native code performance, commanded from the ease of an interpreted REPL language.

There are two primary mechanisms by which interpreted Python can call into native code:
1. The CPython Extension Module interface: Much more common for codebases where you control both the Python and the native code calling it. Most "Binding tools" for other languages like `ctypes` / `Cython`/ `PyBind11` are really sophisticated wrappers around this, which ultimately build off functionality in the `<Python.h>` header itself.
2. CFFI: Python has the ability, like most compiled and interpreted languages, to understand the C Foreign Function Interface - the layout and guardrails needed to call into dynamic libraries. This is very useful if you need to call into a system `.dll`/`.so` that wasn't necessarily written with Python in mind.

There are mechanisms to disable the GIL in more recent versions of Python, for rare situations where it is useful. It is also possible to interact with PyObjects and call Python functions _from_ native code, but that is out of scope for now.

## Packaging and Wheels

So, what's in a Python package?

The original package used for Python modules was a source distribution (`sdist`) for source code, and Eggs for a binary only distribution. Installing eggs was insecure due to arbitrary code execution built-in... not ideal. [PEP 427](https://peps.python.org/pep-0427/#rationale) introduced Wheels to replace Eggs.

You can read about the exact structure in that PEP, but the `.whl` file is really just an archive with both python and possibly native code extensions or dlls that can be loaded by the interpreter. You can unzip installed wheels and examine them yourself!
## Safety and Typing

The last thing I'll cover for now is a bit about writing type-safe Python. I touched on what `mypy` is at the start of this orientation, but let's use a practical example for once, instead of my usually abstract ramblings. Create a python script in a directory (we'll name the file `main.py`, it doesn't matter too much). We'll define a function with no type information.

```python
def fun(param):
    if param < 5:
        return True
    return "A String!"
```

This function already does something we're generally not allowed to do in some compiled languages, because it can be dangerous. The type of our return value depends on our input parameter! Let's run `mypy` in that directory. I'm using `uv`, but you don't need `uv` to run `mypy`:

```bash
$ uv init && uv add mypy && uv run mypy --strict .
main.py:2: error: Function is missing a type annotation  [no-untyped-def]
Found 1 error in 1 file (checked 1 source file)
```

`--strict` is just a shortcut to turn extra checks on. You can have full control over which checks you enable and disable in your project definition file.

Now, let's add type hints! But, let `mypy` catch us in a mistake:

```python
def fun(param : int) -> str:
    if param < 5:
        return True
    return "A String!"
```

Now, `mypy` yields:

```
main.py:4: error: Incompatible return value type (got "bool", expected "str")  [return-value]
Found 1 error in 1 file (checked 1 source file)
```

The correct syntax to denote multiple possible return types involves `|`:

```python
def fun(param : int) -> bool | str:
    if param < 5:
        return True
    return "A String!"
```

Additionally, `mypy` will catch you if the function is ever called in a context where it expects a return type other than one in the list of possible return types.

Those are the very basics of typing! I may come back and cover this in a more advanced fashion later. There are actually some quite deep additions to Python's typing system that were added more recently, and in my opinion aren't widely used enough. The typing system and tools support advanced features like generics, overloads, and type comparisons. You can always read the spec directly here: https://typing.python.org/en/latest/spec/

