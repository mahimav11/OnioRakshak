"""
Generates a research-anchored synthetic daily onion price dataset for
Maharashtra markets, used to train the price prediction model until
enough real data has accumulated via the scraping module.

Grounded in documented facts:
- Monthly seasonality from a SARIMA study on Lasalgaon APMC (2011-2023):
  lowest modal price in April (~Rs 1075/quintal, Rabi harvest glut),
  highest in October (~Rs 3140/quintal, lean period before Kharif
  arrives), rising trend through Oct-Dec.
  Source: Biochem journal 2024, "Forecasting of onion prices in
  Lasalgaon APMC market"
- Negative correlation between arrivals and price is well documented
  in onion market studies (more arrivals -> lower price).
- Year-on-year price growth reflecting general food inflation (~6-8%/yr).
- Occasional sharp volatility events (documented: e.g. Lasalgaon prices
  crashing from ~Rs 3500/qtl to ~Rs 1180/qtl within weeks on high supply,
  or spiking from ~Rs 1100 to ~Rs 4800/qtl on shortage).

This is clearly labeled as synthetic/demo-grade data. Once
`scraping/mandi_price_scraper.py` has accumulated sufficient real daily
history, retrain on that instead.
"""

import numpy as np
import pandas as pd

np.random.seed(42)

START_DATE = "2021-01-01"
END_DATE = "2025-12-31"

MARKETS = {
    # market_name: (district, relative_price_multiplier)
    "Lasalgaon APMC": ("Nashik", 1.00),
    "Pimpalgaon APMC": ("Nashik", 0.97),
    "Pune APMC": ("Pune", 1.08),
    "Solapur APMC": ("Solapur", 0.93),
    "Ahilyanagar APMC": ("Ahilyanagar", 0.95),
}
VARIETIES = ["Red", "Local", "Nashik Red"]

# Monthly seasonal base modal price (Rs/quintal), anchored to the
# SARIMA study's April low / October high and documented festival-season
# demand pressure into Nov-Dec.
MONTHLY_BASE_PRICE = {
    1: 1650, 2: 1350, 3: 1180, 4: 1075, 5: 1250, 6: 1550,
    7: 1950, 8: 2450, 9: 2900, 10: 3140, 11: 2750, 12: 2150,
}

YEARLY_GROWTH_RATE = 0.07  # ~7% per year, general food inflation proxy


def generate():
    dates = pd.date_range(START_DATE, END_DATE, freq="D")
    rows = []

    # A handful of documented-style volatility events: (start_date, end_date, price_multiplier)
    # Modeled on real reported crashes/spikes (e.g. bumper-crop crashes,
    # shortage-driven spikes) without claiming these are the exact real events.
    shock_events = [
        (pd.Timestamp("2021-11-01"), pd.Timestamp("2021-12-15"), 1.6),   # shortage spike
        (pd.Timestamp("2022-04-10"), pd.Timestamp("2022-05-20"), 0.55),  # bumper crop crash
        (pd.Timestamp("2023-10-01"), pd.Timestamp("2023-11-30"), 1.7),   # shortage spike
        (pd.Timestamp("2024-03-15"), pd.Timestamp("2024-04-30"), 0.5),   # bumper crop crash
        (pd.Timestamp("2025-09-01"), pd.Timestamp("2025-10-31"), 1.5),   # shortage spike
    ]

    for date in dates:
        year_growth = (1 + YEARLY_GROWTH_RATE) ** (date.year - 2021)
        month_base = MONTHLY_BASE_PRICE[date.month]

        shock_multiplier = 1.0
        for start, end, mult in shock_events:
            if start <= date <= end:
                shock_multiplier = mult
                break

        for market, (district, market_mult) in MARKETS.items():
            for variety in VARIETIES:
                variety_mult = {"Red": 1.0, "Local": 0.9, "Nashik Red": 1.05}[variety]

                daily_noise = np.random.normal(1.0, 0.06)
                modal = (
                    month_base * year_growth * market_mult * variety_mult
                    * shock_multiplier * daily_noise
                )
                modal = max(modal, 300)  # floor, prices don't go below cost of production for long

                spread = modal * np.random.uniform(0.08, 0.18)
                min_price = max(modal - spread, 200)
                max_price = modal + spread

                # Arrivals: inversely related to price, plus noise. Units: quintals.
                base_arrivals = 8000 * (month_base / 1075) ** -0.8
                arrivals = base_arrivals * np.random.uniform(0.7, 1.3) / shock_multiplier
                arrivals = max(arrivals, 200)

                rows.append({
                    "date": date.strftime("%Y-%m-%d"),
                    "state": "Maharashtra",
                    "district": district,
                    "market": market,
                    "commodity": "Onion",
                    "variety": variety,
                    "min_price": round(min_price, 2),
                    "max_price": round(max_price, 2),
                    "modal_price": round(modal, 2),
                    "arrivals_quintal": round(arrivals, 1),
                })

    df = pd.DataFrame(rows)
    return df


if __name__ == "__main__":
    df = generate()
    import os
    os.makedirs("../data", exist_ok=True)
    df.to_csv("../data/maharashtra_onion_price_dataset.csv", index=False)
    print(f"Generated {len(df)} rows -> ../data/maharashtra_onion_price_dataset.csv")
    print(df.head())
    print(df.groupby(df["date"].str[:7])["modal_price"].mean().head(15))
