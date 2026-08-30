# C++ Codebase Infrastructure with UV and CMake

Why use CMake _and_ UV? Isn't CMake enough?

CMake is great at producing reproducible builds as long as it is run using the same version, in the same environment, with the same inputs. Too often, on developer machines (especially across teams or for open source projects), environment differences can lead to differing behavior.

- uv Locks the exact version of CMake to whatever the latest is in PyPI (or an older version, if needed for building a project with an old CMakeLists.) Users that build your project won't run into problems when building with an old system version of CMake, or a newer version than your project policy supports.
- uv provides an interface we can use to run builds, with the correct environment.
- You can install useful extras from PyPI into your environment, like clang-tools, making them easier to both integrate with CI and enforce same-version and same-behavior of on all developer machines.

> A word of caution on CMake Version Policy:
> 
> Just because pinning CMake version in UV solves the problem of version compatibility for _your_ project's CMake, doesn't mean dependencies that CMake needs to discover or even build will be compatible with your version of CMake.
>
> To address this - if you are doing module discovery or something like dependency builds with `FetchContent`, you need to either:
> - Pick a version of CMake compatible with all of your project's dependencies
> - Sideload multiple versions of CMake, then link against the built libraries in the environment rather than generated CMake targets - UV does make this possible but it's quite messy.

## Example Project Setup

This is a pretty trivial exercise to walk through locally. All you need is a C++ compiler, and UV installed locally. The steps and commands should be largely identical on any platform.

Let's call this project `uvcpp` and make it a simple Hello World program with C++23:

```powershell
uv init uvcpp;
uv add --directory uvcpp clang-tools cmake ninja;
```

Now running `uv tree` in the directory shows what we just installed:

```
Resolved 4 packages in 1ms
uvcpp v0.1.0
├── clang-tools v1.2.0
├── cmake v4.4.3
└── ninja v1.13.2
```

On a fresh setup you might see newer versions of these tools, and that is fine. But, crucially, if you pull an existing project with a lockfile in version control and run `uv sync`, you will get the expected versions of each dependency.

For a serious project, I would also recommend adding these dependencies as `--group dev` so that only users intending to build the binaries from source install build tools with `uv sync`.

Now, let's make a simple hello world source in `src/main.cpp`:

```cpp
#include <print>

auto main() -> int {
    std::println("Hello world!");
    return 0;
}
```

And, a simple `CMakeLists.txt` in the root of the project:

```cmake
cmake_minimum_required(VERSION 4.2)
project(uvcpp VERSION 1 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_executable(main src/main.cpp)
```

Let's add a `CMakePresets.json` too for convenience:

```json
{
    "version": 3,
    "configurePresets": [
        {
            "name": "default",
            "displayName": "Default Config",
            "description": "Default build using Ninja generator",
            "generator": "Ninja",
            "binaryDir": "${sourceDir}/build/${presetName}",
            "cacheVariables": {
                "CMAKE_BUILD_TYPE": "Release",
                "CMAKE_EXPORT_COMPILE_COMMANDS": "ON"
            }
        }
    }
}
```

Note that we can safely assume Ninja (or Ninja Multi-Config) since we installed Ninja from PyPI!

Here is how a MSVC build looks on Windows Developer Powershell. Note the only difference from an end user perspective is that we prepend most of our commands with `uv run`... this runs each command in the proper `venv`.

```powershell
**********************************************************************
** Visual Studio 2022 Developer PowerShell v17.11.3
** Copyright (c) 2022 Microsoft Corporation
**********************************************************************
PS C:\Program Files\Microsoft Visual Studio\2022\Community> cd ~
PS C:\Users\wbowe> cd uvcpp
PS C:\Users\wbowe\uvcpp> uv run cmake --preset default .
-- The CXX compiler identification is MSVC 19.41.34120.0
-- Detecting CXX compiler ABI info
-- Detecting CXX compiler ABI info - done
-- Check for working CXX compiler: C:/Program Files/Microsoft Visual Studio/2022/Community/VC/Tools/MSVC/14.41.34120/bin/Hostx64/x64/cl.exe - skipped
-- Detecting CXX compile features
-- Detecting CXX compile features - done
-- Configuring done (2.5s)
-- Generating done (0.0s)
-- Build files have been written to: C:/Users/wbowe/uvcpp/build/default
PS C:\Users\wbowe\uvcpp> uv run cmake --build build/default
[4/4] Linking CXX executable main.exe
PS C:\Users\wbowe\uvcpp> .\build\default\main.exe
Hello world!
```

## Other Tools

We can also trigger CTest from `uv`:

```powershell
PS C:\Users\wbowe\uvcpp> uv run ctest .
Test project C:/Users/wbowe/uvcpp
No tests were found!!!
```

You can also use the `clang-tools` but note that you'll have to do `uv run clang-tools install ...` first.

## Integrating into Python Builds

Finally, what if we want to package our binary into a wheel that can be installed as a Python package (and published to PyPI!)? There are several approaches, depending on what backend you want to use.
- `scikit-build` is the usual choice for building binaries; however, this runs its own environment. This can be a good thing, and I would recommend this workflow to users familiar with scikit *with the caveat that the version of CMake it picks might be your system version.* Make sure you pin the version appropriately.
- `uv_build` is a newer backend bundled with `uv` by Astral. Right now it "only" supports pure python wheels. You can technically copy prebuilt binaries into your wheels without much fuss, but I strongly recommend _against_ using this for compiled binaries.
- `Hatchling` is the most interesting approach, to me at least. It isn't the normal route for builds which involve binaries, because normally: running custom commands that involve things like CMake is environment dependent. However, since we already build in our virtual environment, we can be clever and leverage this venv for our build step. This means the only variable left is the compiler installed on the system, which is true of Scikit builds anyways.

I hope you would agree - _none of these approaches is perfect_. Scikit provides the closest, most widely used, and probably most stable approach... I would again recommend this tool first.

However, since the last approach is not one I've seen before, I wanted to investigate it myself. I created a custom hook script to invoke `cmake` and `cmake --build` inside our environment, `hatch_build.py`:

```python
from __future__ import annotations

import shutil
import subprocess
import sys
import sysconfig
from pathlib import Path
from typing import Any

from hatchling.builders.hooks.plugin.interface import BuildHookInterface


def _tool(name: str, bundled_dir: Path | None) -> Path:
    exe_name = f"{name}.exe" if sys.platform == "win32" else name
    if bundled_dir is not None:
        candidate = bundled_dir / exe_name
        if candidate.is_file():
            return candidate
    found = shutil.which(name)
    if found is None:
        raise RuntimeError(f"{name} not found")
    return Path(found)


def _cmake() -> Path:
    bundled_dir: Path | None
    try:
        from cmake import CMAKE_BIN_DIR
    except ImportError:
        bundled_dir = None
    else:
        bundled_dir = Path(CMAKE_BIN_DIR)
    return _tool("cmake", bundled_dir)


def _built_main(build_dir: Path) -> Path:
    names = ("main.exe", "main")
    for directory in (
        build_dir,
        build_dir / "Release",
        build_dir / "RelWithDebInfo",
        build_dir / "Debug",
    ):
        for name in names:
            candidate = directory / name
            if candidate.is_file():
                return candidate
    raise FileNotFoundError(f"main executable not found under {build_dir}")


def _platform_tag() -> str:
    return sysconfig.get_platform().replace("-", "_").replace(".", "_")


class CustomBuildHook(BuildHookInterface):
    def initialize(self, version: str, build_data: dict[str, Any]) -> None:
        if self.target_name != "wheel":
            return

        root = Path(self.root)
        cmake = _cmake()
        subprocess.run(
            [str(cmake), "--preset", "release", "--fresh"],
            cwd=root,
            check=True,
        )
        subprocess.run(
            [str(cmake), "--build", "--preset", "release", "--target", "main"],
            cwd=root,
            check=True,
        )

        exe = _built_main(root / "build" / "release")
        scripts: dict[str, str] = build_data.setdefault("shared_scripts", {})
        scripts[str(exe.resolve())] = exe.name
        build_data["pure_python"] = False
        build_data["tag"] = f"py3-none-{_platform_tag()}"

```

Here are how configs for a Hatchling build look in the `pyproject.toml`:

```toml;
[build-system]
requires = ["hatchling", "cmake>=4.2", "ninja"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
only-include = ["main.py"]

[tool.hatch.build.targets.wheel.hooks.custom]
path = "hatch_build.py"

[tool.hatch.build.targets.sdist]
exclude = [
    "/build",
    "/Testing",
    "/dist",
    "/.venv",
]

[tool.hatch.build.targets.sdist.force-include]
"hatch_build.py" = "hatch_build.py"
```

And, that's all there is to it. Surprisingly simple, and this leaves all the authority of the actual environment used to your project config and locks. Here is what a build looks like with this config installed:

```powershell
PS C:\Users\wbowe\uvcpp> uv build
Building source distribution...
Building wheel from source distribution...
-- The CXX compiler identification is MSVC 19.41.34120.0
-- Detecting CXX compiler ABI info
-- Detecting CXX compiler ABI info - done
-- Check for working CXX compiler: C:/Program Files/Microsoft Visual Studio/2022/Community/VC/Tools/MSVC/14.41.34120/bin/Hostx64/x64/cl.exe - skipped
-- Detecting CXX compile features
-- Detecting CXX compile features - done
-- Configuring done (2.9s)
-- Generating done (0.0s)
-- Build files have been written to: C:/Users/wbowe/AppData/Local/uv/cache/sdists-v9/.tmptz3eQA/uvcpp-0.1.0/build/release
[1/4] Scanning C:\Users\wbowe\AppData\Local\uv\cache\sdists-v9\.tmptz3eQA\uvcpp-0.1.0\src\main.cpp for CXX dependencies
[2/4] Generating CXX dyndep file CMakeFiles\main.dir\CXX.dd
[3/4] Building CXX object CMakeFiles\main.dir\src\main.cpp.obj
[4/4] Linking CXX executable main.exe
Successfully built dist\uvcpp-0.1.0.tar.gz
Successfully built dist\uvcpp-0.1.0-py3-none-win_amd64.whl
PS C:\Users\wbowe\uvcpp> uv run --with uvcpp main.exe
Hello world!
```

Again, for a real project I would pick `scikit-build` over this...  but I hope you have at least found it interesting!