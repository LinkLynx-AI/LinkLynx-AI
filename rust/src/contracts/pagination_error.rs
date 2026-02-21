use serde::{Deserialize, Serialize};

pub const DEFAULT_PAGE_LIMIT: u32 = 50;
pub const MAX_PAGE_LIMIT: u32 = 100;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PaginationParams {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cursor: Option<String>,
    #[serde(default = "default_page_limit")]
    pub limit: u32,
}

impl Default for PaginationParams {
    fn default() -> Self {
        Self {
            cursor: None,
            limit: DEFAULT_PAGE_LIMIT,
        }
    }
}

impl PaginationParams {
    pub fn validate_limit(&self) -> Result<(), ErrorCode> {
        if (1..=MAX_PAGE_LIMIT).contains(&self.limit) {
            Ok(())
        } else {
            Err(ErrorCode::ValidationFailed)
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct PaginationMeta {
    #[serde(
        default,
        rename = "nextCursor",
        skip_serializing_if = "Option::is_none"
    )]
    pub next_cursor: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ErrorCode {
    ValidationFailed,
    AuthorizationFailed,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub code: ErrorCode,
}

const fn default_page_limit() -> u32 {
    DEFAULT_PAGE_LIMIT
}

#[cfg(test)]
mod tests {
    use super::{
        ErrorCode, ErrorResponse, PaginationMeta, PaginationParams, DEFAULT_PAGE_LIMIT,
        MAX_PAGE_LIMIT,
    };
    use serde_json::json;

    #[test]
    fn pagination_params_default_limit_is_applied() {
        let params: PaginationParams = serde_json::from_value(json!({})).unwrap();
        assert_eq!(params.cursor, None);
        assert_eq!(params.limit, DEFAULT_PAGE_LIMIT);
    }

    #[test]
    fn pagination_params_limit_validation_has_bounds() {
        let valid = PaginationParams {
            cursor: None,
            limit: MAX_PAGE_LIMIT,
        };
        assert_eq!(valid.validate_limit(), Ok(()));

        let zero = PaginationParams {
            cursor: None,
            limit: 0,
        };
        assert_eq!(zero.validate_limit(), Err(ErrorCode::ValidationFailed));

        let too_large = PaginationParams {
            cursor: None,
            limit: MAX_PAGE_LIMIT + 1,
        };
        assert_eq!(too_large.validate_limit(), Err(ErrorCode::ValidationFailed));
    }

    #[test]
    fn pagination_meta_uses_next_cursor_wire_name() {
        let meta = PaginationMeta {
            next_cursor: Some("cursor-2".to_string()),
        };

        let value = serde_json::to_value(meta).unwrap();
        assert_eq!(value, json!({ "nextCursor": "cursor-2" }));
    }

    #[test]
    fn error_code_and_response_round_trip() {
        let response = ErrorResponse {
            code: ErrorCode::AuthorizationFailed,
        };

        let serialized = serde_json::to_value(&response).unwrap();
        assert_eq!(serialized, json!({ "code": "authorization_failed" }));

        let parsed: ErrorResponse = serde_json::from_value(json!({
            "code": "validation_failed"
        }))
        .unwrap();
        assert_eq!(parsed.code, ErrorCode::ValidationFailed);
    }
}
