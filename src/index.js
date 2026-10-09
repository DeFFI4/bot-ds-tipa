require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Collection,
  ActivityType,
  Events
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { getOrCreateLogChannel } = require('./utils/logger');
const { LOG_CHANNEL_NAME } = require('./config');

const token = process.env.DISCORD_TOKEN;
if (!token || token === 'your_bot_token_here') {
  console.error('❌ Ошибка: Укажите действительный DISCORD_TOKEN в файле discord-bot/.env!');
  console.error('👉 Создайте файл .env на основе .env.example');
  process.exit(1);
}

// Инициализация Discord Client с необходимыми Intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // Требует включения "Server Members Intent" в Developer Portal
    GatewayIntentBits.GuildMessages
  ]
});

// HTTP-сервер для поддержания активности на Render.com (через UptimeRobot)
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    status: 'online',
    bot: client?.user?.tag || 'connecting',
    guilds: client?.guilds?.cache?.size || 0,
    uptime: Math.floor(process.uptime()) + 's',
    timestamp: new Date().toISOString()
  }));
});

server.listen(PORT, () => {
  console.log(`🌐 HTTP-сервер для Uptime-мониторинга запущен на порту ${PORT}`);
});

// Коллекция для хранения зарегистрированных команд
client.commands = new Collection();

/**
 * Рекурсивная загрузка модулей команд из папки commands
 */
const commandsPath = path.join(__dirname, 'commands');

function loadCommands(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });

  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      loadCommands(fullPath);
    } else if (file.name.endsWith('.js')) {
      try {
        const command = require(fullPath);
        if ('data' in command && 'execute' in command) {
          client.commands.set(command.data.name, command);
          console.log(`[Init] Загружена команда: /${command.data.name}`);
        } else {
          console.warn(`[Init] Пропущен файл ${file.name}: нет data или execute.`);
        }
      } catch (err) {
        console.error(`[Init] Ошибка при загрузке ${file.name}:`, err);
      }
    }
  }
}

loadCommands(commandsPath);

// Событие: готовность бота
client.once(Events.ClientReady, async (c) => {
  console.log(`\n=================================================`);
  console.log(`🚀 Lounge Bot успешно запущен!`);
  console.log(`🤖 Авторизован как: ${c.user.tag} (ID: ${c.user.id})`);
  console.log(`🏰 Обслуживает серверов: ${c.guilds.cache.size}`);
  console.log(`⚙️  Загружено команд: ${client.commands.size}`);
  console.log(`=================================================\n`);

  // Установка статуса активности
  c.user.setPresence({
    activities: [
      {
        name: 'Lounge Community | /rules',
        type: ActivityType.Watching
      }
    ],
    status: 'online'
  });

  // Автоматическая проверка и подготовка канала логов для всех доступных гильдий
  for (const guild of c.guilds.cache.values()) {
    try {
      const logChannel = await getOrCreateLogChannel(guild);
      if (logChannel) {
        console.log(`[Auto-Setup] Канал #${LOG_CHANNEL_NAME} готов на сервере "${guild.name}"`);
      }
    } catch (err) {
      console.warn(`[Auto-Setup] Не удалось проверить лог-канал для "${guild.name}":`, err.message);
    }
  }
});

// Событие: обработка слэш-команд
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.warn(`[Interaction] Команда /${interaction.commandName} не найдена в реестре.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`[Interaction] Ошибка при выполнении /${interaction.commandName}:`, error);

    const errorMessage = {
      content: '❌ Произошла непредвиденная ошибка при выполнении этой команды!',
      ephemeral: true
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage).catch(() => {});
    } else {
      await interaction.reply(errorMessage).catch(() => {});
    }
  }
});

// Безопасная обработка необработанных ошибок, чтобы бот не падал 24/7
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Anti-Crash] Необработанное отклонение Promise:', reason);
});

process.on('uncaughtException', (err, origin) => {
  console.error(`[Anti-Crash] Неперехваченное исключение: ${err.message} (${origin})`);
});

// Вход в Discord
client.login(token);
