use serde_json::{Map, Value};
use std::{
    collections::BTreeMap,
    env, fs,
    io::Write,
    path::{Path, PathBuf},
    process::{Command, ExitCode, Stdio},
};
use typify::{TypeSpace, TypeSpaceSettings};

fn main() -> ExitCode {
    match run() {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("{error}");
            ExitCode::FAILURE
        }
    }
}

fn run() -> Result<(), String> {
    let schema_path = schema_argument()?;
    let generated = generate(&schema_path)?;
    print!("{generated}");
    Ok(())
}

fn schema_argument() -> Result<PathBuf, String> {
    let mut arguments = env::args_os().skip(1);
    match (arguments.next(), arguments.next(), arguments.next()) {
        (Some(flag), Some(path), None) if flag == "--schema" => Ok(path.into()),
        _ => Err("usage: contract-generation-spike-rust --schema <schema-path>".to_owned()),
    }
}

fn generate(schema_path: &Path) -> Result<String, String> {
    let source = fs::read_to_string(schema_path)
        .map_err(|error| format!("could not read schema {}: {error}", schema_path.display()))?;
    let mut schema: Value = serde_json::from_str(&source).map_err(|error| {
        format!(
            "schema {} is not valid JSON: {error}",
            schema_path.display()
        )
    })?;
    let definitions = definition_ids(&schema)?;
    normalize_schema(&mut schema, &definitions, "#")?;

    let root_schema = serde_json::from_value(schema)
        .map_err(|error| format!("normalized schema is not supported by schemars: {error}"))?;
    let mut type_space = TypeSpace::new(&TypeSpaceSettings::default());
    type_space
        .add_root_schema(root_schema)
        .map_err(|error| format!("Typify rejected the normalized schema: {error}"))?;

    format_rust(type_space.to_stream().to_string())
}

fn definition_ids(schema: &Value) -> Result<BTreeMap<String, String>, String> {
    let root = schema
        .as_object()
        .ok_or_else(|| "schema root must be a JSON object".to_owned())?;
    match root.get("$schema").and_then(Value::as_str) {
        Some("https://json-schema.org/draft/2020-12/schema") => {}
        Some(dialect) => return Err(format!("unsupported JSON Schema dialect '{dialect}'")),
        None => return Err("schema root must declare the JSON Schema dialect".to_owned()),
    }

    let definitions = root
        .get("$defs")
        .and_then(Value::as_object)
        .ok_or_else(|| "schema root must contain an object-valued '$defs'".to_owned())?;
    definitions
        .iter()
        .map(|(name, definition)| {
            let expected_id = format!("{name}.json");
            let actual_id = definition
                .as_object()
                .and_then(|value| value.get("$id"))
                .and_then(Value::as_str)
                .ok_or_else(|| format!("definition '{name}' must declare '$id'"))?;
            if actual_id != expected_id {
                return Err(format!(
                    "definition '{name}' has unsupported '$id' '{actual_id}'; expected '{expected_id}'"
                ));
            }
            Ok((name.clone(), actual_id.to_owned()))
        })
        .collect()
}

fn normalize_schema(
    schema: &mut Value,
    definitions: &BTreeMap<String, String>,
    location: &str,
) -> Result<(), String> {
    let object = schema
        .as_object_mut()
        .ok_or_else(|| format!("schema at '{location}' must be an object"))?;
    let keys = object.keys().cloned().collect::<Vec<_>>();

    for key in keys {
        match key.as_str() {
            "$defs" => normalize_named_schemas(object, &key, definitions, location)?,
            "properties" => normalize_named_schemas(object, &key, definitions, location)?,
            "oneOf" => normalize_schema_array(object, &key, definitions, location)?,
            "items" | "not" => {
                let value = object
                    .get_mut(&key)
                    .expect("schema key collected from this object");
                normalize_schema(value, definitions, &format!("{location}/{key}"))?;
            }
            "$ref" => normalize_reference(object, definitions, location)?,
            "unevaluatedProperties" => normalize_closed_object(object, location)?,
            "const" => normalize_constant(object, location)?,
            "enum" => {
                if object
                    .get("enum")
                    .and_then(Value::as_array)
                    .is_none_or(Vec::is_empty)
                {
                    return Err(format!("'enum' at '{location}' must not be empty"));
                }
            }
            "$id" | "$schema" | "type" | "required" | "minLength" | "minimum" | "maximum"
            | "minItems" | "maxItems" => {}
            "additionalProperties" => {
                if object.get(&key) != Some(&Value::Bool(false)) {
                    return Err(format!(
                        "unsupported JSON Schema keyword value 'additionalProperties' at '{location}'"
                    ));
                }
            }
            unsupported => {
                return Err(format!(
                    "unsupported JSON Schema keyword '{unsupported}' at '{location}'"
                ));
            }
        }
    }

    Ok(())
}

fn normalize_constant(object: &mut Map<String, Value>, location: &str) -> Result<(), String> {
    let constant = object
        .remove("const")
        .expect("schema key collected from this object");
    if object
        .insert("enum".to_owned(), Value::Array(vec![constant]))
        .is_some()
    {
        return Err(format!(
            "schema at '{location}' declares both 'const' and 'enum'"
        ));
    }
    Ok(())
}

fn normalize_named_schemas(
    object: &mut Map<String, Value>,
    key: &str,
    definitions: &BTreeMap<String, String>,
    location: &str,
) -> Result<(), String> {
    let schemas = object
        .get_mut(key)
        .and_then(Value::as_object_mut)
        .ok_or_else(|| format!("'{key}' at '{location}' must be an object"))?;
    for (name, schema) in schemas {
        normalize_schema(schema, definitions, &format!("{location}/{key}/{name}"))?;
    }
    Ok(())
}

fn normalize_schema_array(
    object: &mut Map<String, Value>,
    key: &str,
    definitions: &BTreeMap<String, String>,
    location: &str,
) -> Result<(), String> {
    let schemas = object
        .get_mut(key)
        .and_then(Value::as_array_mut)
        .ok_or_else(|| format!("'{key}' at '{location}' must be an array"))?;
    if schemas.is_empty() {
        return Err(format!("'{key}' at '{location}' must not be empty"));
    }
    for (index, schema) in schemas.iter_mut().enumerate() {
        normalize_schema(schema, definitions, &format!("{location}/{key}/{index}"))?;
    }
    Ok(())
}

fn normalize_reference(
    object: &mut Map<String, Value>,
    definitions: &BTreeMap<String, String>,
    location: &str,
) -> Result<(), String> {
    let reference = object
        .get("$ref")
        .and_then(Value::as_str)
        .ok_or_else(|| format!("'$ref' at '{location}' must be a string"))?;
    let name = reference
        .strip_suffix(".json")
        .ok_or_else(|| format!("unsupported non-bundled '$ref' '{reference}' at '{location}'"))?;
    if definitions.get(name).map(String::as_str) != Some(reference) {
        return Err(format!(
            "unresolved bundled '$ref' '{reference}' at '{location}'"
        ));
    }
    let pointer_name = name.replace('~', "~0").replace('/', "~1");
    object.insert(
        "$ref".to_owned(),
        Value::String(format!("#/definitions/{pointer_name}")),
    );
    Ok(())
}

fn normalize_closed_object(object: &mut Map<String, Value>, location: &str) -> Result<(), String> {
    let closure = object
        .remove("unevaluatedProperties")
        .expect("schema key collected from this object");
    let false_schema = closure.as_object().is_some_and(|value| {
        value.len() == 1
            && value
                .get("not")
                .and_then(Value::as_object)
                .is_some_and(Map::is_empty)
    });
    if !false_schema {
        return Err(format!(
            "unsupported 'unevaluatedProperties' representation at '{location}'"
        ));
    }
    if object
        .insert("additionalProperties".to_owned(), Value::Bool(false))
        .is_some()
    {
        return Err(format!(
            "schema at '{location}' declares both object-closure keywords"
        ));
    }
    Ok(())
}

fn format_rust(source: String) -> Result<String, String> {
    let mut rustfmt = Command::new("rustfmt")
        .args(["--edition", "2024", "--emit", "stdout"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("could not start pinned rustfmt: {error}"))?;
    rustfmt
        .stdin
        .take()
        .ok_or_else(|| "rustfmt stdin was not available".to_owned())?
        .write_all(source.as_bytes())
        .map_err(|error| format!("could not send generated Rust to rustfmt: {error}"))?;
    let output = rustfmt
        .wait_with_output()
        .map_err(|error| format!("could not wait for rustfmt: {error}"))?;
    if !output.status.success() {
        return Err(format!(
            "rustfmt rejected generated Rust: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    String::from_utf8(output.stdout)
        .map_err(|error| format!("rustfmt emitted non-UTF-8 output: {error}"))
}
