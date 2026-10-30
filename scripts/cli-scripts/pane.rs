//! A pane: one plugin, its context and its draft input.

#[derive(Clone, Debug, Default)]
pub struct PaneContext { pub cwd: String, pub branch: String }

pub struct Pane { pub id: u32, pub plugin: String, pub context: PaneContext, pub draft: String }

impl Pane {
    /// Splits this pane: the new one starts with a copy of the context.
    pub fn split(&self, id: u32, plugin: &str) -> Pane {
        Pane { id, plugin: plugin.to_string(), context: self.context.clone(), draft: String::new() }
    }
}
