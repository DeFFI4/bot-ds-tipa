require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');

/**
 * Рекурсивное чтение всех файлов команд
 */
function readCommandFiles(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });

  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      readCommandFiles(fullPath);
    } else if (file.name.endsWith('.js')) {
      const command = require(fullPath);
      if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
        console.log(`[Deploy] Загружена команда: /${command.data.name} (${path.relative(commandsPath, fullPath)})`);
      } else {
        console.warn(`[Deploy] Файл ${fullPath} пропущен: отсутствует свойство data или execute.`);
      }
    }
  }
}

readCommandFiles(commandsPath);

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId) {
  console.error('❌ Ошибка: В файле .env не указаны DISCORD_TOKEN или CLIENT_ID!');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log(`\n🚀 Начинается регистрация ${commands.length} слэш-команд...`);

    let route;
    if (guildId && guildId.trim() !== '' && guildId !== 'your_guild_id_here') {
      console.log(`🎯 Режим: Серверные команды (Guild: ${guildId}) — моментальное обновление.`);
      route = Routes.applicationGuildCommands(clientId, guildId);
    } else {
      console.log('🌐 Режим: Глобальные команды (Global) — распространение может занять до 1 часа.');
      route = Routes.applicationCommands(clientId);
    }

    const data = await rest.put(route, { body: commands });

    console.log(`✅ Успешно зарегистрировано ${data.length} слэш-команд в Discord API!\n`);
  } catch (error) {
    console.error('❌ Ошибка при регистрации команд:', error);
  }
})();
