use linklynx_domain::{DomainError, User, UserId, UserRepository};

pub struct NoopUserRepository;

impl UserRepository for NoopUserRepository {
    fn find_by_id(&self, _id: UserId) -> Result<Option<User>, DomainError> {
        Ok(None)
    }

    fn save(&self, _user: &User) -> Result<(), DomainError> {
        Ok(())
    }
}
