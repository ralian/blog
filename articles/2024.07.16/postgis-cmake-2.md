# PostGIS Analysis: Part 2/X

In the first part of this analysis, we looked at the runtime dependencies of the PostGIS binaries on Windows. There's still a lot we didn't really cover; I didn't generate a suitable mapping from dll to translation units... but we can come back to this later.

For now, let's just throw together a hacky CMake target for just the postgis-3 library.

Just as an initial guess, let's try including all of the source files in `${PROJECT_SOURCE_DIR}/postgis/` in the target. This will probably get us some files we don't need for now, but that's OK. Once we get something built, we can compare the exports to the published binaries.

Here's how the target will look initially:

```cmake
# Required for Preset Schema v3: https://cmake.org/cmake/help/latest/manual/cmake-presets.7.html#schema
cmake_minimum_required (VERSION 3.21.0 FATAL_ERROR)

project(postgis
	VERSION 3.4.2
	DESCRIPTION "PostGIS Extensions for PostgreSQL"
	HOMEPAGE_URL "https://postgis.net/"	
	LANGUAGES C)

file(GLOB POSTGIS-3_SRC ${PROJECT_SOURCE_DIR}/postgis/*.c)
add_library(postgis-3 SHARED ${POSTGIS-3_SRC})
set_property(TARGET postgis-3 PROPERTY C_STANDARD 17)
```

Now, this is missing a ton of compile and linkage dependencies. I eliminated all the missing headers I could think of by using the include directories in the project, my Postgres dir, and by installing `proj` as a submodule from [github](https://github.com/OSGeo/PROJ.git). I have branch 6.3 checked out, as I think that is the required version?

Here is what the hacked together include directories look like for now:

```cmake
set(PGDIR "C:/Program Files/PostgreSQL/16")

target_include_directories(postgis-3 PRIVATE 
	${PROJECT_SOURCE_DIR}/postgis
	${PROJECT_SOURCE_DIR}/liblwgeom
	${PROJECT_SOURCE_DIR}/libpgcommon
	${PROJECT_SOURCE_DIR}/deps/flatgeobuf
	${PGDIR}/include
	${PGDIR}/include/server
	${PGDIR}/include/server/port/win32
	${PGDIR}/include/server/port/win32_msvc
	# Submodules
	${PROJECT_SOURCE_DIR}/proj/src
)
```

## Building geos_c

One of the dependencies we'll have to build ourselves is `geos`. We'll be using the C API - to do this, we create geos as a submodule in the folder `geos`, similar to what we did with `proj`. Once this is done, adding targets for geos is extremely simple:

```cmake
add_subdirectory(geos)
```

This will create two targets,`geos` and `geos_c`. This creates a header file we need as part of the build process - `geos_c.h` from `geos_c.h.in`. Annoyingly, this gets produced in our cmake build dir, so we'll have to do a bit more jank to get postgis to see it:

```cmake
target_include_directories(postgis-3 PRIVATE
	${PROJECT_BINARY_DIR}/geos/capi
	${PROJECT_SOURCE_DIR}/geos/include
)
```

This can go into our existing list of include dirs for postgis-3.

## Building postgis-3

Now, when we configure, generate, and build the `postgis-3` target with Visual Studio, we at least aren't missing a ton of header files. I am however getting an instance of the C2375 compiler error for each SQL-exposed declaration of a function with `PG_FUNCTION_INFO_V1()`... which is perplexing, because the [docs](https://learn.microsoft.com/en-us/cpp/error-messages/compiler-errors-1/compiler-error-c2375?view=msvc-170) say this should only happen with `/Za`, which disables the C language extensions. This should never happen when compiling with `C_STANDARD 17` set in CMake, and in fact, when I try enabling `/Za` manually in Visual Studio, it complains that `/Za` and `/Tc /std:17` are incompatible options.

From messing around with storage classes, it actually looks like C2375 is thrown by MSVC anyways if you throw a DLL export in the mix:

```C
extern void func( void );
static void func( void ); // OK if /Za not specified
extern __declspec(dllexport) void func( void ); // C2375 even with /Za
```

I don't know if this is intended by MSVC and just not documented well... but, for now I'm just removing all the forward declarations that are followed by a use of the SQL exposure macro. It's a pain but it's good enough for now.

If this is necessary eventually, we can just use the preprocessor - but I'm hoping it won't be necessary.

### Attributes

PostGIS has a bunch of GCC-style format [attributes](https://gcc.gnu.org/onlinedocs/gcc/Attribute-Syntax.html) like the following:

```C
void lwnotice(const char *fmt, ...) __attribute__ ((format (printf, 1, 2)));
```

We could throw these behind preprocessor logic - but, for now I'm just going to remove the attribute as well.

### M_PI

On GCC `M_PI` is defined [along with some other constants](https://www.gnu.org/software/libc/manual/html_node/Mathematical-Constants.html). On MSVC, we have to do [this](https://learn.microsoft.com/en-us/cpp/c-runtime-library/math-constants?view=msvc-170&redirectedfrom=MSDN):

```C
#define _USE_MATH_DEFINES
#include <math.h>
```

### Generated Header Files

I kind of glossed over this, but there are two header files that we would normally generate with perl scripts. We want to generate them natively using cmake. The first one, `postgis_revision.h` is easy:

```cmake
execute_process(COMMAND git describe --always WORKING_DIRECTORY ${CMAKE_SOURCE_DIR} OUTPUT_VARIABLE POSTGIS_REVISION)
configure_file(${PROJECT_SOURCE_DIR}/postgis_revision.h.in ${PROJECT_SOURCE_DIR}/postgis_revision.h)
```

The `postgis_config`.h has a lot more in it, but just generating the things we need is not too bad:

```cmake
set(POSTGIS_VERSION "\"${postgis_VERSION}\"")
set(POSTGIS_GEOS_VERSION 31200)
set(POSTGIS_PROJ_VERSION 60300)
set(POSTGIS_PGSQL_VERSION 160)
set(POSTGIS_LIBXML2_VERSION "\"2.11.5\"")
configure_file(${PROJECT_SOURCE_DIR}/postgis_config.h.in ${PROJECT_SOURCE_DIR}/postgis_config.h)
```

We're bypassing the entire make/perl build system here and a lot of this isn't great. I'm not going over the format of the `.in` files, you can find that yourself easily. Also, libxml2 ships with Postgres. I hardcoded the version above to the version we get.

## Linking postgis-3

Hurray, that was the last of the compiler errors in my case. I did have to fiddle around some with forward declarations and reordering some symbols... but that's all relatively minor. Let's start by adding some linking boilerplate to our CMake target:

```
target_link_directories(postgis-3 PRIVATE ${PGDIR}/lib)
target_link_libraries(postgis-3 postgres geos_c)
```

This cuts down on the number of linker errors, but we still have work to do. Next time we'll build liblwgeom and link it to postgis-3 as well.