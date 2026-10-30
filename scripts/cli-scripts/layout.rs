//! Layout of panes inside a tab: a binary tree of splits.

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Direction { Left, Right, Up, Down }

#[derive(Clone, Copy, Debug)]
pub struct Rect { pub x: f32, pub y: f32, pub w: f32, pub h: f32 }

pub struct SplitTree { pub leaves: Vec<(u32, Rect)>, pub focused: u32 }

impl SplitTree {
    pub fn rect(&self, id: u32) -> Option<Rect> {
        self.leaves.iter().find(|(l, _)| *l == id).map(|(_, r)| *r)
    }
}

/// The pane next to the focused one in `dir`, if any.
pub fn focus_neighbor(tree: &SplitTree, dir: Direction) -> Option<u32> {
    let origin = tree.rect(tree.focused)?;
    tree.leaves
        .iter()
        .filter(|(id, _)| *id != tree.focused)
        .filter(|(_, r)| match dir {
            Direction::Left => r.x + r.w <= origin.x,
            Direction::Right => r.x >= origin.x + origin.w,
            Direction::Up => r.y + r.h <= origin.y,
            Direction::Down => r.y >= origin.y + origin.h,
        })
        .min_by(|a, b| distance(origin, a.1).total_cmp(&distance(origin, b.1)))
        .map(|(id, _)| *id)
}

fn distance(a: Rect, b: Rect) -> f32 {
    ((a.x - b.x).powi(2) + (a.y - b.y).powi(2)).sqrt()
}
