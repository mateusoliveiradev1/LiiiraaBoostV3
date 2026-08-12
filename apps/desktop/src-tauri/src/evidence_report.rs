use liiiraa_contracts_rust::validate_hardware_evidence_document;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

use crate::comparison::{
    ComparisonDecision, ComparisonProjection, EvidenceQuality, canonical_json, hash_bytes,
};

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ReportError {
    ComparisonRejected,
    InvalidInput,
    ContractRejected,
    HashMismatch,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportTimelineEntry {
    pub label: String,
    pub evidence_id: String,
    pub evidence_hash: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportProjection {
    pub report_id: String,
    pub comparison_id: String,
    pub generated_at: String,
    pub metric: ComparisonProjection,
    pub summary: String,
    pub limitations: Vec<String>,
    pub timeline: Vec<ReportTimelineEntry>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PortableReportPayload {
    document: Value,
    projection: ReportProjection,
}

#[derive(Clone, Debug, PartialEq)]
pub struct EvidenceReportBundle {
    pub document: Value,
    pub projection: ReportProjection,
    pub json: String,
    pub html: String,
    pub content_hash: String,
    html_hash: String,
}

/// Renders every representation from one immutable projection. Neither HTML
/// nor JSON calculates metrics independently, eliminating representation drift.
pub fn render_report(
    comparison: &ComparisonDecision,
    report_id: &str,
    generated_at: &str,
    limitations: &[String],
) -> Result<EvidenceReportBundle, ReportError> {
    if !comparison.accepted() {
        return Err(ReportError::ComparisonRejected);
    }
    if !valid_identifier(report_id)
        || generated_at.trim().is_empty()
        || limitations.is_empty()
        || limitations.len() > 32
    {
        return Err(ReportError::InvalidInput);
    }
    let limitations = limitations
        .iter()
        .map(|value| bounded_text(value))
        .collect::<Option<Vec<_>>>()
        .ok_or(ReportError::InvalidInput)?;
    let metric = comparison
        .projection
        .clone()
        .ok_or(ReportError::ComparisonRejected)?;
    if metric.quality != EvidenceQuality::Valid {
        return Err(ReportError::ComparisonRejected);
    }

    let evidence_ids = vec![
        comparison.before_session_id.clone(),
        comparison.after_session_id.clone(),
        comparison.comparison_id.clone(),
    ];
    let evidence_hashes = vec![
        comparison.before_hash.clone(),
        comparison.after_hash.clone(),
        metric.evidence_hash.clone(),
    ];
    if !all_unique(&evidence_ids) || !all_unique(&evidence_hashes) {
        return Err(ReportError::InvalidInput);
    }

    let document = json!({
        "kind": "evidence-report",
        "schemaVersion": "1.0",
        "reportId": report_id,
        "evidenceVersion": 1,
        "generatedAt": generated_at,
        "evidenceIds": evidence_ids,
        "evidenceHashes": evidence_hashes,
        "provenance": {
            "source": "Liiiraa Boost canonical comparison projection",
            "collectedAt": comparison.compared_at,
        },
        "limitations": limitations,
    });
    validate_hardware_evidence_document(&document).map_err(|_| ReportError::ContractRejected)?;

    let projection = ReportProjection {
        report_id: report_id.to_owned(),
        comparison_id: comparison.comparison_id.clone(),
        generated_at: generated_at.to_owned(),
        summary: summary_text(&metric),
        limitations: limitations.clone(),
        timeline: vec![
            ReportTimelineEntry {
                label: "Antes".to_owned(),
                evidence_id: comparison.before_session_id.clone(),
                evidence_hash: comparison.before_hash.clone(),
            },
            ReportTimelineEntry {
                label: "Depois".to_owned(),
                evidence_id: comparison.after_session_id.clone(),
                evidence_hash: comparison.after_hash.clone(),
            },
            ReportTimelineEntry {
                label: "Comparação aceita".to_owned(),
                evidence_id: comparison.comparison_id.clone(),
                evidence_hash: metric.evidence_hash.clone(),
            },
        ],
        metric,
    };
    let payload = PortableReportPayload {
        document: document.clone(),
        projection: projection.clone(),
    };
    let payload_value = serde_json::to_value(&payload).map_err(|_| ReportError::InvalidInput)?;
    let canonical = canonical_json(&payload_value);
    let json = String::from_utf8(canonical.clone()).map_err(|_| ReportError::InvalidInput)?;
    let content_hash = hash_bytes(&canonical);
    let html = render_offline_html(&projection, &content_hash);
    let html_hash = hash_bytes(html.as_bytes());

    Ok(EvidenceReportBundle {
        document,
        projection,
        json,
        html,
        content_hash,
        html_hash,
    })
}

/// Reopens both portable representations, validates the generated contract,
/// and proves they still carry the same authoritative values and identity.
pub fn verify_report(bundle: &EvidenceReportBundle) -> Result<(), ReportError> {
    validate_hardware_evidence_document(&bundle.document)
        .map_err(|_| ReportError::ContractRejected)?;
    let parsed: PortableReportPayload =
        serde_json::from_str(&bundle.json).map_err(|_| ReportError::HashMismatch)?;
    let parsed_value = serde_json::to_value(&parsed).map_err(|_| ReportError::HashMismatch)?;
    if hash_bytes(&canonical_json(&parsed_value)) != bundle.content_hash
        || hash_bytes(bundle.html.as_bytes()) != bundle.html_hash
        || parsed.document != bundle.document
        || parsed.projection != bundle.projection
    {
        return Err(ReportError::HashMismatch);
    }
    verify_html_projection(&bundle.html, &bundle.projection, &bundle.content_hash)
}

fn verify_html_projection(
    html: &str,
    projection: &ReportProjection,
    content_hash: &str,
) -> Result<(), ReportError> {
    let required = [
        format!("data-content-hash=\"{}\"", escape_html(content_hash)),
        escape_html(&projection.report_id),
        escape_html(&projection.comparison_id),
        escape_html(&projection.metric.metric),
        escape_html(&projection.metric.unit),
        format_number(projection.metric.before),
        format_number(projection.metric.after),
        format_number(projection.metric.delta),
        escape_html(&projection.metric.evidence_hash),
    ];
    if required.iter().all(|needle| html.contains(needle)) {
        Ok(())
    } else {
        Err(ReportError::HashMismatch)
    }
}

fn render_offline_html(projection: &ReportProjection, content_hash: &str) -> String {
    let limitations = projection
        .limitations
        .iter()
        .map(|item| format!("<li>{}</li>", escape_html(item)))
        .collect::<String>();
    let timeline = projection
        .timeline
        .iter()
        .map(|entry| {
            format!(
                "<li><strong>{}</strong><span>{}</span><code>{}</code></li>",
                escape_html(&entry.label),
                escape_html(&entry.evidence_id),
                escape_html(&entry.evidence_hash)
            )
        })
        .collect::<String>();
    let metric = &projection.metric;
    format!(
        "<!doctype html>\
<html lang=\"pt-BR\"><head><meta charset=\"utf-8\">\
<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\
<title>Relatório de evidência — {report}</title>\
<style>{styles}</style></head>\
<body data-content-hash=\"{content_hash}\"><a class=\"skip\" href=\"#conteudo\">Ir ao conteúdo</a>\
<main id=\"conteudo\"><header><p class=\"eyebrow\">EVIDÊNCIA LOCAL VERIFICADA</p>\
<h1>Comparação medida</h1><p>{summary}</p></header>\
<section aria-labelledby=\"resultado\"><h2 id=\"resultado\">Resultado</h2>\
<table><caption>Valores autoritativos da comparação {comparison}</caption>\
<thead><tr><th scope=\"col\">Métrica</th><th scope=\"col\">Antes</th>\
<th scope=\"col\">Depois</th><th scope=\"col\">Diferença</th><th scope=\"col\">Unidade</th></tr></thead>\
<tbody><tr><th scope=\"row\">{metric}</th><td>{before}</td><td>{after}</td>\
<td>{delta}</td><td>{unit}</td></tr></tbody></table>\
<p class=\"hash\"><strong>Hash da comparação:</strong> <code>{metric_hash}</code></p></section>\
<section aria-labelledby=\"limites\"><h2 id=\"limites\">Limitações</h2><ul>{limitations}</ul></section>\
<section aria-labelledby=\"linha\"><h2 id=\"linha\">Proveniência</h2><ol>{timeline}</ol></section>\
<footer><p>Relatório {report} · gerado em {generated}</p>\
<p><strong>Hash do conteúdo:</strong> <code>{content_hash}</code></p></footer></main></body></html>",
        report = escape_html(&projection.report_id),
        comparison = escape_html(&projection.comparison_id),
        generated = escape_html(&projection.generated_at),
        summary = escape_html(&projection.summary),
        metric = escape_html(&metric.metric),
        before = format_number(metric.before),
        after = format_number(metric.after),
        delta = format_number(metric.delta),
        unit = escape_html(&metric.unit),
        metric_hash = escape_html(&metric.evidence_hash),
        limitations = limitations,
        timeline = timeline,
        content_hash = escape_html(content_hash),
        styles = OFFLINE_STYLES,
    )
}

fn summary_text(metric: &ComparisonProjection) -> String {
    let direction = if metric.delta < 0.0 {
        "redução"
    } else if metric.delta > 0.0 {
        "aumento"
    } else {
        "sem alteração"
    };
    format!(
        "{}: {} de {} para {} (diferença {}).",
        metric.metric,
        direction,
        format_number(metric.before),
        format_number(metric.after),
        format_number(metric.delta)
    )
}

fn format_number(value: f64) -> String {
    if value.fract() == 0.0 {
        format!("{value:.1}")
    } else {
        let value = format!("{value:.6}");
        value.trim_end_matches('0').trim_end_matches('.').to_owned()
    }
}

fn escape_html(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

fn all_unique(values: &[String]) -> bool {
    let mut sorted = values.to_vec();
    sorted.sort();
    sorted.dedup();
    sorted.len() == values.len()
}

fn valid_identifier(value: &str) -> bool {
    !value.trim().is_empty() && value.chars().count() <= 128
}

fn bounded_text(value: &str) -> Option<String> {
    let value = value.trim().chars().take(512).collect::<String>();
    (!value.is_empty()).then_some(value)
}

const OFFLINE_STYLES: &str = "\
:root{color-scheme:dark;font-family:system-ui,sans-serif;background:#050a12;color:#edf6ff}\
*{box-sizing:border-box}body{margin:0;background:#050a12;color:#edf6ff;line-height:1.5}\
.skip{position:absolute;left:-9999px}.skip:focus{left:1rem;top:1rem;background:#22c8ff;color:#001018;padding:.75rem}\
main{width:min(72rem,calc(100% - 2rem));margin:0 auto;padding:4rem 0}header,section,footer{padding:2rem;border:1px solid #28445d;background:#091321;margin-bottom:1rem}\
.eyebrow{color:#22c8ff;font-weight:700;letter-spacing:.14em}h1{font-size:clamp(2rem,5vw,4rem);margin:.25rem 0}\
h2{margin-top:0}table{border-collapse:collapse;width:100%;overflow:auto}caption{text-align:left;margin-bottom:1rem}\
th,td{border-bottom:1px solid #28445d;padding:.8rem;text-align:left}code{overflow-wrap:anywhere;color:#8bdbff}\
ol li{display:grid;grid-template-columns:10rem 1fr;gap:.5rem;margin:.8rem 0}@media(max-width:40rem){main{padding:1rem 0}header,section,footer{padding:1rem}table{font-size:.85rem}ol li{grid-template-columns:1fr}}\
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}";
