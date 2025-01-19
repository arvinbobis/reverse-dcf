from flask import Flask, request, jsonify
from flask_cors import CORS
import logging

# Configure logging
logging.basicConfig(level=logging.DEBUG)


app = Flask(__name__)
CORS(app)

def calculate_intrinsic_value(fcf, wacc, growth_rate, terminal_growth_rate, projection_years):
    # Calculate discounted cash flows
    discounted_fcf = sum(
        (fcf * (1 + growth_rate) ** t) / ((1 + wacc) ** t)
        for t in range(1, projection_years + 1)
    )
    # Calculate terminal value
    fcf_final = fcf * (1 + growth_rate) ** projection_years
    terminal_value = fcf_final * (1 + terminal_growth_rate) / (wacc - terminal_growth_rate)
    pv_terminal_value = terminal_value / ((1 + wacc) ** projection_years)

    # Total intrinsic value
    return discounted_fcf + pv_terminal_value

@app.route('/calculate', methods=['POST'])
def calculate():
    try:
        data = request.json
        ev = float(data['enterprise_value'])
        fcf = float(data['free_cash_flow'])
        wacc = float(data['wacc'])  # Use same WACC
        terminal_growth_rate = float(data['terminal_growth_rate'])  # Same terminal growth
        projection_years = int(data['projection_years'])  # Same projection years
        shares_outstanding = float(data['shares_outstanding'])

        # Input validation
        if wacc <= 0 or terminal_growth_rate >= wacc:
            return jsonify({"error": "WACC must be greater than the terminal growth rate and both must be positive."}), 400
        if fcf <= 0 or ev <= 0 or shares_outstanding <= 0:
            return jsonify({"error": "Inputs like enterprise value, FCF, and shares outstanding must be positive."}), 400

        # Binary search for implied growth rate
        lower_bound, upper_bound = 0.0, 1.0
        tolerance = 1e-8
        while (upper_bound - lower_bound) > tolerance:
            growth_rate = (lower_bound + upper_bound) / 2
            intrinsic_value = calculate_intrinsic_value(fcf, wacc, growth_rate, terminal_growth_rate, projection_years)
            if intrinsic_value > ev:
                upper_bound = growth_rate
            else:
                lower_bound = growth_rate

        implied_growth_rate = growth_rate

        # Calculate intrinsic value using the implied growth rate
        intrinsic_value = calculate_intrinsic_value(fcf, wacc, implied_growth_rate, terminal_growth_rate, projection_years)
        implied_stock_price = intrinsic_value / shares_outstanding

        # Sensitivity analysis for ±5% growth rate
        sensitivity_results = []
        for variation in [-0.05, 0.05]:  # -5% and +5% variation
            adjusted_growth_rate = implied_growth_rate + variation
            # Log the parsed values
            logging.debug("Parsed values - FCF: %f, WACC: %f, Terminal Growth Rate: %f, "
                        "Projection Years: %d, Shares Outstanding: %f, Adjusted Growth Rate: %f",
                        fcf, wacc, terminal_growth_rate, projection_years, shares_outstanding, adjusted_growth_rate)
            intrinsic_value_variation = calculate_intrinsic_value(fcf, wacc, adjusted_growth_rate, terminal_growth_rate, projection_years)
            implied_stock_price_variation = intrinsic_value_variation / shares_outstanding
            sensitivity_results.append({
                "implied_growth_rate": (adjusted_growth_rate * 100),  # Convert to percentage
                "implied_stock_price": implied_stock_price_variation
            })

        return jsonify({
            "implied_growth_rate": implied_growth_rate,  # Convert to percentage
            "intrinsic_value": intrinsic_value,
            "implied_stock_price": implied_stock_price,
            "sensitivity_analysis": sensitivity_results
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/custom-growth', methods=['POST'])
@app.route('/custom-growth', methods=['POST'])
def custom_growth():
    try:
        data = request.json

        # Parse inputs
        fcf = float(data['free_cash_flow'])
        wacc = float(data['wacc']) / 100  # Scale to decimal
        terminal_growth_rate = float(data['terminal_growth_rate']) / 100  # Scale to decimal
        projection_years = int(data['projection_years'])
        shares_outstanding = float(data['shares_outstanding'])
        custom_growth_rate = float(data['custom_growth_rate']) / 100  # Scale to decimal

        # Validate inputs
        if custom_growth_rate <= -1 or custom_growth_rate >= 1:
            return jsonify({"error": "Custom growth rate must be between -100% and 100%."}), 400

        # Calculate the intrinsic value using the custom growth rate
        logging.debug("Current FCF: %f", fcf)
        intrinsic_value = calculate_intrinsic_value(fcf, wacc, custom_growth_rate, terminal_growth_rate, projection_years)
        # Calculate the implied stock price
        implied_stock_price = intrinsic_value / shares_outstanding
        logging.debug("Custome Implied stock price: %f", implied_stock_price)

        logging.debug("Parsed values - FCF: %f, WACC: %f, Terminal Growth Rate: %f, "
                        "Projection Years: %d, Shares Outstanding: %f, Custom Growth Rate: %f",
                        fcf, wacc, terminal_growth_rate, projection_years, shares_outstanding, custom_growth_rate)

        # Project stock prices for the next 3 years
        projected_prices = []
        for year in range(1, 4):  # Years 1 to 3
            projected_fcf = fcf * ((1 + custom_growth_rate) ** year)  # Apply growth to FCF
            logging.debug("Projected FCF for year %d: %f", year, projected_fcf)
            projected_intrinsic_value = calculate_intrinsic_value(projected_fcf, wacc, custom_growth_rate, terminal_growth_rate, projection_years)
            projected_stock_price = projected_intrinsic_value / shares_outstanding
            projected_prices.append(projected_stock_price)

        return jsonify({
            "implied_stock_price": implied_stock_price,
            "projected_prices": projected_prices
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 400

    

    
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)

