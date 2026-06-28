const WEBHOOK_URL =
  "https://galamo.app.n8n.cloud/webhook/6f571108-c9dd-4efe-854e-24b6c61d4910";

const executeBtn = document.getElementById("executeBtn");
const statusBanner = document.getElementById("statusBanner");
const blotter = document.getElementById("blotter");

function updateClock() {
  const now = new Date();
  document.getElementById("marketDate").textContent = now.toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  document.getElementById("marketTime").textContent = now.toLocaleTimeString("en-US", {
    hour12: false,
  });
}

setInterval(updateClock, 1000);
updateClock();

const tickerSymbols = [
  ["AAPL", "+1.24", "up"],
  ["MSFT", "-0.42", "down"],
  ["NVDA", "+3.18", "up"],
  ["N8N", "+0.89", "up"],
  ["BTC", "-2.11", "down"],
  ["EUR/USD", "+0.05", "up"],
  ["GALAMO", "+5.00", "up"],
];

function buildTicker() {
  const items = [...tickerSymbols, ...tickerSymbols]
    .map(([sym, chg, dir]) => `<span class="${dir}">${sym} ${chg}%</span>`)
    .join('<span class="sep"> • </span>');
  document.getElementById("ticker").innerHTML = items;
}

buildTicker();

const quotes = [
  ["N8N-FLOW", "142.50", "+2.30", "+1.64"],
  ["WHK-01", "88.12", "-0.55", "-0.62"],
  ["AUTO-BOT", "201.00", "+4.10", "+2.08"],
  ["GALAMO", "999.99", "+12.00", "+1.22"],
];

function renderQuotes() {
  const tbody = document.getElementById("quotesBody");
  tbody.innerHTML = quotes
    .map(([sym, last, chg, pct]) => {
      const dir = chg.startsWith("+") ? "up" : "down";
      return `<tr>
        <td>${sym}</td>
        <td>${last}</td>
        <td class="${dir}">${chg}</td>
        <td class="${dir}">${pct}</td>
      </tr>`;
    })
    .join("");
}

renderQuotes();

function addBlotterEntry(event, status, statusClass) {
  const time = new Date().toLocaleTimeString("en-US", { hour12: false });
  const li = document.createElement("li");
  li.className = "blotter-item";
  li.innerHTML = `
    <span>${time}</span>
    <span>${event}</span>
    <span class="${statusClass}">${status}</span>
  `;
  blotter.prepend(li);
}

function showBanner(type, message) {
  statusBanner.className = `status-banner ${type}`;
  statusBanner.textContent = message;
  statusBanner.classList.remove("hidden");
}

async function executeWebhook() {
  executeBtn.disabled = true;
  showBanner("pending", "Routing order to exchange…");
  addBlotterEntry("ORDER SENT", "PENDING", "ok");

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      throw new Error(data.message || `HTTP ${response.status}`);
    }

    const msg = data.message || "Workflow started";
    showBanner("success", `FILLED — ${msg}`);
    addBlotterEntry("WEBHOOK ACK", "FILLED", "ok");
  } catch (err) {
    showBanner("error", `REJECTED — ${err.message}`);
    addBlotterEntry("WEBHOOK FAIL", "REJECTED", "fail");
    console.error(err);
  } finally {
    executeBtn.disabled = false;
  }
}

executeBtn.addEventListener("click", executeWebhook);

addBlotterEntry("TERMINAL READY", "ONLINE", "ok");
