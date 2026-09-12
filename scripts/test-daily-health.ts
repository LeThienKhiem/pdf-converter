/** Dry-run the daily health alert against live data. */
import { alertDailyHealth } from "../lib/salesAlerts";
alertDailyHealth().then((r) => console.log("result:", JSON.stringify(r)));
