# 🧠 DeepSwarm – Deep Research & Swarm Intelligence Engine

<div align="center">

[![GitHub last commit](https://img.shields.io/github/last-commit/sgindeed/DeepSwarm)](https://github.com/sgindeed/DeepSwarm)
[![GitHub Repo Size](https://img.shields.io/github/repo-size/sgindeed/DeepSwarm)](https://github.com/sgindeed/DeepSwarm)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

### AI-powered Deep Research Platform with Autonomous Multi-Agent Swarm Intelligence

**Research • Debate • Predict • Synthesize**

</div>

---

# 📖 Overview

**DeepSwarm** is an AI-powered research platform capable of autonomously performing deep web research, analyzing information from multiple sources, detecting contradictions, and generating comprehensive reports.

Unlike traditional research assistants, DeepSwarm doesn't stop after collecting information.

Once research is complete, it automatically creates a **dynamic swarm of AI experts** specialized for the research topic. These agents debate, challenge one another's assumptions, defend opposing viewpoints, and finally collaborate to generate future predictions and confidence-scored insights.

The result is an intelligent research system capable of producing both factual analysis and simulated expert reasoning.

---

# ✨ Features

## 🔍 Autonomous Deep Research

- Multi-stage research planning
- Automatic query decomposition
- Recursive web exploration
- Intelligent source selection
- Deep web scraping
- Multi-iteration refinement
- Executive summaries
- Comprehensive markdown reports

---

## 🧠 Swarm Intelligence

Instead of using a single LLM response, DeepSwarm creates multiple AI experts.

Example personas include:

- Technology Analyst
- Economist
- Policy Expert
- Historian
- Security Researcher
- Ethics Advisor
- Healthcare Specialist

Each agent:

- Forms independent opinions
- Challenges other agents
- Defends arguments
- Revises conclusions
- Votes on future outcomes

Finally, a synthesizer agent produces the final report.

---

## ⚡ Real-Time Streaming

DeepSwarm streams every stage live using WebSockets.

Users can watch:

- Search progress
- Websites being scraped
- Sources analyzed
- Contradictions detected
- Agent generation
- Live debates
- Future predictions

Everything updates in real-time.

---

## 📄 Professional Reports

Generate structured reports including:

- Executive Summary
- Research Analysis
- Source Evaluation
- Contradiction Report
- Swarm Debate Transcript
- Future Predictions
- Confidence Scores
- References

Reports can be exported as:

- PDF
- Microsoft Word

---

## 👤 User Management

- JWT Authentication
- Secure Registration
- Login
- Password Hashing
- Research History
- Persistent Sessions

---

## 🌙 Modern Interface

- Responsive UI
- Dark Mode
- Light Mode
- Markdown Rendering
- Live Progress
- Interactive Dashboard

---

# 🏗 Architecture

```
                 ┌───────────────────────────┐
                 │      React Frontend       │
                 └─────────────┬─────────────┘
                               │
                          REST + WebSocket
                               │
                 ┌─────────────▼─────────────┐
                 │      FastAPI Backend      │
                 └─────────────┬─────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼

 Research Engine       Swarm Intelligence      Authentication
 Search Engine          Future Simulation           JWT

        │                      │
        └──────────────┬───────┘
                       ▼

              Groq LLM API

                       │

             DuckDuckGo Search

                       │

              BeautifulSoup Scraper

                       │

                  SQLite Database
```

---

# 🧩 Tech Stack

## Backend

- Python 3.10+
- FastAPI
- SQLAlchemy Async
- SQLite
- WebSockets
- Pydantic
- JWT Authentication
- Bcrypt
- HTTPX
- BeautifulSoup
- DuckDuckGo Search (DDGS)

---

## AI

- Groq API
- Llama Models
- Mixtral Models
- Automatic LLM Fallback
- Multi-Agent Simulation

---

## Frontend

- React 18
- Tailwind CSS
- HTML2PDF
- Marked
- WebSockets

---

# 🚀 Workflow

## Step 1

User submits a research topic.

↓

## Step 2

Research planner creates multiple search queries.

↓

## Step 3

System searches the web.

↓

## Step 4

Relevant websites are scraped.

↓

## Step 5

Information is summarized.

↓

## Step 6

Contradictions are detected.

↓

## Step 7

Research report generated.

↓

## Step 8

Swarm agents are created dynamically.

↓

## Step 9

Agents debate each other.

↓

## Step 10

Synthesizer generates final intelligence report.

↓

## Step 11

Export report.

---

# 📦 Installation

## Clone Repository

```bash
git clone https://github.com/sgindeed/DeepSwarm.git

cd DeepSwarm
```

---

## Create Virtual Environment

Windows

```bash
python -m venv venv

venv\Scripts\activate
```

Linux / Mac

```bash
python3 -m venv venv

source venv/bin/activate
```

---

## Install Backend

```bash
pip install -r requirements.txt
```

---

## Configure Environment

Create a `.env`

```env
GROQ_API_KEY=your_groq_api_key

JWT_SECRET=your_secret_key

DATABASE_URL=sqlite+aiosqlite:///./research_engine.db
```

---

## Install Frontend

```bash
cd frontend

npm install
```

---

# ▶ Running

## Backend

```bash
uvicorn app.main:app --reload
```

Backend

```
http://localhost:8000
```

---

## Frontend

```bash
npm start
```

Frontend

```
http://localhost:3000
```

---

# 🔌 API Endpoints

| Method | Endpoint | Description |
|---------|----------|-------------|
| POST | `/auth/register` | Register user |
| POST | `/auth/login` | Login |
| POST | `/research/start` | Start research |
| POST | `/research/simulate/{id}` | Start swarm simulation |
| GET | `/research/status/{id}` | Research status |
| GET | `/research/final/{id}` | Final report |
| GET | `/research/history` | User history |
| WS | `/ws/research/{id}` | Live updates |

---

# 📡 Live Streaming

WebSockets stream:

- Search progress
- Scraping progress
- AI thinking
- Debate transcript
- Future predictions
- Confidence scores
- Completion status

---

# 🔒 Authentication

DeepSwarm uses

- JWT Authentication
- Bcrypt Password Hashing
- Protected APIs
- Secure Sessions

---

# 📈 Future Roadmap

- Vector Database Support
- RAG Integration
- PDF Upload Research
- URL Research
- Citation Graph
- Knowledge Graph Generation
- Local LLM Support
- Multi-language Research
- Agent Memory
- Timeline Visualization
- Source Reliability Heatmap
- Docker Deployment
- PostgreSQL Support

---

# 🤝 Contributing

Contributions are welcome!

1. Fork the repository

2. Create a branch

```bash
git checkout -b feature/new-feature
```

3. Commit changes

```bash
git commit -m "Added new feature"
```

4. Push

```bash
git push origin feature/new-feature
```

5. Open a Pull Request

---

# 📜 License

This project is licensed under the MIT License.

---

# 🙏 Acknowledgements

Special thanks to the open-source community and the projects that make DeepSwarm possible.

- FastAPI
- React
- Groq
- DuckDuckGo Search
- BeautifulSoup
- SQLAlchemy
- Tailwind CSS

---

# ⭐ Support

If you find this project useful, please consider giving it a ⭐ on GitHub.

It helps others discover the project and motivates further development.

---

<div align="center">

## 🧠 DeepSwarm

### Research Smarter • Debate Better • Predict the Future

**Made with ❤️ using FastAPI, React and AI**

⭐ **Star the repository if you found it useful!**

https://github.com/sgindeed/DeepSwarm

</div>
