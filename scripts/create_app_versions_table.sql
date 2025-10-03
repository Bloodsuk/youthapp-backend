-- Create app_versions table
CREATE TABLE IF NOT EXISTS app_versions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    platform ENUM('android', 'ios', 'web') NOT NULL,
    version VARCHAR(20) NOT NULL,
    force_update TINYINT(1) DEFAULT 0,
    release_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create index on platform for faster queries
CREATE INDEX idx_app_versions_platform ON app_versions(platform);

-- Insert sample data (optional)
INSERT INTO app_versions (platform, version, force_update, release_notes) VALUES
('android', '1.0.0', 0, 'Initial release for Android'),
('ios', '1.0.0', 0, 'Initial release for iOS'),
('web', '1.0.0', 0, 'Initial release for Web');
