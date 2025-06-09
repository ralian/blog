#include <algorithm>
#include <cstdio>
#include <exception>
#include <map>
#include <random>
#include <ranges>
#include <string>

std::string alphabet{"0123456789abcdefghijklmnopqrstuvwxyz "};
constexpr size_t alphabet_size = 37;

// Edge counts for each two tuple and upward, numbered by the length of the sequence
char sequence_counts_2[alphabet_size][alphabet_size];                                   // 1,369 B
char sequence_counts_3[alphabet_size][alphabet_size][alphabet_size];                    // 50,653 B
char sequence_counts_4[alphabet_size][alphabet_size][alphabet_size][alphabet_size];     // 1,874,161 B -- see where this is going?

std::map<const std::string, unsigned int> sequence_edge_list;

std::random_device rd;
std::mt19937 gen(rd());

// Not using Zipf's law for now
unsigned short default_weights[] = {
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // No numbers
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 26 letters
    1 // Punctuation
};
std::discrete_distribution<unsigned short> dist_default(default_weights, default_weights+alphabet_size);

char ascii_to_ord(int ascii)
{
    if (ascii >= '0' && ascii <= '9') return (ascii - '0');
    if (ascii >= 'a' && ascii <= 'z') return (ascii - 'a' + 10);
    if (ascii >= 'A' && ascii <= 'Z') return (ascii - 'A' + 10); // admit uppercase
    if (ascii == ' ' || ascii == ',' || ascii == '.') return 36; // treat all punctuation the same as space for now
    return 255;
}

char ord_to_ascii(char ord)
{
    if (ord <= 36)
        return alphabet.c_str()[ord];
    return '?';
}

auto read_file(const char* path) -> std::string {
    std::string out;

    FILE* fp = std::fopen(path, "rb");

    int c; // Note: int, not char, required to handle EOF
    while ((c = std::fgetc(fp)) != EOF) // Standard C I/O file reading loop
        out += char(c);

    if (std::ferror(fp))
        std::puts("I/O error when reading");
    else if (std::feof(fp))
        std::puts("End of file reached successfully");
    
    std::fclose(fp);
    return out;
}

int main(int argc, char** argv)
{
    std::string input = read_file("../../lorem_ipsum.txt");

    std::fill(*sequence_counts_2, *sequence_counts_2 + sizeof(sequence_counts_2), 0);
    for (const auto& pair : input | std::views::slide(2))
        ++sequence_counts_2
            [ascii_to_ord(pair.front())]
            [ascii_to_ord(pair.back())];

    std::fill(**sequence_counts_3, **sequence_counts_3 + sizeof(sequence_counts_3), 0);
    for (const auto& trie : input | std::views::slide(3))
        ++sequence_counts_3
            [ascii_to_ord(trie[0])]
            [ascii_to_ord(trie[1])]
            [ascii_to_ord(trie[2])];

    std::fill(***sequence_counts_4, ***sequence_counts_4 + sizeof(sequence_counts_4), 0);
    for (const auto& seq : input | std::views::slide(4))
        ++sequence_counts_4
            [ascii_to_ord(seq[0])]
            [ascii_to_ord(seq[1])]
            [ascii_to_ord(seq[2])]
            [ascii_to_ord(seq[3])];

    for (const auto& seq : input | std::views::slide(5))
    {
        std::string seq_str{seq.data(), 5};
        for (char& ch : seq_str)
            ch = ord_to_ascii(ascii_to_ord(ch));

        unsigned short cur_count = sequence_edge_list.contains(seq_str) ? sequence_edge_list[seq_str] : 0;
        sequence_edge_list.insert_or_assign(seq_str, cur_count + 1);
    }

    std::string seed(argc > 1 ? argv[1] : "lorem ");

    while (seed.length() < 256)
    {
        size_t len = seed.length();
        
        const auto& last_seq = sequence_counts_4
            [ascii_to_ord(seed[len-3])]
            [ascii_to_ord(seed[len-2])]
            [ascii_to_ord(seed[len-1])];

        //auto max_elem = std::ranges::max_element(last_seq);
        //char next = (max_elem-last_seq);

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

    printf(seed.c_str());
}

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
