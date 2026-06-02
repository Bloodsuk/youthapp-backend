-- Order-scoped phleb ↔ customer visit chat
CREATE TABLE IF NOT EXISTS visit_chat_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    job_id INT NULL,
    sent_from INT NOT NULL,
    sent_to INT NOT NULL,
    sent_from_role VARCHAR(4) NOT NULL,
    sent_to_role VARCHAR(4) NOT NULL,
    message TEXT NOT NULL,
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_visit_chat_order (order_id),
    INDEX idx_visit_chat_order_created (order_id, created_at)
);
