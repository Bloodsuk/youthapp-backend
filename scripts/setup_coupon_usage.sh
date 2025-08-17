#!/bin/bash

# Database configuration
DB_HOST="127.0.0.1"
DB_USER="practappstaging"
DB_NAME="practappstaging"
DB_PASSWORD="0FRAV3McemgGjKkMdkDk"

echo "Creating user_coupon_usage table..."

# Create the table
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME << EOF
CREATE TABLE IF NOT EXISTS \`user_coupon_usage\` (
  \`id\` int(11) NOT NULL AUTO_INCREMENT,
  \`user_id\` int(11) NOT NULL,
  \`coupon_id\` varchar(344) NOT NULL,
  \`used_at\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`unique_user_coupon\` (\`user_id\`, \`coupon_id\`),
  KEY \`idx_user_id\` (\`user_id\`),
  KEY \`idx_coupon_id\` (\`coupon_id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
EOF

if [ $? -eq 0 ]; then
    echo "✅ user_coupon_usage table created successfully!"
else
    echo "❌ Error creating table. Please check your database connection."
fi
