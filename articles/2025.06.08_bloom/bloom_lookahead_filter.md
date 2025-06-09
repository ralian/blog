# Bloom Look-Ahead Filter (BLAF)

Here, I will show how a bloom filter can be used for lookahead indexing and search.

## Some Definitions

- We will work with strings of an alphabet \\\(\Sigma\\\) consisting of the English Letters, Arabic Numerals, and a space character. \\\(\vert \Sigma \vert = 37\\\) .
- We will call a byte 8 bits (as it has been for quite a while!) and a word 8 bytes. A good number to keep in the back of your mind is that the amount of information required to represent one letter of our alphabet is \\\(\log_2 \vert \Sigma \vert \approx 5.209\ \text{bits} \approx 0.65\ \text{Bytes}\\\).

That's less than I thought I would have to explain before we can jump into some code. First, let's set up a classic n-gram index.

## N-Gram Count Matrix

The n-gram count matrix is simple but scales poorly (*very* poorly) as you increase N. To use a bit of python pseudocode, to get the count of appearances of the sequence \\\(e_0 e_1 \dots e_n\\\) from this N dimensional matrix, `count = mat[e0][e1]...[en]`. Of course, the memory requirement here is \\\(\vert  \Sigma \vert ^ N\\\) bytes - assuming we are using an unsigned 8 bit number for counts! But, the lookup is constant time (ignoring messy things like caches). Here's how count matrices of increasing size can be constructed:

```c++
constexpr size_t alphabet_size = 37;

// Edge counts for each two tuple and upward, numbered by the length of the sequence
char sequence_counts_2[alphabet_size][alphabet_size];                                   // 1,369 B
char sequence_counts_3[alphabet_size][alphabet_size][alphabet_size];                    // 50,653 B
char sequence_counts_4[alphabet_size][alphabet_size][alphabet_size][alphabet_size];     // 1,874,161 B -- see where this is going?
```

To store a 6-gram of byte-sized counts for our alphabet, it would already take 2.6 GB, and it will be incredibly sparse.

Filling this count matrix on a training set is quite straightforward. We just increment the count in each cell corresponding to the sequence indices, and we do it for each "window" of the sequence length using a slide view. Here's how to zero and fill just the `N=2` matrix:

```c++
std::string input = read_file("../../lorem_ipsum.txt");

std::fill(*sequence_counts_2, *sequence_counts_2 + sizeof(sequence_counts_2), 0);
for (const auto& pair : input | std::views::slide(2))
    ++sequence_counts_2[ascii_to_ord(pair[0])][ascii_to_ord(pair[1])];
```

One fun thing we can do with this is fill out a seed string by using the matrix to look up the most probable 'next character' given the last `N-1` . Given a training input of some Latin text (a fancy way of saying I loaded in Lorem Ipsum), here's what the following snippet outputs:

```c++
std::string seed(argc > 1 ? argv[1] : "lorem ");

while (seed.length() < 256)
{
    size_t len = seed.length();

    const auto& last_seq = sequence_counts_4
        [ascii_to_ord(seed[len-3])]
        [ascii_to_ord(seed[len-2])]
        [ascii_to_ord(seed[len-1])];

    auto max_elem = std::ranges::max_element(last_seq);
    char next = (max_elem-last_seq);
    
    seed += ord_to_ascii(next);
}

printf(seed.c_str());
```

Output: `lorem id esse cillum dolore et dolore et dolore et dolore et dolore et dolore et dolore et dolore et dolore et dolore et dolore et dolore et dolore et dolore et dolore et dolore et dolore et dolore et dolore et dolore et dolore et dolore et dolore et dolor`

Don't worry about `ord_to_ascii` or `ascii_to_ord` - they are just converting our 27-char encoding back and forth to readable ascii representation.

Note that because this is deterministic and has a very narrow memory, we quite easily fall into a cycle where the most used sequence of letters ends up repeating. You can play around with the input seed and get some interesting different cycles, but the best way to improve this is to make it non-deterministic. If you already have a random device and generator from the C++ STL set up, creating a discrete distribution isn't much more complex than picking the max element:

```c++
while (seed.length() < 256)
{
    size_t len = seed.length();

    const auto& last_seq = sequence_counts_4
        [ascii_to_ord(seed[len-3])]
        [ascii_to_ord(seed[len-2])]
        [ascii_to_ord(seed[len-1])];

    unsigned short weights[alphabet_size];
    size_t total_weight = 0;
    for (int i = 0; i < alphabet_size; i++)
    {
        weights[i] = last_seq[i];
        total_weight += weights[i];
    }

    char next;
    if (total_weight > 0)
    {
        std::discrete_distribution<unsigned short> dist(weights, weights+alphabet_size);
        next = dist(gen);
    }
    else 
        next = dist_default(gen);

    seed += ord_to_ascii(next);
}
```

We also fall back to a default distribution if there are no instances of the input sequence in the training data. This default distribution is in the [full source](articles/2025.06.08_bloom/main.cpp) of the program that you can try out on your own. If this sounds complex, just focus on what the distribution is doing: picking a character from the pool of possible next characters seen in the training data, weighted proportionally to how often the next letter appears. This will have a more interesting output than the cycles we saw before, and it will change each time:

Output: `lorem id est labore et dolor in voluptation ullamco laborum do eiusmodo consectetur  ex ea consectetur  exercitation ulla pariatur  exercitat nulla pariat cupidatate velit aliquip ex ea commodo consectetur  excepteur ad minim ipsum dolor incididunt in repr`

Output: `lorem ipsum dolor incididunt ut eniam  qui officia deserunt incididunt  sed dolore dolore eu fugiatur ad minim velit anim adipiscing elit aliqua  ut enim velit aliquis nostrud esse cillum do eiusmodo eiusmod tempor in reprehenderit in reprehenderit anim ad`

## N-Gram Edge List

As the size of N increases relative to \\\(\vert \Sigma \vert\\\) , it is better to create an edge list of sequences rather than the matrix. This is especially true if we consider our alphabet something like all the English words. We aren't doing that with ours, but regardless, implementing one for sequences of length 5 is quite easy:

```c++
std::map<const std::string, unsigned int> sequence_edge_list;

for (const auto& seq : input | std::views::slide(5))
{
    std::string seq_str{seq.data(), 5};
    for (char& ch : seq_str)
        ch = ord_to_ascii(ascii_to_ord(ch));

    unsigned short cur_count = sequence_edge_list.contains(seq_str) ? sequence_edge_list[seq_str] : 0;
    sequence_edge_list.insert_or_assign(seq_str, cur_count + 1);
}
```

You might be wondering the point of lines 6 and 7 - we are copying each 5-sequence in the input set to a string and transforming each char into then out of our encoding. This is just so we store keys as readable ascii, but we only store the transformed characters (i.e. `'D'` becomes `'d'` and `'.'` becomes `' '`)

## Using the Count Matrix as a Bloom Filter

If you're wondering where bloom filters play into this, the answer is that we've already implemented one. We just aren't using it as such. If we have a very large edge list, we can use our sequentially-longer count matrices as  counting bloom filters in front of the edge list.

```c++
// Returns the number of times the sequence of 5 characters appears in the training set
unsigned short count_5_sequence(std::string seq)
{
    if (seq.length() != 5)
        throw std::runtime_error("Need 5 chars to look up");

    if (sequence_counts_2[seq[0]][seq[1]] == 0)
        return 0;

    if (sequence_counts_3[seq[0]][seq[1]][seq[2]] == 0)
        return 0;

    if (sequence_counts_4[seq[0]][seq[1]][seq[2]][seq[3]] == 0)
        return 0;
    
    return sequence_edge_list.contains(seq) ? sequence_edge_list[seq] : 0
}
```

Admittedly, you probably won't see any speedup with this until the size of the edge list becomes very large - but once it does, you will likely see a dramatic speedup as the bloom filter lookup is effectively constant time. I might do some performance tests at a later date and revisit this topic, but for now -

peace out.
