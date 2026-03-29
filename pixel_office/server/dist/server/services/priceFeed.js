export async function fetchCurrentPrice(symbol) {
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`;
        const res = await fetch(url, {
            headers: { "User-Agent": "PixelOffice/1.0" },
        });
        if (!res.ok)
            return null;
        const data = await res.json();
        const meta = data?.chart?.result?.[0]?.meta;
        if (!meta?.regularMarketPrice)
            return null;
        return {
            symbol: symbol.toUpperCase(),
            price: meta.regularMarketPrice,
            date: new Date().toISOString().split("T")[0],
            source: "yahoo_finance",
        };
    }
    catch {
        return null;
    }
}
export async function fetchPriceForDate(symbol, date) {
    try {
        const targetDate = new Date(date);
        const period1 = Math.floor(targetDate.getTime() / 1000) - 86400 * 5;
        const period2 = Math.floor(targetDate.getTime() / 1000) + 86400;
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=1d`;
        const res = await fetch(url, {
            headers: { "User-Agent": "PixelOffice/1.0" },
        });
        if (!res.ok)
            return null;
        const data = await res.json();
        const result = data?.chart?.result?.[0];
        const timestamps = result?.timestamp;
        const closes = result?.indicators?.quote?.[0]?.close;
        if (!timestamps?.length || !closes?.length)
            return null;
        const targetTs = targetDate.getTime() / 1000;
        let bestIdx = 0;
        let bestDiff = Math.abs(timestamps[0] - targetTs);
        for (let i = 1; i < timestamps.length; i++) {
            const diff = Math.abs(timestamps[i] - targetTs);
            if (diff < bestDiff) {
                bestDiff = diff;
                bestIdx = i;
            }
        }
        const price = closes[bestIdx];
        if (price == null)
            return null;
        const actualDate = new Date(timestamps[bestIdx] * 1000).toISOString().split("T")[0];
        return {
            symbol: symbol.toUpperCase(),
            price,
            date: actualDate,
            source: "yahoo_finance",
        };
    }
    catch {
        return null;
    }
}
