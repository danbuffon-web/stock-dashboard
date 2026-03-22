import React, { useState, useEffect } from 'react';
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  ComposedChart,
  Bar,
} from 'recharts';
import {
  Search,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Loader,
  Zap,
  History,
} from 'lucide-react';

const StockDashboard = () => {
  const [tickers, setTickers] = useState(['AAPL']);
  const [inputValue, setInputValue] = useState('');
  const [stockData, setStockData] = useState({});
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [backtestResults, setBacktestResults] = useState(null);
  const [selectedTicker, setSelectedTicker] = useState('');

  const ALPHAVANTAGE_KEY = process.env.REACT_APP_ALPHAVANTAGE_KEY;
  
  const colors = ['#00D9FF', '#39FF14', '#FF6B9D', '#FFB347'];

  const fetchStockData = async (ticker) => {
    try {
      if (!ALPHAVANTAGE_KEY) {
        throw new Error('Missing Alpha Vantage API key');
      }

      const response = await fetch(
        `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${ticker}&apikey=${ALPHAVANTAGE_KEY}&outputsize=compact`
      );
      const data = await response.json();

      if (data['Error Message']) {
        throw new Error(`Ticker "${ticker}" not found`);
      }

      if (data['Note']) {
        throw new Error(
          'API rate limit reached. Please try again in a few minutes. Free tier allows 5 requests per minute and 100 per day.'
        );
      }

      if (!data['Time Series (Daily)']) {
        throw new Error(
          `Unexpected API response for ${ticker}. Please try again later.`
        );
      }

      const timeSeries = data['Time Series (Daily)'] || {};
      const dates = Object.keys(timeSeries).slice(0, 100).reverse();

      if (dates.length === 0) {
        throw new Error(`No data available for ${ticker}`);
      }

      const prices = dates.map((date) => parseFloat(timeSeries[date]['4. close']));
      const volumes = dates.map((date) => parseInt(timeSeries[date]['5. volume'], 10));
      const highs = dates.map((date) => parseFloat(timeSeries[date]['2. high']));
      const lows = dates.map((date) => parseFloat(timeSeries[date]['3. low']));

      const ma200 = calculateMA(prices, 200);
      const ma50 = calculateMA(prices, 50);
      const rsi = calculateRSI(prices);
      const macd = calculateMACD(prices);
      const bb = calculateBollingerBands(prices, 20, 2);
      const currentPrice = prices[prices.length - 1];
      const previousPrice = prices[prices.length - 2];
      const dayChange =
        previousPrice
          ? ((currentPrice - previousPrice) / previousPrice) * 100
          : 0;

      return {
        ticker,
        currentPrice: currentPrice.toFixed(2),
        dayChange: dayChange.toFixed(2),
        ma200: ma200 ? ma200.toFixed(2) : 'Unavailable on compact data',
        ma50: ma50 ? ma50.toFixed(2) : 'N/A',
        rsi: rsi.toFixed(2),
        macd,
        bollingerBands: bb,
        pe: 'N/A',
        peg: 'N/A',
        dates,
        prices,
        volumes,
        highs,
        lows,
      };
    } catch (err) {
      setError(err.message);
      return null;
    }
  };

  const calculateMA = (prices, period) => {
    if (prices.length < period) return null;
    const slice = prices.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  };

  const calculateRSI = (prices, period = 14) => {
    if (prices.length <= period) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = prices.length - period; i < prices.length; i++) {
      const diff = prices[i] - prices[i - 1];
      if (diff > 0) gains += diff;
      else losses -= diff;
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  };

  const calculateEMA = (prices, period) => {
    if (prices.length < period) return prices[prices.length - 1] || 0;

    const k = 2 / (period + 1);
    let ema =
      prices.slice(0, period).reduce((a, b) => a + b, 0) / period;

    for (let i = period; i < prices.length; i++) {
      ema = prices[i] * k + ema * (1 - k);
    }

    return ema;
  };

  const calculateMACD = (prices, fast = 12, slow = 26) => {
    const ema12 = calculateEMA(prices, fast);
    const ema26 = calculateEMA(prices, slow);
    const macdLine = ema12 - ema26;

    return {
      macd: macdLine.toFixed(4),
      ema12: ema12.toFixed(2),
      ema26: ema26.toFixed(2),
    };
  };

  const calculateBollingerBands = (prices, period = 20, stdDev = 2) => {
    if (prices.length < period) return null;

    const slice = prices.slice(-period);
    const sma = slice.reduce((a, b) => a + b, 0) / period;
    const variance =
      slice.reduce((acc, val) => acc + Math.pow(val - sma, 2), 0) / period;
    const std = Math.sqrt(variance);

    return {
      upper: (sma + std * stdDev).toFixed(2),
      middle: sma.toFixed(2),
      lower: (sma - std * stdDev).toFixed(2),
    };
  };

const performBacktest = (ticker) => {
  const data = stockData[ticker];
  if (!data) return;

  let trades = [];
  let position = null;
  let cash = 10000;
  let shares = 0;

  const prices = data.prices;
  const dates = data.dates;

  // Use 200MA if enough history exists, otherwise fall back to 50MA
  const maPeriod = prices.length >= 200 ? 200 : 50;

  for (let i = maPeriod; i < prices.length; i++) {
    const rsi = calculateRSI(prices.slice(0, i + 1));
    const movingAverage = calculateMA(prices.slice(0, i + 1), maPeriod);
    const price = prices[i];

    if (!movingAverage) continue;

    if (!position && rsi < 30 && price > movingAverage) {
      shares = Math.floor(cash / price);

      if (shares > 0) {
        cash -= shares * price;
        position = {
          type: 'buy',
          date: dates[i],
          price,
          shares,
        };
        trades.push(position);
      }
    } else if (position && rsi > 70) {
      cash += shares * price;

      trades.push({
        type: 'sell',
        date: dates[i],
        price,
        profit: (price - position.price) * shares,
        profitPercent: (((price - position.price) / position.price) * 100).toFixed(2),
      });

      position = null;
      shares = 0;
    }
  }

  const finalValue = cash + shares * prices[prices.length - 1];
  const sellTrades = trades.filter((t) => t.type === 'sell');
  const winningTrades = sellTrades.filter(
    (t) => parseFloat(t.profitPercent) > 0
  );

  setBacktestResults({
    ticker,
    trades,
    finalValue: finalValue.toFixed(2),
    totalReturn: (((finalValue - 10000) / 10000) * 100).toFixed(2),
    winRate: (winningTrades.length / (sellTrades.length || 1)) * 100,
    strategyLabel: `RSI + ${maPeriod}MA`,
  });
};

  const addTicker = () => {
    const next = inputValue.trim().toUpperCase();
    if (!next || tickers.length >= 4 || tickers.includes(next)) return;

    setTickers([...tickers, next]);
    setInputValue('');
  };

  const removeTicker = (ticker) => {
    const updated = tickers.filter((t) => t !== ticker);
    setTickers(updated);

    if (selectedTicker === ticker) {
      setSelectedTicker(updated[0] || '');
    }
  };

  const loadStocks = async () => {
    setLoading(true);
    setError('');
    setBacktestResults(null);

    const newData = {};

    for (const ticker of tickers) {
      const data = await fetchStockData(ticker);
      if (data) {
        newData[ticker] = data;
      }
    }

    setStockData(newData);

    if (Object.keys(newData).length > 0) {
      const firstTicker = Object.keys(newData)[0];

      const chartPoints = newData[firstTicker].dates.map((date, idx) => {
        const point = { date: date.slice(5) };
        Object.keys(newData).forEach((t) => {
          point[t] = newData[t].prices[idx];
        });
        return point;
      });

      setChartData(chartPoints.slice(-60));
      setSelectedTicker(firstTicker);
      generateAnalysis(newData);
    } else {
      setChartData([]);
      setAnalysis('');
    }

    setLoading(false);
  };

const generateAnalysis = async (data) => {
  const summary = Object.entries(data)
    .map(
      ([ticker, info]) =>
        `${ticker}: $${info.currentPrice}, RSI: ${info.rsi}, 200MA: ${info.ma200}, 50MA: ${info.ma50}, MACD: ${info.macd.macd}`
    )
    .join(' | ');

  try {
    setAnalysis('Generating AI analysis...');

    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || result.details || 'Analysis unavailable');
    }

    setAnalysis(result.analysis || 'Analysis unavailable.');
  } catch (err) {
    setAnalysis(`AI analysis unavailable: ${err.message}`);
  }
};
    
  useEffect(() => {
    if (tickers.length > 0) {
      loadStocks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getBBSignal = (price, bb) => {
    if (!bb) return 'N/A';
    if (price > parseFloat(bb.upper)) return 'Overbought';
    if (price < parseFloat(bb.lower)) return 'Oversold';
    return 'Normal';
  };

  const getMACDSignal = (macd) => {
    if (!macd) return 'Neutral';
    return parseFloat(macd.macd) > 0 ? 'Bullish' : 'Bearish';
  };

  const isValidTrendComparison =
    selectedTicker &&
    stockData[selectedTicker] &&
    stockData[selectedTicker].ma200 !== 'Unavailable on compact data';

  return (
    <div
      className="min-h-screen"
      style={{
        background: 'linear-gradient(135deg, #0a0e27 0%, #1a1f3a 50%, #0f1420 100%)',
        fontFamily: '"Inter", -apple-system, sans-serif',
      }}
    >
      <div className="border-b border-cyan-500/20 px-8 py-6 backdrop-blur-sm">
        <h1
          className="text-4xl font-extrabold text-white mb-2"
          style={{ letterSpacing: '-0.5px' }}
        >
          Stock Analysis Dashboard
        </h1>
        <p className="text-cyan-200 text-sm">
          Advanced technical analysis with backtesting for educational purposes
        </p>
      </div>

      <div className="p-8">
        <div className="mb-8 bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-cyan-500/20 rounded-xl p-6 backdrop-blur-sm">
          <div className="flex gap-3 mb-4 flex-wrap">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && addTicker()}
              placeholder="Enter ticker (e.g., AAPL, MSFT)"
              maxLength="5"
              className="flex-1 min-w-[240px] px-4 py-3 bg-slate-900/50 border border-cyan-500/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition"
            />
            <button
              onClick={addTicker}
              disabled={tickers.length >= 4}
              className="px-6 py-3 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-200 rounded-lg font-semibold transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Search size={18} /> Add
            </button>
            <button
              onClick={loadStocks}
              disabled={loading || tickers.length === 0}
              className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 text-slate-900 rounded-lg font-bold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? <Loader size={18} className="animate-spin" /> : 'Load Data'}
            </button>
          </div>

          {loading && (
            <div className="text-cyan-200 text-sm mb-4 flex items-center gap-2">
              <Loader size={16} className="animate-spin" />
              Fetching market data...
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {tickers.map((ticker) => (
              <div
                key={ticker}
                className="flex items-center gap-2 bg-slate-900/60 px-3 py-2 rounded-lg border border-cyan-400/30"
              >
                <span className="text-cyan-200 font-semibold">{ticker}</span>
                <button
                  onClick={() => removeTicker(ticker)}
                  className="text-red-400 hover:text-red-300 font-bold"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-900/30 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg flex items-start gap-3">
            <AlertCircle size={20} className="mt-0.5 flex-shrink-0" />
            <div>
              <strong>Error:</strong> {error}
              {error.toLowerCase().includes('rate limit') && (
                <div className="text-xs text-red-100/80 mt-2">
                  Free Alpha Vantage allows 5 requests per minute.
                </div>
              )}
            </div>
          </div>
        )}

        {Object.keys(stockData).length > 0 && (
          <div className="mb-6 flex gap-2 border-b border-cyan-500/20 flex-wrap">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-3 font-semibold transition ${
                activeTab === 'overview'
                  ? 'text-cyan-400 border-b-2 border-cyan-400'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('technical')}
              className={`px-4 py-3 font-semibold transition flex items-center gap-2 ${
                activeTab === 'technical'
                  ? 'text-cyan-400 border-b-2 border-cyan-400'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              <Zap size={18} /> Advanced Indicators
            </button>
            <button
              onClick={() => setActiveTab('backtest')}
              className={`px-4 py-3 font-semibold transition flex items-center gap-2 ${
                activeTab === 'backtest'
                  ? 'text-cyan-400 border-b-2 border-cyan-400'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              <History size={18} /> Backtest Strategy
            </button>
          </div>
        )}

        {activeTab === 'overview' && Object.keys(stockData).length > 0 && (
          <>
            <div
              className={`grid gap-6 mb-8 ${
                Object.keys(stockData).length === 1
                  ? 'grid-cols-1'
                  : Object.keys(stockData).length === 2
                  ? 'grid-cols-1 md:grid-cols-2'
                  : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
              }`}
            >
              {Object.entries(stockData).map(([ticker, data], idx) => (
                <div
                  key={ticker}
                  className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-cyan-500/20 rounded-xl p-6 backdrop-blur-sm hover:border-cyan-400/40 transition cursor-pointer"
                  onClick={() => setSelectedTicker(ticker)}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-white">{ticker}</h3>
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: colors[idx] }}
                    />
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="text-gray-300 text-xs uppercase tracking-wider mb-1">
                        Price
                      </p>
                      <div className="flex items-end gap-2 flex-wrap">
                        <span className="text-4xl font-extrabold text-white tracking-tight">
                          ${data.currentPrice}
                        </span>
                        <span
                          className={`text-sm font-semibold ${
                            parseFloat(data.dayChange) >= 0
                              ? 'text-green-400'
                              : 'text-red-400'
                          } flex items-center gap-1`}
                        >
                          {parseFloat(data.dayChange) >= 0 ? (
                            <TrendingUp size={16} />
                          ) : (
                            <TrendingDown size={16} />
                          )}
                          {Math.abs(parseFloat(data.dayChange))}%
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-cyan-500/10">
                      <MetricRow
                        label="200MA"
                        value={data.ma200}
                        tooltip="Long-term trend. Unavailable on compact free data."
                      />
                      <MetricRow label="50MA" value={data.ma50} tooltip="Short-term trend" />
                      <MetricRow
                        label="RSI"
                        value={data.rsi}
                        tooltip="0-30 oversold, 70+ overbought"
                      />
                      <MetricRow
                        label="MACD"
                        value={getMACDSignal(data.macd)}
                        tooltip="Trend momentum"
                      />
                      <MetricRow
                        label="Bollinger Bands"
                        value={getBBSignal(parseFloat(data.currentPrice), data.bollingerBands)}
                        tooltip="Volatility zone"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {chartData.length > 0 && (
              <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-cyan-500/20 rounded-xl p-6 backdrop-blur-sm mb-8">
                <h2 className="text-xl font-bold text-white mb-6">
                  Price History (Last 60 Days)
                </h2>
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={chartData}>
                    <defs>
                      {tickers.map((ticker, idx) => (
                        <linearGradient
                          key={ticker}
                          id={`grad-${ticker}`}
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop offset="0%" stopColor={colors[idx]} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={colors[idx]} stopOpacity={0.01} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(6, 182, 212, 0.1)" />
                    <XAxis dataKey="date" stroke="#9CA3AF" style={{ fontSize: '12px' }} />
                    <YAxis stroke="#9CA3AF" style={{ fontSize: '12px' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        border: '1px solid rgba(6, 182, 212, 0.3)',
                        borderRadius: '8px',
                      }}
                      labelStyle={{ color: '#fff' }}
                    />
                    <Legend />
                    {tickers.map((ticker, idx) => (
                      <Area
                        key={ticker}
                        type="monotone"
                        dataKey={ticker}
                        stroke={colors[idx]}
                        strokeWidth={2}
                        dot={false}
                        fillOpacity={0.6}
                        fill={`url(#grad-${ticker})`}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {analysis && (
              <div className="bg-gradient-to-br from-cyan-900/20 to-blue-900/20 border border-cyan-400/30 rounded-xl p-6 backdrop-blur-sm">
                <h2 className="text-lg font-bold text-cyan-200 mb-3 flex items-center gap-2">
                  <AlertCircle size={20} /> Educational Analysis
                </h2>
                <p className="text-gray-200 leading-relaxed text-sm">{analysis}</p>
                <p className="text-gray-400 text-xs mt-4 italic">
                  *This analysis is for educational purposes. Always conduct your own
                  research before investing.
                </p>
              </div>
            )}
          </>
        )}

        {activeTab === 'technical' && Object.keys(stockData).length > 0 && (
          <>
            <div className="mb-6 flex gap-2 flex-wrap">
              {tickers.map((ticker) => (
                <button
                  key={ticker}
                  onClick={() => setSelectedTicker(ticker)}
                  className={`px-4 py-2 rounded-lg font-semibold transition ${
                    selectedTicker === ticker
                      ? 'bg-cyan-500 text-slate-900'
                      : 'bg-slate-800 text-cyan-200 hover:bg-slate-700'
                  }`}
                >
                  {ticker}
                </button>
              ))}
            </div>

            {selectedTicker && stockData[selectedTicker] && (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                  <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-cyan-500/20 rounded-xl p-6 backdrop-blur-sm">
                    <h3 className="text-lg font-bold text-white mb-4">
                      Relative Strength Index (RSI)
                    </h3>
                    <div className="text-center mb-4">
                      <div className="text-4xl font-bold text-cyan-400 mb-2">
                        {stockData[selectedTicker].rsi}
                      </div>
                      <div
                        className={`text-sm font-semibold ${
                          parseFloat(stockData[selectedTicker].rsi) < 30
                            ? 'text-green-400'
                            : parseFloat(stockData[selectedTicker].rsi) > 70
                            ? 'text-red-400'
                            : 'text-yellow-400'
                        }`}
                      >
                        {parseFloat(stockData[selectedTicker].rsi) < 30
                          ? '📉 Oversold'
                          : parseFloat(stockData[selectedTicker].rsi) > 70
                          ? '📈 Overbought'
                          : '➡️ Neutral'}
                      </div>
                    </div>
                    <div className="bg-slate-900/50 p-3 rounded-lg text-sm text-gray-200">
                      <p>
                        <strong>Signal:</strong> RSI below 30 suggests oversold conditions
                        (potential buy). Above 70 suggests overbought (potential sell).
                      </p>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-cyan-500/20 rounded-xl p-6 backdrop-blur-sm">
                    <h3 className="text-lg font-bold text-white mb-4">
                      MACD (Moving Average Convergence Divergence)
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300">MACD</span>
                        <span className="font-bold text-cyan-400">
                          {stockData[selectedTicker].macd.macd}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300">EMA 12</span>
                        <span className="font-bold text-blue-400">
                          ${stockData[selectedTicker].macd.ema12}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300">EMA 26</span>
                        <span className="font-bold text-purple-400">
                          ${stockData[selectedTicker].macd.ema26}
                        </span>
                      </div>
                      <div className="bg-slate-900/50 p-3 rounded-lg text-sm text-gray-200 mt-3">
                        <p>
                          <strong>Signal:</strong> Positive MACD = Bullish momentum.
                          Negative = Bearish. Crossovers signal trend changes.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-cyan-500/20 rounded-xl p-6 backdrop-blur-sm">
                    <h3 className="text-lg font-bold text-white mb-4">Bollinger Bands</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300">Upper Band</span>
                        <span className="font-bold text-red-400">
                          ${stockData[selectedTicker].bollingerBands?.upper || 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300">Middle (SMA 20)</span>
                        <span className="font-bold text-yellow-400">
                          ${stockData[selectedTicker].bollingerBands?.middle || 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300">Lower Band</span>
                        <span className="font-bold text-green-400">
                          ${stockData[selectedTicker].bollingerBands?.lower || 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-cyan-500/10">
                        <span className="text-gray-300">Current Status</span>
                        <span className="font-bold text-cyan-400">
                          {getBBSignal(
                            parseFloat(stockData[selectedTicker].currentPrice),
                            stockData[selectedTicker].bollingerBands
                          )}
                        </span>
                      </div>
                      <div className="bg-slate-900/50 p-3 rounded-lg text-sm text-gray-200 mt-3">
                        <p>
                          <strong>Signal:</strong> Price at upper band = overbought. At
                          lower band = oversold. Bands widen with volatility.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-cyan-500/20 rounded-xl p-6 backdrop-blur-sm">
                    <h3 className="text-lg font-bold text-white mb-4">Moving Averages</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300">Current Price</span>
                        <span className="font-bold text-white text-lg">
                          ${stockData[selectedTicker].currentPrice}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300">50-Day MA</span>
                        <span className="font-bold text-blue-400">
                          ${stockData[selectedTicker].ma50}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300">200-Day MA</span>
                        <span className="font-bold text-purple-400">
                          {stockData[selectedTicker].ma200}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-cyan-500/10">
                        <span className="text-gray-300">Trend</span>
                        {isValidTrendComparison ? (
                          <span
                            className={`font-bold ${
                              parseFloat(stockData[selectedTicker].currentPrice) >
                              parseFloat(stockData[selectedTicker].ma200)
                                ? 'text-green-400'
                                : 'text-red-400'
                            }`}
                          >
                            {parseFloat(stockData[selectedTicker].currentPrice) >
                            parseFloat(stockData[selectedTicker].ma200)
                              ? 'Uptrend'
                              : 'Downtrend'}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-sm">
                            Unavailable (compact data)
                          </span>
                        )}
                      </div>
                      <div className="bg-slate-900/50 p-3 rounded-lg text-sm text-gray-200 mt-3">
                        <p>
                          <strong>Signal:</strong> Price above moving averages suggests
                          strength. The 200-day MA is unavailable on free compact data.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {chartData.length > 0 && (
                  <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-cyan-500/20 rounded-xl p-6 backdrop-blur-sm mb-8">
                    <h2 className="text-xl font-bold text-white mb-6">Volume Analysis</h2>
                    <ResponsiveContainer width="100%" height={300}>
                      <ComposedChart
                        data={chartData.map((d, i) => ({
                          ...d,
                          volume: stockData[selectedTicker].volumes[i],
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(6, 182, 212, 0.1)" />
                        <XAxis dataKey="date" stroke="#9CA3AF" style={{ fontSize: '12px' }} />
                        <YAxis yAxisId="left" stroke="#9CA3AF" style={{ fontSize: '12px' }} />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          stroke="#9CA3AF"
                          style={{ fontSize: '12px' }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'rgba(15, 23, 42, 0.9)',
                            border: '1px solid rgba(6, 182, 212, 0.3)',
                            borderRadius: '8px',
                          }}
                          labelStyle={{ color: '#fff' }}
                        />
                        <Bar yAxisId="right" dataKey="volume" fill="rgba(6, 182, 212, 0.3)" />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey={selectedTicker}
                          stroke="#00D9FF"
                          strokeWidth={2}
                          dot={false}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                    <div className="bg-slate-900/50 p-3 rounded-lg text-sm text-gray-200 mt-4">
                      <p>
                        <strong>Signal:</strong> Rising price with increasing volume =
                        strong trend. Rising price with low volume = weak. Volume confirms
                        trends.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {activeTab === 'backtest' && Object.keys(stockData).length > 0 && (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-4">
                Strategy Backtesting
              </h2>
              <p className="text-gray-200 mb-6">
               Test a simple RSI + moving average strategy: Buy when RSI {'<'} 30 and price is above the trend average. Sell when RSI {'>'} 70.
               The app uses 200MA when enough history is available, otherwise it falls back to 50MA.
               </p>

              <div className="flex gap-3 flex-wrap">
                {tickers.map((ticker) => (
                  <button
                    key={ticker}
                    onClick={() => performBacktest(ticker)}
                    className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 text-slate-900 rounded-lg font-bold transition"
                  >
                    Backtest {ticker}
                  </button>
                ))}
              </div>
            </div>

            {backtestResults && (
              <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-cyan-500/20 rounded-xl p-6 backdrop-blur-sm">
                <h3 className="text-xl font-bold text-white mb-2">
  {backtestResults.ticker} - Strategy Results
</h3>
<p className="text-gray-300 mb-6">
  Strategy used: {backtestResults.strategyLabel}
</p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="bg-slate-900/50 p-4 rounded-lg">
                    <p className="text-gray-300 text-sm mb-1">Starting Capital</p>
                    <p className="text-2xl font-bold text-cyan-400">$10,000</p>
                  </div>
                  <div className="bg-slate-900/50 p-4 rounded-lg">
                    <p className="text-gray-300 text-sm mb-1">Final Value</p>
                    <p className="text-2xl font-bold text-cyan-400">
                      ${backtestResults.finalValue}
                    </p>
                  </div>
                  <div className="bg-slate-900/50 p-4 rounded-lg">
                    <p className="text-gray-300 text-sm mb-1">Total Return</p>
                    <p
                      className={`text-2xl font-bold ${
                        parseFloat(backtestResults.totalReturn) >= 0
                          ? 'text-green-400'
                          : 'text-red-400'
                      }`}
                    >
                      {parseFloat(backtestResults.totalReturn) >= 0 ? '+' : ''}
                      {backtestResults.totalReturn}%
                    </p>
                  </div>
                  <div className="bg-slate-900/50 p-4 rounded-lg">
                    <p className="text-gray-300 text-sm mb-1">Win Rate</p>
                    <p className="text-2xl font-bold text-yellow-400">
                      {backtestResults.winRate.toFixed(0)}%
                    </p>
                  </div>
                </div>

                <div className="bg-slate-900/50 p-4 rounded-lg">
                  <h4 className="text-lg font-bold text-white mb-4">Trade History</h4>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {backtestResults.trades.map((trade, idx) => (
                      <div
                        key={idx}
                        className={`flex justify-between items-center p-3 rounded-lg text-sm ${
                          trade.type === 'buy'
                            ? 'bg-blue-900/30 border border-blue-500/30'
                            : 'bg-green-900/30 border border-green-500/30'
                        }`}
                      >
                        <div>
                          <span
                            className={`font-bold ${
                              trade.type === 'buy' ? 'text-blue-300' : 'text-green-300'
                            }`}
                          >
                            {trade.type === 'buy' ? '🟦 BUY' : '🟩 SELL'}
                          </span>
                          <span className="text-gray-300 ml-2">{trade.date}</span>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-white">${trade.price}</p>
                          {trade.profit && (
                            <p
                              className={`${
                                parseFloat(trade.profitPercent) >= 0
                                  ? 'text-green-400'
                                  : 'text-red-400'
                              }`}
                            >
                              {parseFloat(trade.profitPercent) >= 0 ? '+' : ''}
                              {trade.profitPercent}% (${trade.profit.toFixed(2)})
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-lg mt-6 text-sm text-gray-200">
                  <p className="mb-2">
                    <strong>⚠️ Educational Purpose:</strong> This backtest is simplified
                    and uses historical data. Real trading involves slippage, commissions,
                    and risk.
                  </p>
                  <p>
                    <strong>💡 Learning Opportunity:</strong> Analyze why this strategy
                    works or fails for this stock. What market conditions favor this
                    approach?
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const MetricRow = ({ label, value, tooltip }) => (
  <div className="flex justify-between items-center text-sm">
    <span className="text-gray-300 cursor-help" title={tooltip}>
      {label}:
    </span>
    <span className="text-cyan-200 font-semibold text-right ml-3">{value}</span>
  </div>
);

export default StockDashboard;
