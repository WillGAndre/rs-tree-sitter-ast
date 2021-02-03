#include <tree_sitter/parser.h>
#include <wctype.h>

enum TokenType
{
    STRING_CONTENT,
    RAW_STRING_LIT,
    FLOAT_LIT,
    BLK_COMMENT,
};

// Aux
static void advance(TSLexer *lexer) {
    lexer->advance(lexer, false);
}

static bool isFloatDigit(int32_t n) {
    return n == '_' || iswdigit(n);
}

void *tree_sitter_rust_external_scanner_create() { return NULL; }
void tree_sitter_rust_external_scanner_destroy(void *payload) {}
void tree_sitter_rust_external_scanner_reset(void *payload) {}
unsigned tree_sitter_rust_external_scanner_serialize(void *payload, char *buff) { return 0; }
void tree_sitter_rust_external_scanner_deserialize(void *payload, const char *buff, unsigned len) {}

bool tree_sitter_rust_external_scanner_scan(void *payload, TSLexer *lexer, const bool *valid_symbols) {
    // STRING CONTENT
    if (valid_symbols[STRING_CONTENT] && !valid_symbols[FLOAT_LIT]) {
        bool str_content = false;
        for (;;) {
            if (lexer->lookahead == '\"' || lexer->lookahead == '\\') {
                break;
            } else if (lexer->lookahead == 0) { return false; }
            advance(lexer);
            str_content = true;
        }
        lexer->result_symbol = STRING_CONTENT;
        return str_content;
    }

    while(iswspace(lexer->lookahead)) {lexer->advance(lexer, true);}
    
    // RAW_STRING_LIT
    if (valid_symbols[RAW_STRING_LIT] && (lexer->lookahead == 'r' || lexer->lookahead == 'b')){
        lexer->result_symbol = RAW_STRING_LIT;
        if (lexer->lookahead == 'b') { advance(lexer); }
        if (lexer->lookahead != 'r') { return false; }
        advance(lexer);

        unsigned open_hash_count = 0;
        while (lexer->lookahead == '#') {
            advance(lexer);
            open_hash_count++;
        }

        if (lexer->lookahead != '"') { return false; }
        advance(lexer);

        for (;;) {
            if (lexer->lookahead == 0) {
                return false;
            } else if (lexer->lookahead == '"') {
                advance(lexer);
                unsigned end_hash_count = 0;
                while (lexer->lookahead == '#' && end_hash_count < open_hash_count) {
                    advance(lexer);
                    end_hash_count++;
                }
                if (end_hash_count == open_hash_count) { return true; }
            } else { advance(lexer); }
        }
    }

    // FLOAT_LIT
    if (valid_symbols[FLOAT_LIT] && iswdigit(lexer->lookahead)) {
        lexer->result_symbol = FLOAT_LIT;

        advance(lexer);
        while (isFloatDigit(lexer->lookahead)) {
            advance(lexer);
        }

        bool has_fraction = false, has_exponent = false;

        if (lexer->lookahead == '.') {
            has_fraction = true;
            advance(lexer);
            if (iswalpha(lexer->lookahead))
            {
                // The dot is followed by a letter: 1.max(2) => not a float but an integer
                return false;
            }

            if (lexer->lookahead == '.')
            {
                return false;
            }
            while (isFloatDigit(lexer->lookahead))
            {
                advance(lexer);
            }
        }

        lexer->mark_end(lexer);

        if (lexer->lookahead == 'e' || lexer->lookahead == 'E') {
            has_exponent = true;
            advance(lexer);
            if (lexer->lookahead == '+' || lexer->lookahead == '-') {
                advance(lexer);
            }
            if (!isFloatDigit(lexer->lookahead)) {
                return true;
            }
            advance(lexer);
            while (isFloatDigit(lexer->lookahead)) {
                advance(lexer);
            }

            lexer->mark_end(lexer);
        }

        if (!has_exponent && !has_fraction)
            return false;

        if (lexer->lookahead != 'u' && lexer->lookahead != 'i' && lexer->lookahead != 'f') {
            return true;
        }
        advance(lexer);
        if (!iswdigit(lexer->lookahead)) {
            return true;
        }

        while (iswdigit(lexer->lookahead)) {
            advance(lexer);
        }

        lexer->mark_end(lexer);
        return true;
    }

    // BLK_COMMENT
    if (lexer->lookahead == '/') { advance(lexer); }
    if (lexer->lookahead != '*') { return false; }
    advance(lexer);
    bool end_blk = false;
    unsigned depth = 1;
    for (;;) {
        switch (lexer->lookahead) {
            case '\0':
                return false;
            case '*':
                advance(lexer);
                end_blk = true;
                break;
            case '/':
                if (end_blk) {
                    advance(lexer);
                    end_blk = false;
                    depth--;
                    if (depth == 0) { lexer->result_symbol = BLK_COMMENT; return true; }
                } else {
                    advance(lexer);
                    end_blk = false;
                    if (lexer->lookahead == '*') { advance(lexer); depth++; }
                }
                break;
            default:
                advance(lexer);
                end_blk = false;
                break;
        }
    }
    return false;
}

