export var DataSource;
(function (DataSource) {
    DataSource["Real"] = "Real";
    DataSource["Mock"] = "Mock";
    DataSource["Hybrid"] = "Hybrid";
})(DataSource || (DataSource = {}));
function generateMockPrice(symbol) {
    const basePrice = Math.random() * 500 + 50;
    const changePct = (Math.random() - 0.5) * 10;
    return {
        symbol: symbol.toUpperCase(),
        current: parseFloat(basePrice.toFixed(2)),
        change_pct: parseFloat(changePct.toFixed(2)),
        volume: Math.floor(Math.random() * 10000000) + 1000000,
    };
}
function generateMockScenarios(symbol, horizon, currentPrice) {
    return [
        {
            scenario: "base",
            horizon,
            price_target: parseFloat((currentPrice * (1 + (Math.random() - 0.5) * 0.1)).toFixed(2)),
            confidence: parseFloat((0.5 + Math.random() * 0.3).toFixed(2)),
            rationale: "Based on historical trends and current market conditions.",
        },
        {
            scenario: "bull",
            horizon,
            price_target: parseFloat((currentPrice * (1 + Math.random() * 0.2)).toFixed(2)),
            confidence: parseFloat((0.3 + Math.random() * 0.2).toFixed(2)),
            rationale: "Positive momentum and favorable industry tailwinds.",
        },
        {
            scenario: "bear",
            horizon,
            price_target: parseFloat((currentPrice * (1 - Math.random() * 0.15)).toFixed(2)),
            confidence: parseFloat((0.3 + Math.random() * 0.2).toFixed(2)),
            rationale: "Macroeconomic headwinds and potential earnings slowdown.",
        },
        {
            scenario: "stress",
            horizon,
            price_target: parseFloat((currentPrice * (1 - Math.random() * 0.3)).toFixed(2)),
            confidence: parseFloat((0.2 + Math.random() * 0.15).toFixed(2)),
            rationale: "Extreme adverse scenario simulation.",
        },
    ];
}
function generateMockRiskProfile(symbol, currentPrice) {
    const volatility = parseFloat((0.1 + Math.random() * 0.3).toFixed(2));
    const maxDrawdown = parseFloat((volatility * (1 + Math.random())).toFixed(2));
    return {
        volatility,
        max_drawdown: maxDrawdown > 1 ? 0.99 : maxDrawdown,
        notes: `Mock risk assessment for ${symbol}.`,
    };
}
export class MockAnalyzer {
    async analyzeAsset(symbol, ctx) {
        const priceSnapshot = generateMockPrice(symbol);
        const scenarios = generateMockScenarios(symbol, ctx.horizon, priceSnapshot.current);
        const riskProfile = generateMockRiskProfile(symbol, priceSnapshot.current);
        return {
            symbol: symbol.toUpperCase(),
            price_snapshot: priceSnapshot,
            fundamentals: null,
            technical: null,
            risk_profile: riskProfile,
            scenarios,
        };
    }
}
export class RealAnalyzer {
    async analyzeAsset(symbol, ctx) {
        let priceSnapshot = null;
        try {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`;
            const res = await fetch(url, { headers: { "User-Agent": "PixelOffice/1.0" } });
            if (res.ok) {
                const data = await res.json();
                const meta = data?.chart?.result?.[0]?.meta;
                if (meta?.regularMarketPrice) {
                    priceSnapshot = {
                        symbol: symbol.toUpperCase(),
                        current: meta.regularMarketPrice,
                        change_pct: 0,
                        volume: null,
                    };
                }
            }
        }
        catch { }
        const scenarios = [];
        if (ctx.scenario && ctx.scenario !== "base" && priceSnapshot) {
            const basePrice = priceSnapshot.current;
            let multiplier = 1;
            let rationale = "";
            switch (ctx.scenario) {
                case "bull":
                    multiplier = 1 + Math.random() * 0.15;
                    rationale = "Bullish scenario.";
                    break;
                case "bear":
                    multiplier = 1 - Math.random() * 0.1;
                    rationale = "Bearish scenario.";
                    break;
                case "stress":
                    multiplier = 1 - Math.random() * 0.2;
                    rationale = "Stress test.";
                    break;
                default: multiplier = 1;
            }
            scenarios.push({
                scenario: ctx.scenario,
                horizon: ctx.horizon,
                price_target: parseFloat((basePrice * multiplier).toFixed(2)),
                confidence: parseFloat((0.4 + Math.random() * 0.3).toFixed(2)),
                rationale,
            });
        }
        return {
            symbol: symbol.toUpperCase(),
            price_snapshot: priceSnapshot,
            fundamentals: null,
            technical: null,
            risk_profile: priceSnapshot ? { volatility: null, max_drawdown: null, notes: `Real data for ${symbol}.` } : null,
            scenarios,
        };
    }
}
export class HybridAnalyzer {
    constructor() {
        this.mock = new MockAnalyzer();
        this.real = new RealAnalyzer();
    }
    async analyzeAsset(symbol, ctx) {
        const [realResult, mockResult] = await Promise.all([
            this.real.analyzeAsset(symbol, { ...ctx, source: DataSource.Real }),
            this.mock.analyzeAsset(symbol, { ...ctx, source: DataSource.Mock }),
        ]);
        return {
            symbol: realResult.symbol || mockResult.symbol,
            price_snapshot: realResult.price_snapshot || mockResult.price_snapshot,
            fundamentals: realResult.fundamentals || mockResult.fundamentals,
            technical: realResult.technical || mockResult.technical,
            risk_profile: realResult.risk_profile || mockResult.risk_profile,
            scenarios: mockResult.scenarios,
        };
    }
}
export function createAnalyzer(source) {
    switch (source) {
        case DataSource.Mock: return new MockAnalyzer();
        case DataSource.Real: return new RealAnalyzer();
        case DataSource.Hybrid: return new HybridAnalyzer();
        default: return new MockAnalyzer();
    }
}
