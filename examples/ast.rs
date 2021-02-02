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
