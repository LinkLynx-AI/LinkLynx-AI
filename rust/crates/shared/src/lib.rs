use thiserror::Error;

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct UserId(pub uuid::Uuid);

#[derive(Debug, Error)]
pub enum SharedError {
    #[error("internal error")]
    Internal,
}
