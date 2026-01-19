#[derive(Debug, Default)]
pub enum Theme {
    #[default]
    Light,
    Dark,
}

impl Theme {
    pub fn as_str(&self) -> &'static str {
        match self {
            Theme::Light => "light",
            Theme::Dark => "dark",
        }
    }

    pub fn as_oauth_button_theme(&self) -> &'static str {
        // https://developers.google.com/identity/gsi/web/reference/html-reference#data-theme
        match self {
            Theme::Light => "outline",
            Theme::Dark => "filled_black",
        }
    }
}

impl From<Option<&str>> for Theme {
    fn from(value: Option<&str>) -> Self {
        match value {
            Some("light") => Theme::Light,
            Some("dark") => Theme::Dark,
            _ => Theme::default(),
        }
    }
}
