import express from "express";
import cors from "cors";
import fs from "fs";
import "dotenv/config";
import { getPool, getConfig } from "../src/pixel_memory/config.js";
import { fetchCurrentPrice, fetchPriceForDate } from "./services/priceFeed.js";
import { createAnalyzer, DataSource } from "./sherlock_analysis/index.js";
import { ConferenceRoomStorage, createConferenceRoomRouter } from "./conferenceroom/routes.js";
import { callChatModelForRole } from "./dist/models/roleModels.js";
import { createCoolerSession, buildTurnPrompt, validateUtterance, getNextIntent, addUtteranceToHistory, getRepairText, sessionToMarkdown, } from "./conversation/coolerController.js";
async function logActivity(type, description, details, userId) {
    try {
        const tables = await runDbQuery("SHOW TABLES");
        const tableNames = tables.map((row) => Object.values(row)[0]);
        if (!tableNames.includes("activity_log"))
            return;
        await runDbQuery("INSERT INTO activity_log (type, description, details, user_id) VALUES (?, ?, ?, ?)", [type, description, details ? JSON.stringify(details) : null, userId || null]);
    }
    catch { }
}
const app = express();
const PORT = process.env.PORT || 4173;
const COOLER_TALK_LOG_FILE = "/home/sherlockhums/apps/pixelworld/pixel_office/cooler_talk_log.md";
function writeCoolerTalkToFile(session) {
    const mdContent = sessionToMarkdown(session);
    try {
        fs.appendFileSync(COOLER_TALK_LOG_FILE, mdContent);
        console.log(`[CoolerTalk] Saved to ${COOLER_TALK_LOG_FILE}`);
    }
    catch (err) {
        console.error("[CoolerTalk] Failed to write to file:", err);
    }
}
app.use(cors());
app.use(express.json());
// Serve handoff JSON file
app.get("/handoff/opencode-local-agents.json", (req, res) => {
    const handoffPath = "/home/sherlockhums/apps/pixelworld/.handoff/opencode-local-agents.json";
    if (fs.existsSync(handoffPath)) {
        const data = fs.readFileSync(handoffPath, "utf-8");
        res.setHeader("Content-Type", "application/json");
        res.send(data);
    }
    else {
        res.status(404).json({ error: "Handoff file not found" });
    }
});
const PIXEL_ME_URL = "http://127.0.0.1:5001";
const KB_SERVER_URL = "http://127.0.0.1:8787";
app.use((req, res, next) => {
    const agent = req.header("X-Office-Agent");
    const client = req.header("X-Office-Client");
    if (agent || client) {
        console.log(`[Office] Request from Agent: ${agent}, Client: ${client}`);
    }
    next();
});
// Proxy /api/time to Pixel-Me
app.get("/api/time/current", async (req, res) => {
    try {
        const resp = await fetch(`${PIXEL_ME_URL}/time/current`);
        const data = await resp.json();
        res.json(data);
    }
    catch (error) {
        res.status(502).json({ ok: false, error: error.message });
    }
});
app.get("/api/time/summary", async (req, res) => {
    try {
        const date = req.query.date;
        const url = date ? `${PIXEL_ME_URL}/time/summary?date=${date}` : `${PIXEL_ME_URL}/time/summary`;
        const resp = await fetch(url);
        const data = await resp.json();
        res.json(data);
    }
    catch (error) {
        res.status(502).json({ ok: false, error: error.message });
    }
});
// Proxy /api/kb to KB Server
app.post("/api/kb/search", async (req, res) => {
    try {
        const resp = await fetch(`${KB_SERVER_URL}/search`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(req.body),
        });
        const data = await resp.json();
        res.json(data);
    }
    catch (error) {
        res.status(502).json({ ok: false, error: error.message });
    }
});
const conferenceroomStorage = new ConferenceRoomStorage();
app.use("/conferenceroom", createConferenceRoomRouter(conferenceroomStorage));
function requireAdmin(req, res, next) {
    const token = process.env.ADMIN_ACCESS_TOKEN;
    if (!token) {
        if (process.env.NODE_ENV === "production") {
            res.status(403).json({ error: "Admin access not configured" });
            return;
        }
        next();
        return;
    }
    const header = req.header("x-admin-token");
    if (header !== token) {
        res.status(403).json({ error: "Forbidden" });
        return;
    }
    next();
}
async function runDbQuery(sql, params = []) {
    const pool = await getPool();
    const config = getConfig();
    const isPg = config.db.type === "postgres";
    if (isPg) {
        const result = await pool.query(sql, params);
        return result.rows;
    }
    else {
        const [rows] = await pool.query(sql, params);
        return rows;
    }
}
function parseValue(value) {
    if (value === null || value === undefined)
        return null;
    if (typeof value === "string") {
        try {
            return JSON.parse(value);
        }
        catch {
            return value;
        }
    }
    return value;
}
async function getDbSchema() {
    const tables = await runDbQuery("SHOW TABLES");
    const tableNames = tables.map((row) => Object.values(row)[0]);
    let schema = "Database schema:\n";
    for (const tableName of tableNames) {
        const columns = await runDbQuery(`DESCRIBE \`${tableName}\``);
        schema += `\nTable: ${tableName}\n`;
        for (const col of columns) {
            schema += `  - ${col.Field} (${col.Type})\n`;
        }
    }
    return { schema, tables: tableNames };
}
async function getTableData(tableName, limit = 10) {
    const rows = await runDbQuery(`SELECT * FROM \`${tableName}\` LIMIT ?`, [limit]);
    return rows.map(row => {
        const parsed = {};
        for (const [key, value] of Object.entries(row)) {
            parsed[key] = parseValue(value);
        }
        return parsed;
    });
}
function detectRequestedTables(message, availableTables) {
    const lowerMessage = message.toLowerCase();
    const requested = [];
    for (const table of availableTables) {
        if (lowerMessage.includes(table.toLowerCase()) ||
            lowerMessage.includes(table.replace('_', ' '))) {
            requested.push(table);
        }
    }
    if (lowerMessage.includes('database') ||
        lowerMessage.includes('what is in') ||
        lowerMessage.includes('show me') ||
        lowerMessage.includes('all data') ||
        lowerMessage.includes('everything')) {
        if (requested.length === 0) {
            return availableTables;
        }
    }
    return requested;
}
function formatTableData(tableName, data) {
    if (!data || data.length === 0) {
        return `\n### ${tableName}\nNo data found.\n`;
    }
    let output = `\n### ${tableName} (${data.length} rows)\n`;
    const headers = Object.keys(data[0]);
    output += `Columns: ${headers.join(', ')}\n\n`;
    for (const row of data.slice(0, 5)) {
        const rowStr = headers.map(h => {
            const val = row[h];
            if (val === null)
                return 'NULL';
            if (typeof val === 'object')
                return JSON.stringify(val);
            return String(val);
        }).join(' | ');
        output += `| ${rowStr} |\n`;
    }
    if (data.length > 5) {
        output += `\n... and ${data.length - 5} more rows\n`;
    }
    return output;
}
app.post("/api/chat", async (req, res) => {
    try {
        const { message, history } = req.body;
        if (!message) {
            res.status(400).json({ error: "Message is required" });
            return;
        }
        const { schema: dbSchema, tables: tableNames } = await getDbSchema();
        const requestedTables = detectRequestedTables(message, tableNames);
        let tableDataContext = "";
        if (requestedTables.length > 0) {
            for (const table of requestedTables) {
                try {
                    const data = await getTableData(table, 10);
                    tableDataContext += formatTableData(table, data);
                }
                catch (err) {
                    tableDataContext += `\n### ${table}\nError fetching data: ${err}\n`;
                }
            }
        }
        const systemPrompt = `You are a database assistant for pixel office. The user's question will include the actual database data already fetched for you.

IMPORTANT: Do NOT say you'll "run", "execute", or "query" the database. The data has ALREADY been fetched and is provided below. Just analyze and display it.

DATABASE SCHEMA:
${dbSchema}

${tableDataContext ? `ALREADY FETCHED DATA:\n${tableDataContext}\n\nNow analyze this data and present it to the user.` : ''}

Rules:
- NEVER mention executing queries - data is already provided
- Show actual data in readable format
- Be helpful and concise`;
        const messages = [
            { role: "system", content: systemPrompt }
        ];
        if (history && Array.isArray(history)) {
            messages.push(...history);
        }
        messages.push({ role: "user", content: message });
        const result = await callChatModelForRole("office_assistant", messages, {
            temperature: 0.7,
        });
        res.json({
            reply: result.response,
            role: result.role,
            model: result.model
        });
    }
    catch (error) {
        console.error("Chat error:", error);
        res.status(500).json({ error: error.message || "Internal server error" });
    }
});
app.post("/api/agent-chat", async (req, res) => {
    try {
        const { message, model, agentName, agentRole } = req.body;
        if (!message) {
            res.status(400).json({ error: "Message is required" });
            return;
        }
        const selectedModel = model || "dash-squirrel";
        const rolePrompts = {
            receptionist: "You are FrontDesk, a friendly receptionist at Pixel Office. You help with intake, routing questions, and provide helpful information about the office. Be warm, efficient, and concise.",
            clerk: "You are a Clerk at Pixel Office. You handle task routing, data entry, and help coordinate workflow between teams. Be helpful and organized.",
            executive: "You are an Executive at Pixel Office. You handle high-level decisions, approvals, and strategic planning. Be professional, thoughtful, and decisive.",
            specialist: "You are a Specialist at Pixel Office. You provide deep technical analysis and expertise. Be knowledgeable, detailed, and thorough.",
            custodian: "You are a Custodian at Pixel Office. You handle logistics, scheduling, and physical operations. Be practical, reliable, and efficient.",
            archivist: "You are an Archivist at Pixel Office. You maintain records, documentation, and institutional knowledge. Be precise, thorough, and organized.",
        };
        const systemPrompt = rolePrompts[agentRole] || `You are ${agentName}, a helpful assistant at Pixel Office.`;
        const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
        const ollamaResponse = await fetch(`${ollamaUrl}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: selectedModel,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: message }
                ],
                stream: false
            })
        });
        if (!ollamaResponse.ok) {
            const errorText = await ollamaResponse.text();
            console.error("Ollama error:", errorText);
            res.json({ reply: `I'm having trouble connecting to the AI model right now. Please try again later. (Model: ${selectedModel})` });
            return;
        }
        const ollamaData = await ollamaResponse.json();
        const reply = ollamaData.message?.content || "I couldn't generate a response.";
        res.json({ reply, model: selectedModel });
    }
    catch (error) {
        console.error("Agent chat error:", error);
        res.status(500).json({ error: error.message || "Failed to chat with agent" });
    }
});
app.get("/api/db/query", async (req, res) => {
    try {
        const { table, limit } = req.query;
        if (!table || typeof table !== "string") {
            res.status(400).json({ error: "Table name required" });
            return;
        }
        const data = await getTableData(table, limit ? parseInt(limit, 10) : 10);
        res.json({ data });
    }
    catch (error) {
        console.error("Query error:", error);
        res.status(500).json({ error: error.message || "Query failed" });
    }
});
app.get("/api/db/tables", async (req, res) => {
    try {
        const tables = await runDbQuery("SHOW TABLES");
        const tableNames = tables.map((row) => Object.values(row)[0]);
        res.json({ tables: tableNames });
    }
    catch (error) {
        console.error("Tables error:", error);
        res.status(500).json({ error: error.message || "Failed to get tables" });
    }
});
app.get("/api/admin/summary", requireAdmin, async (req, res) => {
    try {
        const tables = await runDbQuery("SHOW TABLES");
        const tableNames = tables.map((row) => Object.values(row)[0]);
        const tableSummaries = [];
        for (const tableName of tableNames) {
            try {
                const countResult = await runDbQuery(`SELECT COUNT(*) as cnt FROM \`${tableName}\``);
                const rowCount = Array.isArray(countResult) ? countResult[0]?.cnt : countResult?.cnt || 0;
                tableSummaries.push({ name: tableName, rowCount: Number(rowCount) });
            }
            catch (err) {
                tableSummaries.push({ name: tableName, error: err.message });
            }
        }
        res.json({ tables: tableSummaries });
    }
    catch (error) {
        console.error("Admin summary error:", error);
        res.status(500).json({ error: error.message || "Failed to get summary" });
    }
});
app.get("/api/admin/activity", requireAdmin, async (req, res) => {
    try {
        const tables = await runDbQuery("SHOW TABLES");
        const tableNames = tables.map((row) => Object.values(row)[0]);
        if (!tableNames.includes("activity_log")) {
            res.json({
                events: [],
                message: "Activity logging not yet configured. The activity_log table does not exist."
            });
            return;
        }
        const events = await runDbQuery("SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 50");
        res.json({ events });
    }
    catch (error) {
        console.error("Admin activity error:", error);
        res.status(500).json({ error: error.message || "Failed to get activity" });
    }
});
app.post("/api/admin/actions/evaluate-stock-forecasts", requireAdmin, async (req, res) => {
    try {
        const tables = await runDbQuery("SHOW TABLES");
        const tableNames = tables.map((row) => Object.values(row)[0]);
        if (!tableNames.includes("stock_forecasts")) {
            res.json({ ok: false, message: "stock_forecasts table does not exist" });
            return;
        }
        const dueForecasts = await runDbQuery("SELECT sf.*, st.symbol FROM stock_forecasts sf JOIN stock_tickers st ON sf.ticker_id = st.id WHERE sf.status = 'pending' AND sf.target_date <= CURDATE()");
        if (dueForecasts.length === 0) {
            res.json({ ok: true, evaluatedCount: 0, errors: [], message: "No due forecasts to evaluate." });
            return;
        }
        const errors = [];
        let evaluatedCount = 0;
        for (const forecast of dueForecasts) {
            try {
                const priceResult = await fetchPriceForDate(forecast.symbol, forecast.target_date);
                if (!priceResult) {
                    errors.push(`Could not fetch price for ${forecast.symbol} on ${forecast.target_date}`);
                    continue;
                }
                const actualPrice = priceResult.price;
                let actualReturnPct = null;
                let absErrorPrice = null;
                let absErrorPct = null;
                if (forecast.baseline_price && forecast.baseline_price > 0) {
                    actualReturnPct = ((actualPrice - Number(forecast.baseline_price)) / Number(forecast.baseline_price)) * 100;
                }
                if (forecast.predicted_price != null) {
                    absErrorPrice = Math.abs(Number(forecast.predicted_price) - actualPrice);
                }
                if (forecast.predicted_return_pct != null && actualReturnPct != null) {
                    absErrorPct = Math.abs(Number(forecast.predicted_return_pct) - actualReturnPct);
                }
                await runDbQuery("UPDATE stock_forecasts SET status = 'evaluated', evaluated_at = NOW(), actual_price = ?, actual_return_pct = ?, absolute_error_price = ?, absolute_error_pct = ? WHERE id = ?", [actualPrice, actualReturnPct, absErrorPrice, absErrorPct, forecast.id]);
                evaluatedCount++;
            }
            catch (err) {
                errors.push(`Error evaluating forecast #${forecast.id}: ${err.message}`);
            }
        }
        res.json({ ok: true, evaluatedCount, errors, message: `Evaluated ${evaluatedCount} forecast(s).` });
        await logActivity("stock_forecast_evaluated", `Evaluated ${evaluatedCount} pending forecasts`, { evaluated: evaluatedCount, errors: errors.length });
    }
    catch (error) {
        console.error("Admin evaluate error:", error);
        res.status(500).json({ error: error.message || "Failed to evaluate forecasts" });
    }
});
app.post("/api/stocks/forecasts", async (req, res) => {
    try {
        const { symbol, horizon_days, target_date, prediction_type, predicted_price, predicted_direction, notes, user_id } = req.body;
        if (!symbol || !prediction_type) {
            res.status(400).json({ error: "symbol and prediction_type are required" });
            return;
        }
        const validTypes = ["price", "percentage_return", "direction"];
        if (!validTypes.includes(prediction_type)) {
            res.status(400).json({ error: `prediction_type must be one of: ${validTypes.join(", ")}` });
            return;
        }
        const effectiveUserId = user_id || 1;
        const horizon = horizon_days || 14;
        const effectiveTargetDate = target_date || new Date(Date.now() + horizon * 86400000).toISOString().split("T")[0];
        let tickerRows = await runDbQuery("SELECT id FROM stock_tickers WHERE symbol = ?", [symbol.toUpperCase()]);
        let tickerId;
        if (tickerRows.length === 0) {
            await runDbQuery("INSERT INTO stock_tickers (symbol) VALUES (?)", [symbol.toUpperCase()]);
            tickerRows = await runDbQuery("SELECT id FROM stock_tickers WHERE symbol = ?", [symbol.toUpperCase()]);
        }
        tickerId = tickerRows[0].id;
        let baselinePrice = null;
        const priceResult = await fetchCurrentPrice(symbol);
        if (priceResult) {
            baselinePrice = priceResult.price;
        }
        let predictedReturnPct = null;
        if (prediction_type === "price" && predicted_price != null && baselinePrice != null && baselinePrice > 0) {
            predictedReturnPct = ((predicted_price - baselinePrice) / baselinePrice) * 100;
        }
        await runDbQuery(`INSERT INTO stock_forecasts (user_id, ticker_id, horizon_days, target_date, prediction_type, predicted_price, predicted_return_pct, predicted_direction, baseline_price, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [effectiveUserId, tickerId, horizon, effectiveTargetDate, prediction_type, predicted_price || null, predictedReturnPct, predicted_direction || null, baselinePrice, notes || null]);
        const inserted = await runDbQuery("SELECT sf.*, st.symbol AS ticker_symbol FROM stock_forecasts sf JOIN stock_tickers st ON sf.ticker_id = st.id WHERE sf.id = LAST_INSERT_ID()");
        res.json({ forecast: inserted[0] });
    }
    catch (error) {
        console.error("Create forecast error:", error);
        res.status(500).json({ error: error.message || "Failed to create forecast" });
    }
});
app.get("/api/stocks/forecasts", async (req, res) => {
    try {
        const { status, symbol, from, to, user_id, limit, offset } = req.query;
        const effectiveUserId = user_id || 1;
        const conditions = ["sf.user_id = ?"];
        const params = [effectiveUserId];
        if (status) {
            conditions.push("sf.status = ?");
            params.push(status);
        }
        if (symbol) {
            conditions.push("st.symbol = ?");
            params.push(symbol.toUpperCase());
        }
        if (from) {
            conditions.push("sf.created_at >= ?");
            params.push(from);
        }
        if (to) {
            conditions.push("sf.created_at <= ?");
            params.push(to);
        }
        const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
        const lim = limit ? parseInt(limit, 10) : 50;
        const off = offset ? parseInt(offset, 10) : 0;
        const countRows = await runDbQuery(`SELECT COUNT(*) as total FROM stock_forecasts sf JOIN stock_tickers st ON sf.ticker_id = st.id ${where}`, params);
        const total = countRows[0]?.total || 0;
        const forecasts = await runDbQuery(`SELECT sf.*, st.symbol AS ticker_symbol FROM stock_forecasts sf JOIN stock_tickers st ON sf.ticker_id = st.id ${where} ORDER BY sf.created_at DESC LIMIT ? OFFSET ?`, [...params, lim, off]);
        res.json({ forecasts, total: Number(total) });
    }
    catch (error) {
        console.error("List forecasts error:", error);
        res.status(500).json({ error: error.message || "Failed to list forecasts" });
    }
});
app.get("/api/stocks/forecasts/stats", async (req, res) => {
    try {
        const effectiveUserId = req.query.user_id || 1;
        const rows = await runDbQuery(`SELECT
         COUNT(*) as totalForecasts,
         SUM(CASE WHEN status = 'evaluated' THEN 1 ELSE 0 END) as evaluatedCount,
         AVG(CASE WHEN status = 'evaluated' AND absolute_error_price IS NOT NULL THEN absolute_error_price END) as meanAbsoluteErrorPrice,
         AVG(CASE WHEN status = 'evaluated' AND absolute_error_pct IS NOT NULL THEN absolute_error_pct END) as meanAbsoluteErrorPct
       FROM stock_forecasts WHERE user_id = ?`, [effectiveUserId]);
        const directionRows = await runDbQuery(`SELECT
         COUNT(*) as total,
         SUM(CASE
           WHEN predicted_direction = 'up' AND actual_return_pct > 0 THEN 1
           WHEN predicted_direction = 'down' AND actual_return_pct < 0 THEN 1
           WHEN predicted_direction = 'flat' AND ABS(actual_return_pct) < 1 THEN 1
           ELSE 0
         END) as correct
       FROM stock_forecasts
       WHERE user_id = ? AND status = 'evaluated' AND predicted_direction IS NOT NULL`, [effectiveUserId]);
        const stats = rows[0] || {};
        const dirStats = directionRows[0] || {};
        const dirHitRate = dirStats.total > 0 ? (Number(dirStats.correct) / Number(dirStats.total)) * 100 : null;
        res.json({
            totalForecasts: Number(stats.totalForecasts) || 0,
            evaluatedCount: Number(stats.evaluatedCount) || 0,
            meanAbsoluteErrorPrice: stats.meanAbsoluteErrorPrice != null ? Number(stats.meanAbsoluteErrorPrice) : null,
            meanAbsoluteErrorPct: stats.meanAbsoluteErrorPct != null ? Number(stats.meanAbsoluteErrorPct) : null,
            directionHitRate: dirHitRate,
        });
    }
    catch (error) {
        console.error("Forecast stats error:", error);
        res.status(500).json({ error: error.message || "Failed to get forecast stats" });
    }
});
app.get("/api/stocks/forecasts/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const rows = await runDbQuery("SELECT sf.*, st.symbol AS ticker_symbol FROM stock_forecasts sf JOIN stock_tickers st ON sf.ticker_id = st.id WHERE sf.id = ?", [id]);
        if (rows.length === 0) {
            res.status(404).json({ error: "Forecast not found" });
            return;
        }
        res.json({ forecast: rows[0] });
    }
    catch (error) {
        console.error("Get forecast error:", error);
        res.status(500).json({ error: error.message || "Failed to get forecast" });
    }
});
app.delete("/api/stocks/forecasts/:id", async (req, res) => {
    try {
        const { id } = req.params;
        await runDbQuery("DELETE FROM stock_forecasts WHERE id = ?", [id]);
        res.json({ ok: true });
    }
    catch (error) {
        console.error("Delete forecast error:", error);
        res.status(500).json({ error: error.message || "Failed to delete forecast" });
    }
});
app.post("/api/stocks/forecasts/evaluate-due", requireAdmin, async (req, res) => {
    try {
        const dueForecasts = await runDbQuery("SELECT sf.*, st.symbol FROM stock_forecasts sf JOIN stock_tickers st ON sf.ticker_id = st.id WHERE sf.status = 'pending' AND sf.target_date <= CURDATE()");
        if (dueForecasts.length === 0) {
            res.json({ evaluatedCount: 0, errors: [] });
            return;
        }
        const errors = [];
        let evaluatedCount = 0;
        for (const forecast of dueForecasts) {
            try {
                const priceResult = await fetchPriceForDate(forecast.symbol, forecast.target_date);
                if (!priceResult) {
                    errors.push(`Could not fetch price for ${forecast.symbol} on ${forecast.target_date}`);
                    continue;
                }
                const actualPrice = priceResult.price;
                let actualReturnPct = null;
                let absErrorPrice = null;
                let absErrorPct = null;
                if (forecast.baseline_price && Number(forecast.baseline_price) > 0) {
                    actualReturnPct = ((actualPrice - Number(forecast.baseline_price)) / Number(forecast.baseline_price)) * 100;
                }
                if (forecast.predicted_price != null) {
                    absErrorPrice = Math.abs(Number(forecast.predicted_price) - actualPrice);
                }
                if (forecast.predicted_return_pct != null && actualReturnPct != null) {
                    absErrorPct = Math.abs(Number(forecast.predicted_return_pct) - actualReturnPct);
                }
                await runDbQuery("UPDATE stock_forecasts SET status = 'evaluated', evaluated_at = NOW(), actual_price = ?, actual_return_pct = ?, absolute_error_price = ?, absolute_error_pct = ? WHERE id = ?", [actualPrice, actualReturnPct, absErrorPrice, absErrorPct, forecast.id]);
                evaluatedCount++;
            }
            catch (err) {
                errors.push(`Error evaluating forecast #${forecast.id}: ${err.message}`);
            }
        }
        res.json({ evaluatedCount, errors });
        await logActivity("stock_forecast_evaluated", `Evaluated ${evaluatedCount} pending forecasts`, { evaluated: evaluatedCount, errors: errors.length });
    }
    catch (error) {
        console.error("Evaluate forecasts error:", error);
        res.status(500).json({ error: error.message || "Failed to evaluate forecasts" });
    }
});
app.post("/api/analyze", async (req, res) => {
    try {
        const { symbol, horizon, scenario, source } = req.body;
        if (!symbol) {
            res.status(400).json({ error: "symbol is required" });
            return;
        }
        const dataSource = source === "Real"
            ? DataSource.Real
            : source === "Hybrid"
                ? DataSource.Hybrid
                : DataSource.Mock;
        const ctx = {
            horizon: horizon || "1m",
            scenario: scenario || "base",
            source: dataSource,
        };
        const analyzer = createAnalyzer(dataSource);
        const analysis = await analyzer.analyzeAsset(symbol.toUpperCase(), ctx);
        res.json({ analysis });
    }
    catch (error) {
        console.error("Analyze error:", error);
        res.status(500).json({ error: error.message || "Failed to analyze asset" });
    }
});
app.get("/api/analyze/sources", (req, res) => {
    res.json({
        sources: [
            { id: "Mock", name: "Mock", description: "Synthetic/mock data for testing" },
            { id: "Real", name: "Real", description: "Real market data from Yahoo Finance" },
            { id: "Hybrid", name: "Hybrid", description: "Real prices with mock scenarios" },
        ],
    });
});
// Agent Lightning Training Endpoint
app.post("/api/agentlightning/train", async (req, res) => {
    try {
        const { agentId } = req.body;
        // Simulate training process
        console.log(`Starting agent lightning training for agent: ${agentId || 'anonymous'}`);
        // In a real implementation, this would trigger actual training
        // For now, we'll return a success response
        res.json({
            ok: true,
            status: "completed",
            message: `Agent lightning training started for ${agentId || 'anonymous'}`,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error("Agent lightning training error:", error);
        res.status(500).json({
            ok: false,
            error: error.message || "Failed to start training"
        });
    }
});
// Cooler Talk Endpoint - Agents gather in kitchen for casual chat
const KITCHEN_COOLER_POSITIONS = [
    { x: 870, y: 130 },
    { x: 930, y: 130 },
    { x: 900, y: 150 },
    { x: 860, y: 160 },
    { x: 940, y: 160 },
    { x: 900, y: 180 },
];
const AGENT_NAMES = [
    "FrontDesk", "IronClaw", "ZeroClaw", "HermitClaw", "OpenClaw", "LeslieClaw", "Sherlobster", "Hercule Prawnro"
];
const COOLER_TOPICS = [
    "weekend plans",
    "the coffee machine",
    "latest office gossip",
    "that weird noise from the basement",
    "whether the AC is broken",
    "who took the last donut",
    "the new memo from management",
    "the ping pong tournament",
    "their cat's latest trick",
    "the weather",
];
const coolerTalkLog = [];
async function generateCoolerTalk(agentName, otherAgents, topic) {
    const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
    const prompt = `You are ${agentName}, a character in a pixel art office simulation. Have a brief, casual conversation with your coworkers about "${topic}". 
Keep your response very short (1-2 sentences max), casual, and in character. Something a coworker would say at the water cooler.`;
    try {
        const response = await fetch(`${ollamaUrl}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "gemma",
                messages: [
                    { role: "system", content: prompt },
                    { role: "user", content: `You turn to talk to ${otherAgents.join(", ")} by the water cooler.` }
                ],
                stream: false
            })
        });
        if (!response.ok) {
            return getFallbackDialogue(agentName, topic);
        }
        const data = await response.json();
        return data.message?.content?.substring(0, 100) || getFallbackDialogue(agentName, topic);
    }
    catch (error) {
        console.error("Ollama error in cooler talk:", error);
        return getFallbackDialogue(agentName, topic);
    }
}
function getFallbackDialogue(agentName, topic) {
    const fallbacks = {
        "FrontDesk": ["Did you hear about the new schedule?", "This coffee is amazing!", "Only 2 more days until Friday!"],
        "IronClaw": ["I fixed the leak in the breakroom.", "Anyone else hungry?", "The weekend can't come soon enough."],
        "ZeroClaw": ["Has anyone seen my notebook?", "This project is going well!", "I love the office atmosphere."],
        "HermitClaw": ["I found something interesting in the archives.", "Quiet day today.", "Anyone want to discuss the new system?"],
        "OpenClaw": ["The reports are all filed.", "Great teamwork everyone!", "Let's grab lunch together."],
        "LeslieClaw": ["Meeting at 3pm everyone!", "Good work on the quarterly numbers.", "We need to discuss the new strategy."],
        "Sherlobster": ["Has anyone seen ClawGuard?", "I had the weirdest dream last night.", "This is quite the place!"],
        "Hercule Prawnro": ["The data looks promising!", "We should celebrate soon.", "Who wants to play ping pong?"],
    };
    const options = fallbacks[agentName] || ["Great weather today!", "Interesting topic!", "I was just thinking the same thing."];
    return options[Math.floor(Math.random() * options.length)];
}
app.post("/api/coolertalk", async (req, res) => {
    try {
        const sessionId = `ct-${Date.now()}`;
        console.log(`[CoolerTalk] Starting session ${sessionId}...`);
        // Select 4-6 random agents to participate
        const numParticipants = 4 + Math.floor(Math.random() * 3);
        const shuffled = [...AGENT_NAMES].sort(() => Math.random() - 0.5);
        const participants = shuffled.slice(0, numParticipants);
        // Pick topic
        const topic = COOLER_TOPICS[Math.floor(Math.random() * COOLER_TOPICS.length)];
        // Create conversation session
        const session = createCoolerSession(topic, participants);
        // Assign kitchen positions
        const assignments = participants.map((name, idx) => ({
            agentId: name.toLowerCase().replace(/ /g, "-"),
            name: name,
            targetX: KITCHEN_COOLER_POSITIONS[idx].x,
            targetY: KITCHEN_COOLER_POSITIONS[idx].y,
        }));
        // Generate chained conversation
        const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
        // Helper function to fetch with longer timeout
        const fetchWithTimeout = async (url, options, timeout = 60000) => {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), timeout);
            try {
                const response = await fetch(url, { ...options, signal: controller.signal });
                clearTimeout(id);
                return response;
            }
            catch (e) {
                clearTimeout(id);
                throw e;
            }
        };
        for (let i = 0; i < participants.length; i++) {
            const agentName = participants[i];
            const intent = getNextIntent(session);
            const prompt = buildTurnPrompt(session, agentName, intent);
            let text = "";
            let attempts = 0;
            let valid = false;
            // Longer timeout (60s) and more retries (5)
            // Try up to 5 times to get a valid utterance
            while (!valid && attempts < 5) {
                try {
                    console.log(`[CoolerTalk] Calling ollama for ${agentName} (intent: ${intent})...`);
                    console.log(`[CoolerTalk] Prompt: ${prompt.substring(0, 200)}...`);
                    const response = await fetchWithTimeout(`${ollamaUrl}/api/chat`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            model: "gemma",
                            messages: [
                                { role: "system", content: prompt },
                                { role: "user", content: "Write your line now. Keep it short and conversational." }
                            ],
                            stream: false
                        })
                    }, 30000);
                    if (response.ok) {
                        const data = await response.json();
                        text = data.message?.content?.trim() || "";
                        console.log(`[CoolerTalk] Ollama response: "${text.substring(0, 80)}..."`);
                        // Clean up any quotes
                        if (text.startsWith('"') && text.endsWith('"')) {
                            text = text.slice(1, -1);
                        }
                    }
                    else {
                        const errorText = await response.text();
                        console.error(`[CoolerTalk] Ollama error ${response.status}:`, errorText);
                    }
                }
                catch (e) {
                    if (e.name === 'AbortError') {
                        console.error("[CoolerTalk] Ollama timeout after 60s - using fallback");
                    }
                    else {
                        console.error("[CoolerTalk] Ollama error:", e.message);
                    }
                }
                // Fallback if empty or error
                if (!text) {
                    console.log(`[CoolerTalk] No response from ollama, using fallback for ${agentName}`);
                    text = getFallbackDialogue(agentName, topic);
                }
                const utterance = {
                    speaker: agentName,
                    text,
                    intent,
                    replyTo: session.utterances.length > 0 ? session.utterances.length - 1 : null,
                };
                const validation = validateUtterance(utterance, session, session.utterances);
                valid = validation.valid;
                if (!valid) {
                    console.log(`[CoolerTalk] REJECTED (${validation.rejected_reasons.join(", ")}): "${text}"`);
                    attempts++;
                    // After max retries, use repair strategy (deterministic template)
                    if (attempts >= 5) {
                        const prevText = session.utterances.length > 0
                            ? session.utterances[session.utterances.length - 1].text
                            : undefined;
                        text = getRepairText(intent, topic, prevText);
                        console.log(`[CoolerTalk] REPAIR used for ${agentName}: "${text}"`);
                        // Create new utterance with repair text
                        const repairUtterance = {
                            speaker: agentName,
                            text,
                            intent,
                            replyTo: session.utterances.length > 0 ? session.utterances.length - 1 : null,
                        };
                        session.utterances.push(repairUtterance);
                        addUtteranceToHistory(session, repairUtterance);
                        session.validationDetails.push({ valid: true, retries: attempts, rejected_reasons: validation.rejected_reasons });
                        session.currentTurn++;
                        valid = true; // Force accept repair
                    }
                }
                else {
                    session.utterances.push(utterance);
                    addUtteranceToHistory(session, utterance);
                    session.validationDetails.push(validation);
                    session.currentTurn++;
                }
            }
            // Delay between turns to let ollama process (skip on last participant)
            if (i < participants.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
        }
        // Console log with validation details
        const topicKeywords = session.topicKeywords || [];
        console.log(`[CoolerTalk] Session ${session.id} - Topic: "${topic}"`);
        console.log(`[CoolerTalk] Keywords: ${topicKeywords.join(", ")}`);
        console.log(`[CoolerTalk] Participants: ${participants.join(", ")}`);
        session.utterances.forEach((u, i) => {
            const details = session.validationDetails[i];
            const retryInfo = details ? ` [retries:${details.retries}, reasons:${details.rejected_reasons.join(";")}]` : "";
            console.log(`[CoolerTalk] ${u.speaker} (${u.intent}): "${u.text}"${retryInfo}`);
        });
        // Format dialogues for client (speech bubbles) - with staggered timing
        // Each bubble shows for 8 seconds, then next one appears after 3 seconds
        // Also add a 3 second initial delay for agents to "get their drinks"
        const dialogueStartDelay = 3000;
        const dialogues = session.utterances.map((u, idx) => ({
            agentId: u.speaker.toLowerCase().replace(/ /g, "-"),
            text: u.text,
            intent: u.intent,
            showAt: Date.now() + dialogueStartDelay + (idx * 3000), // 3s initial, then 3s between
            expiresAt: Date.now() + dialogueStartDelay + (idx * 3000) + 8000, // show for 8s each
        }));
        // Build structured log entry
        const logEntry = {
            timestamp: new Date().toISOString(),
            sessionId: session.id,
            topic,
            participants,
            utterances: session.utterances.map(u => ({
                speaker: u.speaker,
                text: u.text,
                intent: u.intent,
                reply_to: u.replyTo,
            })),
        };
        // Store in memory log
        coolerTalkLog.push(logEntry);
        if (coolerTalkLog.length > 10)
            coolerTalkLog.shift();
        // Save to markdown file with new format
        writeCoolerTalkToFile(session);
        res.json({
            ok: true,
            session_id: session.id,
            participant_count: participants.length,
            assignments: assignments,
            dialogues: dialogues,
            topic: topic,
            duration_ms: 60000,
            started_at: new Date().toISOString()
        });
    }
    catch (error) {
        console.error("Cooler talk error:", error);
        res.status(500).json({
            ok: false,
            error: error.message || "Failed to start cooler talk"
        });
    }
});
// Get cooler talk conversation log
app.get("/api/coolertalk/log", (req, res) => {
    res.json({
        sessions: coolerTalkLog
    });
});
// Get updated dialogue during cooler talk
app.get("/api/coolertalk/dialogue", async (req, res) => {
    try {
        const topic = COOLER_TOPICS[Math.floor(Math.random() * COOLER_TOPICS.length)];
        const agentName = AGENT_NAMES[Math.floor(Math.random() * AGENT_NAMES.length)];
        const otherAgents = AGENT_NAMES.filter(n => n !== agentName).slice(0, 3);
        const dialogue = await generateCoolerTalk(agentName, otherAgents, topic);
        res.json({
            agentId: agentName.toLowerCase().replace(/ /g, "-"),
            text: dialogue,
            expiresAt: Date.now() + 15000,
        });
    }
    catch (error) {
        console.error("Dialogue error:", error);
        res.status(500).json({ error: error.message });
    }
});
// AgentLightning Architecture
app.get("/api/agentlightning/architecture", (req, res) => {
    const archPath = "/home/sherlockhums/.openclaw/workspace-main/AGENTLIGHTNING_ROLE_ARCHITECTURE.yaml";
    try {
        const yamlContent = fs.readFileSync(archPath, "utf8");
        res.json({ yaml: yamlContent });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.listen(Number(PORT), "127.0.0.1", () => {
    console.log(`Pixel Office Live server running on http://localhost:${PORT}`);
    console.log(`Chat endpoint: http://localhost:${PORT}/api/chat`);
    console.log(`DB Tables: http://localhost:${PORT}/api/db/tables`);
});
async function callRoleDailyPlan(tasks, maxMinutes = 450, minSlot = 6, maxSlot = 18) {
    const systemMsg = `You are a workload planner for a single knowledge worker with ${maxMinutes} minutes of capacity per day. Tasks are ${minSlot}–${maxSlot} minutes each. You must produce a JSON plan that respects total capacity and uses only provided task_ids.`;
    const userPayload = {
        capacity_minutes: maxMinutes,
        min_slot_minutes: minSlot,
        max_slot_minutes: maxSlot,
        tasks: tasks.map((t) => ({
            id: t.id,
            title: t.title,
            description: t.description,
            priority: t.priority,
            estimated_minutes: t.estimated_minutes,
            due_date: t.due_date ? t.due_date.toISOString().split("T")[0] : null,
        })),
    };
    const userMsg = `Given the following open tasks and constraints, create a JSON object with keys \`summary\`, \`total_allocated_minutes\`, and \`items\` (a list of objects with \`task_id\`, \`allocated_minutes\`, and \`notes\`).\n\n` +
        `Constraints:\n` +
        `- Total allocated minutes <= ${maxMinutes}\n` +
        `- Each slot between ${minSlot} and ${maxSlot} minutes\n` +
        `- Use only task_ids from the list.\n` +
        `- Prefer higher priority and nearer due_date.\n\n` +
        `Tasks JSON:\n` +
        JSON.stringify(userPayload, null, 2);
    const messages = [
        { role: "system", content: systemMsg },
        { role: "user", content: userMsg },
    ];
    const result = await callChatModelForRole("workload_planner", messages, {
        temperature: 0.2,
    });
    const content = result.response;
    if (!content) {
        throw new Error("No response from LLM");
    }
    // Attempt to parse JSON from the response. 
    // Improved models will return pure JSON, but some might wrap it in markdown blocks.
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    const plan = JSON.parse(jsonStr);
    // Attach metadata
    plan.metadata = {
        role: result.role,
        model: result.model
    };
    return plan;
}
app.post("/api/daily_plan", async (req, res) => {
    try {
        const today = new Date().toISOString().split("T")[0];
        const tasks = await runDbQuery(`SELECT id, title, description, status, priority, estimated_minutes, due_date
       FROM tasks
       WHERE status IN ('open', 'in_progress')
       ORDER BY priority ASC, COALESCE(due_date, '9999-12-31') ASC, id ASC
       LIMIT 100`);
        if (tasks.length === 0) {
            res.json({ message: "No open tasks found.", plan: null });
            return;
        }
        let plan;
        try {
            plan = await callRoleDailyPlan(tasks);
        }
        catch (err) {
            res.status(500).json({ error: "Failed to generate plan", details: err.message });
            return;
        }
        const summary = plan.summary || "";
        const totalAllocated = parseInt(plan.total_allocated_minutes, 10) || 0;
        const items = plan.items || [];
        if (!items || items.length === 0) {
            res.status(500).json({ error: "Plan contained no items" });
            return;
        }
        await runDbQuery(`INSERT INTO daily_plans (plan_date, summary, total_allocated_minutes)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         summary = VALUES(summary),
         total_allocated_minutes = VALUES(total_allocated_minutes)`, [today, summary, totalAllocated]);
        const planRows = await runDbQuery("SELECT id FROM daily_plans WHERE plan_date = ?", [today]);
        const dailyPlanId = planRows[0].id;
        await runDbQuery("DELETE FROM daily_plan_items WHERE daily_plan_id = ?", [dailyPlanId]);
        let slotIndex = 1;
        for (const item of items) {
            const taskId = parseInt(item.task_id, 10);
            const allocMin = parseInt(item.allocated_minutes, 10) || 0;
            const notes = item.notes || "";
            if (allocMin <= 0)
                continue;
            await runDbQuery(`INSERT INTO daily_plan_items (daily_plan_id, task_id, slot_index, allocated_minutes, notes)
         VALUES (?, ?, ?, ?, ?)`, [dailyPlanId, taskId, slotIndex, allocMin, notes]);
            slotIndex++;
        }
        res.json({
            plan_date: today,
            summary,
            total_allocated_minutes: totalAllocated,
            items,
        });
    }
    catch (error) {
        console.error("Daily plan error:", error);
        res.status(500).json({ error: error.message || "Failed to generate daily plan" });
    }
});
app.get("/api/daily_plan", async (req, res) => {
    try {
        const today = new Date().toISOString().split("T")[0];
        const plans = await runDbQuery("SELECT * FROM daily_plans WHERE plan_date = ?", [today]);
        if (plans.length === 0) {
            res.json({ plan: null });
            return;
        }
        const plan = plans[0];
        const items = await runDbQuery(`SELECT dpi.*, t.title, t.description, t.priority, t.estimated_minutes
       FROM daily_plan_items dpi
       JOIN tasks t ON dpi.task_id = t.id
       WHERE dpi.daily_plan_id = ?
       ORDER BY dpi.slot_index`, [plan.id]);
        res.json({
            plan: {
                ...plan,
                items,
            },
        });
    }
    catch (error) {
        console.error("Get daily plan error:", error);
        res.status(500).json({ error: error.message || "Failed to get daily plan" });
    }
});
app.post("/api/tasks", async (req, res) => {
    try {
        // Proxy to Pixel-Me
        const resp = await fetch(`${PIXEL_ME_URL}/tasks`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(req.body),
        });
        const data = await resp.json();
        res.json(data);
    }
    catch (error) {
        console.error("Create task proxy error:", error);
        res.status(502).json({ ok: false, error: error.message });
    }
});
app.get("/api/tasks", async (req, res) => {
    try {
        // Proxy to Pixel-Me
        const status = req.query.status || "open";
        const project = req.query.project;
        let url = `${PIXEL_ME_URL}/tasks?status=${status}`;
        if (project)
            url += `&project=${project}`;
        const resp = await fetch(url);
        const data = await resp.json();
        res.json(data);
    }
    catch (error) {
        console.error("List tasks proxy error:", error);
        res.status(502).json({ ok: false, error: error.message });
    }
});
app.patch("/api/tasks/:id", async (req, res) => {
    try {
        // Proxy to Pixel-Me
        const { id } = req.params;
        const resp = await fetch(`${PIXEL_ME_URL}/tasks/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(req.body),
        });
        const data = await resp.json();
        res.json(data);
    }
    catch (error) {
        console.error("Update task proxy error:", error);
        res.status(502).json({ ok: false, error: error.message });
    }
});
app.delete("/api/tasks/:id", async (req, res) => {
    try {
        const { id } = req.params;
        await runDbQuery("DELETE FROM tasks WHERE id = ?", [id]);
        res.json({ ok: true });
    }
    catch (error) {
        console.error("Delete task error:", error);
        res.status(500).json({ error: error.message || "Failed to delete task" });
    }
});
app.get("/api/analytics/capacity", async (req, res) => {
    try {
        const results = await runDbQuery(`
      SELECT
        dp.plan_date,
        SUM(dpi.allocated_minutes) AS total_allocated_minutes,
        SUM(CASE WHEN t.status = 'done' THEN dpi.allocated_minutes ELSE 0 END) AS executed_minutes
      FROM daily_plans dp
      JOIN daily_plan_items dpi ON dp.id = dpi.daily_plan_id
      JOIN tasks t ON dpi.task_id = t.id
      GROUP BY dp.plan_date
      ORDER BY dp.plan_date DESC
    `);
        res.json({ capacity: results });
    }
    catch (error) {
        console.error("Analytics capacity error:", error);
        res.status(500).json({ error: error.message || "Failed to get capacity analytics" });
    }
});
const workflowTasks = new Map();
function generateTaskId() {
    return `task_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}
async function fetchGitHubFile(owner, repo, path, token) {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "PixelOffice/1.0"
    };
    if (token) {
        headers["Authorization"] = `token ${token}`;
    }
    try {
        const response = await fetch(url, { headers });
        if (!response.ok) {
            const error = await response.text();
            console.error(`GitHub API error: ${response.status} - ${error}`);
            return null;
        }
        const data = await response.json();
        if (data.content) {
            const content = Buffer.from(data.content, 'base64').toString('utf-8');
            return { content, sha: data.sha };
        }
        return null;
    }
    catch (error) {
        console.error("GitHub fetch error:", error);
        return null;
    }
}
async function fetchGitHubREADME(owner, repo, token) {
    const readmeNames = ['README.md', 'README.rst', 'README.txt', 'README'];
    for (const name of readmeNames) {
        const result = await fetchGitHubFile(owner, repo, name, token);
        if (result) {
            return result.content;
        }
    }
    return null;
}
// Create new workflow task (entry point)
app.post("/api/workflow/create", async (req, res) => {
    try {
        const { workflowType, requester, summary, inputs, priority = "normal" } = req.body;
        if (!workflowType || !requester) {
            res.status(400).json({ error: "workflowType and requester are required" });
            return;
        }
        const taskId = generateTaskId();
        const now = new Date().toISOString();
        const task = {
            id: taskId,
            workflowType,
            status: "queued",
            currentOwner: "receptionist",
            requester,
            summary: summary || "",
            inputs: inputs || {},
            worklog: [{
                    timestamp: now,
                    agent: "system",
                    action: "ticket_created",
                    note: `New ${workflowType} workflow created by ${requester}`
                }],
            artifacts: [],
            createdAt: now,
            priority
        };
        workflowTasks.set(taskId, task);
        res.json({
            taskId,
            status: task.status,
            currentOwner: task.currentOwner,
            message: "Task created and queued for receptionist"
        });
    }
    catch (error) {
        console.error("Workflow create error:", error);
        res.status(500).json({ error: error.message || "Failed to create workflow task" });
    }
});
// Receptionist processes the task
app.post("/api/workflow/receptionist/process", async (req, res) => {
    try {
        const { taskId, extractedSummary, extractedInputs } = req.body;
        if (!taskId) {
            res.status(400).json({ error: "taskId is required" });
            return;
        }
        const task = workflowTasks.get(taskId);
        if (!task) {
            res.status(404).json({ error: "Task not found" });
            return;
        }
        if (task.currentOwner !== "receptionist") {
            res.status(400).json({ error: `Task is currently owned by ${task.currentOwner}` });
            return;
        }
        const now = new Date().toISOString();
        task.summary = extractedSummary || task.summary;
        task.inputs = { ...task.inputs, ...extractedInputs };
        task.status = "in_progress";
        task.currentOwner = "clerk";
        task.worklog.push({
            timestamp: now,
            agent: "receptionist",
            action: "ticket_processed",
            note: `Extracted: ${task.summary}`
        });
        workflowTasks.set(taskId, task);
        res.json({
            taskId,
            status: task.status,
            currentOwner: task.currentOwner,
            message: "Task processed by receptionist, assigned to clerk"
        });
    }
    catch (error) {
        console.error("Receptionist process error:", error);
        res.status(500).json({ error: error.message || "Failed to process task" });
    }
});
// Clerk assigns task to specialist
app.post("/api/workflow/clerk/assign", async (req, res) => {
    try {
        const { taskId, specialistId } = req.body;
        if (!taskId) {
            res.status(400).json({ error: "taskId is required" });
            return;
        }
        const task = workflowTasks.get(taskId);
        if (!task) {
            res.status(404).json({ error: "Task not found" });
            return;
        }
        if (task.currentOwner !== "clerk") {
            res.status(400).json({ error: `Task is currently owned by ${task.currentOwner}` });
            return;
        }
        const now = new Date().toISOString();
        task.status = "in_progress";
        task.currentOwner = specialistId || "specialist";
        task.worklog.push({
            timestamp: now,
            agent: "clerk",
            action: "assigned",
            note: `Assigned to ${task.currentOwner}`
        });
        workflowTasks.set(taskId, task);
        res.json({
            taskId,
            status: task.status,
            currentOwner: task.currentOwner,
            message: `Task assigned to ${task.currentOwner}`
        });
    }
    catch (error) {
        console.error("Clerk assign error:", error);
        res.status(500).json({ error: error.message || "Failed to assign task" });
    }
});
// Specialist reviews and adds content
app.post("/api/workflow/specialist/review", async (req, res) => {
    try {
        const { taskId, reviewResult, approved = true } = req.body;
        if (!taskId) {
            res.status(400).json({ error: "taskId is required" });
            return;
        }
        const task = workflowTasks.get(taskId);
        if (!task) {
            res.status(404).json({ error: "Task not found" });
            return;
        }
        if (task.currentOwner !== "specialist") {
            res.status(400).json({ error: `Task is currently owned by ${task.currentOwner}` });
            return;
        }
        const now = new Date().toISOString();
        task.status = approved ? "awaiting_review" : "failed";
        task.currentOwner = "clerk";
        task.worklog.push({
            timestamp: now,
            agent: "specialist",
            action: "reviewed",
            note: reviewResult || (approved ? "Approved" : "Rejected")
        });
        workflowTasks.set(taskId, task);
        res.json({
            taskId,
            status: task.status,
            currentOwner: task.currentOwner,
            message: approved ? "Task reviewed and awaiting delivery" : "Task rejected"
        });
    }
    catch (error) {
        console.error("Specialist review error:", error);
        res.status(500).json({ error: error.message || "Failed to review task" });
    }
});
// Archivist archives the completed task
app.post("/api/workflow/archivist/complete", async (req, res) => {
    try {
        const { taskId, response, artifacts = [] } = req.body;
        if (!taskId) {
            res.status(400).json({ error: "taskId is required" });
            return;
        }
        const task = workflowTasks.get(taskId);
        if (!task) {
            res.status(404).json({ error: "Task not found" });
            return;
        }
        const now = new Date().toISOString();
        task.status = "completed";
        task.response = response;
        task.artifacts = artifacts;
        task.worklog.push({
            timestamp: now,
            agent: "archivist",
            action: "completed",
            note: "Task completed and archived"
        });
        workflowTasks.set(taskId, task);
        res.json({
            taskId,
            status: task.status,
            response: task.response,
            message: "Task completed and archived"
        });
    }
    catch (error) {
        console.error("Archivist complete error:", error);
        res.status(500).json({ error: error.message || "Failed to complete task" });
    }
});
// Get task status
app.get("/api/workflow/:taskId", (req, res) => {
    try {
        const { taskId } = req.params;
        const task = workflowTasks.get(taskId);
        if (!task) {
            res.status(404).json({ error: "Task not found" });
            return;
        }
        res.json({ task });
    }
    catch (error) {
        console.error("Get workflow error:", error);
        res.status(500).json({ error: error.message || "Failed to get task" });
    }
});
// GitHub file retrieval endpoint (triggers full workflow)
app.post("/api/workflow/github/readme", async (req, res) => {
    try {
        const { owner, repo, requester, token } = req.body;
        if (!owner || !repo) {
            res.status(400).json({ error: "owner and repo are required" });
            return;
        }
        // Step 1: Create task
        const taskId = generateTaskId();
        const now = new Date().toISOString();
        const task = {
            id: taskId,
            workflowType: "github_readme_retrieval",
            status: "queued",
            currentOwner: "receptionist",
            requester: requester || "user",
            summary: `Retrieve README from ${owner}/${repo}`,
            inputs: { owner, repo },
            worklog: [{
                    timestamp: now,
                    agent: "system",
                    action: "ticket_created",
                    note: `Request to retrieve README from ${owner}/${repo}`
                }],
            artifacts: [],
            createdAt: now,
            priority: "normal"
        };
        workflowTasks.set(taskId, task);
        // Step 2: Receptionist processes (synchronously for this endpoint)
        const extractedSummary = `Fetch README.md from GitHub repository ${owner}/${repo}`;
        task.summary = extractedSummary;
        task.status = "in_progress";
        task.currentOwner = "clerk";
        task.worklog.push({
            timestamp: new Date().toISOString(),
            agent: "receptionist",
            action: "ticket_processed",
            note: `Extracted: ${extractedSummary}`
        });
        workflowTasks.set(taskId, task);
        // Step 3: Clerk assigns to specialist
        task.currentOwner = "specialist";
        task.worklog.push({
            timestamp: new Date().toISOString(),
            agent: "clerk",
            action: "assigned",
            note: "Assigned to specialist for retrieval"
        });
        workflowTasks.set(taskId, task);
        // Step 4: Fetch the README
        const readmeContent = await fetchGitHubREADME(owner, repo, token);
        if (!readmeContent) {
            task.status = "failed";
            task.currentOwner = "clerk";
            task.worklog.push({
                timestamp: new Date().toISOString(),
                agent: "specialist",
                action: "failed",
                note: `Could not find README in ${owner}/${repo}`
            });
            task.response = `I couldn't find a README file in the repository ${owner}/${repo}. Please check the repository name and try again.`;
            workflowTasks.set(taskId, task);
            res.json({
                taskId,
                status: task.status,
                response: task.response,
                worklog: task.worklog
            });
            return;
        }
        // Step 5: Specialist approves with content
        const truncatedContent = readmeContent.length > 5000
            ? readmeContent.substring(0, 5000) + "\n\n... (truncated)"
            : readmeContent;
        task.artifacts.push({ type: "file", content: readmeContent });
        task.worklog.push({
            timestamp: new Date().toISOString(),
            agent: "specialist",
            action: "reviewed",
            note: "Successfully retrieved README"
        });
        workflowTasks.set(taskId, task);
        // Step 6: Archivist completes
        task.status = "completed";
        task.currentOwner = "archivist";
        task.response = `Here's the README from ${owner}/${repo}:\n\n${truncatedContent}`;
        task.worklog.push({
            timestamp: new Date().toISOString(),
            agent: "archivist",
            action: "completed",
            note: "Task completed and archived"
        });
        workflowTasks.set(taskId, task);
        res.json({
            taskId,
            status: task.status,
            summary: task.summary,
            response: task.response,
            artifacts: task.artifacts,
            worklog: task.worklog
        });
    }
    catch (error) {
        console.error("GitHub README workflow error:", error);
        res.status(500).json({ error: error.message || "Failed to retrieve README" });
    }
});
// Health check for workflow system
app.get("/api/workflow/health", (req, res) => {
    res.json({
        status: "healthy",
        activeTasks: workflowTasks.size,
        timestamp: new Date().toISOString()
    });
});
