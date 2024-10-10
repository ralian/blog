# Serializing Python Objects in Git Blobs

I was looking into a solution for storing metadata in a git repo, and I read a [great post](https://graphite.dev/blog/git-key-value) on the topic by Graphite.

I am using libgit via pygit2, so for my case storing and reading the blob looks something like this:

```python
import pygit2 as git
repo = git.Repository('.git')

def load(ref):
	ref = repo.references.get(f"refs/folder/{ref}")
	return json.loads(ref.peel().data) if ref else dict()

def store(ref, obj):
    oid = repo.create_blob(bytes(json.dumps(obj), 'utf-8'))
	if ref: repo.references.delete(f"refs/folder/{ref}")
    repo.references.create(f"refs/folder/{ref}", oid)
```

Note that deleting the old ref leaves the old blob in the ODB. In order to actually delete the old blob, we have to garbage collect:

```
git gc --prune=now
```

After this, `git fsck` should show no dangling blobs.

I might cover more about building trees/packing these json objects in the future.
