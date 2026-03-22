export const SCHEMA_VERSION = 6;

export const schemas = {
  postgres: {
    entities: `
      CREATE TABLE IF NOT EXISTS entities (
        id SERIAL PRIMARY KEY,
        type VARCHAR(100) NOT NULL,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_entities_type_name ON entities(type, name);
      CREATE INDEX IF NOT EXISTS idx_entities_slug ON entities(slug) WHERE slug IS NOT NULL;
    `,
    mem_entries: `
      CREATE TABLE IF NOT EXISTS mem_entries (
        id SERIAL PRIMARY KEY,
        entity_id INTEGER REFERENCES entities(id) ON DELETE SET NULL,
        kind VARCHAR(100) NOT NULL,
        title VARCHAR(500),
        content TEXT NOT NULL,
        tags JSONB,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_mem_entries_entity_timestamp ON mem_entries(entity_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_mem_entries_kind_timestamp ON mem_entries(kind, timestamp);
    `,
    prefs: `
      CREATE TABLE IF NOT EXISTS prefs (
        id SERIAL PRIMARY KEY,
        scope VARCHAR(100) NOT NULL,
        key VARCHAR(255) NOT NULL,
        value TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(scope, key)
      );
      CREATE INDEX IF NOT EXISTS idx_prefs_scope_key ON prefs(scope, key);
    `,
    pixel_state: `
      CREATE TABLE IF NOT EXISTS pixel_state (
        id SERIAL PRIMARY KEY,
        owner VARCHAR(100) NOT NULL,
        key VARCHAR(255) NOT NULL,
        value JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(owner, key)
      );
      CREATE INDEX IF NOT EXISTS idx_pixel_state_owner_key ON pixel_state(owner, key);
    `,
    users: `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `,
    stock_tickers: `
      CREATE TABLE IF NOT EXISTS stock_tickers (
        id SERIAL PRIMARY KEY,
        symbol VARCHAR(16) UNIQUE NOT NULL,
        exchange VARCHAR(32),
        name VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `,
    stock_forecasts: `
      CREATE TABLE IF NOT EXISTS stock_forecasts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        ticker_id INTEGER NOT NULL REFERENCES stock_tickers(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        horizon_days INTEGER NOT NULL DEFAULT 14,
        target_date DATE NOT NULL,
        prediction_type VARCHAR(32) NOT NULL,
        predicted_price DECIMAL(18,4),
        predicted_return_pct DECIMAL(9,4),
        predicted_direction VARCHAR(16),
        baseline_price DECIMAL(18,4),
        notes TEXT,
        status VARCHAR(32) NOT NULL DEFAULT 'pending',
        evaluated_at TIMESTAMP WITH TIME ZONE,
        actual_price DECIMAL(18,4),
        actual_return_pct DECIMAL(9,4),
        absolute_error_price DECIMAL(18,4),
        absolute_error_pct DECIMAL(9,4)
      );
      CREATE INDEX IF NOT EXISTS idx_stock_forecasts_user_created ON stock_forecasts(user_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_stock_forecasts_ticker_target ON stock_forecasts(ticker_id, target_date);
      CREATE INDEX IF NOT EXISTS idx_stock_forecasts_status_target ON stock_forecasts(status, target_date);
    `,
    activity_log: `
      CREATE TABLE IF NOT EXISTS activity_log (
        id BIGSERIAL PRIMARY KEY,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        user_id BIGINT,
        type VARCHAR(64) NOT NULL,
        description TEXT,
        details JSONB
      );
      CREATE INDEX IF NOT EXISTS idx_activity_created_at ON activity_log(created_at DESC);
    `,
    tasks: `
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(32) NOT NULL DEFAULT 'open',
        priority SMALLINT DEFAULT 3,
        estimated_minutes SMALLINT DEFAULT 12,
        due_date DATE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_due_priority ON tasks(status, due_date, priority);
    `,
    daily_plans: `
      CREATE TABLE IF NOT EXISTS daily_plans (
        id SERIAL PRIMARY KEY,
        plan_date DATE NOT NULL,
        summary TEXT,
        total_allocated_minutes INT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(plan_date)
      );
    `,
    daily_plan_items: `
      CREATE TABLE IF NOT EXISTS daily_plan_items (
        id SERIAL PRIMARY KEY,
        daily_plan_id BIGINT NOT NULL,
        task_id BIGINT NOT NULL,
        slot_index INT NOT NULL,
        allocated_minutes SMALLINT NOT NULL,
        notes TEXT,
        completed_at TIMESTAMP,
        FOREIGN KEY (daily_plan_id) REFERENCES daily_plans(id) ON DELETE CASCADE,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_daily_plan_items_plan ON daily_plan_items(daily_plan_id);
    `,
    events: `
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        type VARCHAR(32) NOT NULL DEFAULT 'work',
        start_time TIMESTAMP WITH TIME ZONE NOT NULL,
        end_time TIMESTAMP WITH TIME ZONE NOT NULL,
        source VARCHAR(64) NOT NULL DEFAULT 'manual',
        notes TEXT,
        links JSONB DEFAULT '[]',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_events_start_time ON events(start_time);
      CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
    `,
    tasks_v2: `
      CREATE TABLE IF NOT EXISTS tasks_v2 (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(32) NOT NULL DEFAULT 'inbox',
        priority VARCHAR(8) NOT NULL DEFAULT 'P2',
        timebox VARCHAR(16),
        due DATE,
        tags JSONB DEFAULT '[]',
        source VARCHAR(64) NOT NULL DEFAULT 'manual',
        links JSONB DEFAULT '[]',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_tasks_v2_status ON tasks_v2(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_v2_priority ON tasks_v2(priority);
      CREATE INDEX IF NOT EXISTS idx_tasks_v2_due ON tasks_v2(due);
    `,
    sessions: `
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        task_id BIGINT REFERENCES tasks_v2(id) ON DELETE SET NULL,
        start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        end_time TIMESTAMP WITH TIME ZONE,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_task ON sessions(task_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_start ON sessions(start_time);
    `,
  },
  mysql: {
    entities: `
      CREATE TABLE IF NOT EXISTS entities (
        id INT AUTO_INCREMENT PRIMARY KEY,
        type VARCHAR(100) NOT NULL,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE,
        metadata JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_entities_type_name (type, name),
        INDEX idx_entities_slug (slug)
      ) ENGINE=InnoDB;
    `,
    mem_entries: `
      CREATE TABLE IF NOT EXISTS mem_entries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        entity_id INT DEFAULT NULL,
        kind VARCHAR(100) NOT NULL,
        title VARCHAR(500),
        content TEXT NOT NULL,
        tags JSON,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_mem_entries_entity_timestamp (entity_id, timestamp),
        INDEX idx_mem_entries_kind_timestamp (kind, timestamp),
        FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE SET NULL
      ) ENGINE=InnoDB;
    `,
    prefs: `
      CREATE TABLE IF NOT EXISTS prefs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        scope VARCHAR(100) NOT NULL,
        \`key\` VARCHAR(255) NOT NULL,
        value TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE INDEX idx_prefs_scope_key (scope, \`key\`)
      ) ENGINE=InnoDB;
    `,
    pixel_state: `
      CREATE TABLE IF NOT EXISTS pixel_state (
        id INT AUTO_INCREMENT PRIMARY KEY,
        owner VARCHAR(100) NOT NULL,
        \`key\` VARCHAR(255) NOT NULL,
        value JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE INDEX idx_pixel_state_owner_key (owner, \`key\`)
      ) ENGINE=InnoDB;
    `,
    users: `
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `,
    stock_tickers: `
      CREATE TABLE IF NOT EXISTS stock_tickers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        symbol VARCHAR(16) UNIQUE NOT NULL,
        exchange_name VARCHAR(32),
        name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `,
    stock_forecasts: `
      CREATE TABLE IF NOT EXISTS stock_forecasts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        ticker_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        horizon_days INT NOT NULL DEFAULT 14,
        target_date DATE NOT NULL,
        prediction_type VARCHAR(32) NOT NULL,
        predicted_price DECIMAL(18,4),
        predicted_return_pct DECIMAL(9,4),
        predicted_direction VARCHAR(16),
        baseline_price DECIMAL(18,4),
        notes TEXT,
        status VARCHAR(32) NOT NULL DEFAULT 'pending',
        evaluated_at TIMESTAMP NULL,
        actual_price DECIMAL(18,4),
        actual_return_pct DECIMAL(9,4),
        absolute_error_price DECIMAL(18,4),
        absolute_error_pct DECIMAL(9,4),
        INDEX idx_stock_forecasts_user_created (user_id, created_at),
        INDEX idx_stock_forecasts_ticker_target (ticker_id, target_date),
        INDEX idx_stock_forecasts_status_target (status, target_date),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (ticker_id) REFERENCES stock_tickers(id)
      ) ENGINE=InnoDB;
    `,
    activity_log: `
      CREATE TABLE IF NOT EXISTS activity_log (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        user_id BIGINT NULL,
        type VARCHAR(64) NOT NULL,
        description TEXT NULL,
        details JSON NULL,
        INDEX idx_activity_created_at (created_at DESC)
      ) ENGINE=InnoDB;
    `,
    tasks: `
      CREATE TABLE IF NOT EXISTS tasks (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        title VARCHAR(255) NOT NULL,
        description TEXT NULL,
        status ENUM('open', 'in_progress', 'done', 'archived') DEFAULT 'open',
        priority TINYINT UNSIGNED DEFAULT 3,
        estimated_minutes TINYINT UNSIGNED DEFAULT 12,
        due_date DATE NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_status (status),
        INDEX idx_due_priority (status, due_date, priority)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,
    daily_plans: `
      CREATE TABLE IF NOT EXISTS daily_plans (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        plan_date DATE NOT NULL,
        summary TEXT NULL,
        total_allocated_minutes INT UNSIGNED NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_plan_date (plan_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,
    daily_plan_items: `
      CREATE TABLE IF NOT EXISTS daily_plan_items (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        daily_plan_id BIGINT UNSIGNED NOT NULL,
        task_id BIGINT UNSIGNED NOT NULL,
        slot_index INT UNSIGNED NOT NULL,
        allocated_minutes TINYINT UNSIGNED NOT NULL,
        notes TEXT NULL,
        completed_at TIMESTAMP NULL,
        PRIMARY KEY (id),
        KEY idx_daily_plan (daily_plan_id),
        CONSTRAINT fk_daily_plan_items_plan FOREIGN KEY (daily_plan_id)
          REFERENCES daily_plans(id) ON DELETE CASCADE,
        CONSTRAINT fk_daily_plan_items_task FOREIGN KEY (task_id)
          REFERENCES tasks(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,
    events: `
      CREATE TABLE IF NOT EXISTS events (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        title VARCHAR(255) NOT NULL,
        type VARCHAR(32) NOT NULL DEFAULT 'work',
        start_time DATETIME NOT NULL,
        end_time DATETIME NOT NULL,
        source VARCHAR(64) NOT NULL DEFAULT 'manual',
        notes TEXT,
        links JSON DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_events_start (start_time),
        INDEX idx_events_type (type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,
    tasks_v2: `
      CREATE TABLE IF NOT EXISTS tasks_v2 (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(32) NOT NULL DEFAULT 'inbox',
        priority VARCHAR(8) NOT NULL DEFAULT 'P2',
        timebox VARCHAR(16),
        due DATE,
        tags JSON DEFAULT '[]',
        source VARCHAR(64) NOT NULL DEFAULT 'manual',
        links JSON DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_tasks_v2_status (status),
        INDEX idx_tasks_v2_priority (priority),
        INDEX idx_tasks_v2_due (due)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,
    sessions: `
      CREATE TABLE IF NOT EXISTS sessions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        task_id BIGINT UNSIGNED DEFAULT NULL,
        start_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        end_time DATETIME DEFAULT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_sessions_task (task_id),
        INDEX idx_sessions_start (start_time),
        CONSTRAINT fk_sessions_task FOREIGN KEY (task_id)
          REFERENCES tasks_v2(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,
  },
};

export type SchemaName = keyof typeof schemas.postgres;
