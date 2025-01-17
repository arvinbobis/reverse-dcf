import React, { useState } from 'react';
import axios from 'axios';

const ReverseDCFCalculator = () => {
    const [formData, setFormData] = useState({
        current_stock_price: '',
        enterprise_value: '',
        free_cash_flow: '',
        wacc: 8,
        terminal_growth_rate: 2,
        projection_years: 5,
        shares_outstanding: ''
    });

    const [result, setResult] = useState(null);
    const [intrinsicValue, setIntrinsicValue] = useState(null);
    const [impliedStockPrice, setImpliedStockPrice] = useState(null);
    const [sensitivityData, setSensitivityData] = useState([]);
    const [userGrowthRate, setUserGrowthRate] = useState('');
    const [customStockPrice, setCustomStockPrice] = useState(null);
    const [error, setError] = useState(null);
    const [projectedPrices, setProjectedPrices] = useState([]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const validateInputs = () => {
        for (let key in formData) {
            const value = parseFloat(formData[key]);
            if (!formData[key] || value <= 0) {
                setError('Please enter positive numbers for all fields.');
                return false;
            }
            if ((key === 'wacc' || key === 'terminal_growth_rate') && value > 100) {
                setError('WACC and Terminal Growth Rate should be below 100%.');
                return false;
            }
        }
        setError(null);
        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateInputs()) return;

        try {
            const adjustedData = {
                ...formData,
                wacc: parseFloat(formData.wacc) / 100,
                terminal_growth_rate: parseFloat(formData.terminal_growth_rate) / 100
            };

            const response = await axios.post('http://localhost:5000/calculate', adjustedData);
            const impliedGrowthRate = response.data.implied_growth_rate * 100; // Convert back for display only
            setResult(impliedGrowthRate);
            setIntrinsicValue(response.data.intrinsic_value);
            setImpliedStockPrice(response.data.implied_stock_price);

            // Add percentage difference compared to current stock price
            const updatedSensitivityData = response.data.sensitivity_analysis.map((entry) => {
                const percentageDifference = formData.current_stock_price
                    ? ((entry.implied_stock_price - parseFloat(formData.current_stock_price)) / parseFloat(formData.current_stock_price)) * 100
                    : null;
                return {
                    ...entry,
                    percentageDifference
                };
            });

            setSensitivityData(updatedSensitivityData || []);
        } catch (error) {
            setError('Error connecting to the server. Please try again later.');
            console.error('Error calculating reverse DCF:', error);
        }
    };

    const handleCustomGrowthRate = async () => {
        if (!userGrowthRate || isNaN(userGrowthRate)) {
            setError('Please enter a valid implied growth rate.');
            return;
        }
    
        try {
            const response = await axios.post('http://localhost:5000/custom-growth', {
                ...formData,
                custom_growth_rate: parseFloat(userGrowthRate) // Send custom growth rate as decimal
            });
    
            const impliedStockPrice = response.data.implied_stock_price.toFixed(2);
            setCustomStockPrice(impliedStockPrice);
    
            // Process projected prices and calculate differences
            const updatedProjectedPrices = response.data.projected_prices.map((price, index) => {
                const currentPrice = parseFloat(formData.current_stock_price);
                const customPercentageDifference = currentPrice
                    ? ((price - currentPrice) / currentPrice) * 100
                    : null;
    
                return {
                    year: index + 1,
                    stockPrice: price,
                    customPercentageDifference,
                };
            });
    
            setProjectedPrices(updatedProjectedPrices || []);
            setError(null);
        } catch (error) {
            setError('Error connecting to the server. Please try again later.');
            console.error('Error calculating custom implied stock price:', error);
        }
    };
    

    return (
        <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px', maxWidth: '900px', margin: '50px auto', fontFamily: 'Arial, sans-serif' }}>
            {/* Left Column - Reverse DCF Calculator */}
            <div style={{ flex: 1, borderRight: '1px solid #ccc', paddingRight: '20px' }}>
                <h1 style={{ textAlign: 'center' }}>Reverse DCF Calculator</h1>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {Object.keys(formData).map((key) => (
                        <div key={key} style={{ display: 'flex', flexDirection: 'column' }}>
                            <label style={{ marginBottom: '5px' }}>
                                {key.replace('_', ' ')}{key.includes('wacc') || key.includes('growth') ? ' (%)' : ''}:
                            </label>
                            <input
                                type="number"
                                name={key}
                                value={formData[key]}
                                onChange={handleChange}
                                style={{ padding: '8px', borderRadius: '5px', border: '1px solid #ccc' }}
                            />
                        </div>
                    ))}
                    <button type="submit" style={{ padding: '10px', backgroundColor: '#007BFF', color: 'white', border: 'none', borderRadius: '5px' }}>
                        Calculate Implied Growth Rate & Intrinsic Value
                    </button>
                </form>
                {error && <p style={{ color: 'red', marginTop: '20px' }}>{error}</p>}
                {result && (
                    <>
                        <h2 style={{ marginTop: '20px', textAlign: 'center' }}>Implied Growth Rate: {result.toFixed(2)}%</h2>
                        {/* <h2 style={{ marginTop: '20px', textAlign: 'center' }}>Intrinsic Value: ${intrinsicValue?.toFixed(2)}</h2> */}
                        <h2 style={{ marginTop: '20px', textAlign: 'center' }}>Implied Stock Price: ${impliedStockPrice?.toFixed(2)}</h2>
                    </>
                )}
            </div>

            {/* Right Column - Sensitivity Analysis and Custom Growth */}
            <div style={{ flex: 1, paddingLeft: '20px' }}>
                {/* Sensitivity Analysis */}
                {sensitivityData.length > 0 && (
                    <div style={{ marginTop: '20px' }}>
                        <h2 style={{ textAlign: 'center' }}>Sensitivity Analysis</h2>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    <th style={{ border: '1px solid #ccc', padding: '10px' }}>Implied Growth Rate (%)</th>
                                    <th style={{ border: '1px solid #ccc', padding: '10px' }}>Implied Stock Price ($)</th>
                                    <th style={{ border: '1px solid #ccc', padding: '10px' }}>Difference (%)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sensitivityData.map((entry, index) => (
                                    <tr key={index}>
                                        <td style={{ border: '1px solid #ccc', padding: '10px' }}>{entry.implied_growth_rate.toFixed(2)}</td>
                                        <td style={{ border: '1px solid #ccc', padding: '10px' }}>{entry.implied_stock_price.toFixed(2)}</td>
                                        <td style={{ border: '1px solid #ccc', padding: '10px' }}>
                                            {entry.percentageDifference !== null
                                                ? `${entry.percentageDifference.toFixed(2)}%`
                                                : 'N/A'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Custom Growth Rate */}
                {result && (
                    <div style={{ marginTop: '20px' }}>
                        <h2 style={{ textAlign: 'center' }}>Custom Implied Growth Rate</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <label>Enter your own implied growth rate (%):</label>
                            <input
                                type="number"
                                value={userGrowthRate}
                                onChange={(e) => setUserGrowthRate(e.target.value)}
                                style={{ padding: '8px', borderRadius: '5px', border: '1px solid #ccc' }}
                            />
                            <button
                                onClick={handleCustomGrowthRate}
                                style={{ padding: '10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px' }}
                            >
                                Calculate Custom Implied Stock Price
                            </button>
                        </div>
                        {customStockPrice && (
                            <>
                                <h2 style={{ marginTop: '20px', textAlign: 'center' }}>Custom Implied Stock Price: ${customStockPrice}</h2>
                                {projectedPrices.length > 0 && (
                                    <div style={{ marginTop: '20px' }}>
                                        <h2 style={{ textAlign: 'center' }}>Projected Stock Prices (Next 3 Years)</h2>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr>
                                                    <th style={{ border: '1px solid #ccc', padding: '10px' }}>Year</th>
                                                    <th style={{ border: '1px solid #ccc', padding: '10px' }}>Projected Stock Price ($)</th>
                                                    <th style={{ border: '1px solid #ccc', padding: '10px' }}>Difference (%)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {projectedPrices.map((entry) => (
                                                    <tr key={entry.year}>
                                                        <td style={{ border: '1px solid #ccc', padding: '10px' }}>{entry.year}</td>
                                                        <td style={{ border: '1px solid #ccc', padding: '10px' }}>{entry.stockPrice.toFixed(2)}</td>
                                                        <td style={{ border: '1px solid #ccc', padding: '10px' }}>
                                                            {entry.customPercentageDifference !== null
                                                                ? `${entry.customPercentageDifference.toFixed(2)}%`
                                                                : 'N/A'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                            </>
                        )}

                    </div>
                )}
            </div>
        </div>
    );
};

export default ReverseDCFCalculator;
