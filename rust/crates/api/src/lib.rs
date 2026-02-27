pub fn service_name() -> &'static str {
    "linklynx_api"
}

#[cfg(test)]
mod tests {
    use super::service_name;

    #[test]
    fn service_name_is_stable() {
        assert_eq!(service_name(), "linklynx_api");
    }
}
