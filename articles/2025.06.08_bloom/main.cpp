#include <algorithm>
#include <cstdio>
#include <ranges>
#include <string>

constexpr size_t alphabet_size = 37;

// Counts for each two tuple and upward, numbered by the length of the sequence
char sequence_counts_2[alphabet_size][alphabet_size];                                   // 1,369 B
char sequence_counts_3[alphabet_size][alphabet_size][alphabet_size];                    // 50,653 B
char sequence_counts_4[alphabet_size][alphabet_size][alphabet_size][alphabet_size];     // 1,874,161 B -- see where this is going?

char ascii_to_ord(int ascii)
{
    if (ascii >= '0' && ascii <= '9') return (ascii - '0');
    if (ascii >= 'a' && ascii <= 'z') return (ascii - 'a' + 10);
    if (ascii >= 'A' && ascii <= 'Z') return (ascii - 'A' + 10); // admit uppercase
    if (ascii == ' ') return 36;
    return 255;
}

char ord_to_ascii(char ord)
{
    if (ord < 10) return ('0' + ord);
    if (ord < 36) return ('a' + ord - 10);
    if (ord == 36) return ' ';
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

    std::fill(*sequence_counts_2, *sequence_counts_2 + (alphabet_size * alphabet_size), 0);
    for (const auto& pair : input | std::views::slide(2))
        sequence_counts_2[ascii_to_ord(pair.front())][ascii_to_ord(pair.back())]++;

    //std::fill(sequence_counts_3, sequence_counts_3 + (alphabet_size * alphabet_size * alphabet_size), 0);
    //for (const auto& trie : input | std::views::slide(3))
    //    sequence_counts_3[trie[0]][trie[1]][trie[2]]++;

    /*for (char ch : input)
    {
        std::printf(" %c(%i) ", ord_to_ascii(ascii_to_ord(ch)), ascii_to_ord(ch));
    }*/

    while (true)
    {
        int ch = std::getchar();
        auto max_elem = std::ranges::max_element(sequence_counts_2[ch]);
        char next = (max_elem - sequence_counts_2[ch]);
        std::putchar(ord_to_ascii(next));
    }
}
