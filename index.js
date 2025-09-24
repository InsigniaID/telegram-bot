import TelegramBot from "node-telegram-bot-api";
import ky from "ky";
import dotenv from "dotenv";

dotenv.config();

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const API_URL = "https://genai-bi.insignia.co.id/v1/chat-messages";

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const userQuery = msg.text;

  if (!userQuery) {
    bot.sendMessage(chatId, "Please type a query.");
    return;
  }

  // Kirim indikator typing ke user
  bot.sendChatAction(chatId, "typing");

  try {
    const response = await ky.post(API_URL, {
      headers: {
        Authorization: `Bearer ${process.env.GENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      json: {
        inputs: {},
        query: userQuery,
        response_mode: "streaming",
        conversation_id: "",
        user: String(chatId),
        files: [],
      },
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    let buffer = "";
    let finalThought = "";

    // loop baca SSE stream
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n");
      buffer = parts.pop(); // sisakan chunk incomplete

      for (const line of parts) {
        if (line.startsWith("data:")) {
          try {
            const data = JSON.parse(line.slice(5).trim());

            if (data.event === "agent_thought" && data.thought) {
              // overwrite, jadi yg terakhir akan tersimpan
              finalThought = data.thought;
            }
          } catch (e) {
            console.error("Parse error:", line);
          }
        }
      }

      // selama masih baca stream → keep typing
      bot.sendChatAction(chatId, "typing");
    }

    if (finalThought) {
      bot.sendMessage(chatId, finalThought);
    } else {
      bot.sendMessage(chatId, "⚠️ No final response received.");
    }
  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, "⚠️ Error processing your request.");
  }
});
