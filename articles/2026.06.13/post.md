# Hardening virtual inheritance in Python

There are two problems that Abstract Base Classes (ABC) solve for interfaces:
- Guaranteeing interface implementation
- [The Diamond Problem](https://en.wikipedia.org/wiki/Multiple_inheritance#The_diamond_problem)

ABCs force the user to implement all methods marked with `@abstractmethod`, if not all methods are implemented, i.e:

```python
from abc import ABC, abstractmethod

class DBContext(object):
    def __init__(self):
        print("Opening database connection...")
        print("DBContext.__init__()")

class Queryable(ABC):
    @abstractmethod
    def query(self, **kwargs) -> str:
        ...

    def __init__(self):
        print("Queryable.__init__()")


class SqliteDBContext(Queryable, DBContext):
    #def query(self, **kwargs) -> str: return ""
    
    def __init__(self, filename):
        super().__init__()
        print("SqliteDBContext.__init__()")

assert SqliteDBContext("database.db")
```

the instantiation in the assert will raise an error like so:

```
      5 
----> 6 assert SqliteDBContext("database.db")

TypeError: Can't instantiate abstract class SqliteDBContext without an implementation for abstract method 'query'
```

However, note that we skip executing `DBContext.__init__()` due to the Method Resolution Order (MRO) - perhaps you have several parent classes, and executing a function in all of them is important. This is a form of the diamond problem, which ABCs also solve by introducing Virtual Inheritance:

```python
@Queryable.register
class SqliteDBContext(DBContext):
    ...
```

Using Virtual Inheritance in essence solves the diamond problem by removing the diamond; the problem is that bypassing regular inheritance no longer guarantees interface implementation!

```python
@Queryable.register
class SqliteDBContext(DBContext):
    # def query(self, **kwargs) -> str: return ""

    def __init__(self, filename):
        super().__init__()
        print("SqliteDBContext.__init__()")

assert SqliteDBContext("database.db")
```

The assert above passes just fine, even though we want it to fail due to incomplete interface.

What if we were to perform our own validation on interface registration?

```python
from abc import ABC, ABCMeta, abstractmethod

class Queryable(ABC):
    @abstractmethod
    def query(self, **kwargs) -> str:
        ...

    # The trick! Registration Voodoo
    def register(subclass):
        assert any("query" in cls.__dict__ for cls in subclass.__mro__), \
            f"{subclass} does not fully implement {__class__}"
        return ABCMeta.register(__class__, subclass)

    def __init__(self):
        print("Queryable.__init__()")
```

This works for the above example... better yet, the assert will fail on module load time (versus regular inheritance which only raises on instantiation):

```python
@Queryable.register
class SqliteDBContext(DBContext):
    # def query(self, **kwargs) -> str: return ""

    def __init__(self, filename):
        super().__init__()
        print("SqliteDBContext.__init__()")
```

yields even without any usage:

```
Cell In[41], line 10, in Queryable.register(subclass)
      9     def register(subclass):
---> 10         assert any("query" in B.__dict__ for B in subclass.__mro__), \
     11             f"{subclass} does not fully implement {__class__}"
     12         return ABCMeta.register(__class__, subclass)

AssertionError: <class '__main__.SqliteDBContext'> does not fully implement <class '__main__.Queryable'>
```

Believe it or not, it's actually possible to provide a 'universal' virtual inheritance checker which scans the interface for abstract methods, and checks the existance of a method in the implementation with matching types:

```python
from abc import ABC, ABCMeta, abstractmethod
from inspect import get_annotations

def _has_fn(cls, name, types):
    print(cls, name, types)
    for B in cls.__mro__:
        for k,v in B.__dict__.items():
            if k == name and get_annotations(v) == types:
                return True
    return False

class Queryable(ABC):
    @abstractmethod
    def query(self, **kwargs) -> str:
        ...

    # Note: not handling inheritance / MRO for the interface type
    def register(subclass):
        for k,v in __class__.__dict__.items():
            if hasattr(v, "__isabstractmethod__"):
                interface = get_annotations(v)
                assert _has_fn(subclass, k, interface), \
                    f"{subclass} does not fully implement {__class__}"
        return ABCMeta.register(__class__, subclass)
```

This provides much stronger guarantees at module load time than ABCs do by default.