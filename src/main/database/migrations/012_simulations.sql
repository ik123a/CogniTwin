-- Decision support systems (Bayesian decision networks)
CREATE TABLE IF NOT EXISTS saved_decisions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    options_json TEXT NOT NULL,       -- Array of decision options (title, scores, metadata)
    factors_json TEXT NOT NULL,       -- Array of evaluation criteria / probabilistic variables
    recommended_option TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Historical simulation run logs
CREATE TABLE IF NOT EXISTS simulation_runs (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,               -- 'markov' or 'monte_carlo'
    input_parameters_json TEXT,
    output_results_json TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
