# Graph Editors Don't Have to Suck

Graph editors (Node editors? Blueprint editors? They go by a lot of names.) - I will grant, are an interesting idea. They are a common sight in game engines, configuration tools for audio, and sometimes - they even try to masquerade as programming languages (Looking at you, LabVIEW). I guess the theory is that they're more "user friendly" and easy to visually parse - although, if I'm being honest, I'm not sure how much I agree with that line of reasoning.

I've given it a bit of thinking lately and I've realized they _do_ at least have one advantage over traditional config editors: they absolutely use horizontal screen space more effectively.

I'm still not sure it outweighs the cons for me, though: let me break down what I see as the disadvantages. As a reward for for reading my manic rants against node editing tools, I promise I have an interesting idea afterwards...

Cons:
- Graph editors usually require mouse input, which can feel nice but I would argue is slower than the keyboard for powerusers.
- The _biggest_ issue I have: Graphical changes (moving nodes around) is coupled with the config changes. This means, in many graph editors, just loading the file and clicking on something is enough to change the file on disk. These changes have a way of making their way into VCS commits when inexperienced users add them without knowing any better - and it pollutes your commits, branches, and pull requests.
- This coupling also means that the underlying file contains a bunch of functionally-unnecessary data about the node layout - leading to much larger file sizes and more expensive parsing.

Pros:
- Graph editors use horizontal space more effectively - config editors often just use a fraction of your screen, and configs are often in the hundreds of lines.
- Node editors do allow you to group items more effectively than traditional config editors. While most config editors do have features like code folding, you can think of hiding a group of nodes as code folding on more dimensions than on config scope.

## Fixing Graph Editors

If I presented my thoughts effectively, you might be thinking the same thing I did to fix the major con:

Separate the config file from the layout one!

To be totally honest, this might be how some node editors on the market already work. I don't know how they all function. All the ones I've worked with, however, _don't_ do that.

Also, my initial idea was to throw ImGui at the problem and serialize the two sets of data into separate JSON files. But, I almost forgot - ImGui already has functionality for serializing layouts into ini files! This means, if I build a JSON node editor in ImGui, we should get the layout part for free. I might have to mess with the internals some to force it to load the layout file corresponding to our JSON graph file, but the bones are already there.

## Extending on the Idea

Thinking on the idea even further, I realized that if you are careful about the schema, you could make a node editor which is capable of loading and editing any JSON file. (JSON which isn't tailored to the graph schema will usually appear as a set of disconnected nodes).

I'll also leverage JSON schemas for this, and use some of the usual hacks for it. E.g. `$comment` keys will be used to add comments to a json block, and I'll use the JSON pointer schema to reference nodes within a document.

Hope I can develop this idea further. I'm just starting to mess with it in [this](https://github.com/ralian/jsongraph) repo.