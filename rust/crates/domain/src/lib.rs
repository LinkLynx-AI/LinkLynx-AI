pub use linklynx_shared::UserId;

#[derive(Debug, Clone)]
pub struct User {
    pub id: UserId,
    pub name: String,
}

#[derive(Debug, thiserror::Error)]
pub enum DomainError {
    #[error("user not found")]
    UserNotFound,
}

pub trait UserRepository: Send + Sync {
    fn find_by_id(&self, id: UserId) -> Result<Option<User>, DomainError>;
    fn save(&self, user: &User) -> Result<(), DomainError>;
}
