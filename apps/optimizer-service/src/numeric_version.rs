pub(crate) fn parse_bounded_numeric_version(value: &str) -> Option<Vec<u64>> {
    let segments: Vec<_> = value.split('.').collect();
    if segments.is_empty() || segments.len() > 4 {
        return None;
    }

    segments
        .into_iter()
        .map(|segment| {
            if segment.is_empty()
                || !segment.bytes().all(|byte| byte.is_ascii_digit())
                || (segment.len() > 1 && segment.starts_with('0'))
            {
                return None;
            }
            segment.parse::<u64>().ok()
        })
        .collect()
}

pub(crate) fn equivalent_numeric_version(expected: &str, actual: &str) -> bool {
    let (Some(mut expected), Some(mut actual)) = (
        parse_bounded_numeric_version(expected),
        parse_bounded_numeric_version(actual),
    ) else {
        return false;
    };
    while expected.len() > 1 && expected.last() == Some(&0) {
        expected.pop();
    }
    while actual.len() > 1 && actual.last() == Some(&0) {
        actual.pop();
    }
    expected == actual
}
