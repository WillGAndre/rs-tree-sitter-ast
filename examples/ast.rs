pub use self::TyParamBound::*;
pub use self::UnsafeSource::*;
pub use self::PathParameters::*;
pub use symbol::{Ident, Symbol as Name};
pub use util::ThinVec;
pub use util::parser::ExprPrecedence;

use syntax_pos::{Span, DUMMY_SP};
use codemap::{respan, Spanned};
use abi::Abi;
use ext::hygiene::{Mark, SyntaxContext};
use print::pprust;
use ptr::P;
use rustc_data_structures::indexed_vec;
use symbol::{Symbol, keywords};
use tokenstream::{ThinTokenStream, TokenStream};

use serialize::{self, Encoder, Decoder};
use std::collections::HashSet;
use std::fmt;
use std::rc::Rc;
use std::u32;

#[derive(Clone, PartialEq, Eq, RustcEncodable, RustcDecodable, Hash, Copy)]
pub struct Lifetime {
    pub id: NodeId,
    pub span: Span,
    pub ident: Ident,
}

impl fmt::Debug for Lifetime {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "lifetime({}: {})", self.id, pprust::lifetime_to_string(self))
    }
}

/// A lifetime definition, e.g. `'a: 'b+'c+'d`
#[derive(Clone, PartialEq, Eq, RustcEncodable, RustcDecodable, Hash, Debug)]
pub struct LifetimeDef {
    pub attrs: ThinVec<Attribute>,
    pub lifetime: Lifetime,
    pub bounds: Vec<Lifetime>
}

/// A "Path" is essentially Rust's notion of a name.
///
/// It's represented as a sequence of identifiers,
/// along with a bunch of supporting information.
///
/// E.g. `std::cmp::PartialEq`
#[derive(Clone, PartialEq, Eq, RustcEncodable, RustcDecodable, Hash)]
pub struct Path {
    pub span: Span,
    /// The segments in the path: the things separated by `::`.
    /// Global paths begin with `keywords::CrateRoot`.
    pub segments: Vec<PathSegment>,
}

impl<'a> PartialEq<&'a str> for Path {
    fn eq(&self, string: &&'a str) -> bool {
        self.segments.len() == 1 && self.segments[0].identifier.name == *string
    }
}

impl fmt::Debug for Path {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "path({})", pprust::path_to_string(self))
    }
}

impl fmt::Display for Path {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{}", pprust::path_to_string(self))
    }
}

impl Path {
    // convert a span and an identifier to the corresponding
    // 1-segment path
    pub fn from_ident(s: Span, identifier: Ident) -> Path {
        Path {
            span: s,
            segments: vec![PathSegment::from_ident(identifier, s)],
        }
    }

    // Add starting "crate root" segment to all paths except those that
    // already have it or start with `self`, `super`, `Self` or `$crate`.
    pub fn default_to_global(mut self) -> Path {
        if !self.is_global() {
            let ident = self.segments[0].identifier;
            if !::parse::token::Ident(ident).is_path_segment_keyword() ||
               ident.name == keywords::Crate.name() {
                self.segments.insert(0, PathSegment::crate_root(self.span));
            }
        }
        self
    }

    pub fn is_global(&self) -> bool {
        !self.segments.is_empty() && self.segments[0].identifier.name == keywords::CrateRoot.name()
    }
}

/// A segment of a path: an identifier, an optional lifetime, and a set of types.
///
/// E.g. `std`, `String` or `Box<T>`
#[derive(Clone, PartialEq, Eq, RustcEncodable, RustcDecodable, Hash, Debug)]
pub struct PathSegment {
    /// The identifier portion of this path segment.
    pub identifier: Ident,
    /// Span of the segment identifier.
    pub span: Span,

    /// Type/lifetime parameters attached to this path. They come in
    /// two flavors: `Path<A,B,C>` and `Path(A,B) -> C`.
    /// `None` means that no parameter list is supplied (`Path`),
    /// `Some` means that parameter list is supplied (`Path<X, Y>`)
    /// but it can be empty (`Path<>`).
    /// `P` is used as a size optimization for the common case with no parameters.
    pub parameters: Option<P<PathParameters>>,
}

impl PathSegment {
    pub fn from_ident(ident: Ident, span: Span) -> Self {
        PathSegment { identifier: ident, span: span, parameters: None }
    }
    pub fn crate_root(span: Span) -> Self {
        PathSegment {
            identifier: Ident { ctxt: span.ctxt(), ..keywords::CrateRoot.ident() },
            span,
            parameters: None,
        }
    }
}

/// Parameters of a path segment.
///
/// E.g. `<A, B>` as in `Foo<A, B>` or `(A, B)` as in `Foo(A, B)`
#[derive(Clone, PartialEq, Eq, RustcEncodable, RustcDecodable, Hash, Debug)]
pub enum PathParameters {
    /// The `<'a, A,B,C>` in `foo::bar::baz::<'a, A,B,C>`
    AngleBracketed(AngleBracketedParameterData),
    /// The `(A,B)` and `C` in `Foo(A,B) -> C`
    Parenthesized(ParenthesizedParameterData),
}

impl PathParameters {
    pub fn span(&self) -> Span {
        match *self {
            AngleBracketed(ref data) => data.span,
            Parenthesized(ref data) => data.span,
        }
    }
}

/// A path like `Foo<'a, T>`
#[derive(Clone, PartialEq, Eq, RustcEncodable, RustcDecodable, Hash, Debug, Default)]
pub struct AngleBracketedParameterData {
    /// Overall span
    pub span: Span,
    /// The lifetime parameters for this path segment.
    pub lifetimes: Vec<Lifetime>,
    /// The type parameters for this path segment, if present.
    pub types: Vec<P<Ty>>,
    /// Bindings (equality constraints) on associated types, if present.
    ///
    /// E.g., `Foo<A=Bar>`.
    pub bindings: Vec<TypeBinding>,
}

impl Into<Option<P<PathParameters>>> for AngleBracketedParameterData {
    fn into(self) -> Option<P<PathParameters>> {
        Some(P(PathParameters::AngleBracketed(self)))
    }
}

impl Into<Option<P<PathParameters>>> for ParenthesizedParameterData {
    fn into(self) -> Option<P<PathParameters>> {
        Some(P(PathParameters::Parenthesized(self)))
    }
}