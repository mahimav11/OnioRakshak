# OnioRakshak: Smart Onion Storage System

> An IoT + ML powered system to monitor and manage onion storage conditions — reducing post-harvest losses for Maharashtra's onion farmers through real-time environmental sensing, automated control, and shelf-life prediction.

## Overview

Onions are one of India's most widely grown and economically important crops, but improper storage leads to massive post-harvest losses every year from spoilage, sprouting, and rot. **OnioRakshak** addresses this by combining low-cost IoT sensing with edge processing, cloud-based analytics, and machine learning to give farmers real-time visibility and automated control over their storage conditions.

## Features

### 🌡️ Real-Time Environmental Monitoring
- Continuous tracking of temperature and humidity inside the storage unit via DHT22
- Gas concentration monitoring (MQ135) to detect early signs of rot or spoilage
- Rain sensor to flag moisture ingress risk
- PIR-based intrusion detection to alert on unauthorized access

### ⚙️ Automated Climate Control
- Exhaust fan automatically triggered when temperature/humidity crosses safe thresholds
- Motorized curtain control to shield stored onions from rain or excess sunlight
- Buzzer alerts for critical conditions (gas spike, intrusion, extreme temperature/humidity)
- All logic runs at the edge on ESP32 for fast, low-latency response even with intermittent connectivity

### 🧠 ML-Based Predictions
- Shelf-life estimation model that predicts how long stored onions will stay usable based on sensor history
- Market price prediction to help farmers decide the optimal time to sell
- Models trained on historical storage and market data, served via the backend API

### ☁️ Cloud Backend & APIs
- REST API layer syncing sensor data, alerts, and predictions between hardware and dashboards
- Persistent storage of historical sensor readings for trend analysis
- Designed to support multiple storage units/farms in the future

### 📊 Farmer-Facing Dashboards
- Web dashboard for live monitoring, historical trends, and alerts
- Mobile app for on-the-go access, especially useful for farmers who aren't near a desktop
- Simple, accessible UI designed with non-technical users in mind

## Tech Stack & Hardware

| Layer | Components |
|---|---|
| Microcontroller | ESP32 |
| Sensors | DHT22 (temperature/humidity), MQ135 (gas), rain sensor, PIR (intrusion) |
| Actuators | Exhaust fan, curtain motor, buzzer |
| Backend | REST API (cloud-hosted) |
| ML | Shelf-life prediction, market price prediction |
| Frontend | Web dashboard + mobile app |

## Project Structure

```
OnioRakshak/
├── backend/     # REST API and server-side logic
├── database/    # Database schemas and models
├── docs/        # Documentation, diagrams, and reports
├── frontend/    # Web dashboard
├── hardware/    # ESP32 firmware and circuit designs
├── ml/          # Shelf-life and price prediction models
├── mobile/      # Mobile app
└── tests/       # Test suites
```

## Team

| Name | Role |
|---|---|
| Maharshi Valmik Tuwar | Frontend |
| Mahima Mahesh Vahadne | ML |
| Ayush Sumesh Vellangara | Backend & Database |
| Uday Annasaheb Thete | Team Lead — Embedded & Hardware |

**Project Guide:** Prof. V. N. Nirgude

## Status

🚧 Under active development. Project scaffolding is in place; core modules (hardware firmware, backend API, ML models, and dashboards) are being built out.

## License

_To be added._
