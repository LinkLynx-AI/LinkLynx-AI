pub mod protocol_ws;

pub use protocol_ws::{
    AckPayload, AckStatus, AuthPayload, EventPayload, Frame, HelloPayload, Op, SendMessagePayload,
};

pub mod message_api;

pub mod protocol_events;

pub use protocol_events::{
    MessageCreatedPayload, MessageDeletedPayload, MessageEventType, MessagePayload,
    MessagePayloadBase, MessageUpdatedPayload, ProtocolEventEnvelope,
};

pub mod pagination_error;

pub use pagination_error::{
    ErrorCode, ErrorResponse, PaginationMeta, PaginationParams, DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT,
};

#[cfg(test)]
mod compatibility_snapshots;
