/** Verify the Telegram alert pipe end-to-end with a clearly-marked test message. */
import { sendTelegramMessage } from "../lib/telegram";

async function main() {
  const ok = await sendTelegramMessage(
    [
      "🧪 <b>TEST — not a real order</b>",
      "",
      "This is what the first-sale alert will look like:",
      "",
      "🎉🎉 <b>FIRST PAYING CUSTOMER</b> 🎉🎉",
      "",
      "<b>Week Pass ($2, 7 days)</b>",
      "Amount: <b>$2.00</b>",
      "Customer: someone@example.com",
      "",
      "https://www.invoicetodata.com/admin",
    ].join("\n")
  );
  console.log(ok ? "✅ Telegram delivered" : "❌ Telegram failed (check TELEGRAM_BOT_TOKEN / CHAT_ID)");
}
main();
