const numeric_suffix = [
    'u8', 'u16', 'u32', 'u64', 'u128', 'usize',
    'i8', 'i16', 'i32', 'i64', 'i128', 'isize',
    'f32', 'f64'
];

const data_types = numeric_suffix.concat(['bool', 'str', 'char']);

module.exports = grammar({
    name: 'rust',

    // Array of tokens that may appear anywhere in the language
    extras: $ => [/\s/, $.line_comment, $.blk_comment],

    // github/tree-sitter/creating-parsers | External Scanners section
    externals: $ => [
        $._string_content,
        $.raw_string_lit,
        $.float_lit,
        $.blk_comment
    ],

    supertypes: $ => [
        $._expression,
        $._type,
        $._literal,
        $._literal_pattern,
        $._declaration_stm,
        $._pattern,
    ],

    // Rules that are removed from the grammar by replacing all of their usages with a copy of their def.
    inline: $ => [
        $._path,
        $._type_identifier,
        $._field_identifier,
        $._tokens_macro_invoc,
        $._token_content,
        $._declaration_stm,
        $._reserved_identifier,
        $._expression_block
    ],

    conflicts: $ => [
        [$._type, $._pattern],
        [$.unit_type, $.tuple_pattern],
        [$.scoped_identifier, $.scoped_type_identifier],
        [$.parameters, $._pattern],
        [$.parameters, $.tuple_struct_pattern],
        [$.type_parameters, $.for_lifetime],
    ],

    word: $ => $.identifier,

    rules: {
        source_file: $ => repeat($._stm),

        _stm: $ => choice(
            $._expression_stm,
            $._declaration_stm
        ),

        empty_stm: $ => ';',

        _expression_stm: $ => choice(
            seq($._expression, ';'),
            prec(1, $._expression_block)
        ),

        _declaration_stm: $ => choice(
            $.const_item,
            $.macro_invoc,
            $.macro_def,
            $.empty_stm,
            $.outer_attribute_item,
            $.inner_attribute_item,
            $.mod_item,
            $.foreign_mod_item,
            $.struct_item,
            $.union_item,
            $.enum_item,
            $.type_item,
            $.function_item,
            $.function_no_body_item,
            $.impl_item,
            $.trait_item,
            $.associated_type,
            $.let_declaration,
            $.use_declaration,
            $.extern_crate_declaration,
            $.static_item
        ),

        _expression: $ => choice(
            $._literal,
            $.return_expression,
            $.call_expression,
            $.type_cast_expression,
            $.range_expression,
            $.assignment_expression,
            $.compound_assignment_expression,
            $.binary_expression,
            $.question_mark_expression,
            $.reference_expression,
            $.unary_expression,
            prec.left($.identifier),
            prec.left($._reserved_identifier),
            alias(choice(...data_types), $.identifier),
            $.self,
            $.scoped_identifier,
            $.generic_function,
            $.tuple_expression,
            $.struct_expression,
            $.array_expression,
            $.field_expression,
            $.await_expression,
            prec(1, $.macro_invoc),
            $.unit_expression,
            $.break_expression,
            $.continue_expression,
            $.index_expression,
            $.metavariable,
            $.closure_expression,
            $.single_parenthesized_expression,
            $._expression_block
        ),

        _expression_block: $ => choice(
            $.if_expression,
            $.if_let_expression,
            $.for_expression,
            $.while_expression,
            $.while_let_expression,
            $.loop_expression,
            $.match_expression,
            $.block,
            $.const_block,
            $.unsafe_block,
            $.async_block
        ),

        macro_invoc: $ => seq(
            field('macro', choice(
                $.identifier,
                $.scoped_identifier     // scoped ident
            )),
            '!',
            $.token_tree
        ),

        scoped_identifier: $ => seq(
            field('path', optional(choice(
                $._path,
                $.bracket_type,
                alias($.generic_type_turbofish, $.generic_type)
            ))),
            '::',
            field('name', $.identifier)
        ),

        scoped_type_identifier_expression: $ => prec(-2, seq(
            field('path', optional(choice(
                $._path,
                alias($.generic_type_turbofish, $.generic_type)
            ))),
            '::',
            field('name', $._type_identifier)
        )),

        scoped_type_identifier: $ => seq(
            field('path', optional(choice(
                $._path,                                            // path
                alias($.generic_type_turbofish, $.generic_type),    // alias generic type with turbofish as generic type
                $.bracket_type,                                     // bracket type
                $.generic_type                                      // generic type
            ))),
            '::',
            field('name', $._type_identifier)
        ),

        macro_def: $ => {
            const rules = seq(
                repeat(seq($.macro_rule, ';')),
                optional($.macro_rule)
            )

            return seq('macro_rules!', 
                field('name', $.identifier),
                choice(
                    seq('(', rules, ')', ';'),
                    seq('{', rules, '}')
                )
            )
        },

        macro_rule: $ => seq(
            field('left', alias($.token_tree_mac_rul, $.token_tree)),
            '=>',
            field('right', $.token_tree)
        ),

        _tokens_macro_rule: $ => choice(
            alias($.token_tree_mac_rul, $.token_tree),       // token tree for _tokens_m_r
            alias($.token_rep_mac_rul, $.token_rep),        // token rep 
            $._token_content,                               // token content
            $.token_bind                                    // token bind
        ),

        token_tree_mac_rul: $ => choice(
            seq('(', repeat($._tokens_macro_rule), ')'),
            seq('[', repeat($._tokens_macro_rule), ']'),
            seq('{', repeat($._tokens_macro_rule), '}')
        ),

        token_rep_mac_rul: $ => seq(
            '$', 
            '(', 
            repeat($._tokens_macro_rule), 
            ')', 
            optional(/[^+*?]/), 
            choice('+', '*', '?')
        ),

        token_bind: $ => seq(
            field('name', $.metavariable),
            ':',
            field('type', $.fragment_specifier)
        ),

        fragment_specifier: $ => choice(
            'block', 'expr', 'ident', 'item', 'lifetime', 'path', 'stmt',
            'tt', 'ty', 'vis', 'literal', 'pat', 'meta'
        ),

        _tokens_macro_invoc: $ => choice(
            $.token_tree,       // tokens delimiters (),[],{}
            $.token_rep,        // tokens rep {$A: ty, $B: tx ...}
            $._token_content    // identifier / reserved words
        ),

        token_tree: $ => choice(
            seq('(', repeat($._tokens_macro_invoc), ')'),
            seq('[', repeat($._tokens_macro_invoc), ']'),
            seq('{', repeat($._tokens_macro_invoc), '}')
        ),

        token_rep: $ => seq(
            '$', 
            '(', 
            repeat($._tokens_macro_invoc), 
            ')', 
            optional(/[^+*?]/), 
            choice('+', '*', '?')
        ),

        _token_content: $ => choice(
            $._literal, $.identifier, $.metavariable, $.mutable_specifier,
            $.self, $.crate, $.super, /[/_\-=->,;:::!=?.@*=/=&=#%=^=+<>|~]+/,
            alias(choice(...data_types), $.primitive_type),
            '\'', 'as', 'async', 'await', 'break', 'const', 'continue', 'default', 'enum', 'fn', 'for',
            'if', 'impl', 'let', 'loop', 'match', 'mod', 'pub', 'return', 'static', 'struct', 'trait',
            'type', 'union', 'unsafe', 'use', 'where', 'while'
        ),

        outer_attribute_item: $ => seq(
            '#', '[', $.meta_item, ']'
        ),

        inner_attribute_item: $ => seq(
            '#', '!', '[', $.meta_item, ']'
        ),

        meta_item: $ => seq(
            $._path,
            optional(choice(
                seq('=', field('value', $._literal)),
                field('list', $.meta_seq)
            ))
        ),

        meta_seq: $ => seq(
            '(',
            optional(sepRepInstru(',', choice($.meta_item, $._literal))),
            optional(','),
            ')'
        ),

        mod_item: $ => seq(
            optional($.privacy_visibility),
            'mod',
            field('name', $.identifier),
            choice(
                ';',
                field('body', $.declaration_list)
            )
        ),

        foreign_mod_item: $ => seq(
            optional($.privacy_visibility),
            $.extern_modifier, // extern modifier
            choice(
                ';',
                field('body', $.declaration_list)
            )
        ),

        declaration_list: $ => seq(
            '{', repeat($._declaration_stm), '}'
        ),

        struct_item: $ => seq(
            optional($.privacy_visibility),
            'struct',
            field('name', $._type_identifier),
            field('type_parameters', optional($.type_parameters)),
            choice(
                seq(
                    optional($.where_clause),
                    field('body', $.struct_field)
                ),
                seq(
                    field('body', $.tuple_field),  //aka ordered_field_declaration_list
                    optional($.where_clause),
                    ';'
                ),
                ';'
            )
        ),

        union_item: $ => seq(
            optional($.privacy_visibility),
            'union',
            field('name', $._type_identifier),
            field('type_parameters', optional($.type_parameters)),
            optional($.where_clause),
            field('body', $.struct_field)
        ),

        enum_item: $ => seq(
            optional($.privacy_visibility),
            'enum',
            field('name', $._type_identifier),
            field('type_parameters', optional($.type_parameters)),
            optional($.where_clause),
            field('body', $.enum_body)
        ),

        enum_body: $ => seq(
            '{',
            optional(sepRepInstru(',', seq(repeat($.outer_attribute_item), $.enum_content))),
            optional(','),
            '}'
        ),

        enum_content: $ => seq(
            optional($.privacy_visibility),
            field('name', $.identifier),
            field('body', optional(choice(
                $.struct_field,
                $.tuple_field
            ))),
            optional(seq(
                '=', field('value', $._expression)
            ))
        ),

        struct_field: $ => seq(
            '{',
            optional(sepRepInstru(',', seq(
                repeat($.outer_attribute_item),
                optional($.privacy_visibility),
                field('name', $._field_identifier),
                ':',
                field('type', $._type)
            ))),
            optional(','),
            '}'
        ),

        tuple_field: $ => seq(
            '(',
            optional(sepRepInstru(',', seq(
                repeat($.outer_attribute_item),
                optional($.privacy_visibility),
                field('type', $._type)
            ))),
            optional(','),
            ')'
        ),

        extern_crate_declaration: $ => seq(
            optional($.privacy_visibility),
            'extern',
            $.crate,
            field('name', $.identifier),
            optional(seq('as', field('alias', $.identifier))),
            ';'
        ),

        const_item: $ => seq(
            optional($.privacy_visibility),
            'const',
            field('name', choice(
                '_',
                $.identifier
            )),
            ':',
            field('type', $._type),
            optional(seq(
                '=',
                field('value', $._expression)
            )),
            ';'
        ),

        static_item: $ => seq(
            optional($.privacy_visibility),
            'static',
            optional($.mutable_specifier),
            field('name', $.identifier),
            ':',
            field('type', $._type),
            optional(seq(
                '=',
                field('value', $._expression)
            )),
            ';'
        ),

        type_item: $ => seq(
            optional($.privacy_visibility),
            'type',
            field('name', $._type_identifier),
            field('type_parameters', optional($.type_parameters)),
            '=',
            field('type', $._type),
            ';'
        ),

        function_item: $ => seq(
            optional($.privacy_visibility),
            optional($.function_qualifiers),
            'fn',
            field('name', choice($.identifier, $.metavariable)),
            field('type_parameters', optional($.type_parameters)),
            field('parameters', $.parameters),
            optional(seq('->', field('return_type', $._type))),
            optional($.where_clause),
            field('body', $.block)
        ),

        function_no_body_item: $ => seq(
            optional($.privacy_visibility),
            optional($.function_qualifiers),
            'fn',
            field('name', choice($.identifier, $.metavariable)),
            field('type_parameters', optional($.type_parameters)),
            field('parameters', $.parameters),
            optional(seq('->', field('return_type', $._type))),
            optional($.where_clause),
            ';'
        ),

        function_qualifiers: $ => repeat1(choice(
            'async',
            'const',
            'unsafe',
            'default',
            $.extern_modifier
        )),

        where_clause: $ => seq(
            'where',
            sepRepInstru(',', $.where_predicate),
            optional(',')
        ),

        where_predicate: $ => seq(
            field('left', choice(
                $._type_identifier,
                $.lifetime,
                $.scoped_type_identifier,
                $.generic_type,
                $.reference_type,
                $.pointer_type,
                $.tuple_type,
                $.higher_ranked_trait_bound,
                alias(choice(...data_types), $.primitive_type)
            )),
            field('bounds', $.trait_bounds)
        ),

        impl_item: $ => seq(
            optional('unsafe'),
            'impl',
            field('type_parameters', optional($.type_parameters)),
            optional(seq(
                field('trait', choice(
                    $._type_identifier,
                    $.scoped_type_identifier,
                    $.generic_type
                )),
                'for',
            )),
            field('type', $._type),
            optional($.where_clause),
            field('body', $.declaration_list)
        ),

        trait_item: $ => seq(
            optional($.privacy_visibility),
            optional('unsafe'),
            'trait',
            field('name', $._type_identifier),
            field('type_parameters', optional($.type_parameters)),
            field('bounds', optional($.trait_bounds)),
            optional($.where_clause),
            field('body', $.declaration_list)
        ),

        associated_type: $ => seq(
            'type',
            field('name', $._type_identifier),
            field('trait', optional($.trait_bounds)),
            ';'
        ),

        trait_bounds: $ => seq(
            ':',
            sepRepInstru('+', choice(
                $._type,
                $.lifetime,
                $.higher_ranked_trait_bound,     // $.higher_ranked_trait_bound
                $.sized_trait_bound             // $.sized_trait_bound
            )),
        ),

        higher_ranked_trait_bound: $ => seq(
            'for',
            field('type_parameters', $.type_parameters),
            field('type', $._type)
        ),

        sized_trait_bound: $ => seq('?', $._type),

        type_parameters: $ => prec(1, seq(
            '<',
            sepRepInstru(',', choice(
                $.lifetime,
                $.metavariable,
                $.constrained_type_parameter,
                $.optional_type_parameter,
                $.const_parameter,
                $._type_identifier
            )),
            optional(','),
            '>'
        )),

        const_parameter: $ => seq(
            'const',
            field('name', $.identifier),
            ':',
            field('type', $._type)
        ),

        constrained_type_parameter: $ => seq(
            field('left', choice($.lifetime, $._type_identifier)),
            field('bounds', $.trait_bounds)
        ),

        optional_type_parameter: $ => seq(
            field('name', choice(
                $._type_identifier,
                $.constrained_type_parameter
            )),
            '=',
            field('parameter_type', $._type)
        ),

        let_declaration: $ => seq(
            optional($.privacy_visibility),
            'let',
            optional($.mutable_specifier),
            field('pattern', $._pattern),
            optional(seq(
                ':', field('type', $._type)
            )),
            optional(seq(
                '=', field('value', $._expression)
            )),
            ';'
        ),

        use_declaration: $ => seq(
            optional($.privacy_visibility),
            'use',
            field('useTree', $._use_tree),
            ';'
        ),

        _use_tree: $ => choice(
            $._path,            // SimplePath
            $.use_wildcard,     // (SimplePath? ::?) *
            $.scope_use_list,   // (SimplePath? ::)? { (UseTree ( , UseTree )* ,?)? }
            $.use_as,           // SimplePath(as(IDENTIFIER | _)) ?
            $.use_list          // { (UseTree ( , UseTree )* ,?)? }
        ),

        scope_use_list: $ => seq(
            field('path', optional($._path)),
            '::',
            field('list', $.use_list)
        ),

        use_list: $ => seq(
            '{',
            optional(sepRepInstru(',', $._use_tree)),
            optional(','),
            '}'
        ),

        use_as: $ => seq(field('path', $._path), 'as', field('alias', $.identifier)),

        use_wildcard: $ => seq(optional(seq($._path, '::')), '*'),

        parameters: $ => seq(
            '(',
            optional(sepRepInstru(',', seq(
                optional($.outer_attribute_item),
                choice(
                    $.parameter,
                    $.self_parameter,
                    $.variadic_parameter,
                    '_',
                    $._type
                )
            ))),
            optional(','),
            ')'
        ),

        variadic_parameter: $ => '...',

        self_parameter: $ => seq(
            optional('&'),
            optional($.lifetime),
            optional($.mutable_specifier),
            $.self
        ),

        parameter: $ => seq(
            optional($.mutable_specifier),
            field('pattern', choice(
                $._pattern,
                $.self,
                $._reserved_identifier
            )),
            ':',
            field('type', $._type)
        ),

        extern_modifier: $ => seq(
            'extern',
            optional($.string_lit)
        ),

        privacy_visibility: $ => prec.right(
            choice(
                $.crate,
                seq(
                    'pub',
                    optional(seq(
                        '(',
                        choice(
                            $.crate,
                            $.self,
                            $.super,
                            seq('in', $._path)
                        ),
                        ')'
                    ))
                )
            )
        ),

        _type: $ => choice(
            $.abstract_type,                // abstract type
            $.reference_type,       // reference type
            $.pointer_type,             // pointer type
            $.array_type,                    // array type
            $.function_type,                 // function type
            $.dynamic_type,                 // dynamic type
            $.bounded_type,                 // bounded type
            $.metavariable,
            $._type_identifier,
            $.never_type,
            $.tuple_type,
            $.unit_type,
            $.macro_invoc,
            $.generic_type,
            $.scoped_type_identifier,
            alias(choice(...data_types), $.primitive_type)
        ),

        bracket_type: $ => seq(
            '<',
            choice(
                $._type,
                $.qualified_type
            ),
            '>'
        ),

        qualified_type: $ => seq(
            field('type', $._type), 'as', field('alias', $._type)
        ),

        lifetime: $ => seq("'", $.identifier),

        array_type: $ => seq(
            '[',
            field('element', $._type),
            optional(seq(
                ';', field('size', $._expression)
            )),
            ']'
        ),

        for_lifetime: $ => seq(
            'for', '<',
            sepRepInstru(',', $.lifetime),
            optional(','),
            '>'
        ),

        function_type: $ => seq(
            optional($.for_lifetime),
            prec(14, seq(
                choice(
                    field('trait', choice(
                        $._type_identifier,
                        $.scoped_type_identifier
                    )),
                    seq(
                        optional($.function_qualifiers),
                        'fn'
                    )
                ),
                field('parameters', $.parameters)
            )),
            optional(seq('->', field('return_type', $._type)))
        ),

        tuple_type: $ => seq(
            '(',
            sepRepInstru(',', $._type),
            optional(','),
            ')'
        ),

        unit_type: $ => seq('(', ')'),

        generic_function: $ => prec(1, seq(
            field('function', choice(
                $.identifier,
                $.scoped_identifier,
                $.field_expression
            )),
            '::',
            field('type_arguments', $.type_args)
        )),

        generic_type: $ => prec(1, seq(
            field('type', choice(
                $._type_identifier,
                $.scoped_type_identifier
            )),
            field('type_arguments', $.type_args)
        )),

        generic_type_turbofish: $ => seq(
            field('type', choice(
                $._type_identifier,
                $.scoped_identifier
            )),
            '::',
            field('type_arguments', $.type_args)
        ),

        bounded_type: $ => prec.left(-1, choice(
            seq($.lifetime, '+', $._type),
            seq($._type, '+', $.lifetime),
            seq($._type, '+', $._type)
        )),

        type_args: $ => seq(
            token(prec(1, '<')),
            sepRepInstru(',', choice(
                $._type,
                $.lifetime,
                $._literal,
                $.bind_type,
                $.block         // block
            )),
            optional(','),
            '>'
        ),

        bind_type: $ => seq(
            field('name', $._type_identifier),
            '=',
            field('type', $._type)
        ),

        reference_type: $ => seq(
            '&',
            optional($.lifetime), optional($.mutable_specifier),
            field('type', $._type)
        ),

        pointer_type: $ => seq(
            '*',
            choice($.mutable_specifier, 'const'),
            field('type', $._type)
        ),

        never_type: $ => '!',

        abstract_type: $ => seq(
            'impl',
            field('trait', choice(
                $._type_identifier,
                $.scoped_type_identifier,
                $.function_type, //function type
                $.generic_type
            ))
        ),

        dynamic_type: $ => seq(
            'dyn',
            field('trait', choice(
                $._type_identifier,
                $.scoped_type_identifier,
                $.function_type, // function type
                $.generic_type
            ))
        ),

        mutable_specifier: $ => 'mut',

        range_expression: $ => prec.left(1, choice(
            seq($._expression, choice('..', '...', '..='), $._expression),
            seq($._expression, '..'),
            seq('..', $._expression),
            '..'
        )),

        unary_expression: $ => prec(11, seq(
            choice('-', '*', '!'),
            $._expression
        )),

        reference_expression: $ => prec(11, seq(
            '&',
            optional($.mutable_specifier),
            field('value', $._expression)
        )),

        question_mark_expression: $ => seq($._expression, '?'),

        binary_expression: $ => {
            const binary_expression_prec = [
                [9, choice('+', '-')], 
                [10, choice('*', '/', '%')], 
                [7, '&'], [5, '|'],
                [6, '^'], [8, choice('<<', '>>')], 
                [4, choice('==', '!=', '<', '>', '<=', '>=')],
                [3, '&&'], [2, '||'],
            ];


            return choice(...binary_expression_prec.map(([precedence, operator]) => prec.left(precedence, seq(
                field('left', $._expression),
                field('operator', operator),
                field('right', $._expression),
            ))));
        },

        compound_assignment_expression: $ => prec.left(0, seq(
            field('left', $._expression),
            field('operator', choice('+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=')),
            field('right', $._expression)
        )),

        assignment_expression: $ => prec.left(0, seq(
            field('left', $._expression),
            '=',
            field('right', $._expression)
        )),

        type_cast_expression: $ => seq(
            field('value', $._expression),
            'as',
            field('type', $._type)
        ),

        return_expression: $ => choice(
            prec.left(seq('return', $._expression)),
            prec(-1, 'return')
        ),

        call_expression: $ => prec(14, seq(
            field('function', $._expression),
            field('arguments', $.arguments)
        )),

        arguments: $ => seq(
            '(',
            optional(sepRepInstru(',', seq(repeat($.outer_attribute_item), $._expression))),
            optional(','),
            ')'
        ),

        array_expression: $ => seq(
            '[',
            repeat($.outer_attribute_item),
            choice(
                seq(
                    optional(sepRepInstru(',', $._expression)),
                    optional(',')
                ),
                seq(
                    $._expression,
                    ';',
                    field('length', $._expression)
                )
            ),
            ']'
        ),

        single_parenthesized_expression: $ => seq(
            '(',
            $._expression,
            ')'
        ),

        tuple_expression: $ => seq(
            '(',
            repeat($.outer_attribute_item),
            seq($._expression, ','),
            repeat(seq($._expression, ',')),
            optional($._expression),
            ')'
        ),

        unit_expression: $ => seq('(', ')'),

        struct_expression: $ => seq(
            field('name', choice(
                $._type_identifier,
                alias($.scoped_type_identifier_expression, $.scoped_type_identifier),
                $.generic_type_turbofish
            )),
            field('body', $.field_struct_list)
        ),

        field_struct_list: $ => seq(
            '{',
            optional(sepRepInstru(',', choice(
                $.shorthand_field,
                $.base_field,
                $.field_norm
            ))),
            optional(','),
            '}'
        ),

        field_norm: $ => seq(
            repeat($.outer_attribute_item),
            field('name', $._field_identifier),
            ':',
            field('value', $._expression)
        ),

        base_field: $ => seq(
            '..',
            $._expression
        ),

        shorthand_field: $ => seq(
            repeat($.inner_attribute_item),
            $.identifier
        ),

        if_expression: $ => seq(
            'if',
            field('condition', $._expression),
            field('then', $.block),
            optional(field('else', $.else_clause))
        ),

        if_let_expression: $ => seq(
            'if', 'let',
            field('pattern', $._pattern),
            '=',
            field('value', $._expression),
            field('then', $.block),
            optional(field('else', $.else_clause))
        ),

        else_clause: $ => seq(
            'else',
            choice(
                $.if_expression,
                $.if_let_expression,
                $.block
            )
        ),

        match_expression: $ => seq(
            'match',
            field('value', $._expression),
            field('body', $.match_block)
        ),

        match_block: $ => seq(
            '{',
            optional(seq(
                repeat($.match_arm),
                alias($.last_match_arm, $.match_arm)
            )),
            '}'
        ),

        match_arm: $ => seq(
            repeat($.outer_attribute_item),
            field('pattern', choice(
                $.macro_invoc,
                $.match_pattern
            )),
            '=>',
            choice(
                seq(field('value', $._expression), ','),
                field('value', prec(1, $._expression_block))
            )
        ),

        last_match_arm: $ => seq(
            repeat($.outer_attribute_item),
            field('pattern', $.match_pattern),
            '=>',
            field('value', $._expression),
            optional(',')
        ),

        match_pattern: $ => seq(
            $._pattern,
            optional(seq(
                'if',
                field('condition', $._expression)
            ))
        ),

        while_expression: $ => seq(
            optional(seq($.loop_label, ':')),
            'while',
            field('condition', $._expression),
            field('body', $.block)
        ),

        while_let_expression: $ => seq(
            optional(seq($.loop_label, ':')),
            'while', 'let',
            field('pattern', $._pattern),
            '=',
            field('value', $._expression),
            field('body', $.block)
        ),

        loop_expression: $ => seq(
            optional(seq($.loop_label, ':')),
            'loop',
            field('body', $.block)
        ),

        for_expression: $ => seq(
            optional(seq($.loop_label, ':')),
            'for',
            field('pattern', $._pattern),
            'in',
            field('value', $._expression),
            field('body', $.block)
        ),

        const_block: $ => seq('const', field('body', $.block)),

        closure_expression: $ => prec(-1, seq(
            optional('move'),
            field('parameters', $.closure_parameters),
            choice(
                field('body', $._expression),
                seq(
                    optional(seq('->', field('return_type', $._type))),
                    field('body', $.block)
                )
            )
        )),

        closure_parameters: $ => seq(
            '|',
            optional(sepRepInstru(',', choice(
                $._pattern,
                $.parameter
            ))),
            '|'
        ),

        loop_label: $ => seq('\'', $.identifier),

        break_expression: $ => prec.left(seq('break', optional($.loop_label), optional($._expression))),

        continue_expression: $ => prec.left(seq('continue', optional($.loop_label))),

        index_expression: $ => prec(14, seq(
            $._expression, '[', $._expression, ']'
        )),

        await_expression: $ => prec(13, seq(
            $._expression,
            '.',
            'await'
        )),

        field_expression: $ => prec(13, seq(
            field('value', $._expression),
            '.',
            field('field', choice(
                $._field_identifier,
                $.integer_lit
            ))
        )),

        unsafe_block: $ => seq('unsafe', $.block),

        async_block: $ => seq(
            'async',
            optional('move'),
            $.block
        ),

        block: $ => seq(
            '{',
            repeat($._stm),
            optional($._expression),
            '}'
        ),

        _pattern: $ => choice(
            $._literal_pattern,
            alias(choice(...data_types), $.identifier),
            $.identifier,
            $.scoped_identifier,
            $.tuple_pattern,
            $.tuple_struct_pattern,
            $.struct_pattern,
            $.ref_pattern,
            $.mut_pattern,
            $.range_pattern,
            $.reference_pattern,
            $.capture_pattern,
            $.or_pattern,
            $.rest_field_pattern,
            $.slice_pattern,
            $.const_block,  // const block *
            '_'
        ),

        tuple_pattern: $ => seq(
            '(', optional(sepRepInstru(',', $._pattern)), optional(','), ')'
        ),

        slice_pattern: $ => seq(
            '[', optional(sepRepInstru(',', $._pattern)), optional(','), ']'
        ),

        tuple_struct_pattern: $ => seq(
            field('type', choice(
                $.scoped_identifier,
                $.identifier
            )),
            '(', optional(sepRepInstru(',', $._pattern)), optional(','), ')'
        ),

        range_pattern: $ => seq(
            choice($._literal_pattern, $._path),
            choice('...', '..='),
            choice($._literal_pattern, $._path)
        ),

        reference_pattern: $ => seq(
            choice('&', '&&'),
            optional($.mutable_specifier),
            $._pattern
        ),

        capture_pattern: $ => seq(
            $.identifier, '@', $._pattern
        ),

        struct_pattern: $ => seq(
            field('type', choice(
                $.scoped_type_identifier,
                alias($.identifier, $.type_identifier)
            )),
            '{', 
            optional(sepRepInstru(',', choice($.field_pattern, $.rest_field_pattern))),     // rest_field_pattern -> StructPatternEtCetera
            optional(','),
            '}'
        ),

        field_pattern: $ => seq(
            optional('ref'),
            optional($.mutable_specifier),
            choice(
                field('name', $.identifier),
                seq(
                    field('name', $._field_identifier),
                    ':',
                    field('pattern', $._pattern)
                )
            )
        ),

        rest_field_pattern: $ => '..',

        ref_pattern: $ => seq('ref', $._pattern),

        mut_pattern: $ => prec(-1, seq($.mutable_specifier, $._pattern)),

        or_pattern: $ => prec.left(-2, seq($._pattern, '|', $._pattern)), 

        _literal_pattern: $ => choice(
            $.string_lit,
            $.raw_string_lit,
            $.char_lit,
            $.boolean_lit,
            $.integer_lit,
            $.float_lit,
            $.negative_lit
        ),
        
        _literal: $ => choice(
            $.string_lit,
            $.raw_string_lit,
            $.char_lit,
            $.boolean_lit,
            $.integer_lit,
            $.float_lit
        ),

        boolean_lit: $ => choice('true', 'false'),

        integer_lit: $ => token(seq(
            choice(
                /[0-9][0-9_]*/,
                /0x[0-9a-fA-F_]+/,
                /0o[0-7_]+/,
                /0b[01_]+/
            ),
            optional(choice(...numeric_suffix))
        )),

        negative_lit: $ => seq('-', choice($.integer_lit, $.float_lit,)),

        char_lit: $ => token(seq(
            optional('b'),
            '\'',
            optional(choice(
                seq('\\', choice(   // Character escape
                    /[^xu]/,
                    /x[0-9a-fA-F]{2}/,
                    /u[0-9a-fA-F]{4}/,
                    /u{[0-9a-fA-F]+}/
                )),
                /[^\\']/
            )),
            '\''
        )),

        string_lit: $ => seq(
            alias(/b?"/, '"'),
            repeat(choice(
                $._char_escape,
                $._string_content
            )),
            token.immediate('"')
        ),

        _char_escape: $ => token(
            seq('\\', 
                choice(
                    /[^xu]/,
                    /x[0-9a-fA-F]{2}/,
                    /u[0-9a-fA-F]{4}/,
                    /u{[0-9a-fA-F]+}/
                )
            )
        ),

        comment: $ => choice(
            $.line_comment,
            $.blk_comment
        ),

        line_comment: $ => token(seq(
            '//',
            /.*/
        )),

        _path: $ => choice(
            $.self,
            alias(choice(...data_types), $.identifier),
            $.metavariable,
            $.super,
            $.crate,
            $.identifier,
            $.scoped_identifier
        ),
        
        self: $ => 'self',
        crate: $ => 'crate',
        super: $ => 'super',

        metavariable: $ => /\$[a-zA-Z_]\w*/,
        identifier: $ => token(seq(/(r#)?[a-zA-Z_][a-zA-Z\d_]*/)),
        _type_identifier: $ => alias($.identifier, $.type_identifier),
        _reserved_identifier: $ => alias(choice('default', 'union'), $.identifier),
        _field_identifier: $ => alias($.identifier, $.field_identifier)
    }
});

// Seperation and Repetition
function sepRepInstru(sep, instruc) {
    return seq(instruc, repeat(seq(sep, instruc)))
}

