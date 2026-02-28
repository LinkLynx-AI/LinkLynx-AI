use linklynx_domains::{DomainError, User, UserId, UserRepository};

pub struct NoopUserRepository;

impl UserRepository for NoopUserRepository {
    fn find_by_id(&self, _id: UserId) -> Result<Option<User>, DomainError> {
        Ok(None)
    }

    fn save(&self, _user: &User) -> Result<(), DomainError> {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::NoopUserRepository;
    use linklynx_domains::{User, UserId, UserRepository};
    use uuid::Uuid;

    #[test]
    fn noop_repository_find_returns_none() {
        let repository = NoopUserRepository;
        let result = repository.find_by_id(UserId(Uuid::new_v4())).unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn noop_repository_save_returns_ok() {
        let repository = NoopUserRepository;
        let user = User {
            id: UserId(Uuid::new_v4()),
            name: "tester".to_string(),
        };

        let result = repository.save(&user);
        assert!(result.is_ok());
    }
}
