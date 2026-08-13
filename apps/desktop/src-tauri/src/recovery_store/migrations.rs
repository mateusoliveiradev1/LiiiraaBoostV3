use rusqlite_migration::Migrations;

pub fn migrations() -> Migrations<'static> {
    Migrations::new(Vec::new())
}
