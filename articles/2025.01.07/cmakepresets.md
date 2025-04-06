# Leveraging CMake Preset Multi-Inheritance

[CMake Presets](https://cmake.org/cmake/help/latest/manual/cmake-presets.7.html) (since v3.19, circa 2020) solve an important problem: keeping track of the usual config, build, install, etc. presets needed to build a project.

There is some neat stuff crammed in the schema, including inheritance, includes, and several macros to expand statements within the presets.

Today we're looking at how to use preset inheritance to create a composition-based preset library to simplify your preset list.

(You _are_ using presets, right...? _right?_)

## Preset Inheritance

The spec allows us to define a list of parent presets for each preset. here is a minimal example:

```json
{
    "name": "default",
    "displayName": "Default Config",
    "description": "Default build using Ninja generator",
    "generator": "Ninja"
},
{
    "name": "gcc",
    "inherits": "default",
    "displayName": "GCC Config, inherited from Default",
    "description": "Specifies both GCC and Ninja",
    "cacheVariables": {
        "CMAKE_C_COMPILER": "gcc",
        "CMAKE_CXX_COMPILER": "g++"
    }
}
```

One kind of incredible feature is the ability to use multiple inheritance:

```json
{
    "name": "debug",
    "hidden": true,
    "cacheVariables": {
        "CMAKE_BUILD_TYPE": "Debug",
    }
},
{
    "name": "release",
    "hidden": true,
    "cacheVariables": {
        "CMAKE_BUILD_TYPE": "Release",
    }
},
...
{
    "name": "gcc-debug",
    "displayName": "GCC Debug Config, inherited from Default",
    "description": "Specifies both GCC, Debug, and Ninja",
    "inherits": ["gcc", "debug"]
},
{
    "name": "gcc-release",
    "displayName": "GCC Debug Config, inherited from Default",
    "description": "Specifies both GCC, Release, and Ninja",
    "inherits": ["gcc", "release"]
}
```
This doesn't look much more convenient with only two bottom-level presets, but it avoids us setting redundant `cacheVariables` across all the presets we have, which could be in the hundreds of presets. It will also allow us to move all the parent presets into their own "header" preset file, to keep the parts of your preset relevant to your project lean.

## Multiple Inheritance Rules

When CMake computes inheritance, it evaluates all targets listed as parents in a RTL fashion. Documentation states:

> The preset will inherit all of the fields from the inherits presets by default (except name, hidden, inherits, description, and displayName), but can override them as desired. If multiple inherits presets provide conflicting values for the same field, the earlier preset in the inherits array will be preferred.

You might then be wondering, "If `gcc-debug` inherits `gcc` and `debug` which both set cache variables, how are the variables from both parents combined?"

It turns out that `cacheVariables` and `environment` are kind of a blessed case for this evaluation:

> Cache variables are inherited through the inherits field, and the preset's variables will be the union of its own cacheVariables and the cacheVariables from all its parents. If multiple presets in this union define the same variable, the standard rules of inherits are applied. Setting a variable to null causes it to not be set, even if a value was inherited from another preset.

Following these rules, `gcc-debug` will receive all three cache variables specified in its parent presets.

## Black Magic: Bending the Inheritance Rules

It turns out, as long as a field supports macro expansion, we can forward some of the behavior from `environment` onto that field with the `$env{}` macro. An example of this is the `target` field.

Let's create a simple project with the following structure:

```
project
|- a.cpp
|- b.cpp
|- CMakeLists.txt
\- CMakePresets.json
```

**a.cpp:**
```C++
#include <cstdio.h>

void main(void) { printf("Hello from A!\n"); }
```

**b.cpp:**
```C++
#include <cstdio.h>

void main(void) { printf("Hello from B!\n"); }
```

**CMakeLists.txt:**
```C++
project(project)

add_executable(A a.cpp)
add_executable(B b.cpp)
```

With all this in mind, let's say we want presets for three different sets of targets: `A`, `B`, and `A+B`. You can, of course, build both `A+B` with the `all` target in this simple example, but let's pretend that this is a more complex project and we want to build `A` and `B` without building `all`.

If we take the naive approach of the following pseudoconfig, we will run into an issue:

```json
{"name": "build-a", "target": "A"},
{"name": "build-b", "target": "B"}
{"name": "build-ab", "inherit": ["build-a", "build-b"]}
```

The issue, of course, is that the target value from `build-a` overwrites `build-b`'s targets (since they are evaluated RTL), so `build-ab` will only build target `A`. The solution to this, kludgy as it might be, follows:

**CMakePresets.json:**

```json
{
    "name": "default",
    "targets": "$env{CMAKE_TARGETS}"// TODO BAD
    ...
},

...

{
    "name": "build-a",
    "hidden": true,
    "environment": {
        "CMAKE_TARGETS": "A $envp{CMAKE_TARGETS}"
    }
},
{
    "name": "build-b",
    "hidden": true,
    "environment": {
        "CMAKE_TARGETS": "B $envp{CMAKE_TARGETS}"
    }
},

...

{
    "name": "mytarget-build-a",
    "inherits": ["default", "build-a"]
},
{
    "name": "mytarget-build-b",
    "inherits": ["default", "build-b"]
},
{
    "name": "mytarget-build-ab",
    "inherits": ["default", "build-a", "build-b"]
}
```

Why does this work? `$envp` takes the environment of the parent, which is originally empty. Thus, `mytarget-build-ab`'s target list is built by compisition: `"" -> "A " -> "B A "`.

## How can _you_ use this?

While this is definitely a supported feature of CMake's presets schema, I recommend using it with caution. It is possible to create some counterintuitive preset hierarchies, especially when lots of parent presets are specified in a context where order matters.

I would assert that any parent which simply sets environment variables or cache variables is probably fine, but to use any parent which uses macro tricks with caution - or not at all.

Happy configuring!
