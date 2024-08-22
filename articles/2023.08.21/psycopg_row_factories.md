# Cleaner Queries in Python with psycopg Row Factories

If you find yourself frequently querying any sort of database with psycopg, you are probably used to doing some muddy iteration through the result of a `cursor.fetchall()` (or whichever fetch method you are using.) You'll probably end up with something that, while isn't disastrously bad code, is the sort of thing that drives people to write wrapper classes that hide the internals of how the query is structured and parsed. There is a better way than sweeping everything under the rug, however: [Row factories](https://www.psycopg.org/psycopg3/docs/api/rows.html).

In this article, we'll set up an example of such a schema / query script, and talk about how to use a class row factory to make our code cleaner.

## Counting Ducks

Let's create a schema to keep track of ducks at our local pond.

```sql
drop table if exists ducks;

create table ducks
(
     id uuid primary key default gen_random_uuid(), 
     name varchar(20), 
     times_seen int,
	 last_seen timestamp,
	 weight float
);
 
insert into ducks
(name, times_seen, last_seen, weight)
values
('Alice', 5, now(), 2.5),
('Bob', 7, '2022-04-30'::timestamp, 3.14),
('Charlie', 1, '2022-01-01'::timestamp, 1.8),
('Donald', 3, '2019-06-15'::timestamp, 42); -- Donald needs a diet.
```

Now, we want to access this data from our python environment. Here is a simple script to dump all of this data into python so we can work with it:

```python
# This is an example of what _not_ to do. We will improve on this shortly.

import psycopg as pg

connection = pg.connect(user="postgres", password="postgres", host="localhost")
cursor = connection.cursor()

cursor.execute("select * from ducks")

rows = cursor.fetchall()

for duck in rows:
    print(f"{duck[1]} was last seen at the pond on {duck[3]}")
```

This works, but what could be improved about this? Well, a few things:

1. We never close our connection to the DB. Of course, it will get closed when the application terminates, but this still isn't ideal.
2. There is no error handling (which might be fine if we want all errors to be fatal).
3. We pay no attention to batch processing. Fine for 4 entries, but what about 1,000,000?
4. Most importantly: Each row is returned as a list. Can you figure out what `duck[1]` and `duck[3]` represent? Maybe from context in this case, but it's not super clear. Here's an experiment: Take the same python script, but rebuild the database with the entries in a different order. Does the python script still work as intended?

Let's back up a bit and talk about ways we can clean this up.

### Context Management

The simplest thing we can do to attack issues #1 (and #2 to some degree) are to use context management. You have in all likelihood seen this before for opening file streams in python: `with open("foo.txt", "w") as bar`. This opens the foo.txt file in a new block, and automatically closes the file when the block is closed (and if an exception is raised within the block). You can use this same tool with psycopg connections and cursors:

```python
with psycopg.connect(user="postgres", password="postgres", host="localhost") as conn:
    with conn.cursor(name='fetch_cursor', row_factory=psycopg.rows.namedtuple_row) as cur:
```

Here we also added two arguments to the call to `cursor()`: `name` and `row_factory`. Let's talk about what they do:

- `name` is straightforward but more important than you think - it simply sets the name of the cursor. **Setting a name is important because if you do not set the name of a cursor, it will always be a client side cursor.** We'll talk about what this means a bit later in this example.
- `row_factory` - well, that's what we came here to talk about. Row factory sets how each row we receive is handled. `row_factory=psycopg.rows.tuple_row` is the default, and it results in the behavior we saw before: We receive each row as a tuple, and have to figure out how all the data we requested is ordered in that tuple. As you can see, we changed the row factory to `namedtuple_row`.

### Row Factories

Changing our cursor's Row Factory to something other than the default tuple provides an elegant solution to issue #4. In this case, `cur` will now provide a named tuple when we iterate through `rows`, and we can rewrite the print statement on the final line of our query:

```python
 print(f"{duck.name} was last seen at the pond on {duck.last_seen}")
```

This is immediately more readable than it was before, and will be more robust than making assumptions about the column structure of the tuple.

If some of the column names are complex and incompatible with python member syntax, there is also `psycopg.rows.dict_row`, which creates each row as a dictionary. There are plenty of other factory types which you can read about in the documentation of psycopg. We will cover `psycopg.rows.class_row(cls)` but not until the end of this article.

### Server Cursors and Completing the Query

We're almost done with our query, but we haven't solved issue #3 yet. For this example it's kind of a non-issue: we are just dumping the data, so we may as well receive it all at once. However, one can imagine some sort of `DuckStreamProcessor` that would prefer to receive data in batches.

Fortunately, psycopg has us covered. It turns out that once we execute the query, the cursor itself is iterable. For a server side cursor (which again, needs a name to function correctly), iterating over the cursor will produce one row for each implicit call to `next()`, but these calls will be bursted immediately after receiving a batch of rows. The batch size can be set by `cursor.itersize` but has a reasonable default value for most purposes.

Let's put everything together and use a server side cursor to fetch batches of two queries at a time:

```python
import psycopg

with psycopg.connect(user="postgres", password="postgres", host="localhost") as conn:
    with conn.cursor(name='fetch_cursor', row_factory=psycopg.rows.namedtuple_row) as cur:
        cur.itersize = 2
        cur.execute("select * from ducks")
        for duck in cur:
            print(f"{duck.name} was last seen at the pond on {duck.last_seen}")
```

For an actual example, especially querying a remote server, you probably want `itersize` to be something between 100 and 1000 depending on the query complexity and size of the data. This is more performant than using a client side cursor and calling `cur.fetchmany()` since that still pulls all results before iterating.

### Side Note: Tracking Query Progress of a Server Side Cursor

If you were using something like `tqdm` to track progress while iterating over a list previously, you can still get the same behavior! For `tqdm`, you just have to tell it what the total number of iterations will be since it cannot intuit that on its own. Just use the already open cursor to get this info first:

```python
numresults = cur.execute("select count(*) from ducks").fetchone().count
cur.execute("select * from ducks")
for duck in tqdm(cur, total=numresults):
	do_something_with(duck)
```

Now you will have a nice progress bar!

### Class Row Factory

Let's say we're developing some kind of duck watching client and we need to parse this information into a specialty class designed for holding this information. We could construct a class like so:

```python
class Duck:
    def __init__(self, id: uuid, name: str, times_seen: int, last_seen: datetime, weight: float):
        self.__dict__ = locals()
        return self

    def observe(self):
        self.last_seen = datetime.now()
        self.times_seen += 1
        self.update()
        return self

    def weigh(self, weight_kg):
        self.weight = weight_kg
        self.update()
        return self

    def update(self):
        with pg.connect(user="postgres", password="postgres", host="localhost") as conn:
            with conn.cursor() as cur:
                cur.execute(f"update ducks set times_seen = {self.times_seen}, last_seen = '{self.last_seen}', weight = '{self.weight}' where id='{self.id}'")
            conn.commit()
        return self
    pass
```

If you wanted to get even more hacky with the constructor, you could accept key word arguments like so:
```python
def __init__(self, **columns):
    self.__dict__ = columns
    return self
```

If we wanted to dump the database into a list of these classes, we could iterate over each row as a named tuple like before, and call the constructor of `Duck` with each member. However, it turns out, if we're careful and match the row names to arguments in the class constructor as we have here, we can use it as a "Class Row." If we designate this class to the cursor, it will automatically create `Duck`s for us:

```python
ducks = []

with pg.connect(user="postgres", password="postgres", host="localhost") as conn:
    with conn.cursor(name='fetch_cursor', row_factory=class_row(Duck)) as cur:
        cur.execute("select * from ducks")
        for duck in cur:
            ducks.append(duck)
```

Now, `ducks` is just a list of all the ducks that we could iterate over and do useful things with:

```python
for duck in ducks:
	duck.observe()
```

If you do this, you'll see the data for each duck update in the database when you call the local object's function!

### Conclusion

Hopefully this helps you write cleaner queries with psycopg! It's much easier to write complex and even recursive queries in python, even if a well written complicated join or recursive CTE will probably be faster.