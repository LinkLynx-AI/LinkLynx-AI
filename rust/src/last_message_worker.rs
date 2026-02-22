use thiserror::Error;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MessageSummary {
    pub message_id: i64,
    pub message_at_ms: i64,
}

#[derive(Debug, Error)]
#[allow(dead_code)]
pub enum LastMessageError {
    #[error("store error: {0}")]
    Store(String),
}

pub trait LastMessageStore {
    fn upsert_if_newer(
        &mut self,
        channel_id: i64,
        candidate: MessageSummary,
    ) -> Result<bool, LastMessageError>;

    fn current_last_message(
        &self,
        channel_id: i64,
    ) -> Result<Option<MessageSummary>, LastMessageError>;

    fn set_current_last_message(
        &mut self,
        channel_id: i64,
        candidate: MessageSummary,
    ) -> Result<(), LastMessageError>;
}

pub trait ScyllaHistoryReader {
    fn find_latest_not_deleted(
        &self,
        channel_id: i64,
    ) -> Result<Option<MessageSummary>, LastMessageError>;
}

pub struct LastMessageWorker<S: LastMessageStore, R: ScyllaHistoryReader> {
    store: S,
    history_reader: R,
}

impl<S: LastMessageStore, R: ScyllaHistoryReader> LastMessageWorker<S, R> {
    pub fn new(store: S, history_reader: R) -> Self {
        Self {
            store,
            history_reader,
        }
    }

    pub fn on_message_created(
        &mut self,
        channel_id: i64,
        summary: MessageSummary,
    ) -> Result<bool, LastMessageError> {
        self.store.upsert_if_newer(channel_id, summary)
    }

    pub fn on_message_deleted(
        &mut self,
        channel_id: i64,
        deleted_message_id: i64,
    ) -> Result<bool, LastMessageError> {
        let current = self.store.current_last_message(channel_id)?;
        if current.as_ref().map(|x| x.message_id) != Some(deleted_message_id) {
            return Ok(false);
        }

        let recalculated = self.history_reader.find_latest_not_deleted(channel_id)?;
        if let Some(summary) = recalculated {
            self.store.set_current_last_message(channel_id, summary)?;
        }
        Ok(true)
    }

    pub fn into_parts(self) -> (S, R) {
        (self.store, self.history_reader)
    }
}

#[cfg(test)]
mod tests {
    use super::{
        LastMessageError, LastMessageStore, LastMessageWorker, MessageSummary, ScyllaHistoryReader,
    };
    use std::collections::HashMap;

    #[derive(Default)]
    struct InMemoryLastMessageStore {
        by_channel: HashMap<i64, MessageSummary>,
    }

    impl LastMessageStore for InMemoryLastMessageStore {
        fn upsert_if_newer(
            &mut self,
            channel_id: i64,
            candidate: MessageSummary,
        ) -> Result<bool, LastMessageError> {
            match self.by_channel.get(&channel_id) {
                Some(current) if current.message_at_ms >= candidate.message_at_ms => Ok(false),
                _ => {
                    self.by_channel.insert(channel_id, candidate);
                    Ok(true)
                }
            }
        }

        fn current_last_message(
            &self,
            channel_id: i64,
        ) -> Result<Option<MessageSummary>, LastMessageError> {
            Ok(self.by_channel.get(&channel_id).cloned())
        }

        fn set_current_last_message(
            &mut self,
            channel_id: i64,
            candidate: MessageSummary,
        ) -> Result<(), LastMessageError> {
            self.by_channel.insert(channel_id, candidate);
            Ok(())
        }
    }

    struct InMemoryHistoryReader {
        by_channel: HashMap<i64, Option<MessageSummary>>,
    }

    impl ScyllaHistoryReader for InMemoryHistoryReader {
        fn find_latest_not_deleted(
            &self,
            channel_id: i64,
        ) -> Result<Option<MessageSummary>, LastMessageError> {
            Ok(self.by_channel.get(&channel_id).cloned().unwrap_or(None))
        }
    }

    #[test]
    fn created_updates_last_message_only_when_newer() {
        let store = InMemoryLastMessageStore::default();
        let reader = InMemoryHistoryReader {
            by_channel: HashMap::new(),
        };
        let mut worker = LastMessageWorker::new(store, reader);

        let first = MessageSummary {
            message_id: 100,
            message_at_ms: 1_000,
        };
        let older = MessageSummary {
            message_id: 99,
            message_at_ms: 999,
        };

        assert!(worker.on_message_created(1, first).unwrap());
        assert!(!worker.on_message_created(1, older).unwrap());
    }

    #[test]
    fn deleted_non_last_message_does_not_recalculate() {
        let store = InMemoryLastMessageStore {
            by_channel: HashMap::from([(
                1,
                MessageSummary {
                    message_id: 100,
                    message_at_ms: 1_000,
                },
            )]),
        };
        let reader = InMemoryHistoryReader {
            by_channel: HashMap::from([(
                1,
                Some(MessageSummary {
                    message_id: 99,
                    message_at_ms: 999,
                }),
            )]),
        };
        let mut worker = LastMessageWorker::new(store, reader);

        let recalculated = worker.on_message_deleted(1, 98).unwrap();
        assert!(!recalculated);
    }

    #[test]
    fn deleted_last_message_recalculates_from_history() {
        let store = InMemoryLastMessageStore {
            by_channel: HashMap::from([(
                1,
                MessageSummary {
                    message_id: 100,
                    message_at_ms: 1_000,
                },
            )]),
        };
        let reader = InMemoryHistoryReader {
            by_channel: HashMap::from([(
                1,
                Some(MessageSummary {
                    message_id: 90,
                    message_at_ms: 900,
                }),
            )]),
        };
        let mut worker = LastMessageWorker::new(store, reader);

        let recalculated = worker.on_message_deleted(1, 100).unwrap();
        assert!(recalculated);

        let (store, _) = worker.into_parts();
        let current = store.current_last_message(1).unwrap().unwrap();
        assert_eq!(current.message_id, 90);
    }
}
