pub use fluent::FluentValue;
use fluent::{concurrent::FluentBundle, FluentArgs, FluentError, FluentResource};
use fluent_syntax::parser::ParserError;
use std::os::unix::prelude::OsStrExt;
use std::{collections::HashMap, fs::read_dir, path::Path, sync::OnceLock};
use std::collections::HashSet;
use tokio::task_local;
use unic_langid::subtags::Language;
use unic_langid::{LanguageIdentifier, LanguageIdentifierError};

pub struct LocalesLoader {
    locales: HashMap<Language, FluentBundle<FluentResource>>,
    identifiers: HashSet<LanguageIdentifier>,
}

#[derive(thiserror::Error, Debug)]
pub enum LoadFtlError {
    #[error("I/O Error while reading ftl files: {0}")]
    Io(#[from] std::io::Error),
    #[error("Encountered directory whose name is not a language identifier: {0}")]
    LanguageIdentifier(#[from] LanguageIdentifierError),
    #[error("Error(s) parsing fluent resource file: {0:?}")]
    FluentParsing(Vec<ParserError>),
    #[error("Fluent Resource Conflict(s): {0:?}")]
    FluentConflict(Vec<FluentError>),
}

impl LocalesLoader {
    pub fn load<P: AsRef<Path>>(resource_dirs: Vec<P>) -> Result<Self, LoadFtlError> {
        let mut locales = HashMap::new();
        let mut identifiers = HashSet::new();

        for path in resource_dirs {
            for dir_entry in read_dir(path)? {
                let dir_entry = dir_entry?;

                if !dir_entry.path().is_dir() {
                    log::warn!("Expected layout for localization directories is [...]/static/{{lang1,lang2,lang3}}/*.ftl. Unexpectedly found non-directory {:?}, ignoring", dir_entry.path());
                    continue;
                }

                let lang_id = LanguageIdentifier::from_bytes(dir_entry.file_name().as_bytes())?;

                let bundle = locales
                    .entry(lang_id.language)
                    .or_insert_with(|| FluentBundle::new_concurrent(vec![lang_id.clone()]));

                for resource in read_dir(dir_entry.path())? {
                    let resource = resource?;

                    if !resource.path().is_file() {
                        log::warn!("Expected layout for localization directories is [...]/static/{{lang1,lang2,lang3}}/*.ftl. Unexpectedly found non-file {:?}, ignoring", resource.path());
                        continue;
                    }

                    let source = FluentResource::try_new(std::fs::read_to_string(&resource.path())?)
                        .map_err(|(_, errors)| LoadFtlError::FluentParsing(errors))?;

                    bundle.add_resource(source).map_err(|errors| LoadFtlError::FluentConflict(errors))?
                }

                identifiers.insert(lang_id);
            }
        }

        Ok(LocalesLoader { locales, identifiers })
    }

    /// Set the `LOCALES` [`OnceLock`] to use this set of loaded locales
    pub fn commit(mut self) -> HashSet<LanguageIdentifier> {
        let identifiers = std::mem::take(&mut self.identifiers);
        LOCALES.set(self).unwrap_or_else(|_| panic!("LOCALES OnceLock already initialized"));
        identifiers
    }

    pub fn get() -> &'static LocalesLoader {
        LOCALES
            .get()
            .expect("Locales were not properly initialized. Please ensure that the locales have been loaded correctly!")
    }

    pub fn get_bundle(&self, lang: &Language) -> Option<&FluentBundle<FluentResource>> {
        self.locales.get(lang)
    }

    pub fn lookup<'a>(&self, lang: &Language, text_id: &str, args: Option<&HashMap<&str, FluentValue<'a>>>) -> String {
        let (key, maybe_attr) = match text_id.split_once(".") {
            Some((key, attr)) => (key, Some(attr)),
            None => (text_id, None),
        };

        let bundle = match self.get_bundle(lang) {
            Some(bundle) => bundle,
            None => return text_id.to_string(),
        };

        let message = match bundle.get_message(key) {
            Some(message) => message,
            None => return text_id.to_string(),
        };

        let pattern = match maybe_attr
            .and_then(|attr| message.get_attribute(attr).map(|a| a.value()))
            .or_else(|| message.value())
        {
            Some(pattern) => pattern,
            None => return text_id.to_string(),
        };

        let fluent_args = match args {
            Some(args) => {
                let mut fluent_args = FluentArgs::new();
                args.iter().for_each(|(arg, value)| fluent_args.set(arg.to_string(), value.clone()));

                Some(fluent_args)
            },
            None => None,
        };

        // todo: leverage fluent's formatting error handling for better error messages
        bundle.format_pattern(pattern, fluent_args.as_ref(), &mut Vec::new()).to_string()
    }
}

static LOCALES: OnceLock<LocalesLoader> = OnceLock::new();

task_local! {
    pub static LANGUAGE: Language;
}

/// Utility function for easily retrieving the current [`LanguageIdentifier`] inside the
/// `task_local!` [`LocalKey`] scope of wherever this is called from.
pub fn task_lang() -> Language {
    LANGUAGE.with(|lang| *lang)
}

/// A utility function for fetching a translated message associated with the
/// given `text_id`. The language of the returned message depends on the value
/// of the `tokio::task_local!` `LANGUAGE` [`LocalKey`] variable. The translations
/// are stored in the `locales` directory.
///
/// This function call must be nested inside a [`LocalKey`] scope.
pub fn tr(text_id: &str) -> String {
    LANGUAGE
        .try_with(|lang| LocalesLoader::get().lookup(lang, text_id, None))
        .unwrap_or(format!("Invalid context {}", text_id))
}

/// Like [`tr`], except this function must be used for fetching translations
/// containing variables.
///
/// Example with English translation:
/// ```ignore
/// assert_eq!(
///     trp!("demon-score", ("percent", 99)),
///     "Demonlist score (99%)",
/// );
/// ```
/// Source text: `demon-score = Demonlist score ({$percent}%)`
#[macro_export]
macro_rules! trp {
    ($text_id:expr $(, ($key:expr, $value:expr) )* $(,)?) => {{
        use std::collections::HashMap;
        use $crate::localization::{LANGUAGE, FluentValue, LocalesLoader};

        let mut args_map: HashMap<&'static str, FluentValue<'_>> = HashMap::new();

        $(
            args_map.insert($key, FluentValue::from($value.clone()));
        )*

        LANGUAGE.try_with(|lang| LocalesLoader::get().lookup(lang, $text_id, Some(&args_map))).unwrap_or(format!("Invalid context {}", $text_id))
    }};
}
